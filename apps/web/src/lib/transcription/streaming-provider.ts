// StreamingTranscriptionProvider seam (v3 m2). The batch TranscriptionProvider
// in apps/web/worker/transcription-provider.ts is untouched; this seam covers
// live capture, where inference runs in the browser and only text segments
// reach the server. Interim segments are display-only; final segments are the
// ones persisted via the live-session service.

export type StreamingSegment = {
  startMs: number;
  endMs: number;
  text: string;
  speaker: null;
};

export type StreamingTranscriptionEvent =
  | { kind: "interim"; segment: StreamingSegment }
  | { kind: "final"; segment: StreamingSegment };

export type StreamingSessionOptions = {
  onEvent: (event: StreamingTranscriptionEvent) => void;
  onError?: (error: Error) => void;
};

export type StreamingTranscriptionSession = {
  /** Push 16 kHz mono PCM samples captured since the last call. */
  pushAudio(samples: Float32Array): void;
  /** Flush pending audio; resolves after the last final segment is emitted. */
  finish(): Promise<void>;
  /** Tear down without flushing (discard/cancel). */
  abort(): void;
};

export interface StreamingTranscriptionProvider {
  startSession(
    options: StreamingSessionOptions,
  ): Promise<StreamingTranscriptionSession>;
}
