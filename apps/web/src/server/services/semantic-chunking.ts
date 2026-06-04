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

const OVERLAP_WHITESPACE_TOLERANCE_CHARS = 30;

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
  const whitespaceDistance = targetStart - whitespaceStart;

  if (
    whitespaceStart > currentStart &&
    whitespaceDistance <= OVERLAP_WHITESPACE_TOLERANCE_CHARS
  ) {
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
    .map((segment, inputIndex) => ({
      ...segment,
      inputIndex,
      text: normalizeText(segment.text),
    }))
    .filter((segment) => segment.text.length > 0)
    .sort(
      (left, right) =>
        left.startMs - right.startMs ||
        left.endMs - right.endMs ||
        left.inputIndex - right.inputIndex,
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
    const firstCurrentSegment = currentSegments[0];
    const sourceChanged =
      firstCurrentSegment !== undefined &&
      (segment.transcriptId !== firstCurrentSegment.transcriptId ||
        segment.recordingId !== firstCurrentSegment.recordingId);

    if (
      currentSegments.length > 0 &&
      (sourceChanged || nextLength > MAX_CHUNK_CHARS)
    ) {
      flushCurrentSegments();
    }

    currentSegments.push(segment);
    currentLength =
      currentLength === 0
        ? segment.text.length
        : currentLength + 1 + segment.text.length;
  }

  flushCurrentSegments();

  return chunks
    .flatMap((chunk) => {
      if (chunk.content.length <= MAX_CHUNK_CHARS) {
        return [chunk];
      }

      return splitText(chunk.content).map((content) => ({
        ...chunk,
        chunkIndex: 0,
        content,
      }));
    })
    .map((chunk, chunkIndex) => ({
      ...chunk,
      chunkIndex,
    }));
}
