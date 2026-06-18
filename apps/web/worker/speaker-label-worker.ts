import { mkdir, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { Job } from "pg-boss";
import {
  type SpeakerLabelJobPayload,
  speakerLabelJobPayloadSchema,
} from "@/server/queue/transcription-jobs";
import type { ServiceSupabaseClient } from "@/server/services/context";
import type { StorageProvider } from "@/server/services/storage-provider";
import { convertToDiarizationWav, type FfmpegRunner } from "./audio-convert";
import type { DiarizationProvider } from "./diarization-provider";
import { assignSpeakers } from "./speaker-merge";

type SpeakerLabelJobData = SpeakerLabelJobPayload & {
  bucket?: string;
};

type SegmentRow = {
  id: string;
  transcript_id: string;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker: string | null;
};

export type ProcessSpeakerLabelJobDeps = {
  bucket: string;
  supabase: ServiceSupabaseClient;
  storage: StorageProvider;
  diarization?: DiarizationProvider;
  tempDir: string;
  convertToWav?: FfmpegRunner;
};

async function getJobAudioNode(
  supabase: ServiceSupabaseClient,
  payload: SpeakerLabelJobPayload,
) {
  const { data, error } = await supabase
    .from<{
      id: string;
      user_id: string;
      title: string;
      kind: string;
      storage_key: string;
    }>("library_nodes")
    .select("*")
    .eq("id", payload.nodeId)
    .eq("user_id", payload.userId)
    .maybeSingle();

  if (error) throw new Error(`Could not load audio node: ${error.message}`);
  if (!data || data.kind !== "audio") throw new Error("Audio node not found.");
  if (data.storage_key !== payload.storageKey) {
    throw new Error("Job storage key does not match audio node.");
  }

  return data;
}

// transcript_segments has no user_id column: ownership is established here,
// by loading the transcript user-scoped, before any segment is touched
// (service-role caveat — docs/SECURITY.md).
async function getOwnedTranscript(
  supabase: ServiceSupabaseClient,
  payload: SpeakerLabelJobPayload,
) {
  const { data, error } = await supabase
    .from<{ id: string; user_id: string; recording_id: string }>("transcripts")
    .select("*")
    .eq("recording_id", payload.recordingId)
    .eq("user_id", payload.userId)
    .maybeSingle();

  if (error) throw new Error(`Could not load transcript: ${error.message}`);
  if (!data) throw new Error("Transcript not found.");
  return data;
}

/**
 * Post-finalize speaker labeling for live sessions (v4 m4).
 *
 * Downloads the finalized session audio, converts it to WAV (live capture is
 * webm; sherpa-onnx reads WAV only), diarizes with the batch provider, and
 * updates the existing segments' speaker column. The recording is already
 * `done` and is never touched: any failure here leaves the transcript exactly
 * as finalize wrote it, and pg-boss retries transient errors.
 */
export async function processSpeakerLabelJob(
  job: Pick<Job<SpeakerLabelJobData>, "id" | "name" | "data">,
  deps: ProcessSpeakerLabelJobDeps,
) {
  const payload = speakerLabelJobPayloadSchema.parse(job.data);

  if (!deps.diarization) {
    console.error(
      "Speaker labeling job received but no diarization provider is configured; leaving null speakers.",
    );
    return { recordingId: payload.recordingId, labeled: 0 };
  }

  const bucket = job.data.bucket ?? deps.bucket;
  const node = await getJobAudioNode(deps.supabase, payload);
  const transcript = await getOwnedTranscript(deps.supabase, payload);

  const { data: segments, error: segmentsError } = await deps.supabase
    .from<SegmentRow>("transcript_segments")
    .select("*")
    .eq("transcript_id", transcript.id)
    .order("start_ms");

  if (segmentsError) {
    throw new Error(`Could not load segments: ${segmentsError.message}`);
  }
  if (!segments || segments.length === 0) {
    return { recordingId: payload.recordingId, labeled: 0 };
  }

  const extension = extname(node.title) || ".webm";
  const audioPath = join(
    deps.tempDir,
    `${payload.recordingId}-label${extension}`,
  );
  const wavPath = join(deps.tempDir, `${payload.recordingId}-label.wav`);

  await mkdir(deps.tempDir, { recursive: true });

  try {
    const downloaded = await deps.storage.download?.({
      bucket,
      key: payload.storageKey,
    });

    if (!downloaded) throw new Error("Storage provider cannot download audio.");

    await writeFile(audioPath, downloaded.bytes);

    if (audioPath !== wavPath) {
      await convertToDiarizationWav(audioPath, wavPath, deps.convertToWav);
    }

    const turns = await deps.diarization.diarize(wavPath);
    if (turns.length === 0) {
      return { recordingId: payload.recordingId, labeled: 0 };
    }

    const labeled = assignSpeakers(
      segments.map((segment) => ({
        startMs: segment.start_ms,
        endMs: segment.end_ms,
        text: segment.text,
        speaker: segment.speaker,
      })),
      turns,
    );

    let updated = 0;
    for (const [index, segment] of segments.entries()) {
      const speaker = labeled[index]?.speaker ?? null;
      if (speaker === segment.speaker) continue;

      const { error } = await deps.supabase
        .from<SegmentRow>("transcript_segments")
        .update({ speaker })
        .eq("id", segment.id)
        .eq("transcript_id", transcript.id);

      if (error) {
        throw new Error(`Could not update segment speaker: ${error.message}`);
      }
      updated += 1;
    }

    return { recordingId: payload.recordingId, labeled: updated };
  } finally {
    await rm(audioPath, { force: true });
    await rm(wavPath, { force: true });
  }
}
