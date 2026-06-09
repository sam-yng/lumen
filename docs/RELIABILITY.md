# Reliability

How Lumen stays correct under failure.

- **Backpressure:** `bun run check` gates every patch; pre-commit + CI enforce.
  PR CI also runs the Supabase-backed Playwright smoke suite after the fast
  gate. See [BACKPRESSURE.md](../BACKPRESSURE.md).
- **Transcription pipeline (M4):** pg-boss jobs are retryable; a `recordings`
  row tracks `status` (`pending`/`processing`/`done`/`failed`) and stores the
  error on failure so the UI can offer retry.
- **Auth:** session verified server-side with `getUser()` (revalidates), not
  just routing.

## Transcription pipeline

## CI pipeline

Pull requests run two checks:

1. `quality-gate` installs dependencies with Bun 1.3.14 and runs
   `bun run check`. This covers Biome, TypeScript, unit tests, and
   integration-style Vitest tests without a live database.
2. `e2e-smoke` starts the local Supabase stack from `apps/web`, resets the DB
   to migrations plus seed data, installs Chromium, and runs
   `bun run test:e2e`. This covers the seeded authenticated library route,
   upload picker, and tag smoke paths in Chromium.

Audio upload creates a `files` row, a `recordings` row in `pending`, and one
pg-boss job on `transcribe-recording`. The worker marks the recording
`processing`, downloads the private Storage object, runs local Whisper, writes
one `transcripts` row plus ordered `transcript_segments`, then marks the
recording `done`.

If download/transcription/write fails, the worker stores the error string on the
recording and marks it `failed`. The UI can retry only `failed` recordings;
retry resets status to `pending` and enqueues a new job. `pending`,
`processing`, and `done` recordings reject retry.

Temporary audio files are removed in the worker after success or failure.
