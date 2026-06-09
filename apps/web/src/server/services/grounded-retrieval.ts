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
