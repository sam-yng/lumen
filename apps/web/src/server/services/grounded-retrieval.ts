export type GroundedDocumentSource = {
  documentId: string;
};

export type GroundedTranscriptSource = {
  transcriptId: string;
  recordingId: string;
  segmentId: string | null;
  startMs: number | null;
  endMs: number | null;
};

export type GroundedSource = {
  citationId: string;
  kind: "document" | "transcript";
  title: string;
  snippet: string;
  score: number | null;
  source: GroundedDocumentSource | GroundedTranscriptSource;
};

export type SearchNotesToolResult = {
  query: string;
  sources: GroundedSource[];
};

/** A ranked source before its stable citation label is assigned. */
export type GroundedCandidate = Omit<GroundedSource, "citationId">;

/** Assign deterministic S1..Sn labels to already-ranked candidates. */
export function assignCitationLabels(
  candidates: GroundedCandidate[],
): GroundedSource[] {
  return candidates.map((candidate, index) => ({
    citationId: `S${index + 1}`,
    ...candidate,
  }));
}

export type SegmentOverlapInput = {
  id: string;
  startMs: number;
  endMs: number;
};

/**
 * Pick the transcript segment that best covers a chunk's [startMs, endMs] span.
 * Overlap predicate: segment.startMs <= chunk.endMs && segment.endMs >= chunk.startMs.
 * Ranking: largest overlap; ties broken by earliest startMs. No overlap -> null.
 */
export function chooseBestTranscriptSegment(
  chunk: { startMs: number; endMs: number },
  segments: SegmentOverlapInput[],
): string | null {
  let best: { id: string; overlap: number; startMs: number } | null = null;

  for (const segment of segments) {
    if (segment.startMs > chunk.endMs || segment.endMs < chunk.startMs) {
      continue;
    }
    const overlap =
      Math.min(chunk.endMs, segment.endMs) -
      Math.max(chunk.startMs, segment.startMs);

    if (
      best === null ||
      overlap > best.overlap ||
      (overlap === best.overlap && segment.startMs < best.startMs)
    ) {
      best = { id: segment.id, overlap, startMs: segment.startMs };
    }
  }

  return best?.id ?? null;
}
