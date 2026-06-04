export const MAX_CHUNK_CHARS = 900;
export const CHUNK_OVERLAP_CHARS = 150;

export type DocumentChunkInput = {
  documentId: string;
  text: string | null;
};

export type TranscriptSegmentChunkInput = {
  transcriptId: string;
  recordingId: string;
  startMs: number;
  endMs: number;
  text: string;
};

export type SearchChunk =
  | {
      sourceType: "document";
      documentId: string;
      transcriptId: null;
      recordingId: null;
      startMs: null;
      endMs: null;
      chunkIndex: number;
      content: string;
    }
  | {
      sourceType: "transcript";
      documentId: null;
      transcriptId: string;
      recordingId: string;
      startMs: number;
      endMs: number;
      chunkIndex: number;
      content: string;
    };

function normalizeText(text: string | null) {
  return text?.replace(/\s+/g, " ").trim() ?? "";
}

function findChunkEnd(text: string, start: number) {
  const hardEnd = Math.min(start + MAX_CHUNK_CHARS, text.length);

  if (hardEnd === text.length) {
    return hardEnd;
  }

  const whitespaceEnd = text.lastIndexOf(" ", hardEnd);
  const minimumUsefulEnd = start + Math.floor(MAX_CHUNK_CHARS * 0.75);

  if (whitespaceEnd > minimumUsefulEnd) {
    return whitespaceEnd;
  }

  return hardEnd;
}

function findNextChunkStart(
  text: string,
  currentStart: number,
  currentEnd: number,
) {
  const targetStart = Math.max(
    currentStart + 1,
    currentEnd - CHUNK_OVERLAP_CHARS,
  );
  const whitespaceStart = text.lastIndexOf(" ", targetStart);

  if (whitespaceStart > currentStart) {
    return whitespaceStart + 1;
  }

  return targetStart;
}

function splitText(text: string) {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = findChunkEnd(text, start);
    const content = text.slice(start, end).trim();

    if (content.length > 0) {
      chunks.push(content);
    }

    if (end >= text.length) {
      break;
    }

    start = findNextChunkStart(text, start, end);
  }

  return chunks;
}

export function chunkDocument(input: DocumentChunkInput): SearchChunk[] {
  return splitText(normalizeText(input.text)).map((content, chunkIndex) => ({
    sourceType: "document",
    documentId: input.documentId,
    transcriptId: null,
    recordingId: null,
    startMs: null,
    endMs: null,
    chunkIndex,
    content,
  }));
}

export function chunkTranscript(
  input: TranscriptSegmentChunkInput[],
): SearchChunk[] {
  const chunks: SearchChunk[] = [];
  const orderedSegments = input
    .map((segment) => ({
      ...segment,
      text: normalizeText(segment.text),
    }))
    .filter((segment) => segment.text.length > 0)
    .sort(
      (left, right) =>
        left.startMs - right.startMs ||
        left.endMs - right.endMs ||
        left.text.localeCompare(right.text),
    );

  let currentSegments: typeof orderedSegments = [];
  let currentLength = 0;

  function flushCurrentSegments() {
    if (currentSegments.length === 0) {
      return;
    }

    const firstSegment = currentSegments[0];
    const lastSegment = currentSegments[currentSegments.length - 1];

    if (!(firstSegment && lastSegment)) {
      return;
    }

    chunks.push({
      sourceType: "transcript",
      documentId: null,
      transcriptId: firstSegment.transcriptId,
      recordingId: firstSegment.recordingId,
      startMs: firstSegment.startMs,
      endMs: lastSegment.endMs,
      chunkIndex: chunks.length,
      content: currentSegments.map((segment) => segment.text).join(" "),
    });

    currentSegments = [];
    currentLength = 0;
  }

  for (const segment of orderedSegments) {
    const nextLength =
      currentLength === 0
        ? segment.text.length
        : currentLength + 1 + segment.text.length;

    if (currentSegments.length > 0 && nextLength > MAX_CHUNK_CHARS) {
      flushCurrentSegments();
    }

    currentSegments.push(segment);
    currentLength =
      currentLength === 0
        ? segment.text.length
        : currentLength + 1 + segment.text.length;
  }

  flushCurrentSegments();

  return chunks;
}
