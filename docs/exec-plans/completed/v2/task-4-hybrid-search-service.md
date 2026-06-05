# Task 4 Hybrid Search Service Implementation Plan

> **Status: COMPLETED (2026-06-05).** Shipped in PR #19 as part of the semantic
> search foundation. See `apps/web/src/server/services/search.ts`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:test-driven-development to implement this task red-green-refactor.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `searchLibrary()` so an optional embedding provider adds
semantic document/transcript chunk results while the default request-handler path
remains FTS-only.

**Architecture:** Keep the existing four FTS/title/file queries intact. When a
provider is supplied, embed the trimmed query once, validate/serialize the vector
with the existing semantic helpers, call the semantic RPC with `ctx.userId`, and
merge/dedupe semantic hits between FTS body hits and title/file-only hits.

**Tech Stack:** TypeScript strict, Vitest, Supabase service fake, existing
semantic embedding/index helpers.

---

## Files

- Modify: `apps/web/src/server/services/search.ts`
- Modify: `apps/web/src/server/services/context.ts`
- Modify: `apps/web/src/server/services/__tests__/fake-supabase.ts`
- Test: `apps/web/src/server/services/__tests__/search.test.ts`

## Steps

- [x] Write failing tests for semantic document ranking/snippet, semantic
  transcript `recordingId`, RPC user scoping, no-provider FTS-only behavior, and
  invalid query embedding error-before-RPC behavior.
- [x] Run
  `cd apps/web && bun run test -- src/server/services/__tests__/search.test.ts`
  and confirm the new tests fail for missing hybrid behavior.
- [x] Extend service context/fake with a minimal `rpc()` surface and assertable
  RPC call log.
- [x] Implement optional semantic retrieval in `searchLibrary()` and merge it
  into the existing result shapes with tiers `0 | 1 | 2`.
- [x] Rerun the focused search test file until green.
- [x] Run `bun run check` from the repo root.
- [x] Self-review the diff and commit with a conventional commit.

## Quality Review Fixes

- [x] Add `ServiceQuery.in()` and fake `.in()` filtering so semantic document
  hydration can select only missing document ids.
- [x] Make fake `match_semantic_search_chunks` return only rows whose `user_id`
  exactly matches `match_user_id`.
- [x] Add regression tests for targeted hydration filters, strict fake RPC
  ownership, wrong embedding counts, malformed semantic sources, and
  FTS-over-semantic dedupe.
- [x] Rerun the focused search test file and `bun run check`.

## Self-Review

- Spec coverage: the steps cover provider optionality, embedding validation,
  RPC args/user scoping, semantic document/transcript result shape, ranking, and
  FTS compatibility.
- Placeholder scan: no implementation placeholders.
- Type consistency: result tiers use `0 | 1 | 2`; semantic RPC rows match the
  generated `match_semantic_search_chunks` return shape.
