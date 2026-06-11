import { randomUUID } from "node:crypto";
import type { Tables } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import type { EmbeddingProvider } from "@/server/services/embedding-provider";
import {
  assertFound,
  assertNoDatabaseError,
  ServiceError,
} from "@/server/services/errors";
import {
  type StorageProvider,
  storageKeyForUpload,
} from "@/server/services/storage-provider";
import {
  type TranscriptSegmentInput,
  writeRecordingTranscript,
} from "@/server/services/transcripts";

type FileRow = Tables<"files">;
type FolderRow = Tables<"folders">;
type RecordingRow = Tables<"recordings">;
type TranscriptRow = Tables<"transcripts">;
type SegmentRow = Tables<"transcript_segments">;

export type LiveSegmentInput = {
  startMs: number;
  endMs: number;
  text: string;
};

async function assertFolderOwned(ctx: ServiceContext, folderId: string | null) {
  if (folderId === null) return;

  const { data, error } = await ctx.supabase
    .from<FolderRow>("folders")
    .select("*")
    .eq("id", folderId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  assertNoDatabaseError(error, "Could not load folder");
  assertFound(data, "Folder not found.");
}

async function getOwnedLiveRecording(ctx: ServiceContext, recordingId: string) {
  const { data, error } = await ctx.supabase
    .from<RecordingRow>("recordings")
    .select("*")
    .eq("id", recordingId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  assertNoDatabaseError(error, "Could not load recording");
  assertFound(data, "Recording not found.");

  if (data.status !== "live") {
    throw new ServiceError("conflict", "Live session is not open.");
  }

  return data;
}

async function getOwnedFile(ctx: ServiceContext, fileId: string) {
  const { data, error } = await ctx.supabase
    .from<FileRow>("files")
    .select("*")
    .eq("id", fileId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  assertNoDatabaseError(error, "Could not load file");
  assertFound(data, "File not found.");
  return data;
}

async function getRecordingTranscript(
  ctx: ServiceContext,
  recordingId: string,
) {
  const { data, error } = await ctx.supabase
    .from<TranscriptRow>("transcripts")
    .select("*")
    .eq("recording_id", recordingId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  assertNoDatabaseError(error, "Could not load transcript");
  assertFound(data, "Transcript not found.");
  return data;
}

export async function startLiveSession(
  ctx: ServiceContext,
  input: { name: string; folderId: string | null },
) {
  const name = input.name.trim();
  if (name.length === 0) {
    throw new ServiceError("invalid_input", "Session name is required.");
  }

  await assertFolderOwned(ctx, input.folderId);

  const fileId = randomUUID();
  const storageKey = storageKeyForUpload(ctx.userId, name, fileId);

  const { data: file, error: fileError } = await ctx.supabase
    .from<FileRow>("files")
    .insert({
      id: fileId,
      user_id: ctx.userId,
      folder_id: input.folderId,
      name,
      mime_type: "audio/webm",
      size_bytes: 0,
      kind: "audio",
      storage_key: storageKey,
    })
    .select("*")
    .single();

  assertNoDatabaseError(fileError, "Could not create file");
  assertFound(file, "File not found.");

  const { data: recording, error: recordingError } = await ctx.supabase
    .from<RecordingRow>("recordings")
    .insert({
      id: randomUUID(),
      user_id: ctx.userId,
      file_id: file.id,
      status: "live",
      duration_sec: null,
      error: null,
    })
    .select("*")
    .single();

  assertNoDatabaseError(recordingError, "Could not create recording");
  assertFound(recording, "Recording not found.");

  const { data: transcript, error: transcriptError } = await ctx.supabase
    .from<TranscriptRow>("transcripts")
    .insert({
      id: randomUUID(),
      user_id: ctx.userId,
      recording_id: recording.id,
      full_text: "",
      language: null,
    })
    .select("*")
    .single();

  assertNoDatabaseError(transcriptError, "Could not create transcript");
  assertFound(transcript, "Transcript not found.");

  return { file, recording, transcript };
}

export async function appendLiveSegments(
  ctx: ServiceContext,
  input: { recordingId: string; segments: LiveSegmentInput[] },
) {
  const recording = await getOwnedLiveRecording(ctx, input.recordingId);
  const transcript = await getRecordingTranscript(ctx, recording.id);

  const segments = input.segments.filter(
    (segment) => segment.text.trim().length > 0,
  );

  for (const segment of segments) {
    if (segment.startMs < 0 || segment.endMs < segment.startMs) {
      throw new ServiceError("invalid_input", "Segment times are invalid.");
    }
  }

  if (segments.length === 0) return { inserted: 0 };

  const { error } = await ctx.supabase
    .from<SegmentRow>("transcript_segments")
    .insert(
      segments.map((segment) => ({
        id: randomUUID(),
        transcript_id: transcript.id,
        start_ms: Math.round(segment.startMs),
        end_ms: Math.round(segment.endMs),
        text: segment.text.trim(),
        // Diarization is batch-only in v3 (m3); the live path never labels speakers.
        speaker: null,
      })),
    );

  assertNoDatabaseError(error, "Could not append live segments");
  return { inserted: segments.length };
}

export async function finalizeLiveSession(
  ctx: ServiceContext,
  input: {
    recordingId: string;
    audio: { bytes: Uint8Array; contentType: string };
    language: string | null;
    bucket: string;
    storage: StorageProvider;
    embeddingProvider?: EmbeddingProvider;
  },
) {
  const recording = await getOwnedLiveRecording(ctx, input.recordingId);
  const file = await getOwnedFile(ctx, recording.file_id);

  try {
    if (input.audio.bytes.byteLength === 0) {
      throw new ServiceError("invalid_input", "Session audio is empty.");
    }

    await input.storage.upload({
      bucket: input.bucket,
      key: file.storage_key,
      bytes: input.audio.bytes,
      contentType: input.audio.contentType,
    });

    const { error: fileError } = await ctx.supabase
      .from<FileRow>("files")
      .update({
        size_bytes: input.audio.bytes.byteLength,
        mime_type: input.audio.contentType,
      })
      .eq("id", file.id)
      .eq("user_id", ctx.userId)
      .select("*")
      .single();

    assertNoDatabaseError(fileError, "Could not update file");

    const transcript = await getRecordingTranscript(ctx, recording.id);
    const { data: segments, error: segmentsError } = await ctx.supabase
      .from<SegmentRow>("transcript_segments")
      .select("*")
      .eq("transcript_id", transcript.id)
      .order("start_ms");

    assertNoDatabaseError(segmentsError, "Could not load live segments");

    const segmentInputs: TranscriptSegmentInput[] = segments.map((segment) => ({
      startMs: segment.start_ms,
      endMs: segment.end_ms,
      text: segment.text,
      speaker: segment.speaker,
    }));

    const written = await writeRecordingTranscript(ctx, {
      recordingId: recording.id,
      fullText: segmentInputs.map((segment) => segment.text).join(" "),
      language: input.language,
      segments: segmentInputs,
      embeddingProvider: input.embeddingProvider,
    });

    // The file row lets callers enqueue follow-up jobs (e.g. v4 speaker
    // labeling) without re-querying for the uploaded audio's storage key.
    return { ...written, file };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown live session error.";

    await ctx.supabase
      .from<RecordingRow>("recordings")
      .update({ status: "failed", error: message })
      .eq("id", recording.id)
      .eq("user_id", ctx.userId)
      .select("*")
      .single();

    throw error;
  }
}

export async function cancelLiveSession(
  ctx: ServiceContext,
  input: { recordingId: string },
) {
  const recording = await getOwnedLiveRecording(ctx, input.recordingId);
  const file = await getOwnedFile(ctx, recording.file_id);

  // Deleting the file row cascades the recording, transcript, and segments.
  // No storage object exists yet: audio is only uploaded at finalization.
  const { error } = await ctx.supabase
    .from<FileRow>("files")
    .delete()
    .eq("id", file.id)
    .eq("user_id", ctx.userId)
    .single();

  assertNoDatabaseError(error, "Could not delete live session file");
  return { deleted: true };
}
