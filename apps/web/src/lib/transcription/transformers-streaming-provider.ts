import type {
  AsrStatus,
  AsrWorkerResponse,
} from "@/lib/transcription/asr-protocol";
import { DEFAULT_ASR_MODEL_ID } from "@/lib/transcription/asr-protocol";
import type {
  StreamingSessionOptions,
  StreamingTranscriptionProvider,
  StreamingTranscriptionSession,
} from "@/lib/transcription/streaming-provider";

export type TransformersProviderOptions = {
  modelId?: string;
  onStatus?: (status: AsrStatus) => void;
};

/**
 * StreamingTranscriptionProvider backed by a Web Worker running Whisper via
 * @huggingface/transformers — inference happens on the user's device and only
 * text segments ever reach the server (v3 m2 spike decision).
 *
 * Device fallback happens across workers: if the WebGPU load fails, the
 * worker is replaced by a fresh one forced to WASM and the audio captured so
 * far is replayed. (In-process fallback is impossible — transformers.js
 * caches the first session-init promise, so one failed attempt poisons every
 * retry inside the same worker.)
 */
export class TransformersStreamingTranscriptionProvider
  implements StreamingTranscriptionProvider
{
  constructor(private readonly options: TransformersProviderOptions = {}) {}

  async startSession(
    options: StreamingSessionOptions,
  ): Promise<StreamingTranscriptionSession> {
    const modelId = this.options.modelId ?? DEFAULT_ASR_MODEL_ID;
    const onStatus = this.options.onStatus;

    let worker: Worker | null = null;
    let finished = false;
    let finishRequested = false;
    let ready = false;
    let retriedWasm = false;
    // Audio is retained until the model is ready so a WASM respawn can
    // replay it; cleared as soon as loading succeeds.
    let retained: Float32Array[] | null = [];

    let resolveFinish: (() => void) | null = null;
    const finishPromise = new Promise<void>((resolve) => {
      resolveFinish = resolve;
    });

    const settleFinish = () => {
      if (finished) return;
      finished = true;
      resolveFinish?.();
    };

    const fail = (error: Error) => {
      options.onError?.(error);
      // A dead session should not leave finish() hanging.
      settleFinish();
    };

    const spawn = (forceWasm: boolean) => {
      const next = new Worker(new URL("./asr-worker.ts", import.meta.url), {
        type: "module",
      });

      next.onmessage = (event: MessageEvent<AsrWorkerResponse>) => {
        const message = event.data;
        switch (message.type) {
          case "status":
            if (message.status.state === "ready") {
              ready = true;
              retained = null;
            }
            onStatus?.(message.status);
            break;
          case "interim":
          case "final":
            options.onEvent({ kind: message.type, segment: message.segment });
            break;
          case "finished":
            settleFinish();
            break;
          case "error":
            if (message.stage === "load" && !ready && !retriedWasm) {
              retriedWasm = true;
              next.terminate();
              spawn(true);
              return;
            }
            fail(new Error(message.message));
            break;
        }
      };

      next.onerror = (event) => {
        fail(new Error(event.message || "Transcription worker crashed."));
      };

      next.postMessage({ type: "configure", modelId, forceWasm });

      // Replay audio the previous worker never transcribed, and re-issue a
      // pending finish so the flush still happens.
      for (const samples of retained ?? []) {
        next.postMessage({ type: "push", samples });
      }
      if (finishRequested) next.postMessage({ type: "finish" });

      worker = next;
    };

    spawn(false);

    return {
      pushAudio(samples: Float32Array) {
        // Keep a copy while loading: the buffer is transferred to the worker
        // and would otherwise be unrecoverable if the worker is replaced.
        retained?.push(samples.slice());
        worker?.postMessage({ type: "push", samples }, [samples.buffer]);
      },
      async finish() {
        finishRequested = true;
        worker?.postMessage({ type: "finish" });
        await finishPromise;
        worker?.terminate();
        worker = null;
      },
      abort() {
        settleFinish();
        worker?.terminate();
        worker = null;
      },
    };
  }
}
