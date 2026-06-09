# Cited Retrieval Plan (v3 Milestone 1)

> **Status:** completed (code shipped) — manual assistant happy-path pending
> (**must be verified before production readiness**)
> **Version:** v3
> **Area:** retrieval, citations, MCP, in-app assistant
> **Created:** 2026-06-09
> **Completed:** 2026-06-09 (PR #23, `feat/v3-execution`)
> **Depends on:** [`completed/v2/semantic-search.md`](../v2/semantic-search.md),
> [`completed/v2/mcp-server-auth.md`](../v2/mcp-server-auth.md),
> [`completed/v2/in-app-assistant.md`](../v2/in-app-assistant.md)
> **Supersedes:** none
> **Design:** [`docs/superpowers/specs/2026-06-09-v3-cited-retrieval-design.md`](../../../superpowers/specs/2026-06-09-v3-cited-retrieval-design.md)
> **Plan:** [`docs/superpowers/plans/2026-06-09-v3-cited-retrieval.md`](../../../superpowers/plans/2026-06-09-v3-cited-retrieval.md)

## Retrospective

Added a citation-aware retrieval contract beside the existing v2 search path,
without touching the app search UI. A new service module
`apps/web/src/server/services/grounded-retrieval.ts` returns
`GroundedSource[]` with stable `S1..Sn` labels, transcript timestamp spans, and
the best-overlapping `transcript_segments` id.

- **One contract, two surfaces:** `retrieveGroundedSources` is consumed by both
  the MCP `search_notes` tool and (transitively) the in-app assistant, so
  external hosts and the product UI inherit citations from the same place.
- **Reused v2 seams, no new cost:** parses the same
  `match_semantic_search_chunks` RPC rows as `searchLibrary`, keeping the extra
  timing metadata; falls back to lexical FTS when no embedding provider is
  supplied. No new chunk columns, no paid API.
- **Transcript precision:** chunk timestamps resolve to the best overlapping
  segment (largest overlap; ties broken by earliest `start_ms`); no overlap
  keeps the span and sets `segmentId: null`.
- **Legacy contract guarded:** `searchLibrary`, `/api/search`, and the sidebar
  `SearchPanel` were left unchanged; a regression test asserts the legacy
  `SearchResult[]` shape (with `kind`/`tier`, no `citationId`) is untouched.

## Verification

- `bun run check` green (root Biome + Turbo typecheck/test).
- Focused suites: `grounded-retrieval` (label assignment, segment overlap,
  semantic + lexical paths, cross-user isolation), MCP `tools` (the
  `{ query, sources }` shape with citation labels), `assistant` (system-prompt
  citation rules + tool loop), and the `searchLibrary` regression guard.
- **Pending human sign-off (working rule 3) — production-readiness blocker:**
  the manual assistant browser happy-path — asking a question over a real
  transcript and confirming `[S#]` citations resolve to returned sources — needs
  a real Claude key, the same blocker tracked for the v2 in-app assistant. This
  **must be completed before Lumen goes to production**; it is recorded in
  [`tech-debt-tracker.md`](../../tech-debt-tracker.md) and gates the
  production-readiness work in
  [`active/production/prod-readiness/index.md`](../../active/production/prod-readiness/index.md).

## Goal

Return structured, source-grounded citations from assistant and MCP retrieval so
each factual claim points back to the exact workspace source (document, or
transcript recording + timestamp span + best segment).

## Scope

- Add `retrieveGroundedSources(ctx, query, { embeddingProvider? })` returning
  citation-ready `GroundedSource[]` (semantic path + lexical fallback).
- Resolve transcript chunk timestamps to the best overlapping
  `transcript_segments` row; preserve the span when none matches.
- Change MCP `search_notes` to return `{ query, sources }` with stable `[S#]`
  labels and an updated tool description.
- Add assistant system-prompt rules: cite only tool-returned sources, label
  claims `[S#]`, and state when sources are insufficient.
- Keep every query scoped to the authenticated user.

## Out Of Scope

- Live/streaming transcription, diarization, Python sidecar evaluation.
- Citation popovers, sidebar source cards, or clickable citation UI.
- A server-built `answer_question` service with citation validation.
- Document text offsets / exact paragraph anchors; reranking beyond v2 inputs.

## Verification Gate

- `bun run check` green.
- Focused service + MCP + assistant tests pass; legacy search contract guarded.
- Manual assistant happy-path over a real transcript citing `[S#]` labels
  (deferred — needs a real Claude key; **required before production readiness**).
