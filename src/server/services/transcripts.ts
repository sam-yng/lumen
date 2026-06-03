import { randomUUID } from "node:crypto";
import type { Tables } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import { assertFound, assertNoDatabaseError } from "@/server/services/errors";

type FileRow = Tables<"files">;
type RecordingRow = Tables<"recordings">;
type TranscriptRow = Tables<"transcripts">;
type SegmentRow = Tables<"transcript_segments">;

export type TranscriptSegmentInput = {
  startMs: number;
  endMs: number;
  text: string;
  speaker: string | null;
};

async function getOwnedRecording(ctx: ServiceContext, recordingId: string) {
  const { data, error } = await ctx.supabase
    .from<RecordingRow>("recordings")
    .select("*")
    .eq("id", recordingId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  assertNoDatabaseError(error, "Could not load recording");
  assertFound(data, "Recording not found.");
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

function orderedSegments(segments: TranscriptSegmentInput[]) {
  return [...segments].sort((a, b) => a.startMs - b.startMs);
}

export async function writeRecordingTranscript(
  ctx: ServiceContext,
  input: {
    recordingId: string;
    fullText: string;
    language: string | null;
    segments: TranscriptSegmentInput[];
  },
) {
  const recording = await getOwnedRecording(ctx, input.recordingId);

  await ctx.supabase
    .from<TranscriptRow>("transcripts")
    .delete()
    .eq("recording_id", recording.id)
    .eq("user_id", ctx.userId);

  const { data: transcript, error: transcriptError } = await ctx.supabase
    .from<TranscriptRow>("transcripts")
    .insert({
      id: randomUUID(),
      user_id: ctx.userId,
      recording_id: recording.id,
      full_text: input.fullText,
      language: input.language,
    })
    .select("*")
    .single();

  assertNoDatabaseError(transcriptError, "Could not create transcript");
  assertFound(transcript, "Transcript not found.");

  const segments = orderedSegments(input.segments);
  if (segments.length > 0) {
    const { error: segmentsError } = await ctx.supabase
      .from<SegmentRow>("transcript_segments")
      .insert(
        segments.map((segment) => ({
          id: randomUUID(),
          transcript_id: transcript.id,
          start_ms: segment.startMs,
          end_ms: segment.endMs,
          text: segment.text,
          speaker: segment.speaker,
        })),
      );

    assertNoDatabaseError(
      segmentsError,
      "Could not create transcript segments",
    );
  }

  const durationSec =
    segments.length > 0
      ? Math.ceil(Math.max(...segments.map((segment) => segment.endMs)) / 1000)
      : null;

  const { data: updatedRecording, error: recordingError } = await ctx.supabase
    .from<RecordingRow>("recordings")
    .update({ status: "done", duration_sec: durationSec, error: null })
    .eq("id", recording.id)
    .eq("user_id", ctx.userId)
    .select("*")
    .single();

  assertNoDatabaseError(recordingError, "Could not update recording");
  assertFound(updatedRecording, "Recording not found.");

  return { recording: updatedRecording, transcript };
}

export async function getTranscriptDetail(
  ctx: ServiceContext,
  input: { recordingId: string },
) {
  const recording = await getOwnedRecording(ctx, input.recordingId);
  const file = await getOwnedFile(ctx, recording.file_id);

  const { data: transcript, error: transcriptError } = await ctx.supabase
    .from<TranscriptRow>("transcripts")
    .select("*")
    .eq("recording_id", recording.id)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  assertNoDatabaseError(transcriptError, "Could not load transcript");

  if (!transcript) {
    return { recording, file, transcript: null, segments: [] as SegmentRow[] };
  }

  const { data: segments, error: segmentsError } = await ctx.supabase
    .from<SegmentRow>("transcript_segments")
    .select("*")
    .eq("transcript_id", transcript.id)
    .order("start_ms");

  assertNoDatabaseError(segmentsError, "Could not load transcript segments");

  return { recording, file, transcript, segments };
}
