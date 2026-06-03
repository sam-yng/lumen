import type { Tables } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import { assertNoDatabaseError } from "@/server/services/errors";

export type TranscriptDetail = {
  transcript: Tables<"transcripts">;
  recording: Tables<"recordings"> | null;
  segments: Tables<"transcript_segments">[];
};

export async function getTranscriptById(
  ctx: ServiceContext,
  id: string,
): Promise<TranscriptDetail | null> {
  const { data: transcript, error: transcriptError } = await ctx.supabase
    .from<Tables<"transcripts">>("transcripts")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("id", id)
    .maybeSingle();
  assertNoDatabaseError(transcriptError, "Could not load transcript");
  if (!transcript) return null;

  const [recordingResult, segmentsResult] = await Promise.all([
    ctx.supabase
      .from<Tables<"recordings">>("recordings")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("id", transcript.recording_id)
      .maybeSingle(),
    ctx.supabase
      .from<Tables<"transcript_segments">>("transcript_segments")
      .select("*")
      .eq("transcript_id", transcript.id)
      .order("start_ms"),
  ]);
  assertNoDatabaseError(recordingResult.error, "Could not load recording");
  assertNoDatabaseError(segmentsResult.error, "Could not load segments");

  return {
    transcript,
    recording: recordingResult.data ?? null,
    segments: segmentsResult.data,
  };
}
