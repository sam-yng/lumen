# Reliability

How Lumen stays correct under failure.

- **Backpressure:** `bun run check` gates every patch; pre-commit + CI enforce.
  See [BACKPRESSURE.md](../BACKPRESSURE.md).
- **Transcription pipeline (M4):** pg-boss jobs are retryable; a `recordings`
  row tracks `status` (`pending`/`processing`/`done`/`failed`) and stores the
  error on failure so the UI can offer retry.
- **Auth:** session verified server-side with `getUser()` (revalidates), not
  just routing.

## Transcription pipeline

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
