# Streaming Diarization Plan (v4 Milestone 4)

> **Status:** active — spike resolved 2026-06-11 (see Decision), build in progress.
> Promoted `queued/v4/ → active/v4/` 2026-06-11.
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

### Decision (2026-06-11): post-finalize batch labeling (option 1)

Code spike over the shipped v3 seams resolved every open question — and
surfaced one constraint the scoping missed:

- **`finalizeLiveSession` uploads the full session audio** to the file's
  `storage_key` (`services/live-sessions.ts`), so the labeling job can reuse
  the exact `{ userId, recordingId, fileId, storageKey }` payload shape and
  download path the batch transcription job uses.
- **The audio is always webm, and sherpa-onnx reads WAV only.** Live capture
  records `audio/webm` (MediaRecorder), and the v3 m3 provider's accepted
  input constraint is WAV (`sherpa.readWave`; non-WAV degrades to null).
  Without a conversion step, option 1 would never label anything. ffmpeg is
  already a hard host/runtime dependency of the worker (`nodejs-whisper`
  converts non-WAV uploads with it; the prod worker Dockerfile installs it),
  so the labeling job converts to 16 kHz mono WAV via ffmpeg — **zero new
  host dependencies**, degrade-never-fail wraps the conversion.
- **`speaker` is not embedded — verified.** `chunkTranscript`
  (`services/semantic-chunking.ts`, called from `semantic-index.ts`) consumes
  only segment text + times. Updating `speaker` post-finalize requires no
  re-chunking or re-embedding, and the finalize path doesn't index live
  segments' speaker either way.
- **User-scoped worker updates resolve transitively.** `transcript_segments`
  has no `user_id` column; the job loads the transcript by `recording_id` +
  `user_id` (payload `userId` comes from the authenticated enqueue path, as
  with transcription jobs) and only then updates segments by `transcript_id`.
  Same pattern as existing worker reads; documented in `docs/SECURITY.md`.
- **No race with finalize.** `writeRecordingTranscript` deletes and reinserts
  segment rows during finalize; the labeling job is enqueued only after
  finalize succeeds and reads fresh segment rows at job time.
- **Label quality vs batch:** identical by construction — same provider, same
  models, same overlap-merge (`speaker-merge.ts`), same audio (modulo the
  webm→WAV decode). Time-to-labels is one queue poll (~2 s) plus diarization
  runtime (~¼× realtime on the v3 spike hardware).

**Rejected — option 2 (true in-browser live labeling):** not spiked, and
recorded honestly as *not measured* rather than "infeasible". Assessed as not
worth the cost while option 1 closes the entire user-visible gap: it would add
a second in-browser model download (pyannote segmentation + ERes2Net speaker
embedding, ~75 MB combined) beside live Whisper, contend for CPU/WebGPU with
ASR mid-session, and require online (incremental, label-stable) clustering of
speaker embeddings — a genuinely hard problem the batch path sidesteps
entirely. Revisit only if post-finalize labels prove insufficient in use.

**Build shape:** new pg-boss queue `label-speakers` handled by the existing
worker process; the finalize route enqueues after `finalizeLiveSession`
succeeds, gated by `DIARIZATION_ENABLED` (enqueue failure logs and never
fails the finalize response). The optional "labeling speakers…" UI state is
**omitted deliberately**: it would need job-state tracking (schema or
polling surface) this milestone doesn't justify — labels appear on the next
transcript view.

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

- [x] `bun run check` green (2026-06-11).
- [x] Unit tests: labeling job with a fake `DiarizationProvider` updates the
  right segments for the right user; labeling failure leaves segments
  untouched and the recording `done`; env-off means no job enqueued.
  (`worker/__tests__/speaker-label-worker.test.ts`,
  `queue/__tests__/transcription-jobs.test.ts`,
  `worker/__tests__/audio-convert.test.ts`.)
- [x] Manual happy path (working rule #3, 2026-06-11): a 41 s two-speaker
  session (two distinct Windows TTS voices alternating over six turns,
  encoded webm/opus like MediaRecorder) was driven through the **real** HTTP
  routes — start → append segments → finalize — against local Supabase with
  `DIARIZATION_ENABLED=true`; the worker picked up the `label-speakers` job,
  converted with ffmpeg, diarized, and all six segments came back labeled
  `Speaker 1`/`Speaker 2` turn-for-turn matching the voices; the transcript
  viewer rendered the alternating SPEAKER chips with audio playback intact.
- [x] Batch comparison: the batch-path diarization (same provider, original
  WAV, no conversion) over the same audio produced the same speaker
  structure (S1 ≈ 0–5 s / 12.6–18.1 s / 25.9–31.7 s, S2 in between) —
  labels comparable across both input forms.

### Verification notes (2026-06-11)

- The mic-capture step itself was simulated (no microphone in the
  verification environment): the live-capture browser UI (browser Whisper +
  MediaRecorder, untouched by this milestone) was bypassed by calling the
  same routes it calls. Worth a human spot-check with a real mic at review.
- A full batch **upload** of the same audio was not runnable on this
  machine: `nodejs-whisper` needs cmake/whisper.cpp which have never been
  set up locally (the long-standing FFmpeg/host-dep tech-debt row). The
  comparison above isolates the diarization stage, which is the only stage
  this milestone shares with the batch path.
- Local env additions for this feature: `apps/web/.env.local` gained
  `DIARIZATION_ENABLED=true` + the two model paths (models fetched via
  `bun run worker:diarization-models`); ffmpeg used a portable build on the
  worker's `PATH` — the prod worker Dockerfile already installs ffmpeg.
