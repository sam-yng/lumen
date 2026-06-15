# v3 Cited Retrieval & Grounding Planning Group

> **Status:** completed — milestone 1 (cited retrieval) shipped in PR #23
> (`feat/v3-execution`) and accepted on human review. It was the only scoped v3
> milestone; no further v3 work is in scope, so the group is complete.
> **One open gate (does not block completion of the build):** the manual
> assistant happy-path is unverified pending a real Claude key — an
> environmental/launch blocker, not an m1 build task. Carried forward to the
> consolidated
> [assistant verification gate](../../queued/post-prod/assistant-launch.md)
> (production-readiness; same gate as the v2 in-app assistant).
> **Version:** v3
> **Area:** retrieval, citations, MCP, in-app assistant
> **Created:** 2026-06-09
> **Activated:** 2026-06-09
> **Completed:** 2026-06-09
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

1. [cited-retrieval.md](cited-retrieval.md) — **milestone 1, completed**
   (PR #23, 2026-06-09): citation-aware `retrieveGroundedSources`
   contract; `search_notes` returns `{ query, sources }` with stable `[S#]`
   labels; transcript citations resolve the best overlapping
   `transcript_segments` row; assistant prompt requires source-grounded
   citations. Manual assistant happy-path deferred pending a real Claude key.

## Sequencing

1. **Cited retrieval (m1, done):** add the grounded-source contract in one place
   so both external MCP hosts and the in-app assistant inherit citations.
2. _Future milestones — scoped 2026-06-10:_ the remaining v3 work (streaming
   transcription, diarization, clickable citation experience) is scoped as a
   fresh group in [`index-m2-plus.md`](index-m2-plus.md) (completed
   2026-06-11; lived at `queued/v3/index.md` while open); the other
   candidates from the design spec's out-of-scope list (`answer_question` with
   citation validation, document text offsets, reranking) are explicitly
   deferred beyond v3 there.

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

## Completion Note

Completed 2026-06-09: m1 was the only scoped v3 milestone and its build is
accepted, so this group moved `active/v3/ → completed/v3/` with
[`PLANS.md`](../../../PLANS.md) updated in the same change. The remaining v3
milestones (m2+) were scoped 2026-06-10 as a fresh group, now completed at
[`index-m2-plus.md`](index-m2-plus.md), rather than by reopening this
group. The one carried-forward item — the
manual assistant happy-path — lives in the consolidated
[assistant verification gate](../../queued/post-prod/assistant-launch.md),
not unfinished m1 work.
