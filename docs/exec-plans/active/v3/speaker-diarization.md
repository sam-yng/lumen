# Speaker Diarization Plan (v3 Milestone 3)

> **Status:** active
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

### Decision (2026-06-10): sherpa-onnx (option 2)

Spike run in a throwaway project against `sherpa-onnx-node` 1.13.2 with the
sherpa-onnx 4-speaker reference recording
(`0-four-speakers-zh.wav`, 56.9 s):

- **API works from Node directly** — `new OfflineSpeakerDiarization(config)` +
  `process(samples)` returns `{ start, end, speaker }` turns; the native addon
  (`sherpa-onnx-darwin-arm64`) installs cleanly via Bun.
- **Runtime:** 12.8 s CPU for 56.9 s of audio (~4.4× faster than realtime on an
  M-series laptop) — well under the cost of transcription itself.
- **Accuracy:** clustering-threshold sweep on the 4-speaker file:
  0.5 → 8 clusters (over-split), 0.7/0.8 → 5, **0.9 → exactly 4** with sensible
  turn structure. Default the threshold to 0.9 and keep it env-tunable.
- **Licenses:** `sherpa-onnx-node` Apache-2.0; segmentation model
  pyannote/segmentation-3.0 is **MIT** (the HF gate is a contact-info form
  only, and sherpa-onnx redistributes the converted ONNX in its GitHub
  releases); speaker-embedding model 3D-Speaker ERes2Net is Apache-2.0.

**Rejected — whisper.cpp tinydiarize:** `nodejs-whisper` 0.3.0 hardcodes its
model list and CLI flags (no `-tdrz`, no `small.en-tdrz`), so it would need a
fork or a raw `whisper-cli` bypass; the tdrz model is English-only; and it
emits speaker-*turn* marks without identity, so it cannot produce stable
"Speaker N" labels for >2 speakers — the stated goal.

**Rejected — Python sidecar (pyannote.audio):** second runtime
(venv/packaging/Windows dev) against the plan's strong Node-only preference;
sherpa-onnx runs the same pyannote segmentation model family and met the
accuracy bar in the spike.

**Input constraint (accepted):** sherpa-onnx reads WAV (non-16 kHz WAV is
linear-resampled in TS); non-WAV audio degrades to `speaker: null` with a log
line, per the degrade-never-fail rule. Whisper transcription is unaffected.
The worker does not auto-download models: paths come from env, and
`apps/web/scripts/fetch-diarization-models.ts` downloads the two ONNX files
for local dev.

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

- [x] `bun run check` green.
- [x] Unit tests: overlap-merge pure function (containment, partial overlap,
  ties, gaps → null); worker pipeline with a fake `DiarizationProvider`;
  diarization failure still yields a `done` recording with null speakers; and
  diarize-before-transcribe ordering (see below).
- [x] Manual happy path (working rule #3, 2026-06-10): uploaded a two-voice
  synthetic seminar WAV; the worker produced `Speaker 1`/`Speaker 2` labels
  matching the two voices turn-for-turn, and the transcript viewer rendered
  them per segment with text/timing identical to a no-diarization run.

### Build notes (2026-06-10)

- **Ordering bug found during the happy path:** the Whisper provider deletes
  its WAV input after transcribing, so running diarization after transcription
  saw ENOENT and silently degraded to null speakers (the degrade rule worked
  as designed). Fix: diarize first, then transcribe, then merge — pinned by a
  pipeline test.
- Models are fetched by `bun run worker:diarization-models` into
  `apps/web/.models/diarization/` (gitignored); worker env:
  `DIARIZATION_ENABLED`, `DIARIZATION_SEGMENTATION_MODEL_PATH`,
  `DIARIZATION_EMBEDDING_MODEL_PATH`, optional
  `DIARIZATION_CLUSTER_THRESHOLD` (default 0.9) and
  `DIARIZATION_NUM_SPEAKERS` (default -1 = auto).
