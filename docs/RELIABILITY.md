# Reliability

How Lumen stays correct under failure.

- **Backpressure:** `bun run check` gates every patch; pre-commit + CI enforce.
  See [BACKPRESSURE.md](../BACKPRESSURE.md).
- **Transcription pipeline (M4):** pg-boss jobs are retryable; a `recordings`
  row tracks `status` (`pending`/`processing`/`done`/`failed`) and stores the
  error on failure so the UI can offer retry.
- **Auth:** session verified server-side with `getUser()` (revalidates), not
  just routing.

Status: stub — expand as the worker and job semantics land in M4.
