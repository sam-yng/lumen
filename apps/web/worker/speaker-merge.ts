import type { SpeakerTurn } from "./diarization-provider";
import type { TranscriptionSegment } from "./transcription-provider";

function overlapMs(segment: TranscriptionSegment, turn: SpeakerTurn): number {
  return (
    Math.min(segment.endMs, turn.endMs) -
    Math.max(segment.startMs, turn.startMs)
  );
}

export function assignSpeakers(
  segments: TranscriptionSegment[],
  turns: SpeakerTurn[],
): TranscriptionSegment[] {
  return segments.map((segment) => {
    let best: SpeakerTurn | null = null;
    let bestOverlap = 0;

    for (const turn of turns) {
      const overlap = overlapMs(segment, turn);
      if (overlap <= 0) continue;

      const isBetter =
        overlap > bestOverlap ||
        (overlap === bestOverlap &&
          best !== null &&
          turn.startMs < best.startMs);

      if (isBetter) {
        best = turn;
        bestOverlap = overlap;
      }
    }

    return { ...segment, speaker: best?.speaker ?? null };
  });
}
