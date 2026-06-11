# Grounded Answers v2 Plan (v4 Milestone 2)

> **Status:** queued
> **Version:** v4
> **Area:** assistant, MCP, citation validation
> **Created:** 2026-06-11
> **Depends on:** [document-anchors.md](../../completed/v4/document-anchors.md) (final
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

## Decision Spike (Task 1 — resolve before building)

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
- Retrieval changes (that's [retrieval-quality-reranking.md](retrieval-quality-reranking.md)).
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
  ([prod-assistant-verification.md](../../active/production/prod-readiness/prod-assistant-verification.md))
  — extend that gate's checklist with one validated-citation check rather
  than duplicating it here.
