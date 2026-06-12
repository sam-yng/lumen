import type { Tables } from "@/server/db/database.types";
import type { ServiceSupabaseClient } from "@/server/services/context";
import {
  type TranscriptSegmentInput,
  writeRecordingTranscript,
} from "@/server/services/transcripts";

type RecordingRow = Tables<"recordings">;
type TranscriptRow = Tables<"transcripts">;
type SegmentRow = Tables<"transcript_segments">;

export const STALE_LIVE_EXPIRED_ERROR =
  "Live session was interrupted before any transcript was captured.";

export type StaleLiveSweepDeps = {
  supabase: ServiceSupabaseClient;
  staleAfterMinutes: number;
  now?: () => Date;
};

export type StaleLiveSweepResult = {
  checked: number;
  finalized: number;
  expired: number;
};

function parseTimestamp(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid timestamp: ${value}`);
  }
  return parsed;
}

/**
 * A live session is stale when nothing has happened for the threshold:
 * segments are appended incrementally, so the newest segment's created_at is
 * the last activity; a session that never produced one falls back to the
 * recording's creation time.
 */
export function isStaleLiveSession(input: {
  recordingCreatedAt: string;
  newestSegmentCreatedAt: string | null;
  now: Date;
  staleAfterMinutes: number;
}): boolean {
  const lastActivityAt = Math.max(
    parseTimestamp(input.recordingCreatedAt),
    input.newestSegmentCreatedAt
      ? parseTimestamp(input.newestSegmentCreatedAt)
      : Number.NEGATIVE_INFINITY,
  );

  return (
    input.now.getTime() - lastActivityAt > input.staleAfterMinutes * 60_000
  );
}

async function sweepOne(
  supabase: ServiceSupabaseClient,
  recording: RecordingRow,
  now: Date,
  staleAfterMinutes: number,
): Promise<"fresh" | "finalized" | "expired"> {
  const { data: transcript, error: transcriptError } = await supabase
    .from<TranscriptRow>("transcripts")
    .select("*")
    .eq("recording_id", recording.id)
    .eq("user_id", recording.user_id)
    .maybeSingle();

  if (transcriptError) {
    throw new Error(`Could not load transcript: ${transcriptError.message}`);
  }

  // transcript_segments has no user_id column: ownership is established by
  // the user-scoped transcript load above (service-role caveat —
  // docs/SECURITY.md).
  let segments: SegmentRow[] = [];
  if (transcript) {
    const { data, error } = await supabase
      .from<SegmentRow>("transcript_segments")
      .select("*")
      .eq("transcript_id", transcript.id)
      .order("start_ms");

    if (error) throw new Error(`Could not load segments: ${error.message}`);
    segments = data ?? [];
  }

  const newestSegmentCreatedAt = segments.reduce<string | null>(
    (newest, segment) =>
      newest === null || segment.created_at > newest
        ? segment.created_at
        : newest,
    null,
  );

  const stale = isStaleLiveSession({
    recordingCreatedAt: recording.created_at,
    newestSegmentCreatedAt,
    now,
    staleAfterMinutes,
  });

  if (!stale) return "fresh";

  if (segments.length === 0) {
    const { error } = await supabase
      .from<RecordingRow>("recordings")
      .update({ status: "failed", error: STALE_LIVE_EXPIRED_ERROR })
      .eq("id", recording.id)
      .eq("user_id", recording.user_id);

    if (error) {
      throw new Error(`Could not expire recording: ${error.message}`);
    }
    return "expired";
  }

  const segmentInputs: TranscriptSegmentInput[] = segments.map((segment) => ({
    startMs: segment.start_ms,
    endMs: segment.end_ms,
    text: segment.text,
    speaker: segment.speaker,
  }));

  // Same shape as the live finalize route: no embedding provider (semantic
  // indexing is provider-gated everywhere; FTS over full_text is automatic).
  await writeRecordingTranscript(
    { userId: recording.user_id, supabase },
    {
      recordingId: recording.id,
      fullText: segmentInputs.map((segment) => segment.text).join(" "),
      language: null,
      segments: segmentInputs,
    },
  );

  return "finalized";
}

/**
 * Stale live-session sweep (v4 m5): finalize abandoned live recordings from
 * their already-stored segments, or expire segmentless husks.
 *
 * Runs service-role across all users — the status='live' scan is the one
 * intentionally cross-user read; every subsequent query is scoped by the
 * owning row's user_id. Per-recording errors are contained so one bad row
 * never blocks the rest of the sweep (degrade-never-fail).
 */
export async function sweepStaleLiveSessions(
  deps: StaleLiveSweepDeps,
): Promise<StaleLiveSweepResult> {
  const now = deps.now?.() ?? new Date();

  const { data: liveRecordings, error } = await deps.supabase
    .from<RecordingRow>("recordings")
    .select("*")
    .eq("status", "live");

  if (error) {
    throw new Error(`Could not list live recordings: ${error.message}`);
  }

  const result: StaleLiveSweepResult = {
    checked: liveRecordings?.length ?? 0,
    finalized: 0,
    expired: 0,
  };

  for (const recording of liveRecordings ?? []) {
    try {
      const outcome = await sweepOne(
        deps.supabase,
        recording,
        now,
        deps.staleAfterMinutes,
      );
      if (outcome === "finalized") result.finalized += 1;
      if (outcome === "expired") result.expired += 1;
    } catch (sweepError) {
      console.error(
        `Stale live sweep failed for recording ${recording.id}: ${
          sweepError instanceof Error ? sweepError.message : String(sweepError)
        }`,
      );
    }
  }

  return result;
}
