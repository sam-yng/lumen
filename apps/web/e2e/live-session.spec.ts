import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

// Manual verification harness for the v3 m2 live-session happy path.
//
// Skipped unless LIVE_SESSION_E2E=1: it downloads the Whisper ONNX model
// (~80 MB, Hugging Face) into the browser on first run and needs a fake
// microphone WAV, so it is not part of the regular suite. Generate the WAV
// with Windows TTS, then run:
//
//   Add-Type -AssemblyName System.Speech
//   $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
//   $s.SetOutputToWaveFile("$env:TEMP\lumen-live-session-speech.wav")
//   $s.Speak("Photosynthesis converts sunlight into chemical energy...")
//   $s.Dispose()
//
//   $env:LIVE_SESSION_E2E = "1"; bun run test:e2e e2e/live-session.spec.ts
const enabled = process.env.LIVE_SESSION_E2E === "1";
const wavPath =
  process.env.LIVE_SESSION_WAV ??
  join(process.env.TEMP ?? "/tmp", "lumen-live-session-speech.wav");

test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${wavPath}`,
    ],
  },
});

test("live session records, streams a transcript, and finalizes", async ({
  page,
}) => {
  test.skip(!enabled, "Set LIVE_SESSION_E2E=1 to run the live capture check.");
  test.skip(!existsSync(wavPath), `Fake microphone WAV missing: ${wavPath}`);
  test.setTimeout(600_000);

  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@lumen.test");
  await page.getByLabel("Password").fill("demo12345");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/library$/);

  await page.getByRole("button", { name: "Live session" }).click();
  await expect(page).toHaveURL(/\/library\/live$/);

  // Unique per run so leftovers from earlier runs can't match the search.
  const sessionName = `Biology live capture ${Date.now()}`;
  await page.getByLabel("Session name").fill(sessionName);
  await page.getByRole("button", { name: "Start recording" }).click();

  // Recording starts immediately; the model loads in the background and the
  // first final segment appears once the first 12s window is transcribed.
  await expect(page.getByText("recording", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByText(/photosynthesis|mitochondria|enzyme|osmosis|powerhouse/i),
  ).toBeVisible({ timeout: 300_000 });

  await page.getByRole("button", { name: "Stop & save" }).click();

  // Flushing the ASR tail + uploading + finalizing can take a while on CPU.
  await expect(page).toHaveURL(/\/library\/transcripts\/[0-9a-f-]+$/i, {
    timeout: 300_000,
  });
  await expect(page.getByText("done", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page
      .getByText(/photosynthesis|mitochondria|enzyme|osmosis|powerhouse/i)
      .first(),
  ).toBeVisible();

  // The finalized session is findable via library search by its file name;
  // the search-result button's accessible name carries the mime + byte size,
  // which distinguishes it from the library row's rename/delete buttons.
  await page.getByRole("link", { name: "Back to library" }).click();
  await page.getByLabel("Search notes and transcripts").fill(sessionName);
  await expect(
    page.getByRole("button", {
      name: new RegExp(`${sessionName} audio/`, "i"),
    }),
  ).toBeVisible({ timeout: 15_000 });
});
