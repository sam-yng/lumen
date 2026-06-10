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
 */
export class TransformersStreamingTranscriptionProvider
  implements StreamingTranscriptionProvider
{
  constructor(private readonly options: TransformersProviderOptions = {}) {}

  async startSession(
    options: StreamingSessionOptions,
  ): Promise<StreamingTranscriptionSession> {
    const worker = new Worker(new URL("./asr-worker.ts", import.meta.url), {
      type: "module",
    });

    let finished = false;
    let resolveFinish: (() => void) | null = null;
    const finishPromise = new Promise<void>((resolve) => {
      resolveFinish = resolve;
    });

    const fail = (error: Error) => {
      options.onError?.(error);
      // A dead session should not leave finish() hanging.
      if (!finished) {
        finished = true;
        resolveFinish?.();
      }
    };

    worker.onmessage = (event: MessageEvent<AsrWorkerResponse>) => {
      const message = event.data;
      switch (message.type) {
        case "status":
          this.options.onStatus?.(message.status);
          break;
        case "interim":
        case "final":
          options.onEvent({ kind: message.type, segment: message.segment });
          break;
        case "finished":
          finished = true;
          resolveFinish?.();
          break;
        case "error":
          fail(new Error(message.message));
          break;
      }
    };

    worker.onerror = (event) => {
      fail(new Error(event.message || "Transcription worker crashed."));
    };

    worker.postMessage({
      type: "configure",
      modelId: this.options.modelId ?? DEFAULT_ASR_MODEL_ID,
    });

    return {
      pushAudio(samples: Float32Array) {
        worker.postMessage({ type: "push", samples }, [samples.buffer]);
      },
      async finish() {
        worker.postMessage({ type: "finish" });
        await finishPromise;
        worker.terminate();
      },
      abort() {
        finished = true;
        resolveFinish?.();
        worker.terminate();
      },
    };
  }
}
