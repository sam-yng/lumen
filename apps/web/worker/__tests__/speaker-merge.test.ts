import { describe, expect, it } from "vitest";
import type { SpeakerTurn } from "../diarization-provider";
import { assignSpeakers } from "../speaker-merge";
import type { TranscriptionSegment } from "../transcription-provider";

function segment(
  startMs: number,
  endMs: number,
  text = "hello",
): TranscriptionSegment {
  return { startMs, endMs, text, speaker: null };
}

function turn(startMs: number, endMs: number, speaker: string): SpeakerTurn {
  return { startMs, endMs, speaker };
}

describe("assignSpeakers", () => {
  it("assigns the speaker of a turn that fully contains the segment", () => {
    const result = assignSpeakers(
      [segment(1_000, 2_000)],
      [turn(0, 5_000, "Speaker 1")],
    );

    expect(result).toEqual([
      { startMs: 1_000, endMs: 2_000, text: "hello", speaker: "Speaker 1" },
    ]);
  });

  it("picks the turn with the largest time overlap", () => {
    const result = assignSpeakers(
      [segment(0, 1_000)],
      [turn(0, 300, "Speaker 1"), turn(300, 1_000, "Speaker 2")],
    );

    expect(result[0]?.speaker).toBe("Speaker 2");
  });

  it("breaks overlap ties in favor of the earliest turn", () => {
    const result = assignSpeakers(
      [segment(0, 1_000)],
      [turn(500, 1_000, "Speaker 2"), turn(0, 500, "Speaker 1")],
    );

    expect(result[0]?.speaker).toBe("Speaker 1");
  });

  it("leaves speaker null when no turn overlaps the segment", () => {
    const result = assignSpeakers(
      [segment(10_000, 11_000)],
      [turn(0, 5_000, "Speaker 1")],
    );

    expect(result[0]?.speaker).toBeNull();
  });

  it("treats touching boundaries as no overlap", () => {
    const result = assignSpeakers(
      [segment(1_000, 2_000)],
      [turn(0, 1_000, "Speaker 1")],
    );

    expect(result[0]?.speaker).toBeNull();
  });

  it("leaves all speakers null when there are no turns", () => {
    const result = assignSpeakers(
      [segment(0, 1_000), segment(1_000, 2_000)],
      [],
    );

    expect(result.map((s) => s.speaker)).toEqual([null, null]);
  });

  it("preserves segment text and timing and does not mutate inputs", () => {
    const input = [segment(0, 1_000, "first"), segment(1_000, 2_000, "second")];
    const turns = [turn(0, 2_000, "Speaker 1")];

    const result = assignSpeakers(input, turns);

    expect(result.map((s) => s.text)).toEqual(["first", "second"]);
    expect(result.map((s) => [s.startMs, s.endMs])).toEqual([
      [0, 1_000],
      [1_000, 2_000],
    ]);
    expect(input[0]?.speaker).toBeNull();
    expect(input[1]?.speaker).toBeNull();
  });

  it("labels a multi-speaker conversation segment by segment", () => {
    const result = assignSpeakers(
      [segment(0, 4_000), segment(4_500, 8_000), segment(8_200, 12_000)],
      [
        turn(0, 4_200, "Speaker 1"),
        turn(4_400, 8_100, "Speaker 2"),
        turn(8_150, 12_000, "Speaker 1"),
      ],
    );

    expect(result.map((s) => s.speaker)).toEqual([
      "Speaker 1",
      "Speaker 2",
      "Speaker 1",
    ]);
  });
});
