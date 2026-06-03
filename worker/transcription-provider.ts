export type TranscriptionSegment = {
  startMs: number;
  endMs: number;
  text: string;
  speaker: string | null;
};

export type TranscriptionResult = {
  fullText: string;
  language: string | null;
  segments: TranscriptionSegment[];
};

export interface TranscriptionProvider {
  transcribe(audioPath: string): Promise<TranscriptionResult>;
}
