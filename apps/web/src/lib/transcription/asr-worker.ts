// ASR Web Worker: runs Whisper locally via @huggingface/transformers
// (WebGPU when available, WASM otherwise). Receives 16 kHz mono PCM pushes,
// emits interim text for the open window and final segments per closed
// window. Fixed-length windows keep the scheme simple (v3 m2); smarter
// VAD-based boundaries can replace them without touching the seam.

import { pipeline } from "@huggingface/transformers";
import type {
  AsrWorkerRequest,
  AsrWorkerResponse,
} from "@/lib/transcription/asr-protocol";
import { ASR_SAMPLE_RATE } from "@/lib/transcription/asr-protocol";
import {
  absoluteSegments,
  interimText,
  type WhisperOutput,
} from "@/lib/transcription/whisper-output";

const WINDOW_SECONDS = 12;
const INTERIM_MIN_NEW_SECONDS = 1.5;
const WINDOW_SAMPLES = WINDOW_SECONDS * ASR_SAMPLE_RATE;
const INTERIM_MIN_NEW_SAMPLES = INTERIM_MIN_NEW_SECONDS * ASR_SAMPLE_RATE;

type Transcriber = (
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<unknown>;

const scope = self as unknown as {
  postMessage(message: AsrWorkerResponse): void;
  onmessage: ((event: MessageEvent<AsrWorkerRequest>) => void) | null;
  navigator?: { gpu?: { requestAdapter(): Promise<unknown> } };
};

function post(message: AsrWorkerResponse) {
  scope.postMessage(message);
}

async function pickDevice(forceWasm: boolean): Promise<"webgpu" | "wasm"> {
  if (forceWasm || !scope.navigator?.gpu) return "wasm";
  try {
    // Probe before committing: transformers.js caches the FIRST session-init
    // promise (wasmInitPromise), so a failed webgpu attempt poisons every
    // later attempt in this worker. The cross-worker retry in the provider
    // covers the case where the adapter exists but session creation fails.
    const adapter = await scope.navigator.gpu.requestAdapter();
    return adapter ? "webgpu" : "wasm";
  } catch {
    return "wasm";
  }
}

async function createTranscriber(
  modelId: string,
  forceWasm: boolean,
): Promise<Transcriber | null> {
  const progressCallback = (progress: { progress?: number }) => {
    post({
      type: "status",
      status: {
        state: "loading",
        progress:
          typeof progress.progress === "number" ? progress.progress : null,
      },
    });
  };

  const device = await pickDevice(forceWasm);
  const dtype =
    device === "webgpu"
      ? { encoder_model: "fp32", decoder_model_merged: "q4" }
      : "q8";

  try {
    const transcriber = (await pipeline(
      "automatic-speech-recognition",
      modelId,
      {
        device,
        dtype,
        progress_callback: progressCallback,
      } as never,
    )) as unknown as Transcriber;
    post({ type: "status", status: { state: "ready", device } });
    return transcriber;
  } catch (error) {
    post({
      type: "error",
      stage: "load",
      message:
        error instanceof Error
          ? error.message
          : "Could not load the transcription model.",
    });
    return null;
  }
}

// Pending PCM not yet folded into a closed window.
let pending: Float32Array[] = [];
let pendingSamples = 0;
let windowStartMs = 0;
let samplesSinceInterim = 0;
let transcriberPromise: Promise<Transcriber | null> | null = null;
let running = false;
let finishRequested = false;
let done = false;

function takeSamples(count: number): Float32Array {
  const out = new Float32Array(count);
  let copied = 0;

  while (copied < count && pending.length > 0) {
    const head = pending[0];
    if (!head) break;
    const take = Math.min(head.length, count - copied);
    out.set(head.subarray(0, take), copied);
    if (take === head.length) {
      pending.shift();
    } else {
      pending[0] = head.subarray(take);
    }
    copied += take;
  }

  pendingSamples -= copied;
  return out;
}

function concatPending(): Float32Array {
  const out = new Float32Array(pendingSamples);
  let offset = 0;
  for (const part of pending) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function emitFinalsFor(transcriber: Transcriber, audio: Float32Array) {
  const output = (await transcriber(audio, {
    return_timestamps: true,
  })) as WhisperOutput;
  const durationMs = (audio.length / ASR_SAMPLE_RATE) * 1000;
  for (const segment of absoluteSegments(output, windowStartMs, durationMs)) {
    post({ type: "final", segment });
  }
  windowStartMs += durationMs;
  samplesSinceInterim = Math.min(samplesSinceInterim, pendingSamples);
}

function hasWork() {
  if (done) return false;
  if (finishRequested) return true;
  if (pendingSamples >= WINDOW_SAMPLES) return true;
  return samplesSinceInterim >= INTERIM_MIN_NEW_SAMPLES;
}

async function pump() {
  if (running || done || !transcriberPromise) return;
  running = true;

  try {
    const transcriber = await transcriberPromise;
    if (!transcriber) {
      done = true;
      return;
    }

    while (pendingSamples >= WINDOW_SAMPLES) {
      await emitFinalsFor(transcriber, takeSamples(WINDOW_SAMPLES));
    }

    if (finishRequested) {
      if (pendingSamples > 0) {
        await emitFinalsFor(transcriber, takeSamples(pendingSamples));
        pending = [];
      }
      done = true;
      post({ type: "finished" });
      return;
    }

    if (samplesSinceInterim >= INTERIM_MIN_NEW_SAMPLES && pendingSamples > 0) {
      samplesSinceInterim = 0;
      const openWindow = concatPending();
      const output = (await transcriber(openWindow, {
        return_timestamps: false,
      })) as WhisperOutput;
      const text = interimText(output);
      if (text.length > 0) {
        post({
          type: "interim",
          segment: {
            startMs: windowStartMs,
            endMs: windowStartMs + (openWindow.length / ASR_SAMPLE_RATE) * 1000,
            text,
            speaker: null,
          },
        });
      }
    }
  } catch (error) {
    post({
      type: "error",
      stage: "transcribe",
      message: error instanceof Error ? error.message : "Transcription failed.",
    });
  } finally {
    running = false;
    // Pushes that arrived while inference ran only appended to the buffer;
    // re-enter the loop if they amount to new work.
    if (hasWork()) void pump();
  }
}

scope.onmessage = (event: MessageEvent<AsrWorkerRequest>) => {
  const message = event.data;

  if (message.type === "configure") {
    transcriberPromise ??= createTranscriber(
      message.modelId,
      message.forceWasm ?? false,
    );
    return;
  }

  if (message.type === "push") {
    if (done) return;
    pending.push(message.samples);
    pendingSamples += message.samples.length;
    samplesSinceInterim += message.samples.length;
    if (hasWork()) void pump();
    return;
  }

  if (message.type === "finish") {
    if (done) return;
    finishRequested = true;
    if (transcriberPromise) {
      void pump();
    } else {
      done = true;
      post({ type: "finished" });
    }
  }
};
