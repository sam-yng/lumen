/**
 * Build-time fetch of the whisper model so the worker image ships ready-to-run
 * (avoids a ~142MB download on the first job / every cold start).
 *
 * `nodejs-whisper@0.3.0` exposes only `nodewhisper` from its package root; the
 * non-interactive download lives at `dist/autoDownloadModel.js` (default
 * export, signature: `(logger, modelName, withCuda?, modelRootPath?)`). If that
 * deep path changes in a future version, we degrade gracefully: the worker's
 * `whisper-provider.ts` sets `autoDownloadModelName`, so the model lazily
 * downloads at the first job anyway. This script is an optimisation, not
 * correctness-critical.
 */

const model = process.env.WHISPER_MODEL ?? "base.en";

async function main() {
  let autoDownloadModel:
    | ((
        logger: Console,
        modelName: string,
        withCuda?: boolean,
        modelRootPath?: string,
      ) => Promise<string>)
    | undefined;

  try {
    const mod = await import("nodejs-whisper/dist/autoDownloadModel.js");
    autoDownloadModel = (mod.default ?? mod) as typeof autoDownloadModel;
  } catch {
    // deep path unavailable
  }

  if (typeof autoDownloadModel !== "function") {
    console.warn(
      "[download-whisper-model] autoDownloadModel unavailable; model will lazy-download at first job.",
    );
    return;
  }

  await autoDownloadModel(console, model);
  console.log(`[download-whisper-model] ${model} ready.`);
}

main().catch((err) => {
  console.error("[download-whisper-model] pre-download failed:", err);
  process.exitCode = 1;
});
