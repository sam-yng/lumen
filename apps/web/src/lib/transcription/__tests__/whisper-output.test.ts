import { describe, expect, it } from "vitest";
import {
  absoluteSegments,
  interimText,
} from "@/lib/transcription/whisper-output";

describe("absoluteSegments", () => {
  it("offsets whisper chunk timestamps by the window start", () => {
    const segments = absoluteSegments(
      {
        text: " hello world how are you",
        chunks: [
          { timestamp: [0, 2.5], text: " hello world" },
          { timestamp: [2.5, 4.0], text: " how are you" },
        ],
      },
      12_000,
      12_000,
    );

    expect(segments).toEqual([
      { startMs: 12_000, endMs: 14_500, text: "hello world", speaker: null },
      { startMs: 14_500, endMs: 16_000, text: "how are you", speaker: null },
    ]);
  });

  it("bounds a null end timestamp by the window duration", () => {
    const segments = absoluteSegments(
      {
        text: " trailing",
        chunks: [{ timestamp: [10.0, null], text: " trailing" }],
      },
      0,
      12_000,
    );

    expect(segments).toEqual([
      { startMs: 10_000, endMs: 12_000, text: "trailing", speaker: null },
    ]);
  });

  it("falls back to one whole-window segment when chunks are missing", () => {
    const segments = absoluteSegments({ text: " all of it " }, 5_000, 3_000);

    expect(segments).toEqual([
      { startMs: 5_000, endMs: 8_000, text: "all of it", speaker: null },
    ]);
  });

  it("drops silence/noise annotations and empty chunks", () => {
    const segments = absoluteSegments(
      {
        text: " [BLANK_AUDIO]",
        chunks: [
          { timestamp: [0, 2], text: " [BLANK_AUDIO]" },
          { timestamp: [2, 4], text: "   " },
          { timestamp: [4, 6], text: " (applause)" },
        ],
      },
      0,
      6_000,
    );

    expect(segments).toEqual([]);
  });

  it("never produces an end before the start", () => {
    const segments = absoluteSegments(
      { text: "x", chunks: [{ timestamp: [3, 1], text: "x" }] },
      0,
      6_000,
    );

    expect(segments).toEqual([
      { startMs: 3_000, endMs: 3_000, text: "x", speaker: null },
    ]);
  });
});

describe("interimText", () => {
  it("trims text and suppresses noise annotations", () => {
    expect(interimText({ text: "  hello  " })).toBe("hello");
    expect(interimText({ text: " [BLANK_AUDIO]" })).toBe("");
  });
});
