import { ASR_SAMPLE_RATE } from "@/lib/transcription/asr-protocol";

// Taps a MediaStream into 16 kHz mono Float32 PCM batches for the ASR worker.
// The AudioWorklet module is tiny, so it ships inline as a Blob URL instead of
// a separately bundled file.
const WORKLET_SOURCE = `
class PcmTap extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel && channel.length > 0) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor("pcm-tap", PcmTap);
`;

const BATCH_SAMPLES = ASR_SAMPLE_RATE / 10; // forward ~100 ms at a time

export type PcmCapture = {
  stop(): Promise<void>;
};

export async function startPcmCapture(
  stream: MediaStream,
  onSamples: (samples: Float32Array) => void,
): Promise<PcmCapture> {
  const context = new AudioContext({ sampleRate: ASR_SAMPLE_RATE });
  const workletUrl = URL.createObjectURL(
    new Blob([WORKLET_SOURCE], { type: "application/javascript" }),
  );

  try {
    await context.audioWorklet.addModule(workletUrl);
  } finally {
    URL.revokeObjectURL(workletUrl);
  }

  const source = context.createMediaStreamSource(stream);
  const tap = new AudioWorkletNode(context, "pcm-tap");

  let batch = new Float32Array(BATCH_SAMPLES);
  let batched = 0;

  tap.port.onmessage = (event: MessageEvent<Float32Array>) => {
    let samples = event.data;
    while (samples.length > 0) {
      const take = Math.min(samples.length, BATCH_SAMPLES - batched);
      batch.set(samples.subarray(0, take), batched);
      batched += take;
      samples = samples.subarray(take);
      if (batched === BATCH_SAMPLES) {
        onSamples(batch);
        batch = new Float32Array(BATCH_SAMPLES);
        batched = 0;
      }
    }
  };

  source.connect(tap);
  // The worklet writes no output (silence), but it must be connected to the
  // destination for the browser to keep pulling it through the audio graph.
  tap.connect(context.destination);

  return {
    async stop() {
      if (batched > 0) {
        onSamples(batch.subarray(0, batched).slice());
        batched = 0;
      }
      tap.port.onmessage = null;
      source.disconnect();
      tap.disconnect();
      await context.close();
    },
  };
}
