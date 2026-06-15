# Grounded Answers v2 Plan (v4 Milestone 2)

> **Status:** completed — shipped on branch `feat/v4-grounded-answers`
> **Version:** v4
> **Area:** assistant, MCP, citation validation
> **Created:** 2026-06-11
> **Depends on:** [document-anchors.md](document-anchors.md) (final
> `GroundedSource` shape), [`completed/v3/cited-retrieval.md`](../../completed/v3/cited-retrieval.md)
> (m1 contract + prompt rules),
> [`completed/v2/in-app-assistant.md`](../../completed/v2/in-app-assistant.md)
> (BYO-key agent loop).
> **Supersedes:** none — this is the item v3 deferred as "server-built
> `answer_question` service with citation validation — revisit in v4 once the
> citation UX shows where validation is actually needed."
> **Design:** spike-first — Task 1 decides the service shape; if a
> superpowers design spec is written for it, link it here before build.

## Goal

Stop trusting the model's citations. Today the assistant prompt *requires*
source-grounded `[S#]` citations (v3 m1) and the UI renders them (v3 m4), but
nothing checks that a cited `S3` actually exists in the retrieved source set —
a hallucinated citation renders as a confident, clickable chip. v4 m2 adds a
**server-side validation layer**: every citation in an assistant answer is
checked against the `GroundedSource[]` actually retrieved that turn, and
invalid ones are visibly degraded rather than presented as grounded.

## Decision Spike (Task 1 — resolved 2026-06-11)

Where the validated-answer boundary lives:

1. **Validation pass inside the existing assistant turn** — a pure module
   (parse `[S#]` mentions → check against the turn's retrieved sources →
   strip/flag misses) wired into `services/assistant.ts` before the turn is
   returned. Smallest change; in-app only; no new MCP surface.
2. **A real `answer_question` MCP tool** — retrieve → compose (BYO-key Claude
   via the existing `ai-credentials`/agent-loop seam) → validate, exposed to
   external MCP hosts too. Honors the original roadmap name, but composing
   answers server-side on behalf of an external host's own model is an odd
   contract and doubles LLM spend for in-app turns.
3. **Hybrid (likely):** the validation module from option 1, shared so the
   in-app assistant uses it on every turn, plus a thin `validate_citations`
   (or `answer_question`) MCP tool only if a concrete external-host use case
   exists. Decide and record.

Also decide in the spike: how strict "supported" is — citation-id existence
only, or also a cheap snippet-support check (cited text overlaps the source
snippet). Start with existence; measure before adding cleverness.

**Decision:** option 1 — a pure citation-validation module in
`server/services/`, wired into `runAssistant` before each turn is returned.
No new MCP surface: no concrete external-host use case exists for a
`validate_citations` / `answer_question` tool, and composing answers
server-side for an external host's own model (option 2) is an odd contract
that doubles LLM spend for in-app turns. The module stays framework-agnostic
and pure, so a thin MCP adapter can be added later without rework if a use
case appears.

Strictness: **existence-only** — a citation is valid iff its exact `[S#]`
label matches a `citationId` in the sources retrieved that turn. No
snippet-overlap check yet; the per-turn validation summary is the instrument
that will show whether one is needed.

Marked, not stripped: the answer text is returned unchanged (no wire munging,
no offset drift for the UI citation splitter). Instead `AssistantResult`
gains `invalidCitations` (distinct unknown labels) plus a `citationSummary`
(valid/invalid mention counts), `sources` is filtered to cited-and-valid
only, and the UI renders unknown labels as visibly degraded non-clickable
chips rather than today's silent plain text.

## Scope

- **Citation-validation module** (pure, unit-tested, framework-agnostic):
  given answer text + the turn's `GroundedSource[]`, return the validated
  answer — invalid `[S#]` stripped or marked, the source list filtered to
  sources actually cited, and a per-turn validation summary (counts of
  valid/invalid) for observability.
- **Assistant integration:** `services/assistant.ts` runs validation on every
  answer before persisting/returning the turn; `AssistantResult.sources`
  carries only validated sources so the v3 m4 chips can render nothing
  unsupported. UI shows degraded (uncited/flagged) spans honestly.
- **Prompt tightening** as the validation summary reveals failure modes —
  prompt text may change; the wire contracts may not.
- **MCP surface:** only per the spike decision; any new tool is a thin
  adapter over the same module (v2 non-negotiable: no business logic in the
  adapter).

## Out Of Scope

- Semantic entailment / NLI-style "does the source really support the claim"
  scoring — existence + optional snippet overlap only.
- Retrieval changes (that's
  [retrieval-quality-reranking.md](retrieval-quality-reranking.md)).
- Streaming-token-level validation; validation runs on the completed answer.
- Any paid or non-BYO-key LLM call.

## Verification Gate

- `bun run check` green.
- Unit tests: fixture answers with valid, unknown, duplicated, and malformed
  `[S#]` citations; empty source sets; sources filtered to cited-only;
  summary counts correct.
- Integration test: assistant turn with a fake MCP bridge yields only
  validated sources in `AssistantResult`.
- Manual happy path: gated on the same real-Claude-key launch gate as v2/v3
  ([assistant-launch.md](../../queued/post-prod/assistant-launch.md))
  — extend that gate's checklist with one validated-citation check rather
  than duplicating it here.

## Retrospective (m2 complete — 2026-06-11)

**Shipped:** pure citation-validation module
(`server/services/citation-validation.ts`, existence-only, shared `[S#]`
regex with the UI splitter), wired into `runAssistant` on both return paths
(final answer and iteration cap). `AssistantResult.sources` now carries only
cited-and-valid sources, plus new `invalidCitations` and `citationSummary`
fields surfaced through `/api/assistant`. The assistant panel renders invalid
labels as degraded non-link chips (dashed border, struck through, explanatory
title) with an unverified-citations note under the turn. No new MCP surface,
per the spike decision; MCP wire contract unchanged. Prompt text unchanged —
no failure mode observed yet that warrants tightening; the summary counts are
the instrument for that.

**Verification:** `bun run check` green on 2026-06-11 (Biome, typecheck,
37 Vitest files / 234 tests). New coverage: 8 unit tests for the module
(valid/unknown/duplicate/zero-padded/malformed labels, empty source sets,
cited-only filtering, ordering), 2 assistant integration tests through the
fake MCP bridge (hallucinated label flagged + dropped; uncited sources
filtered), and updated panel/citations component tests for the degraded
rendering. Browser click-through is the new v4 m2 item on the key-gated
assistant verification checklist.

**Follow-up:** snippet-support checking deliberately deferred — add only if
`citationSummary` shows invalid-mention rates worth chasing. A thin
`validate_citations` MCP adapter remains possible without rework if an
external-host use case materializes.
