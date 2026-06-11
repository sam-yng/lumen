import { mkdir, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Job } from "pg-boss";
import { getServerEnv } from "@/server/config/env";
import {
  createTranscriptionBoss,
  SPEAKER_LABEL_QUEUE_NAME,
  type SpeakerLabelJobPayload,
  TRANSCRIPTION_QUEUE_NAME,
  type TranscriptionJobPayload,
  transcriptionJobPayloadSchema,
} from "@/server/queue/transcription-jobs";
import type { ServiceSupabaseClient } from "@/server/services/context";
import type { EmbeddingProvider } from "@/server/services/embedding-provider";
import {
  type StorageProvider,
  SupabaseStorageProvider,
} from "@/server/services/storage-provider";
import { writeRecordingTranscript } from "@/server/services/transcripts";
import type { DiarizationProvider, SpeakerTurn } from "./diarization-provider";
import { SherpaOnnxDiarizationProvider } from "./sherpa-diarization-provider";
import { processSpeakerLabelJob } from "./speaker-label-worker";
import { assignSpeakers } from "./speaker-merge";
import { createWorkerSupabase } from "./supabase";
import type { TranscriptionProvider } from "./transcription-provider";
import { WhisperTranscriptionProvider } from "./whisper-provider";

type WorkerJobPayload = TranscriptionJobPayload & {
  bucket?: string;
};

type WorkerFileRow = {
  id: string;
  user_id: string;
  name: string;
  storage_key: string;
};

export type WorkerSupabaseClient = ServiceSupabaseClient & {
  storage?: unknown;
};

export type ProcessTranscriptionJobDeps = {
  bucket: string;
  supabase: WorkerSupabaseClient;
  storage: StorageProvider;
  provider: TranscriptionProvider;
  diarization?: DiarizationProvider;
  embeddingProvider?: EmbeddingProvider;
  tempDir: string;
};

