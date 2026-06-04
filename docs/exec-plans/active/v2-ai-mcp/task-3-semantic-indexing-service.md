# Task 3 Semantic Indexing Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add service-layer semantic indexing functions that replace owned document or transcript chunks.

**Architecture:** Keep indexing in a framework-agnostic service that composes Task 2 chunking and embedding seams. Deletes and inserts are explicitly scoped with `ctx.userId` so future service-role worker paths cannot affect another user's rows.

**Tech Stack:** Bun, TypeScript strict, Vitest, Supabase service facade.

---

## File Structure

- Create `apps/web/src/server/services/semantic-index.ts` for document/transcript indexing and pgvector serialization.
- Modify `apps/web/src/server/services/__tests__/fake-supabase.ts` only to log query actions and filters.
- Create `apps/web/src/server/services/__tests__/semantic-index.test.ts` for scoped delete, insert, blank text, and embedding assertions.

## Task Steps

- [x] Write semantic-index tests first and verify they fail because the service module does not exist.
- [x] Implement minimal semantic-index service with scoped delete, single batched embedding call, and serialized embeddings.
- [x] Run focused semantic-index tests until green.
- [x] Run `bun run check`.
- [x] Self-review, keep changes scoped, and commit with a conventional commit.
- [x] Follow-up: add blank transcript segment coverage proving stale owned chunks are deleted without embedding or inserting.
- [x] Quality follow-up: validate caller-provided source rows before indexing, snapshot fake query filters at execution, clarify embedding count mismatches, and validate exported embedding serialization.
