import type { StreamingSegment } from "@/lib/transcription/streaming-provider";

// Message protocol between TransformersStreamingTranscriptionProvider and the
// ASR Web Worker. Audio flows in as 16 kHz mono PCM; segments flow out.

export type AsrWorkerRequest =
  | { type: "configure"; modelId: string; forceWasm?: boolean }
  | { type: "push"; samples: Float32Array }
  | { type: "finish" };

export type AsrStatus =
  | { state: "loading"; progress: number | null }
  | { state: "ready"; device: "webgpu" | "wasm" };

export type AsrWorkerResponse =
  | { type: "status"; status: AsrStatus }
  | { type: "interim"; segment: StreamingSegment }
  | { type: "final"; segment: StreamingSegment }
  | { type: "finished" }
  | { type: "error"; stage: "load" | "transcribe"; message: string };

export const ASR_SAMPLE_RATE = 16_000;
export const DEFAULT_ASR_MODEL_ID = "onnx-community/whisper-base.en";
