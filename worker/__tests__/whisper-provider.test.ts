import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeWhisperJson,
  WhisperTranscriptionProvider,
} from "../whisper-provider";

const whisperJson = {
  result: { language: "en" },
  transcription: [
    {
      timestamps: { from: "00:00:00.000", to: "00:00:01.000" },
      offsets: { from: 0, to: 1000 },
      text: " Hello world ",
    },
    {
      timestamps: { from: "00:00:01.200", to: "00:00:02.400" },
      offsets: { from: 1200, to: 2400 },
      text: "Another thought",
    },
  ],
};

describe("normalizeWhisperJson", () => {
  it("maps whisper JSON offsets into the normalized transcript result", () => {
    expect(normalizeWhisperJson(whisperJson)).toEqual({
      fullText: "Hello world Another thought",
      language: "en",
      segments: [
        {
          startMs: 0,
          endMs: 1000,
          text: "Hello world",
          speaker: null,
        },
        {
          startMs: 1200,
          endMs: 2400,
          text: "Another thought",
          speaker: null,
        },
      ],
    });
  });

  it("uses timestamps when offsets are missing", () => {
    expect(
      normalizeWhisperJson({
        language: "es",
        transcription: [
          {
            timestamps: { from: "00:01:02.500", to: "00:01:03.250" },
            text: "Hola",
          },
        ],
      }),
    ).toEqual({
      fullText: "Hola",
      language: "es",
      segments: [
        {
          startMs: 62500,
          endMs: 63250,
          text: "Hola",
          speaker: null,
        },
      ],
    });
  });
});

describe("WhisperTranscriptionProvider", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((dir) => rm(dir, { force: true, recursive: true })),
    );
    tempDirs.length = 0;
  });

  it("calls nodejs-whisper with CPU JSON options and reads the converted WAV sidecar", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lumen-whisper-"));
    tempDirs.push(dir);
    const audioPath = join(dir, "lecture.mp3");
    const convertedWavPath = join(dir, "lecture.wav");
    const jsonPath = `${convertedWavPath}.json`;
    await writeFile(audioPath, "fake audio");

    const runWhisper = vi.fn(async () => {
      await writeFile(convertedWavPath, "temporary wav");
      await writeFile(jsonPath, JSON.stringify(whisperJson));
      return "stdout transcript";
    });

    const provider = new WhisperTranscriptionProvider({
      modelName: "base.en",
      runWhisper,
    });

    const result = await provider.transcribe(audioPath);

    expect(runWhisper).toHaveBeenCalledWith(audioPath, {
      modelName: "base.en",
      autoDownloadModelName: "base.en",
      removeWavFileAfterTranscription: true,
      withCuda: false,
      whisperOptions: {
        outputInJson: true,
        outputInJsonFull: true,
        language: "auto",
        noGpu: true,
      },
    });
    expect(result.fullText).toBe("Hello world Another thought");
    await expect(readFile(jsonPath, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readFile(convertedWavPath, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("throws a helpful error when whisper does not write JSON output", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lumen-whisper-"));
    tempDirs.push(dir);
    const audioPath = join(dir, "lecture.wav");
    await writeFile(audioPath, "fake wav");

    const provider = new WhisperTranscriptionProvider({
      modelName: "tiny",
      runWhisper: vi.fn(async () => "stdout only"),
    });

    await expect(provider.transcribe(audioPath)).rejects.toThrow(
      "Whisper JSON output not found",
    );
  });
});
