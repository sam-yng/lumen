# Citation Experience Plan (v3 Milestone 4)

> **Status:** queued
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
- **Deep links:** transcript viewer accepts a deep-link target (e.g.
  `?segment=<id>` / `?t=<ms>` — pick one and record it here) that scrolls to,
  highlights, and seeks audio to the cited segment, reusing the viewer's
  existing active-segment + audio-sync machinery. Citation chips/cards link
  there for transcript sources and to the note for document sources.
- **Graceful nulls:** sources with `segmentId: null` deep-link by timestamp
  span; null timing falls back to opening the transcript at the top.

## Out Of Scope (deferred decisions recorded in the group index)

- Server-built `answer_question` service with citation validation.
- Reranking; document text offsets / paragraph anchors.
- Any change to `retrieveGroundedSources`, the MCP tool contract, sidebar
  search, or hover-preview popovers beyond the click-through above.

## Verification Gate

- `bun run check` green.
- Component/unit tests with **fixture turns** (no Claude key needed): `[S#]`
  parsing incl. unknown/duplicate labels, source-card rendering for document +
  transcript (with and without `segmentId`/timing), deep-link target
  resolution; transcript-viewer deep-link scroll/highlight/seek; assistant
  service test that turns carry their sources.
- Manual happy path: ask the assistant a question over a real transcript and
  click a citation through to the highlighted segment at the right timestamp.
  **Requires a real Claude key** — joins the consolidated
  [assistant verification gate](../../active/production/prod-readiness/prod-assistant-verification.md);
  the build itself is verifiable via the fixture-driven tests above.
