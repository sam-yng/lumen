import { readFile, unlink } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { nodewhisper } from "nodejs-whisper";
import type {
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionSegment,
} from "./transcription-provider";

type NodeWhisperOptions = Parameters<typeof nodewhisper>[1];
type WhisperRunner = (
  audioPath: string,
  options: NodeWhisperOptions,
) => Promise<string>;

type JsonRecord = Record<string, unknown>;

type WhisperTranscriptionProviderOptions = {
  modelName: string;
  runWhisper?: WhisperRunner;
};

export class WhisperTranscriptionProvider implements TranscriptionProvider {
  private readonly modelName: string;
  private readonly runWhisper: WhisperRunner;

  constructor(options: WhisperTranscriptionProviderOptions) {
    this.modelName = options.modelName;
    this.runWhisper = options.runWhisper ?? nodewhisper;
  }

  async transcribe(audioPath: string): Promise<TranscriptionResult> {
    let jsonPath: string | null = null;

    try {
      await this.runWhisper(audioPath, whisperOptions(this.modelName));

      jsonPath = await findWhisperJsonSidecar(audioPath);
      const rawJson = await readFile(jsonPath, "utf8");

      return normalizeWhisperJson(JSON.parse(rawJson));
    } finally {
      await cleanupWhisperOutputs(audioPath, jsonPath);
    }
  }
}

export function normalizeWhisperJson(value: unknown): TranscriptionResult {
  const root = asRecord(value, "Whisper JSON output");
  const transcription = root.transcription;

  if (!Array.isArray(transcription)) {
    throw new Error(
      "Whisper JSON output did not include transcription segments",
    );
  }

  const segments = transcription.map(normalizeWhisperSegment);

  return {
    fullText: segments
      .map((segment) => segment.text)
      .join(" ")
      .trim(),
    language: readLanguage(root),
    segments,
  };
}

function getWhisperJsonSidecarCandidates(audioPath: string): string[] {
  const wavPath = getWhisperWavPath(audioPath);
  const candidates = [
    `${wavPath}.json`,
    `${audioPath}.json`,
    join(dirname(wavPath), `${basename(wavPath, extname(wavPath))}.json`),
  ];

  return [...new Set(candidates)];
}

function whisperOptions(modelName: string): NodeWhisperOptions {
  return {
    modelName,
    autoDownloadModelName: modelName,
    removeWavFileAfterTranscription: true,
    withCuda: false,
    whisperOptions: {
      outputInJson: true,
      outputInJsonFull: true,
      language: "auto",
      noGpu: true,
    },
  };
}

async function findWhisperJsonSidecar(audioPath: string): Promise<string> {
  const candidates = getWhisperJsonSidecarCandidates(audioPath);

  for (const candidate of candidates) {
    try {
      await readFile(candidate, "utf8");
      return candidate;
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  throw new Error(
    `Whisper JSON output not found. Checked: ${candidates.join(", ")}`,
  );
}

async function cleanupWhisperOutputs(
  audioPath: string,
  jsonPath: string | null,
): Promise<void> {
  const paths = new Set(getWhisperJsonSidecarCandidates(audioPath));

  if (jsonPath) {
    paths.add(jsonPath);
  }

  const wavPath = getWhisperWavPath(audioPath);
  if (wavPath !== audioPath) {
    paths.add(wavPath);
  }

  await Promise.all([...paths].map(removeIfExists));
}

async function removeIfExists(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }
  }
}

function getWhisperWavPath(audioPath: string): string {
  const extension = extname(audioPath);

  if (extension.toLowerCase() === ".wav") {
    return audioPath;
  }

  return join(dirname(audioPath), `${basename(audioPath, extension)}.wav`);
}

function normalizeWhisperSegment(value: unknown): TranscriptionSegment {
  const segment = asRecord(value, "Whisper transcription segment");
  const text = readString(segment.text, "segment text").trim();
  const offsets = readOptionalRecord(segment.offsets);
  const timestamps = readOptionalRecord(segment.timestamps);
  const startMs =
    readOptionalNumber(offsets?.from) ??
    parseTimestamp(readOptionalString(timestamps?.from));
  const endMs =
    readOptionalNumber(offsets?.to) ??
    parseTimestamp(readOptionalString(timestamps?.to));

  if (startMs === null || endMs === null) {
    throw new Error(
      "Whisper transcription segment is missing start or end time",
    );
  }

  return {
    startMs,
    endMs,
    text,
    speaker: null,
  };
}

function readLanguage(root: JsonRecord): string | null {
  const result = readOptionalRecord(root.result);
  const params = readOptionalRecord(root.params);

  return (
    readOptionalString(result?.language) ??
    readOptionalString(root.language) ??
    readOptionalString(params?.language)
  );
}

function parseTimestamp(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  if (!match) {
    return null;
  }

  const [, hours, minutes, seconds, milliseconds] = match;

  return (
    Number(hours) * 60 * 60 * 1000 +
    Number(minutes) * 60 * 1000 +
    Number(seconds) * 1000 +
    Number(milliseconds.padEnd(3, "0"))
  );
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value as JsonRecord;
}

function readOptionalRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function readString(value: unknown, label: string): string {
  const text = readOptionalString(value);

  if (text === null) {
    throw new Error(`Whisper JSON output is missing ${label}`);
  }

  return text;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
