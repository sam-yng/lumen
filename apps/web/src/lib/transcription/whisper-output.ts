import type { StreamingSegment } from "@/lib/transcription/streaming-provider";

// Shape of @huggingface/transformers ASR pipeline output with
// return_timestamps: true. Timestamps are seconds relative to the audio
// passed in; the final chunk's end can be null when Whisper runs off the
// end of the buffer.
export type WhisperChunk = {
  timestamp: [number, number | null];
  text: string;
};

export type WhisperOutput = {
  text: string;
  chunks?: WhisperChunk[];
};

function isNoiseAnnotation(text: string) {
  // Whisper emits bracketed annotations on silence/noise ("[BLANK_AUDIO]",
  // "(applause)", "♪"); they add nothing to a study transcript.
  return /^[[(♪].*$/.test(text) || text === "♪";
}

function cleanText(text: string) {
  const trimmed = text.trim();
  return isNoiseAnnotation(trimmed) ? "" : trimmed;
}

/**
 * Map a Whisper run over one audio window to absolute-time segments.
 * `windowStartMs` is where the window sits in the whole session;
 * `windowDurationMs` bounds segment ends when Whisper omits one.
 */
export function absoluteSegments(
  output: WhisperOutput,
  windowStartMs: number,
  windowDurationMs: number,
): StreamingSegment[] {
  const chunks = output.chunks ?? [];

  if (chunks.length === 0) {
    const text = cleanText(output.text);
    if (text.length === 0) return [];
    return [
      {
        startMs: windowStartMs,
        endMs: windowStartMs + windowDurationMs,
        text,
        speaker: null,
      },
    ];
  }

  const segments: StreamingSegment[] = [];

  for (const chunk of chunks) {
    const text = cleanText(chunk.text);
    if (text.length === 0) continue;

    const [start, end] = chunk.timestamp;
    const startMs = windowStartMs + Math.max(0, Math.round(start * 1000));
    const rawEndMs =
      end === null
        ? windowStartMs + windowDurationMs
        : windowStartMs + Math.round(end * 1000);

    segments.push({
      startMs,
      endMs: Math.max(startMs, rawEndMs),
      text,
      speaker: null,
    });
  }

  return segments;
}

/** Collapse a Whisper run to one display string for interim updates. */
export function interimText(output: WhisperOutput): string {
  return cleanText(output.text);
}
