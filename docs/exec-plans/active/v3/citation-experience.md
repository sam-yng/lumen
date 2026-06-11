# Citation Experience Plan (v3 Milestone 4)

> **Status:** active — promoted `queued/v3/ → active/v3/` 2026-06-11;
> implementation on `feat/v3-citation-experience`.
> **Version:** v3
> **Area:** assistant UI, transcript viewer, citations
> **Created:** 2026-06-10
> **Depends on:** [`completed/v3/cited-retrieval.md`](../../completed/v3/cited-retrieval.md)
> (m1 — supplies `GroundedSource[]` and `[S#]` labels). Independent of m2/m3;
> may run in parallel with them.
> **Supersedes:** none
> **Design:** the m1 design spec's Out Of Scope list
> ([`2026-06-09-v3-cited-retrieval-design.md`](../../../superpowers/specs/2026-06-09-v3-cited-retrieval-design.md))
> names this milestone ("citation popovers / clickable source UI"); a dedicated
> spec is optional — link it here if written.

## Goal

Close the loop the v3 outline asks for — "answers that link back to the exact
transcript segment + timestamp." m1 made retrieval *return* citations; this
milestone makes them **navigable**: assistant `[S#]` labels become clickable,
each answer shows its source cards, and a transcript citation opens the
transcript viewer scrolled to (and highlighting) the cited segment at its
timestamp. Document citations open the note.

## Decision Record (2026-06-11)

- **Deep-link target: `?segment=<id>`, with `?t=<ms>` as the null-segment
  fallback.** A segment id is the precise pointer and the viewer already holds
  all segments, so resolving id → `start_ms` is free; sources with
  `segmentId: null` but a timestamp span link with `?t=<startMs>`; null timing
  links the bare transcript URL (opens at the top). The viewer accepts both
  params and prefers `segment`.
- **Label collisions across multiple `search_notes` calls in one turn:**
  citation labels restart at S1 per search, so a turn with two searches can
  reuse a label. The turn's source map is last-write-wins — matching the
  sources the model saw most recently when it wrote its final text. Unknown
  labels (model-invented, or overwritten ambiguity) render as plain text, never
  as a wrong link target.
- **Highlight reuses the active-segment machinery:** the deep link sets the
  viewer's `currentTime` (and seeks audio once metadata loads), so the cited
  segment gets the existing active-segment highlight + auto-scroll rather than
  a parallel highlight system.

## Scope

- **Thread sources into turns:** assistant turns currently render plain text
  (`assistant-panel.tsx`) and tool results are dropped after the agent loop
  (`services/assistant.ts`). Extend the assistant response/turn type to carry
  the `GroundedSource[]` returned by `search_notes` during that turn, keyed by
  `citationId`. The MCP wire contract (`{ query, sources }`) and external-host
  behavior stay unchanged.
- **Citation rendering:** parse `[S#]` occurrences in assistant text into
  inline citation chips; unknown labels render as plain text. Below each
  assistant turn, list its source cards (title, snippet, transcript timestamp
  when present).
- **Deep links:** transcript viewer accepts a deep-link target
  (`?segment=<id>` preferred, `?t=<ms>` fallback — see Decision Record) that
  scrolls to, highlights, and seeks audio to the cited segment, reusing the
  viewer's existing active-segment + audio-sync machinery. Citation
  chips/cards link there for transcript sources and to the note for document
  sources.
- **Graceful nulls:** sources with `segmentId: null` deep-link by timestamp
  span; null timing falls back to opening the transcript at the top.

## Out Of Scope (deferred decisions recorded in the group index)

- Server-built `answer_question` service with citation validation.
- Reranking; document text offsets / paragraph anchors.
- Any change to `retrieveGroundedSources`, the MCP tool contract, sidebar
  search, or hover-preview popovers beyond the click-through above.

## Verification Gate

- [x] `bun run check` green (2026-06-11: Biome + typecheck + 216 unit tests).
- [x] Component/unit tests with **fixture turns** (no Claude key needed): `[S#]`
  parsing incl. unknown/duplicate labels, source-card rendering for document +
  transcript (with and without `segmentId`/timing), deep-link target
  resolution; transcript-viewer deep-link scroll/highlight/seek; assistant
  service test that turns carry their sources.
- [ ] Manual happy path: ask the assistant a question over a real transcript and
  click a citation through to the highlighted segment at the right timestamp.
  **Requires a real Claude key** — joins the consolidated
  [assistant verification gate](../../active/production/prod-readiness/prod-assistant-verification.md)
  (m4 flow added there 2026-06-11); the build itself is verified via the
  fixture-driven tests above.

### Verification Record (2026-06-11)

- `bun run check` green: 35 test files, 216 unit tests, including new coverage:
  - `grounded-retrieval.test.ts` — `parseSearchNotesResult` round-trip, null
    segment/timing acceptance, malformed payloads → null.
  - `assistant.test.ts` — `runAssistant` carries `search_notes` sources on the
    result (`sources: []` when no tools ran).
  - `citations.test.tsx` — `splitCitations` (duplicates, non-citation
    brackets), `citationHref` (document / segment / timestamp-fallback / null
    timing), chip rendering incl. unknown-label plain text, source cards with
    and without timestamps.
  - `transcript-viewer.test.tsx` — `resolveDeepLinkMs` (segment wins, unknown
    id falls back to `t`, nothing → top) and rendered deep-link
    scroll/highlight/seek for both `?segment` and `?t`.
  - `assistant-panel.test.tsx` — cited answer renders chips + cards; turns
    POSTed back to the API are stripped to `{ role, content }`.
- Build pieces: `AssistantResult.sources` (`services/assistant.ts`),
  `parseSearchNotesResult` (`services/grounded-retrieval.ts`),
  `components/assistant/citations.tsx`, deep-link props through
  `transcript-route.tsx` → `transcript-viewer.tsx`. MCP wire contract
  unchanged; `/api/assistant` response gains `sources` (additive).
- Status: build complete, pending milestone review (working rule #4). The
  Claude-key manual click-through lives in the consolidated gate above.
