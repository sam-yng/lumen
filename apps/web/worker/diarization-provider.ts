export type SpeakerTurn = {
  startMs: number;
  endMs: number;
  speaker: string;
};

export interface DiarizationProvider {
  diarize(audioPath: string): Promise<SpeakerTurn[]>;
}
