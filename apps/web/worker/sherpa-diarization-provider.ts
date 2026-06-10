import { createRequire } from "node:module";
import type { DiarizationProvider, SpeakerTurn } from "./diarization-provider";

export type RawDiarizationSegment = {
  start: number;
  end: number;
  speaker: number;
};

export type DiarizationEngine = {
  sampleRate: number;
  process(samples: Float32Array): RawDiarizationSegment[];
};

type AudioData = {
  samples: Float32Array;
  sampleRate: number;
};

export type SherpaOnnxDiarizationOptions = {
  segmentationModelPath: string;
  embeddingModelPath: string;
  clusterThreshold: number;
  /** -1 lets the clustering threshold decide the speaker count. */
  numSpeakers: number;
  loadEngine?: (
    options: SherpaOnnxDiarizationOptions,
  ) => Promise<DiarizationEngine>;
  readAudio?: (audioPath: string) => Promise<AudioData>;
};

export function toSpeakerTurns(raw: RawDiarizationSegment[]): SpeakerTurn[] {
  const ordered = [...raw].sort((a, b) => a.start - b.start);
  const labelByCluster = new Map<number, string>();

  return ordered.map((segment) => {
    let label = labelByCluster.get(segment.speaker);
    if (!label) {
      label = `Speaker ${labelByCluster.size + 1}`;
      labelByCluster.set(segment.speaker, label);
    }

    return {
      startMs: Math.round(segment.start * 1000),
      endMs: Math.round(segment.end * 1000),
      speaker: label,
    };
  });
}

export function resampleLinear(
  samples: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate) return samples;

  const outLength = Math.max(
    1,
    Math.round((samples.length * toRate) / fromRate),
  );
  const result = new Float32Array(outLength);
  const step = fromRate / toRate;

  for (let i = 0; i < outLength; i++) {
    const position = Math.min(i * step, samples.length - 1);
    const index = Math.floor(position);
    const fraction = position - index;
    const next = Math.min(index + 1, samples.length - 1);
    result[i] =
      (samples[index] ?? 0) * (1 - fraction) + (samples[next] ?? 0) * fraction;
  }

  return result;
}

// sherpa-onnx-node is a CommonJS native addon; resolve it lazily so the worker
// only pays the load (and only needs the dependency working) when diarization
// is enabled.
async function loadSherpaEngine(
  options: SherpaOnnxDiarizationOptions,
): Promise<DiarizationEngine> {
  const require = createRequire(import.meta.url);
  const sherpa = require("sherpa-onnx-node");

  const engine = new sherpa.OfflineSpeakerDiarization({
    segmentation: {
      pyannote: { model: options.segmentationModelPath },
    },
    embedding: { model: options.embeddingModelPath },
    clustering: {
      numClusters: options.numSpeakers,
      threshold: options.clusterThreshold,
    },
    minDurationOn: 0.2,
    minDurationOff: 0.5,
  });

  return {
    sampleRate: engine.sampleRate,
    process: (samples) => engine.process(samples),
  };
}

async function readWaveFile(audioPath: string): Promise<AudioData> {
  const require = createRequire(import.meta.url);
  const sherpa = require("sherpa-onnx-node");
  const wave = sherpa.readWave(audioPath);

  return { samples: wave.samples, sampleRate: wave.sampleRate };
}

export class SherpaOnnxDiarizationProvider implements DiarizationProvider {
  private readonly options: SherpaOnnxDiarizationOptions;
  private readonly loadEngine: (
    options: SherpaOnnxDiarizationOptions,
  ) => Promise<DiarizationEngine>;
  private readonly readAudio: (audioPath: string) => Promise<AudioData>;
  private enginePromise: Promise<DiarizationEngine> | null = null;

  constructor(options: SherpaOnnxDiarizationOptions) {
    this.options = options;
    this.loadEngine = options.loadEngine ?? loadSherpaEngine;
    this.readAudio = options.readAudio ?? readWaveFile;
  }

  async diarize(audioPath: string): Promise<SpeakerTurn[]> {
    this.enginePromise ??= this.loadEngine(this.options);
    const engine = await this.enginePromise;
    const audio = await this.readAudio(audioPath);
    const samples = resampleLinear(
      audio.samples,
      audio.sampleRate,
      engine.sampleRate,
    );

    return toSpeakerTurns(engine.process(samples));
  }
}
