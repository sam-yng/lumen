# v4 Grounded Answers & Capture Hardening Planning Group

> **Status:** queued
> **Version:** v4
> **Area:** retrieval/citations, assistant, live transcription pipeline
> **Created:** 2026-06-11
> **Depends on:** [`completed/v3/index.md`](../../completed/v3/index.md) (m1,
> cited retrieval), [`completed/v3/index-m2-plus.md`](../../completed/v3/index-m2-plus.md)
> (m2–m4: streaming transcription, diarization, citation experience),
> [`completed/v2/semantic-search.md`](../../completed/v2/semantic-search.md),
> [`completed/v2/in-app-assistant.md`](../../completed/v2/in-app-assistant.md)
> **Supersedes:** none — continues the release sequence after the completed v3
> groups; does not reopen them.

## Goal

Deepen what v3 started, in both directions:

- **Grounding:** document citations land on the exact paragraph (not just the
  note), `[S#]` citations are **validated server-side** instead of trusted from
  the model, and retrieval quality is **measured** before deciding whether a
  reranker earns its keep.
- **Capture:** speaker labels reach the **live** path (v3 labels batch only),
  and live sessions can no longer be stranded in `live` status by a closed tab.

## Source Material

- The original roadmap handoff (`study-app-roadmap-v2-v4.md`) is no longer
  available on any current machine; v4 is scoped from the **in-repo deferred
  ledger** instead, per core belief #1 (the repo is the system of record):
  - [`completed/v3/index-m2-plus.md`](../../completed/v3/index-m2-plus.md)
    "Deferred Beyond v3" — `answer_question` citation validation ("revisit in
    v4"), reranking, document text offsets, streaming diarization.
  - [`tech-debt-tracker.md`](../../tech-debt-tracker.md) — abandoned live
    sessions stuck in `live`.
- Retrieval/citation seams: `apps/web/src/server/services/grounded-retrieval.ts`
  (`GroundedSource`), `services/assistant.ts`, `services/search.ts`,
  `services/semantic-chunking.ts`, `apps/web/src/server/mcp/`.
- Capture seams: `services/live-sessions.ts` (live segments are stored
  incrementally; finalize uploads the session audio), `apps/web/worker/`
  (`DiarizationProvider`, sherpa-onnx implementation, `speaker-merge.ts`).
- Citation UX shipped in v3 m4: `components/assistant/citations.tsx`,
  transcript deep links via `?segment=<id>` / `?t=<ms>`.
- Security model: [`docs/SECURITY.md`](../../../SECURITY.md).

## Child Plans

Implement as separate plans so each can ship and be reviewed on its own:

1. [document-anchors.md](../../completed/v4/document-anchors.md) — **milestone 1
   (completed)**: paragraph anchors for document chunks (re-chunking pass + anchor metadata), so
   document citations deep-link to the cited paragraph the way transcript
   citations deep-link to the segment. Finalizes the `GroundedSource` shape
   the rest of the group consumes.
2. [grounded-answers.md](../../completed/v4/grounded-answers.md) — **milestone 2
   (completed)**: server-side
   citation validation for assistant answers (the item v3 explicitly deferred
   "to v4 once the citation UX shows where validation is actually needed" —
   it shipped, so this is due), with an `answer_question` service shape decided
   by spike.
3. [retrieval-quality-reranking.md](retrieval-quality-reranking.md) —
   **milestone 3**: measurement-first — build a small local retrieval-quality
   harness, then add a local reranker **only if** the measurements show hybrid
   ranking misses sources. A recorded "no reranker needed" is a valid outcome.
4. [streaming-diarization.md](streaming-diarization.md) — **milestone 4**:
   speaker labels for live-captured sessions. Spike decides between true
   in-browser labeling and post-finalize labeling that reuses the batch
   `DiarizationProvider` on the uploaded session audio.
5. [stale-live-sessions.md](stale-live-sessions.md) — **milestone 5** (small,
   may be pulled forward to any point): sweep recordings stranded in `live`,
   finalizing from the already-stored segments where possible. Clears the
   tech-debt row.

## Sequencing

Two independent tracks; m5 floats.

1. **Track A (grounding): m1 → m2 → m3.** m1 first because it is the only
   child that changes the `GroundedSource`/chunk contract — landing it first
   means m2's validation and m3's measurement run against the final shape
   instead of churning the citation contract twice. m2 before m3 because the
   validation layer is where retrieval-quality gaps become visible and
   reportable.
2. **Track B (capture): m4, with m5 anywhere.** m4 touches only the live path
   and is independent of Track A; it may run in parallel. m5 is the smallest
   child and has no dependencies — a good warm-up or gap-filler.

Each child plan opens with a **decision spike** where real engine/placement
choices remain (m1 anchor representation, m2 service shape, m3 reranker, m4
where diarization runs). Resolve the spike and record the decision in the plan
before building — working rule #1 applies per milestone.

## Non-Negotiables

- **Free/local only.** No paid transcription, diarization, embedding, or
  reranking APIs. LLM calls remain BYO-key through the existing assistant
  seam; no new server-paid inference.
- **Existing contracts stay frozen:** `/api/search` + sidebar `SearchPanel`,
  `searchLibrary`'s `SearchResult[]`, and the MCP `search_notes`
  `{ query, sources }` wire shape. Anchor fields are **additive and
  optional** — pre-v4 chunks and external MCP hosts that ignore them keep
  working byte-for-byte.
- **Old content keeps working.** Chunks without anchors degrade to today's
  behavior (document citation opens the note). Re-chunking/backfill must not
  be a prerequisite for the app to function.
- **The batch transcription pipeline stays untouched** (same rule as v3).
  Live-path additions inherit degrade-never-fail: any diarization or sweep
  error leaves transcripts/jobs intact, never blocks finalize.
- **Every path stays user-scoped.** Anything running with the service role
  (worker, any sweep job) scopes every query by `user_id`
  (`docs/SECURITY.md`).
- **Schema changes are scoped per child plan.** m1 expects a migration
  (anchor columns on `semantic_search_chunks`); every other child must
  justify any migration explicitly in its own plan.

## Deferred Beyond v4 (decided, with rationale)

- **Realtime collaboration** — deferred again, deliberately: it is a
  release-sized initiative (shared workspaces, presence, co-editing, schema
  and RLS rework) and the single-user grounding/capture core is still where
  the product value compounds. Candidate headline for v5.
- **Word-level / character-precise document highlights** — m1 anchors stop at
  block/paragraph granularity; finer precision needs offset bookkeeping
  through TipTap edits that paragraph anchors avoid.
- **Speaker identification** (naming real people, voice profiles,
  cross-recording matching) — same exclusion as v3 m3.
- **Live-session resume** — m5 expires or finalizes stranded sessions; letting
  a crashed tab resume capture is a separate capture feature.

## Promotion Rule

Move a child plan from `queued/` to `active/` only when implementation begins,
into the same-named `v4` bucket, updating [`PLANS.md`](../../../PLANS.md) in
the same change so the index remains trustworthy. Do not reopen the completed
v3 groups; when all children here ship, complete this group the same way
[`completed/v3/index-m2-plus.md`](../../completed/v3/index-m2-plus.md) was
completed.

## Self-Review

- **Covers the recorded v4 ledger:** every "Deferred Beyond v3" item is either
  scoped here (validation → m2, offsets → m1, reranking → m3, streaming
  diarization → m4) or re-deferred with rationale (realtime collaboration).
  The stale-live tech-debt row gets a milestone (m5). Nothing silently
  dropped.
- **Builds on shipped seams, doesn't reshape them:** anchors extend chunk
  metadata additively; validation consumes `GroundedSource[]` as-is; m4's
  cheapest option reuses the v3 `DiarizationProvider` unchanged.
- **Honors prior completion notes:** fresh group, new bucket under `queued/`,
  completed v3 groups untouched except a forward pointer from their deferred
  list.
- **Each milestone is independently shippable and reviewable** (working rules
  #3–#4), with spikes scoped where real decisions remain — none pre-decided.
- **Honest about uncertainty:** m3 may legitimately ship a measurement and a
  "no" decision; m4's spike may conclude post-finalize labeling is the right
  v4 scope — both are recorded-outcome milestones, not forced features.