// Diarization degrades, never fails: any error yields no turns and the
// transcription job still completes with null speakers.
async function diarizeSafe(
  audioPath: string,
  diarization: DiarizationProvider | undefined,
): Promise<SpeakerTurn[]> {
  if (!diarization) return [];

  try {
    return await diarization.diarize(audioPath);
  } catch (error) {
    console.error(
      `Diarization failed; keeping null speakers: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return [];
  }
}

async function markRecordingProcessing(
  supabase: ServiceSupabaseClient,
  userId: string,
  recordingId: string,
) {
  const { error } = await supabase
    .from("recordings")
    .update({ status: "processing", error: null })
    .eq("id", recordingId)
    .eq("user_id", userId);

  if (error)
    throw new Error(`Could not mark recording processing: ${error.message}`);
}

async function markRecordingFailed(
  supabase: ServiceSupabaseClient,
  userId: string,
  recordingId: string,
  errorMessage: string,
) {
  const { error } = await supabase
    .from("recordings")
    .update({ status: "failed", error: errorMessage })
    .eq("id", recordingId)
    .eq("user_id", userId);

  if (error)
    throw new Error(`Could not mark recording failed: ${error.message}`);
}

async function getJobFile(
  supabase: ServiceSupabaseClient,
  payload: TranscriptionJobPayload,
) {
  const { data, error } = await supabase
    .from<WorkerFileRow>("files")
    .select("*")
    .eq("id", payload.fileId)
    .eq("user_id", payload.userId)
    .maybeSingle();

  if (error) throw new Error(`Could not load file: ${error.message}`);
  if (!data) throw new Error("File not found.");
  if (data.storage_key !== payload.storageKey) {
    throw new Error("Job storage key does not match file.");
  }

  return data;
}

function localAudioPath(
  tempDir: string,
  recordingId: string,
  fileName: string,
) {
  const extension = extname(fileName);
  return join(tempDir, `${recordingId}${extension}`);
}

export async function processTranscriptionJob(
  job: Pick<Job<WorkerJobPayload>, "id" | "name" | "data">,
  deps: ProcessTranscriptionJobDeps,
) {
  const payload = transcriptionJobPayloadSchema.parse(job.data);
  const bucket = job.data.bucket ?? deps.bucket;
  const file = await getJobFile(deps.supabase, payload);
  const audioPath = localAudioPath(
    deps.tempDir,
    payload.recordingId,
    file.name,
  );

  await mkdir(deps.tempDir, { recursive: true });

  try {
    await markRecordingProcessing(
      deps.supabase,
      payload.userId,
      payload.recordingId,
    );

    const downloaded = await deps.storage.download?.({
      bucket,
      key: payload.storageKey,
    });

    if (!downloaded) throw new Error("Storage provider cannot download files.");

    await writeFile(audioPath, downloaded.bytes);
    // Diarize first: the Whisper provider deletes its WAV input when it
    // finishes, so the audio may not exist after transcription.
    const turns = await diarizeSafe(audioPath, deps.diarization);
    const transcript = await deps.provider.transcribe(audioPath);
    const segments =
      turns.length > 0
        ? assignSpeakers(transcript.segments, turns)
        : transcript.segments;

    await writeRecordingTranscript(
      {
        userId: payload.userId,
        supabase: deps.supabase,
      },
      {
        recordingId: payload.recordingId,
        fullText: transcript.fullText,
        language: transcript.language,
        segments,
        embeddingProvider: deps.embeddingProvider,
      },
    );

    return { recordingId: payload.recordingId };
  } catch (error) {
    await markRecordingFailed(
      deps.supabase,
      payload.userId,
      payload.recordingId,
      error instanceof Error ? error.message : "Unknown transcription error.",
    );
    throw error;
  } finally {
    await rm(audioPath, { force: true });
  }
}

type DiarizationEnv = {
  DIARIZATION_ENABLED: boolean;
  DIARIZATION_SEGMENTATION_MODEL_PATH?: string;
  DIARIZATION_EMBEDDING_MODEL_PATH?: string;
  DIARIZATION_CLUSTER_THRESHOLD: number;
  DIARIZATION_NUM_SPEAKERS: number;
};

export function createDiarizationProvider(
  env: DiarizationEnv,
): DiarizationProvider | undefined {
  if (!env.DIARIZATION_ENABLED) return undefined;

  if (
    !env.DIARIZATION_SEGMENTATION_MODEL_PATH ||
    !env.DIARIZATION_EMBEDDING_MODEL_PATH
  ) {
    console.error(
      "DIARIZATION_ENABLED is true but model paths are missing; speakers will stay null. Set DIARIZATION_SEGMENTATION_MODEL_PATH and DIARIZATION_EMBEDDING_MODEL_PATH (see scripts/fetch-diarization-models.ts).",
    );
    return undefined;
  }

  return new SherpaOnnxDiarizationProvider({
    segmentationModelPath: env.DIARIZATION_SEGMENTATION_MODEL_PATH,
    embeddingModelPath: env.DIARIZATION_EMBEDDING_MODEL_PATH,
    clusterThreshold: env.DIARIZATION_CLUSTER_THRESHOLD,
    numSpeakers: env.DIARIZATION_NUM_SPEAKERS,
  });
}

export async function startTranscriptionWorker() {
  const env = getServerEnv();
  const supabase = createWorkerSupabase();
  const boss = await createTranscriptionBoss(env.PG_BOSS_DATABASE_URL);
  const storage = new SupabaseStorageProvider(supabase.storage);
  const provider = new WhisperTranscriptionProvider({
    modelName: env.WHISPER_MODEL,
  });
  const diarization = createDiarizationProvider(env);

  await boss.work<WorkerJobPayload>(
    TRANSCRIPTION_QUEUE_NAME,
    { batchSize: 1, pollingIntervalSeconds: 2 },
    async ([job]) => {
      if (!job) return undefined;
      return processTranscriptionJob(job, {
        bucket: env.TRANSCRIPTION_STORAGE_BUCKET,
        supabase: supabase as unknown as WorkerSupabaseClient,
        storage,
        provider,
        diarization,
        tempDir: env.TRANSCRIPTION_TMP_DIR,
      });
    },
  );

  // Post-finalize speaker labeling for live sessions (v4 m4).
  await boss.work<SpeakerLabelJobPayload & { bucket?: string }>(
    SPEAKER_LABEL_QUEUE_NAME,
    { batchSize: 1, pollingIntervalSeconds: 2 },
    async ([job]) => {
      if (!job) return undefined;
      return processSpeakerLabelJob(job, {
        bucket: env.TRANSCRIPTION_STORAGE_BUCKET,
        supabase: supabase as unknown as WorkerSupabaseClient,
        storage,
        diarization,
        tempDir: env.TRANSCRIPTION_TMP_DIR,
      });
    },
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  startTranscriptionWorker().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
