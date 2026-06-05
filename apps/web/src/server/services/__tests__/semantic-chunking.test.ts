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

function longWord(length: number) {
  let word = "";
  let index = 0;

  while (word.length < length) {
    word += `x${index.toString(36).padStart(4, "0")}`;
    index += 1;
  }

  return word.slice(0, length);
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

  it("does not let sparse whitespace make overlap balloon past the target", () => {
    const chunks = chunkDocument({
      documentId: "doc-1",
      text: `${"a".repeat(300)} ${longWord(2_000)}`,
    });

    expect(chunks.length).toBeGreaterThan(1);

    for (let index = 1; index < chunks.length; index += 1) {
      const previous = chunks[index - 1]?.content ?? "";
      const current = chunks[index]?.content ?? "";
      const overlap = longestSuffixPrefixOverlap(previous, current);

      expect(current.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
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

  it("uses true time bounds for overlapping grouped segments", () => {
    const chunks = chunkTranscript([
      {
        transcriptId: "transcript-1",
        recordingId: "recording-1",
        startMs: 0,
        endMs: 10_000,
        text: "wide segment",
      },
      {
        transcriptId: "transcript-1",
        recordingId: "recording-1",
        startMs: 1_000,
        endMs: 2_000,
        text: "narrow segment",
      },
    ]);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      startMs: 0,
      endMs: 10_000,
      content: "wide segment narrow segment",
    });
  });

  it("splits a single oversized segment without losing transcript metadata", () => {
    const chunks = chunkTranscript([
      {
        transcriptId: "transcript-1",
        recordingId: "recording-1",
        startMs: 1_000,
        endMs: 9_000,
        text: longWord(MAX_CHUNK_CHARS * 2),
      },
    ]);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual(
      chunks.map((_, index) => index),
    );

    for (const chunk of chunks) {
      expect(chunk).toMatchObject({
        sourceType: "transcript",
        documentId: null,
        transcriptId: "transcript-1",
        recordingId: "recording-1",
        startMs: 1_000,
        endMs: 9_000,
      });
      expect(chunk.content.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
    }
  });

  it("preserves input order for same-timestamp segments", () => {
    const chunks = chunkTranscript([
      {
        transcriptId: "transcript-1",
        recordingId: "recording-1",
        startMs: 1_000,
        endMs: 2_000,
        text: "zulu",
      },
      {
        transcriptId: "transcript-1",
        recordingId: "recording-1",
        startMs: 1_000,
        endMs: 2_000,
        text: "alpha",
      },
    ]);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe("zulu alpha");
  });

  it("does not group segments from different transcripts or recordings", () => {
    const chunks = chunkTranscript([
      {
        transcriptId: "transcript-1",
        recordingId: "recording-1",
        startMs: 1_000,
        endMs: 2_000,
        text: "first transcript",
      },
      {
        transcriptId: "transcript-2",
        recordingId: "recording-2",
        startMs: 1_100,
        endMs: 2_100,
        text: "second transcript",
      },
    ]);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      transcriptId: "transcript-1",
      recordingId: "recording-1",
      content: "first transcript",
    });
    expect(chunks[1]).toMatchObject({
      transcriptId: "transcript-2",
      recordingId: "recording-2",
      content: "second transcript",
    });
  });
});
