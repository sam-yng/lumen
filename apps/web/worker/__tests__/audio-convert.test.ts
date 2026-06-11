import { describe, expect, it } from "vitest";
import { convertToDiarizationWav, diarizationWavArgs } from "../audio-convert";

describe("diarizationWavArgs", () => {
  it("decodes the input to 16 kHz mono WAV, overwriting the output", () => {
    expect(diarizationWavArgs("/tmp/in.webm", "/tmp/out.wav")).toEqual([
      "-y",
      "-i",
      "/tmp/in.webm",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-f",
      "wav",
      "/tmp/out.wav",
    ]);
  });
});

describe("convertToDiarizationWav", () => {
  it("invokes the runner with the conversion args", async () => {
    const calls: string[][] = [];

    await convertToDiarizationWav(
      "/tmp/in.webm",
      "/tmp/out.wav",
      async (args) => {
        calls.push(args);
      },
    );

    expect(calls).toEqual([diarizationWavArgs("/tmp/in.webm", "/tmp/out.wav")]);
  });

  it("propagates runner failures", async () => {
    await expect(
      convertToDiarizationWav("/tmp/in.webm", "/tmp/out.wav", async () => {
        throw new Error("ffmpeg exited with code 1");
      }),
    ).rejects.toThrow("ffmpeg exited with code 1");
  });
});
