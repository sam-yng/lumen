import type {
  GroundedSource,
  GroundedTranscriptSource,
} from "@/server/services/grounded-retrieval";

export type CitationPart =
  | { kind: "text"; text: string; start: number }
  | { kind: "citation"; label: string; start: number };

const CITATION_PATTERN = /\[(S\d+)\]/g;

/**
 * Split assistant text into plain runs and [S#] citation labels. Each part
 * carries its character offset in the source text — a stable identity for
 * React keys.
 */
export function splitCitations(text: string): CitationPart[] {
  const parts: CitationPart[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(CITATION_PATTERN)) {
    if (match.index > lastIndex) {
      parts.push({
        kind: "text",
        text: text.slice(lastIndex, match.index),
        start: lastIndex,
      });
    }
    parts.push({ kind: "citation", label: match[1] ?? "", start: match.index });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ kind: "text", text: text.slice(lastIndex), start: lastIndex });
  }
  return parts;
}

export function isTranscriptSource(
  source: GroundedSource["source"],
): source is GroundedTranscriptSource {
  return "transcriptId" in source;
}

/**
 * Where a citation clicks through to.
 * - Documents open the note.
 * - Transcripts deep-link the viewer: ?segment=<id> when the cited segment is
 *   known, else ?t=<startMs> for a timestamp-only span, else the plain
 *   transcript page (null timing opens at the top).
 */
export function citationHref(source: GroundedSource): string {
  if (!isTranscriptSource(source.source)) {
    return `/library/notes/${source.source.documentId}`;
  }
  const transcript = source.source;
  const base = `/library/transcripts/${transcript.recordingId}`;
  if (transcript.segmentId !== null) {
    return `${base}?segment=${transcript.segmentId}`;
  }
  if (transcript.startMs !== null) return `${base}?t=${transcript.startMs}`;
  return base;
}

export function formatTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
