# Retrieval Quality & Reranking Plan (v4 Milestone 3)

> **Status:** queued
> **Version:** v4
> **Area:** search/retrieval, evaluation
> **Created:** 2026-06-11
> **Depends on:** [`completed/v2/task-4-hybrid-search-service.md`](../../completed/v2/task-4-hybrid-search-service.md)
> (hybrid ranking under test), [document-anchors.md](document-anchors.md) and
> [grounded-answers.md](grounded-answers.md) (final contract + the validation
> summary that surfaces retrieval misses).
> **Supersedes:** none — v3 deferred reranking "until grounded answers
> demonstrably miss sources hybrid ranking should have surfaced"; this plan
> builds the instrument that can demonstrate it.
> **Design:** measurement-first — Task 1 is the harness, Task 2 is the
> measured go/no-go decision recorded in this plan.

## Goal

Answer, with numbers instead of vibes, whether Lumen's hybrid FTS+semantic
retrieval misses sources it should surface — and add a **local** reranker only
if it does. Shipping a measurement plus a recorded "no reranker needed"
decision is a fully successful outcome of this milestone.

## Decision Spike (Tasks 1–2 — resolve before any reranker code)

1. **Harness shape (Task 1):** a small Vitest-driven eval over a seeded
   fixture corpus (documents + transcript segments with known-relevant chunks
   per query) hitting `searchLibrary`/`retrieveGroundedSources` directly.
   Metrics: recall@k and MRR at the k the assistant actually consumes.
   Fixture queries should include the failure shapes hybrid ranking is
   suspected of (paraphrase-only matches, keyword-heavy matches, cross-chunk
   answers).
2. **Go/no-go (Task 2):** define the threshold up front (e.g. relevant chunk
   absent from top-k on ≥ some fraction of fixture queries) before looking at
   results. Record numbers + decision here. **No reranker below threshold.**
3. **Reranker candidates (only on go):** local cross-encoder ONNX (e.g. a
   bge-reranker-class model via onnxruntime, mirroring how the embedding
   provider runs locally) re-scoring the top-N hybrid candidates inside the
   service. Evaluate model license, CPU latency at top-N, and measured metric
   lift on the same harness.

## Scope

- **Eval harness** checked in beside the search service tests, runnable via
  the normal test task — fixtures are deterministic and local (no network).
- **Measurement + recorded decision** in this plan (numbers, threshold,
  go/no-go, rejected alternatives).
- **If go:** a reranking step inside `services/search.ts` /
  `grounded-retrieval.ts` re-ordering hybrid candidates before the existing
  result shaping. Env-gated like other optional capabilities, default
  matching the recorded decision.

## Out Of Scope

- Any change to the `/api/search` route, `SearchPanel`, `SearchResult[]`, or
  MCP `search_notes` shapes — reranking only re-orders what fills them.
- Paid reranking APIs (non-negotiable: free/local).
- Query rewriting/expansion, multi-hop retrieval, or embedding-model swaps —
  different levers, separate plans if the harness motivates them.
- Live user-behavior metrics (click-through logging); fixture-based eval only.

## Verification Gate

- `bun run check` green (harness included in the normal test run).
- The recorded measurement: metrics table, threshold, decision, and — if a
  reranker ships — before/after numbers on the same fixtures.
- If a reranker ships: unit tests for the rerank step (ordering, top-N
  cutoff, env-gating, graceful degrade to hybrid order on reranker error),
  and a manual spot check that sidebar search results still render correctly.
