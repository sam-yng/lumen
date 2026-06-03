import { mkdir, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Job } from "pg-boss";
import { getServerEnv } from "@/server/config/env";
import {
  createTranscriptionBoss,
  TRANSCRIPTION_QUEUE_NAME,
  type TranscriptionJobPayload,
  transcriptionJobPayloadSchema,
} from "@/server/queue/transcription-jobs";
import type { ServiceSupabaseClient } from "@/server/services/context";
import {
  type StorageProvider,
  SupabaseStorageProvider,
} from "@/server/services/storage-provider";
import { writeRecordingTranscript } from "@/server/services/transcripts";
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
  tempDir: string;
};

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
    const transcript = await deps.provider.transcribe(audioPath);

    await writeRecordingTranscript(
      {
        userId: payload.userId,
        supabase: deps.supabase,
      },
      {
        recordingId: payload.recordingId,
        fullText: transcript.fullText,
        language: transcript.language,
        segments: transcript.segments,
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

export async function startTranscriptionWorker() {
  const env = getServerEnv();
  const supabase = createWorkerSupabase();
  const boss = await createTranscriptionBoss(env.PG_BOSS_DATABASE_URL);
  const storage = new SupabaseStorageProvider(supabase.storage);
  const provider = new WhisperTranscriptionProvider({
    modelName: env.WHISPER_MODEL,
  });

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
