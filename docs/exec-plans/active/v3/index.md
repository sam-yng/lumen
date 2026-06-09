# v3 Cited Retrieval & Grounding Planning Group

> **Status:** active — milestone 1 (cited retrieval) shipped in PR #23
> (`feat/v3-execution`); manual assistant happy-path pending a real Claude key
> (same blocker as the v2 in-app assistant — see tech-debt-tracker.md). Further
> v3 milestones are not yet scoped.
> **Version:** v3
> **Area:** retrieval, citations, MCP, in-app assistant
> **Created:** 2026-06-09
> **Activated:** 2026-06-09
> **Depends on:** [`completed/v2/semantic-search.md`](../../completed/v2/semantic-search.md),
> [`completed/v2/mcp-server-auth.md`](../../completed/v2/mcp-server-auth.md),
> [`completed/v2/in-app-assistant.md`](../../completed/v2/in-app-assistant.md)
> **Supersedes:** none

## Goal

Make Lumen's assistant and MCP retrieval **source-grounded**: every factual
claim about the user's workspace traces back to a structured citation pointing at
the exact document or transcript segment that supports it. v3 builds on the v2
semantic-search + MCP + assistant seams without reshaping them.

## Source Material

- Design spec: [`docs/superpowers/specs/2026-06-09-v3-cited-retrieval-design.md`](../../../superpowers/specs/2026-06-09-v3-cited-retrieval-design.md)
- v2 retrieval seam: `apps/web/src/server/services/search.ts`
- v2 MCP tools: `apps/web/src/server/mcp/`
- Security model: [`docs/SECURITY.md`](../../../SECURITY.md)

## Child Plans

1. [cited-retrieval.md](../../completed/v3/cited-retrieval.md) — **milestone 1,
   completed** (PR #23, 2026-06-09): citation-aware `retrieveGroundedSources`
   contract; `search_notes` returns `{ query, sources }` with stable `[S#]`
   labels; transcript citations resolve the best overlapping
   `transcript_segments` row; assistant prompt requires source-grounded
   citations. Manual assistant happy-path deferred pending a real Claude key.

## Sequencing

1. **Cited retrieval (m1, done):** add the grounded-source contract in one place
   so both external MCP hosts and the in-app assistant inherit citations.
2. _Future milestones (not yet scoped):_ candidate follow-ups noted in the design
   spec's out-of-scope list — citation popovers / clickable source UI, a
   server-built `answer_question` service with citation validation, document
   text offsets, and reranking. Scope each as its own child plan before building.

## Non-Negotiables

- The existing `/api/search` route and sidebar `SearchPanel` contract stay
  byte-for-byte unchanged; `searchLibrary` keeps returning `SearchResult[]`.
- The retrieval contract improves in one place so MCP and the assistant share it.
- Reuse v2 semantic-chunk metadata (`document_id`, `transcript_id`,
  `recording_id`, `start_ms`, `end_ms`); do not add new chunk columns.
- Every query stays scoped to the authenticated user; cross-user semantic rows
  and transcript segments must never surface.
- No paid embedding/LLM calls added; the model still composes answers — Lumen
  supplies cited sources and prompt rules.

## Promotion Rule

When milestone 1's manual happy-path is signed off and no further v3 milestone is
active, move this group to `completed/v3/index.md` (bucket name `v3` travels with
it) and update [`PLANS.md`](../../../PLANS.md) in the same change.
