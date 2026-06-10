import { describe, expect, it } from "vitest";
import {
  resampleLinear,
  SherpaOnnxDiarizationProvider,
  toSpeakerTurns,
} from "../sherpa-diarization-provider";

describe("toSpeakerTurns", () => {
  it("converts seconds to ms and labels clusters by first appearance", () => {
    const turns = toSpeakerTurns([
      { start: 0.5, end: 2.0, speaker: 3 },
      { start: 2.5, end: 4.0, speaker: 0 },
      { start: 4.5, end: 6.0, speaker: 3 },
    ]);

    expect(turns).toEqual([
      { startMs: 500, endMs: 2000, speaker: "Speaker 1" },
      { startMs: 2500, endMs: 4000, speaker: "Speaker 2" },
      { startMs: 4500, endMs: 6000, speaker: "Speaker 1" },
    ]);
  });

  it("orders unsorted raw segments by start time before labeling", () => {
    const turns = toSpeakerTurns([
      { start: 5, end: 6, speaker: 0 },
      { start: 0, end: 1, speaker: 1 },
    ]);

    expect(turns.map((turn) => turn.speaker)).toEqual([
      "Speaker 1",
      "Speaker 2",
    ]);
    expect(turns[0]?.startMs).toBe(0);
  });
});

describe("resampleLinear", () => {
  it("returns the same samples when rates match", () => {
    const samples = new Float32Array([0.1, 0.2, 0.3]);

    expect(resampleLinear(samples, 16_000, 16_000)).toBe(samples);
  });

  it("halves the sample count when downsampling 2:1", () => {
    const samples = new Float32Array([0, 1, 2, 3, 4, 5, 6, 7]);

    const result = resampleLinear(samples, 32_000, 16_000);

    expect(result.length).toBe(4);
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(2);
  });
});

describe("SherpaOnnxDiarizationProvider", () => {
  const options = {
    segmentationModelPath: "/models/segmentation.onnx",
    embeddingModelPath: "/models/embedding.onnx",
    clusterThreshold: 0.9,
    numSpeakers: -1,
  };

  it("reads audio, resamples to the engine rate, and returns speaker turns", async () => {
    const processed: Float32Array[] = [];
    const provider = new SherpaOnnxDiarizationProvider({
      ...options,
      loadEngine: async () => ({
        sampleRate: 16_000,
        process(samples: Float32Array) {
          processed.push(samples);
          return [
            { start: 0, end: 1, speaker: 1 },
            { start: 1, end: 2, speaker: 0 },
          ];
        },
      }),
      readAudio: async (audioPath: string) => {
        expect(audioPath).toBe("/tmp/audio.wav");
        return {
          samples: new Float32Array([0, 1, 2, 3]),
          sampleRate: 32_000,
        };
      },
    });

    const turns = await provider.diarize("/tmp/audio.wav");

    expect(processed[0]?.length).toBe(2);
    expect(turns).toEqual([
      { startMs: 0, endMs: 1000, speaker: "Speaker 1" },
      { startMs: 1000, endMs: 2000, speaker: "Speaker 2" },
    ]);
  });

  it("creates the engine once across calls", async () => {
    let engineLoads = 0;
    const provider = new SherpaOnnxDiarizationProvider({
      ...options,
      loadEngine: async () => {
        engineLoads += 1;
        return {
          sampleRate: 16_000,
          process: () => [],
        };
      },
      readAudio: async () => ({
        samples: new Float32Array([0]),
        sampleRate: 16_000,
      }),
    });

    await provider.diarize("/tmp/a.wav");
    await provider.diarize("/tmp/b.wav");

    expect(engineLoads).toBe(1);
  });
});
