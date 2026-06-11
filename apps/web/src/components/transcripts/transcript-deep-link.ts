import type { Tables } from "@/server/db/database.types";

type SegmentRow = Tables<"transcript_segments">;

/** Citation deep link: ?segment=<id> targets a cited segment; ?t=<ms> is the
 * timestamp fallback when no segment was resolved. Neither -> open at top. */
export type TranscriptDeepLink = {
  segmentId: string | null;
  tMs: number | null;
};

/**
 * Resolve a citation deep link to the millisecond position to open at.
 * A known segment id wins (its exact start); otherwise the raw timestamp;
 * otherwise null — open at the top, nothing to seek.
 */
export function resolveDeepLinkMs(
  deepLink: TranscriptDeepLink,
  segments: Pick<SegmentRow, "id" | "start_ms">[],
): number | null {
  if (deepLink.segmentId !== null) {
    const segment = segments.find((row) => row.id === deepLink.segmentId);
    if (segment) return segment.start_ms;
  }
  return deepLink.tMs;
}
