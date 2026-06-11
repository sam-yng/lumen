# v3 Advanced Capture & Retrieval Planning Group (m2+)

> **Status:** queued — m2 (streaming transcription) and m3 (speaker
> diarization) shipped 2026-06-10 and moved to
> [`completed/v3/`](../../completed/v3/streaming-transcription.md) 2026-06-11;
> m4 (citation experience) is the remaining child. Promote child plans to
> `active/v3/` as implementation begins (see Promotion Rule).
> **Version:** v3
> **Area:** transcription pipeline, diarization, assistant/citation UX
> **Created:** 2026-06-10
> **Depends on:** [`completed/v3/index.md`](../../completed/v3/index.md) (m1,
> cited retrieval), [`completed/v1/m4-transcription.md`](../../completed/v1/m4-transcription.md),
> [`completed/v2/semantic-search.md`](../../completed/v2/semantic-search.md),
> [`completed/v2/in-app-assistant.md`](../../completed/v2/in-app-assistant.md)
> **Supersedes:** none — continues the v3 release after the completed m1 group;
> does not reopen it.

## Goal

Complete the v3 release: make transcription **real-time** (live capture during
a lecture) and **multi-speaker** (populate the `transcript_segments.speaker`
field reserved in v1), and finish "retrieval cites its sources" by making the
m1 `[S#]` citations **clickable** — linking back to the exact transcript
segment and timestamp.

## Source Material

- v3 outline (release scope): live/streaming transcription, speaker
  diarization, citations/source-grounded answers.
- m1 design spec: [`docs/superpowers/specs/2026-06-09-v3-cited-retrieval-design.md`](../../../superpowers/specs/2026-06-09-v3-cited-retrieval-design.md)
  — its Out Of Scope list seeds m4 and the deferred items below.
- Transcription seam: `apps/web/worker/transcription-provider.ts`,
  `apps/web/worker/transcription-worker.ts` (pg-boss `transcribe-recording`).
- Retrieval/citation seam: `apps/web/src/server/services/grounded-retrieval.ts`,
  `apps/web/src/server/mcp/`, `apps/web/src/server/services/assistant.ts`.
- Security model: [`docs/SECURITY.md`](../../../SECURITY.md) (worker service-role
  caveat applies to any new ingest path).

## Child Plans

Implement as separate plans so each can ship and be reviewed on its own:

1. [streaming-transcription.md](../../completed/v3/streaming-transcription.md) —
   **milestone 2** (completed 2026-06-10):
   live capture in the browser → incremental transcript → finalize into the
   existing recordings/transcripts/segments + semantic-index pipeline. Adds a
   streaming provider beside the batch `TranscriptionProvider`; never replaces it.
2. [speaker-diarization.md](../../completed/v3/speaker-diarization.md) —
   **milestone 3** (completed 2026-06-10): populate
   `transcript_segments.speaker` on the batch pipeline via a local, free
   diarization step merged onto Whisper segments by time overlap. The viewer
   already renders speaker labels conditionally.
3. [citation-experience.md](citation-experience.md) — **milestone 4**: thread
   m1 `GroundedSource[]` through assistant turns and render `[S#]` as clickable
   citations — transcript sources deep-link the transcript viewer to the cited
   segment + timestamp; document sources open the note.

## Sequencing

1. **m2 streaming transcription first** — the largest unknown (engine +
   transport spike) and the headline capture feature; lands the
   `StreamingTranscriptionProvider` seam diarization may later reuse.
2. **m3 diarization second** — batch pipeline only; merging speaker turns onto
   segments is independent of how the audio arrived, but sequencing it after m2
   avoids two concurrent rewrites of the worker pipeline.
3. **m4 citation experience** — independent of m2/m3 (it touches the assistant
   UI and transcript-viewer deep links, not the audio pipeline) and may be
   pulled forward or run in parallel if capture work stalls. Note: its full
   manual happy-path requires a working assistant, i.e. the same real-Claude-key
   gate tracked in
   [prod-assistant-verification.md](../../active/production/prod-readiness/prod-assistant-verification.md);
   build verification (tests with fixture turns) does not.

Each child plan opens with a **decision spike** (engine/transport choices are
listed, not pre-decided). Resolve the spike and record the decision in the plan
before building — rule #1 still applies per milestone.

## Non-Negotiables

- **Free/local only.** No paid transcription, diarization, embedding, or LLM
  APIs anywhere in this group.
- **The batch pipeline stays the default and stays untouched.** Streaming is an
  additive implementation behind a new seam; `nodejs-whisper` batch jobs keep
  working byte-for-byte. Diarization failures degrade to `speaker: null` and
  never fail a transcription job.
- **Reuse the v1 schema.** Diarization writes the existing
  `transcript_segments.speaker` column; no new semantic-chunk columns. Any new
  migration (e.g. a live recording status) must be explicitly scoped in the
  child plan that needs it.
- **Live-captured content is a first-class citizen.** Finalized live sessions
  flow through the same transcript write + semantic indexing path so search,
  citations, and the transcript viewer work on them with no special cases.
- **Every path stays user-scoped.** New ingest endpoints authenticate the
  Supabase user; anything running with the service role scopes every query by
  `user_id` (worker caveat in `docs/SECURITY.md`).
- **Existing contracts are frozen:** `/api/search` + sidebar `SearchPanel`,
  `searchLibrary`'s `SearchResult[]`, and the MCP `search_notes`
  `{ query, sources }` shape all stay unchanged.

## Deferred Beyond v3 (decided, with rationale)

- **Server-built `answer_question` service with citation validation** — m1
  deliberately kept answer composition in the model; revisit in v4 once the
  citation UX shows where validation is actually needed.
- **Reranking** — the outline marks it optional; no measured retrieval-quality
  gap yet. Add only when grounded answers demonstrably miss sources hybrid
  ranking should have surfaced.
- **Document text offsets / paragraph anchors** — v2 document chunks store no
  offsets; would need re-chunking. Document citations open the note (m4) without
  them.
- **Streaming diarization and realtime collaboration** — out of v3 entirely.

## Promotion Rule

Move a child plan from `queued/` to `active/` only when implementation begins,
into the same-named `v3` bucket, updating
[`PLANS.md`](../../../PLANS.md) in the same change so the index remains
trustworthy. Do not reopen
[`completed/v3/index.md`](../../completed/v3/index.md); when all children here
ship, complete this group the same way that one was completed.

## Self-Review

- **Covers the whole v3 outline:** live/streaming transcription (m2),
  diarization (m3), and the remaining citations work (m4 — m1 shipped the
  contract; m4 ships the link-back UX). Chunking strategy already exists from
  v2; reranking is explicitly deferred with rationale rather than silently
  dropped.
- **Builds on shipped seams, doesn't reshape them:** streaming is additive
  beside `TranscriptionProvider`; diarization fills a reserved column; m4
  consumes `GroundedSource[]` as-is.
- **Honors the m1 completion note:** fresh group, new bucket under `queued/`,
  the completed group untouched except a forward pointer.
- **Each milestone is independently shippable and reviewable** (working rules
  #3–#4), with spikes scoped where real engine/transport decisions remain.
