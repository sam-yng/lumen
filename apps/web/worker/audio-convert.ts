import { spawn } from "node:child_process";

export type FfmpegRunner = (args: string[]) => Promise<void>;

const runFfmpeg: FfmpegRunner = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });

export function diarizationWavArgs(
  inputPath: string,
  outputPath: string,
): string[] {
  // 16 kHz mono PCM: what the pyannote segmentation model expects. The
  // provider would resample anyway; converting here keeps the WAV small.
  return [
    "-y",
    "-i",
    inputPath,
    "-ac",
    "1",
    "-ar",
    "16000",
    "-f",
    "wav",
    outputPath,
  ];
}

/**
 * Convert any ffmpeg-readable audio (live sessions upload webm) into the WAV
 * input sherpa-onnx requires. ffmpeg is already a worker host dependency via
 * nodejs-whisper, so this adds no new requirement.
 */
export async function convertToDiarizationWav(
  inputPath: string,
  outputPath: string,
  runner: FfmpegRunner = runFfmpeg,
): Promise<void> {
  await runner(diarizationWavArgs(inputPath, outputPath));
}
