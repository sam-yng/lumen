import { describe, expect, it } from "vitest";
import {
  CHUNK_OVERLAP_CHARS,
  chunkDocument,
  chunkTranscript,
  MAX_CHUNK_CHARS,
} from "@/server/services/semantic-chunking";

function longestSuffixPrefixOverlap(left: string, right: string) {
  const maxLength = Math.min(left.length, right.length);

  for (let length = maxLength; length > 0; length -= 1) {
    if (right.startsWith(left.slice(-length))) {
      return length;
    }
  }

  return 0;
}

describe("chunkDocument", () => {
  it("returns no chunks for empty or whitespace text", () => {
    expect(chunkDocument({ documentId: "doc-1", text: "" })).toEqual([]);
    expect(chunkDocument({ documentId: "doc-1", text: " \n\t " })).toEqual([]);
    expect(chunkDocument({ documentId: "doc-1", text: null })).toEqual([]);
  });

  it("keeps document source metadata and monotonically increasing chunk indexes", () => {
    const chunks = chunkDocument({
      documentId: "doc-1",
      text: "alpha ".repeat(500),
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual(
      chunks.map((_, index) => index),
    );

    for (const chunk of chunks) {
      expect(chunk).toMatchObject({
        sourceType: "document",
        documentId: "doc-1",
        transcriptId: null,
        recordingId: null,
        startMs: null,
        endMs: null,
      });
      expect(chunk.content.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
    }
  });

  it("splits long text near the limit with about 150 characters of overlap", () => {
    const text = Array.from({ length: 260 }, (_, index) => `token${index}`)
      .join(" ")
      .repeat(3);

    const chunks = chunkDocument({ documentId: "doc-1", text });

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0]?.content.length).toBeGreaterThan(850);

    for (let index = 1; index < chunks.length; index += 1) {
      const previous = chunks[index - 1]?.content ?? "";
      const current = chunks[index]?.content ?? "";
      const overlap = longestSuffixPrefixOverlap(previous, current);

      expect(current.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
      expect(overlap).toBeGreaterThanOrEqual(CHUNK_OVERLAP_CHARS - 30);
      expect(overlap).toBeLessThanOrEqual(CHUNK_OVERLAP_CHARS + 30);
    }
  });
});

describe("chunkTranscript", () => {
  it("preserves start and end millisecond bounds for grouped segments", () => {
    const chunks = chunkTranscript([
      {
        transcriptId: "transcript-1",
        recordingId: "recording-1",
        startMs: 3_000,
        endMs: 3_500,
        text: "charlie ".repeat(40),
      },
      {
        transcriptId: "transcript-1",
        recordingId: "recording-1",
        startMs: 0,
        endMs: 1_000,
        text: "alpha ".repeat(65),
      },
      {
        transcriptId: "transcript-1",
        recordingId: "recording-1",
        startMs: 1_000,
        endMs: 2_000,
        text: "bravo ".repeat(65),
      },
      {
        transcriptId: "transcript-1",
        recordingId: "recording-1",
        startMs: 2_000,
        endMs: 2_500,
        text: " \n ",
      },
    ]);

    expect(chunks).toHaveLength(2);
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual([0, 1]);
    expect(chunks[0]).toMatchObject({
      sourceType: "transcript",
      documentId: null,
      transcriptId: "transcript-1",
      recordingId: "recording-1",
      startMs: 0,
      endMs: 2_000,
    });
    expect(chunks[1]).toMatchObject({
      sourceType: "transcript",
      documentId: null,
      transcriptId: "transcript-1",
      recordingId: "recording-1",
      startMs: 3_000,
      endMs: 3_500,
    });
  });
});
