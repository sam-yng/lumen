# Speaker Diarization Plan (v3 Milestone 3)

> **Status:** queued
> **Version:** v3
> **Area:** transcription pipeline, worker
> **Created:** 2026-06-10
> **Depends on:** [`completed/v1/m4-transcription.md`](../../completed/v1/m4-transcription.md);
> sequenced after [streaming-transcription.md](../../active/v3/streaming-transcription.md)
> (promoted to active 2026-06-10) to avoid concurrent worker-pipeline rewrites
> (no hard code dependency).
> **Supersedes:** none
> **Design:** spike-first — Task 1 produces the engine decision; if a
> superpowers design spec is written for it, link it here before build.

## Goal

Populate the `transcript_segments.speaker` column reserved in v1 so
multi-speaker recordings (seminars, tutorials) show speaker labels — e.g.
"Speaker 1" / "Speaker 2" — in the transcript viewer, which already renders the
field conditionally (`transcript-viewer.tsx`). Batch pipeline only.

## Decision Spike (Task 1 — resolve before building)

Free/local engine options (the m1 spec already flagged "Python sidecar
evaluation" as a known candidate):

1. **whisper.cpp tinydiarize (`-tdrz`)** — stays in the existing
   `nodejs-whisper`/whisper.cpp family; speaker-turn tokens come out of the
   same pass. Cheapest to integrate; known weakest on >2 speakers.
2. **sherpa-onnx speaker diarization** — Node bindings over local ONNX
   segmentation + speaker-embedding models; no Python. Check model licenses
   (pyannote-derived segmentation models carry HF gating/terms).
3. **Python sidecar (pyannote.audio or similar)** — likely best accuracy;
   costs a second runtime (venv, packaging, Windows dev) and a process seam.

Evaluation criteria: label accuracy on real 2–4-speaker seminar audio, CPU
runtime relative to transcription itself, integration complexity (Node-only
strongly preferred), and license terms. Record the decision and rejected
alternatives in this plan, then build.

## Scope

- **`DiarizationProvider` seam** in `apps/web/worker/`:
  `diarize(audioPath): Promise<SpeakerTurn[]>` where `SpeakerTurn` is
  `{ startMs, endMs, speaker }`. One implementation per the spike decision.
- **Merge step** in the worker pipeline: after (or alongside) transcription,
  assign each `TranscriptionSegment` the speaker of the turn with the largest
  time overlap (ties → earliest turn; no overlap → `speaker: null`) before
  `writeRecordingTranscript`. Pure function, unit-tested.
- **Degrade, never fail:** diarization is toggleable via env
  (`config/env.ts`), and any diarization error logs and falls back to
  `speaker: null` — the transcription job still completes `done`.
- **Surfaces for free:** the viewer already renders `segment.speaker`;
  `get_transcript` MCP results already carry segment rows. No retrieval or
  citation contract changes.

## Out Of Scope

- Diarization on the live/streaming path (deferred beyond v3).
- Speaker *identification* (naming real people), voice profiles, or
  cross-recording speaker matching.
- Backfilling existing recordings (a re-transcribe action can be a follow-up if
  wanted).
- New schema — `transcript_segments.speaker` (TEXT, nullable) already exists.

## Verification Gate

- `bun run check` green.
- Unit tests: overlap-merge pure function (containment, partial overlap, ties,
  gaps → null); worker pipeline with a fake `DiarizationProvider`; diarization
  failure still yields a `done` recording with null speakers.
- Manual happy path (working rule #3): upload a real multi-speaker recording,
  confirm distinct speaker labels render in the transcript viewer and segment
  text/timing is unchanged from a no-diarization run.
