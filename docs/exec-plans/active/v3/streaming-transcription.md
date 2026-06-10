# Streaming Transcription Plan (v3 Milestone 2)

> **Status:** active — spike resolved (see Decision Record); implementation in
> progress on `feat/v3-streaming-transcription`.
> **Version:** v3
> **Area:** transcription pipeline, live capture, worker
> **Created:** 2026-06-10
> **Depends on:** [`completed/v1/m4-transcription.md`](../../completed/v1/m4-transcription.md),
> [`completed/v2/semantic-search.md`](../../completed/v2/semantic-search.md)
> **Supersedes:** none
> **Design:** spike-first — Task 1 produced the engine/transport decision
> recorded below; no separate superpowers design spec was written.

## Goal

Let a user start a **live session** during a lecture: the browser captures
microphone audio, an incremental transcript appears while they listen, and on
stop the session **finalizes into the existing pipeline** — a `recordings` row,
audio in Storage, a `transcripts` + `transcript_segments` write, and semantic
indexing — so playback, search, citations, and the transcript viewer work on
live-captured lectures with no special cases.

## Decision Record (Task 1 spike — resolved 2026-06-10)

**Engine: browser-side Transformers.js** (`@huggingface/transformers`, Whisper
ONNX, WebGPU with WASM fallback). **Transport: plain authenticated `POST`s of
finished segments** to a live-session service — no WebSockets, no SSE.

Against the evaluation criteria:

- **Latency:** inference is on-device, so interim text needs no audio
  round-trip; only small JSON segment payloads cross the wire.
- **Quality vs batch:** the live path runs the same Whisper model family
  (`base` tier ONNX export) as the batch `nodejs-whisper` pipeline
  (`WHISPER_MODEL=base.en`); interim text is provisional by design and the
  finalized transcript is what search/citations consume.
- **CPU/memory:** compute scales with users' devices, not server cores. The
  server-side option costs one whisper.cpp realtime session per concurrent
  user on app-server CPU — the worst possible fit for a multi-tenant app on
  free/local infrastructure.
- **Windows + CI dev story:** no native addon to build on Windows; CI never
  runs the model (unit tests drive the session service with a fake segment
  source, exactly like batch tests fake `TranscriptionProvider`).
- **Deployment fit:** Next.js App Router route handlers host the whole
  transport; no WebSocket server bolted onto the worker process.

**Rejected: `@kutalia/whisper-node-addon` (server whisper.cpp streaming).**
Native-addon risk on the Windows dev machine and in CI, per-session server CPU
cost, and it forces the hard transport problem (App Router cannot host
WebSockets natively, so it needs chunked audio upload + SSE or a separate WS
endpoint on the worker). Nothing in the m2 scope needs server-side audio
inference; m3 diarization is batch-only and unaffected.

**Session state: server-persisted, with a new `recording_status` value
`live`.** `startLiveSession` creates the `files` row (reserved storage key,
`size_bytes 0`), a `recordings` row in status `live`, and the `transcripts`
row up front; `appendLiveSegments` durably inserts finalized segments as they
arrive, so a tab crash mid-lecture loses at most the audio blob and unsent
tail, not the transcript text. One migration adds `live` to the
`recording_status` enum (scoped here, per the group non-negotiables).
Finalization uploads the full audio (client-side `MediaRecorder` artifact) to
the reserved key and rewrites the transcript through
`writeRecordingTranscript`, which is exactly the batch path's write: same
delete-and-rewrite, same duration/status handling, same (currently unwired,
same-as-batch) semantic-indexing hook — the recording ends in `done`
byte-for-byte like a batch job.

**Interim vs final:** interim segments are a client-side display concern only;
the `StreamingTranscriptionProvider` seam emits both, and only `final`
segments are POSTed. Audio never leaves the device until finalization.

**Known limitation (accepted, tracked):** a session abandoned mid-capture
(tab closed/crashed) leaves a recording in `live` status with no audio object;
it is visible in the library and deletable via the existing file-delete flow,
but cannot be resumed (pause/resume across reloads is explicitly out of
scope). Logged in `tech-debt-tracker.md`.

## Scope

- **`StreamingTranscriptionProvider` seam** — client-side per the spike
  (`apps/web/src/lib/transcription/`): session-based — start a session, push
  audio, receive interim + final `TranscriptionSegment`s
  (`startMs`/`endMs`/`text`, `speaker: null`), finish. Implemented by
  `TransformersStreamingTranscriptionProvider` backed by a Web Worker running
  Whisper via `@huggingface/transformers`. The batch `TranscriptionProvider`
  interface and `WhisperTranscriptionProvider` are untouched.
- **Live-session service** (`apps/web/src/server/services/live-sessions.ts`):
  create/append/finalize/cancel for the authenticated user; enforces per-user
  scoping like every other service. Migration: `recording_status` gains
  `live`.
- **Capture UI**: mic capture (MediaRecorder for the storage artifact +
  AudioContext PCM tap for ASR), a live transcript view with interim text,
  start/stop/discard controls, clear error/permission states.
- **Finalization**: full audio uploaded via the existing `StorageProvider`;
  segments written through `writeRecordingTranscript`; recording ends in
  `done` exactly like a batch job.

## Out Of Scope

- Diarization on the live path (m3 is batch-only; streaming diarization is
  deferred beyond v3).
- Translation, mobile capture, pause/resume across page reloads, realtime
  collaboration.
- Any change to the batch worker, queue names, or existing job payloads.

## Verification Gate

- `bun run check` green.
- Unit tests: a fake streaming provider drives the session service (interim →
  final segment ordering, finalization writes, failure → recording `failed`
  with error, cross-user access rejected).
- Manual happy path (working rule #3): record a short live session with a real
  microphone in the browser, watch incremental text appear, stop, then confirm
  the finalized recording plays back with synced segments in the transcript
  viewer and is findable via search.

## Verification Record (2026-06-10)

- `bun run check` green (Biome + typecheck + 171 unit tests, incl.
  `live-sessions.test.ts` per the gate above and `whisper-output.test.ts`).
- `bun run build` green — Turbopack bundles the ASR Web Worker.
- Happy path executed end-to-end in a real Chromium against the local stack
  via `e2e/live-session.spec.ts` (gated behind `LIVE_SESSION_E2E=1`; fake
  microphone fed a Windows-TTS WAV): live page → start → on-device Whisper
  produced incremental text → stop & save → transcript page reached `done`
  with the spoken words rendered → file findable via library search with real
  audio bytes uploaded. A human real-microphone pass remains worthwhile at
  milestone review but the full pipeline is browser-verified.
- **Fix found by verification:** transformers.js caches its first
  session-init promise per worker, so a failed WebGPU init poisoned the WASM
  fallback. The worker now probes `requestAdapter()` before choosing WebGPU,
  and the provider respawns a WASM-forced worker (replaying retained audio)
  if a WebGPU load still fails.
