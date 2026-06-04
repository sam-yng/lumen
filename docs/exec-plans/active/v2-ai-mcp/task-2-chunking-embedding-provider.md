# Task 2 Chunking And Embedding Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic chunking helpers and a local/free embedding provider seam for v2 semantic search.

**Architecture:** Keep the new helpers as pure TypeScript service modules with no runtime dependencies. Chunking normalizes text into document or transcript `SearchChunk` records; the deterministic embedding provider hashes normalized tokens into fixed 384-dimensional L2-normalized vectors for tests and local smoke paths.

**Tech Stack:** Bun, TypeScript strict, Vitest, Biome.

---

## File Structure

- Create `apps/web/src/server/services/semantic-chunking.ts` for public chunking types, constants, and pure chunk helpers.
- Create `apps/web/src/server/services/embedding-provider.ts` for the embedding provider interface, deterministic local implementation, dimension constant, and assertion helper.
- Create `apps/web/src/server/services/__tests__/semantic-chunking.test.ts` for chunking requirements.
- Create `apps/web/src/server/services/__tests__/embedding-provider.test.ts` for provider requirements.

## Task Steps

- [ ] **Step 1: Write failing chunking tests**

  Add tests for empty text, document source metadata and chunk indexes, transcript time bounds, and long-text chunk sizes/overlap.

- [ ] **Step 2: Write failing embedding provider tests**

  Add tests for one output vector per input, 384 dimensions, blank rejection, deterministic output, unit-length vectors, and `assertEmbedding` validation.

- [ ] **Step 3: Run focused tests to verify RED**

  Run:

  ```bash
  cd apps/web && bun run test -- src/server/services/__tests__/semantic-chunking.test.ts src/server/services/__tests__/embedding-provider.test.ts
  ```

  Expected: fail because the two service modules do not exist yet.

- [ ] **Step 4: Implement semantic chunking**

  Export exactly the requested public types/functions plus `MAX_CHUNK_CHARS = 900` and `CHUNK_OVERLAP_CHARS = 150`. Normalize whitespace with `text.replace(/\s+/g, " ").trim()`, split documents at deterministic whitespace boundaries near the limit with overlap, and sort/group transcript segments by `startMs` while preserving grouped bounds.

- [ ] **Step 5: Implement deterministic embedding provider**

  Export `EMBEDDING_DIMENSIONS = 384`, `EmbeddingProvider`, `DeterministicEmbeddingProvider`, and `assertEmbedding`. Reject blank text before embedding, tokenize lowercase words, hash tokens into signed dimensions, L2-normalize non-empty vectors, and validate dimensions/finite values.

- [ ] **Step 6: Run focused tests to verify GREEN**

  Run:

  ```bash
  cd apps/web && bun run test -- src/server/services/__tests__/semantic-chunking.test.ts src/server/services/__tests__/embedding-provider.test.ts
  ```

  Expected: pass.

- [ ] **Step 7: Run root gate**

  Run:

  ```bash
  bun run check
  ```

  Expected: Biome, typecheck, and tests pass across the workspace.

- [ ] **Step 8: Self-review and commit**

  Inspect `git diff`, ensure the public exports match the task exactly, keep changes scoped to the four requested code/test files plus this plan, then commit:

  ```bash
  git add docs/exec-plans/active/v2-ai-mcp/task-2-chunking-embedding-provider.md apps/web/src/server/services/semantic-chunking.ts apps/web/src/server/services/embedding-provider.ts apps/web/src/server/services/__tests__/semantic-chunking.test.ts apps/web/src/server/services/__tests__/embedding-provider.test.ts
  git commit -m "feat: add semantic chunking and embeddings"
  ```

## Quality Review Follow-Up

- [x] Added a regression test for a single transcript segment longer than `MAX_CHUNK_CHARS`.
- [x] Split oversized transcript chunks so every returned transcript chunk stays at or below `MAX_CHUNK_CHARS` while preserving transcript metadata.
- [x] Added a sparse-whitespace document regression proving overlap does not balloon beyond `CHUNK_OVERLAP_CHARS + 30`.
- [x] Limited overlap whitespace preference to whitespace near the target overlap window.
- [x] Changed deterministic token lowercasing from `toLocaleLowerCase()` to `toLowerCase()`.
- [x] Asserted representative non-empty text produces at least one non-zero embedding value.
