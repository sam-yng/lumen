# Streaming Transcription Plan (v3 Milestone 2)

> **Status:** queued
> **Version:** v3
> **Area:** transcription pipeline, live capture, worker
> **Created:** 2026-06-10
> **Depends on:** [`completed/v1/m4-transcription.md`](../../completed/v1/m4-transcription.md),
> [`completed/v2/semantic-search.md`](../../completed/v2/semantic-search.md)
> **Supersedes:** none
> **Design:** spike-first — Task 1 produces the engine/transport decision; if a
> superpowers design spec is written for it, link it here before build.

## Goal

Let a user start a **live session** during a lecture: the browser captures
microphone audio, an incremental transcript appears while they listen, and on
stop the session **finalizes into the existing pipeline** — a `recordings` row,
audio in Storage, a `transcripts` + `transcript_segments` write, and semantic
indexing — so playback, search, citations, and the transcript viewer work on
live-captured lectures with no special cases.

## Decision Spike (Task 1 — resolve before building)

Two free/local engine options, which imply different transports:

| | Server: `@kutalia/whisper-node-addon` | Browser: Transformers.js |
|---|---|---|
| Where compute runs | app server / worker CPU (whisper.cpp PCM streaming) | user's device (WASM/WebGPU Whisper) |
| What goes over the wire | PCM/audio chunks up | only text segments up |
| Consistency with batch | same whisper.cpp family/models as v1 | different runtime + model weights |
| Risk profile | server CPU load per concurrent session; native addon on Windows dev | device capability variance; large first-load model download |

Evaluation criteria: end-to-end latency to first/updated text, transcript
quality vs the current batch model, CPU/memory footprint, Windows + CI dev
story, and deployment fit. Also decide the **transport**: Next.js App Router
route handlers do not host WebSockets natively, so candidates are chunked
`POST` + SSE for interim results, a WebSocket endpoint on the worker process,
or (if in-browser) plain `POST`s of finished segments. Record the decision and
rejected alternatives in this plan, then build.

## Scope

- **`StreamingTranscriptionProvider` seam** in `apps/web/worker/` (or shared
  server code, per spike): session-based — start a session, push audio chunks,
  receive interim + final `TranscriptionSegment`s (`startMs`/`endMs`/`text`,
  `speaker: null`), finish. The batch `TranscriptionProvider` interface and
  `WhisperTranscriptionProvider` are untouched.
- **Live-session service** (`apps/web/src/server/services/`): create/append/
  finalize a session for the authenticated user; enforces per-user scoping like
  every other service. Session state and any new `recording_status` value (e.g.
  `live`) are decided in the spike; a migration, if needed, is scoped here.
- **Capture UI**: mic capture (MediaRecorder/AudioWorklet), a live transcript
  view with interim text, start/stop controls, clear error/permission states.
- **Finalization**: full audio uploaded via the existing `StorageProvider`;
  segments written through `writeRecordingTranscript` (or an equivalent that
  reuses its duration/status/semantic-indexing behavior); recording ends in
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
