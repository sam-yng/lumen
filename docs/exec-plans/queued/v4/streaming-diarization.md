# Streaming Diarization Plan (v4 Milestone 4)

> **Status:** queued
> **Version:** v4
> **Area:** live transcription path, worker
> **Created:** 2026-06-11
> **Depends on:** [`completed/v3/streaming-transcription.md`](../../completed/v3/streaming-transcription.md)
> (live-session service + finalize path),
> [`completed/v3/speaker-diarization.md`](../../completed/v3/speaker-diarization.md)
> (batch `DiarizationProvider` + `speaker-merge.ts`, both reusable here).
> **Supersedes:** none — v3 m3 explicitly excluded the live path
> ("the live path never labels speakers").
> **Design:** spike-first — Task 1 decides where diarization runs; if a
> superpowers design spec is written for it, link it here before build.

## Goal

Bring speaker labels to live-captured sessions. A student recording a seminar
live currently gets `speaker: null` on every segment forever, while the same
audio uploaded as a file gets "Speaker 1/2" labels (v3 m3). Close that gap.

## Decision Spike (Task 1 — resolve before building)

Where diarization runs for live sessions. Key fact from scoping:
`finalizeLiveSession` (`services/live-sessions.ts`) **uploads the full session
audio to storage** — so the finalized recording has exactly what the batch
diarizer needs.

1. **Post-finalize batch labeling (cheap, likely-first):** on finalize,
   enqueue a label-speakers job that runs the existing v3
   `DiarizationProvider` + `speaker-merge` over the uploaded audio and
   **updates** the already-written segments' `speaker` column. Labels appear
   shortly after the session ends, not during it. Near-zero new ML surface;
   the spike must resolve how the worker updates segments user-scoped
   (service-role caveat) and how re-indexing/semantic chunks are or aren't
   affected (speaker is not embedded today — verify).
2. **True in-browser live labeling:** run segmentation + speaker-embedding
   ONNX models in the browser (onnxruntime-web / Transformers.js) beside the
   live Whisper worker, labeling segments as they stream. Real "Speaker 2 is
   talking" UX, but heavy: model download size, CPU/WebGPU contention with
   ASR, and online clustering of speaker embeddings is genuinely hard.
3. **Hybrid:** ship option 1 as the v4 deliverable; record option 2 as a
   measured spike result (feasible / not yet) rather than a promise.

Evaluation criteria: label quality vs the batch path on the same audio, time
to labels after session end, browser resource cost (option 2), and how much
new code the live path takes on. Record the decision and rejected
alternatives here, then build.

## Scope

- Per the spike decision; for option 1 (the likely floor):
  - A post-finalize labeling job (pg-boss, existing worker process) gated by
    the existing `DIARIZATION_ENABLED` env; reuses `DiarizationProvider` and
    the overlap-merge logic against stored live segments.
  - Segment `speaker` updates scoped by `user_id` (worker runs service-role —
    `docs/SECURITY.md` caveat applies to this new write path).
  - Transcript viewer needs no changes (already renders `speaker`
    conditionally); live UI may show a "labeling speakers…" state after
    finalize.
- **Degrade, never fail** (inherited from v3 m3): any labeling error leaves
  the finalized transcript exactly as it was (`speaker: null`), recording
  status stays `done`.

## Out Of Scope

- Speaker *identification* (real names, voice profiles, cross-recording
  matching) — same exclusion as v3 m3.
- Any change to the batch pipeline or to `nodejs-whisper` jobs.
- Backfilling previously-finalized live sessions (a re-label action can be a
  follow-up if wanted).
- Realtime collaboration features of any kind.

## Verification Gate

- `bun run check` green.
- Unit tests: labeling job with a fake `DiarizationProvider` updates the
  right segments for the right user; labeling failure leaves segments
  untouched and the recording `done`; env-off means no job enqueued.
- Manual happy path (working rule #3): record a live session with two
  speakers, finalize, and see distinct speaker labels appear in the
  transcript viewer; verify a batch upload of the same audio labels
  comparably.
