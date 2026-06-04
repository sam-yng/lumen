# Semantic Search Plan

> **Status:** queued
> **Version:** v2
> **Area:** semantic search
> **Created:** 2026-06-04
> **Depends on:** `docs/exec-plans/queued/v2/index.md`
> **Supersedes:** none

## Goal

Add local embeddings and pgvector-backed hybrid search so notes and transcript
chunks can be retrieved semantically without per-embedding API cost.

## Scope

- Add a pgvector migration under `apps/web/supabase/migrations/`.
- Regenerate `apps/web/src/server/db/database.types.ts`.
- Regenerate `docs/generated/db-schema.md`.
- Define chunking for document text and transcript segments.
- Add a local embedding provider behind a small interface, likely in the worker
  path so CPU work stays out of request handlers.
- Store vectors in user-owned tables or rows that can be queried only through
  user-scoped services.
- Extend the existing search service with hybrid FTS plus vector retrieval.
- Add tests for ranking, chunk ownership, and cross-user isolation.

## Out Of Scope

- MCP tools and resources.
- In-app assistant UI.
- External AI model calls for embeddings.
- Realtime transcription, diarization, reranking, and citations beyond storing
  enough source metadata for later citation work.

## Verification Gate

- `bun run check`
- `cd apps/web && bun run docs:db-schema`
- Service tests proving user A cannot retrieve user B chunks.
- Manual search smoke test in the browser after implementation.
