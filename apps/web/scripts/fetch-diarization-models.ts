/**
 * Downloads the two ONNX models the diarization step needs into
 * .models/diarization/ (gitignored). Point the worker at them with:
 *
 *   DIARIZATION_ENABLED=true
 *   DIARIZATION_SEGMENTATION_MODEL_PATH=.models/diarization/segmentation.onnx
 *   DIARIZATION_EMBEDDING_MODEL_PATH=.models/diarization/embedding.onnx
 *
 * Sources (see docs/exec-plans/completed/v3/speaker-diarization.md for licenses):
 * - pyannote/segmentation-3.0 (MIT), converted ONNX from sherpa-onnx releases.
 * - 3D-Speaker ERes2Net speaker embedding (Apache-2.0).
 */
import { execFile } from "node:child_process";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MODELS_DIR = join(import.meta.dirname, "..", ".models", "diarization");

const SEGMENTATION_ARCHIVE_URL =
  "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2";
const EMBEDDING_URL =
  "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx";

async function exists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function download(url: string, destination: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${url}`);
  }
  await writeFile(destination, new Uint8Array(await response.arrayBuffer()));
}

async function fetchSegmentationModel() {
  const target = join(MODELS_DIR, "segmentation.onnx");
  if (await exists(target)) {
    console.log(`segmentation model already present: ${target}`);
    return;
  }

  console.log("downloading pyannote segmentation-3.0 (ONNX)...");
  const archive = join(MODELS_DIR, "segmentation.tar.bz2");
  await download(SEGMENTATION_ARCHIVE_URL, archive);

  const extracted = join(MODELS_DIR, "sherpa-onnx-pyannote-segmentation-3-0");
  await execFileAsync("tar", ["xf", archive, "-C", MODELS_DIR]);

  await rename(join(extracted, "model.onnx"), target);
  await rm(extracted, { force: true, recursive: true });
  await rm(archive, { force: true });
  console.log(`segmentation model ready: ${target}`);
}

async function fetchEmbeddingModel() {
  const target = join(MODELS_DIR, "embedding.onnx");
  if (await exists(target)) {
    console.log(`embedding model already present: ${target}`);
    return;
  }

  console.log("downloading 3D-Speaker ERes2Net embedding (ONNX)...");
  await download(EMBEDDING_URL, target);
  console.log(`embedding model ready: ${target}`);
}

await mkdir(MODELS_DIR, { recursive: true });
await fetchSegmentationModel();
await fetchEmbeddingModel();
console.log("done.");
