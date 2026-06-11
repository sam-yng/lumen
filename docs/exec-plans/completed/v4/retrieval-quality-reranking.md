# Retrieval Quality & Reranking Plan (v4 Milestone 3)

> **Status:** completed (2026-06-11) — measurement shipped, decision NO-GO
> **Version:** v4
> **Area:** search/retrieval, evaluation
> **Created:** 2026-06-11
> **Depends on:** [`completed/v2/task-4-hybrid-search-service.md`](../../completed/v2/task-4-hybrid-search-service.md)
> (hybrid ranking under test), [document-anchors.md](../../completed/v4/document-anchors.md) and
> [grounded-answers.md](../../completed/v4/grounded-answers.md) (final contract + the validation
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

## Spike Resolution (recorded before measurement)

### Harness shape (Task 1, decided)

- Lives at `apps/web/src/server/services/__tests__/retrieval-eval/` beside the
  search service tests: `metrics.ts` (recall@k, MRR — pure), `reference-rpc.ts`
  (TS mirror of `match_semantic_search_chunks` ranking semantics),
  `corpus.ts` (fixture documents/transcripts + labeled queries), and
  `retrieval-eval.test.ts` (runs the eval inside the normal Vitest task and
  asserts the recorded numbers, so drift in ranking behavior fails `bun run
  check`).
- Fixtures are chunked with the real `chunkDocument`/`chunkTranscript` and
  embedded with the real `DeterministicEmbeddingProvider`; queries hit
  `retrieveGroundedSources` and `searchLibrary` directly through the existing
  `FakeSupabase` table fakes.
- **Fidelity caveats (accepted, recorded):**
  1. The hybrid scoring of `match_semantic_search_chunks` runs in Postgres; a
     no-network Vitest harness cannot execute it. `reference-rpc.ts` mirrors
     the SQL exactly where it matters — same filter
     (`cosine distance < 0.85 OR FTS match`), same ordering (similarity desc →
     text_rank desc → updated_at desc), same `limit greatest(1, least(n, 20))`
     — with cosine computed over the same embeddings the real RPC would store.
     The FTS-match/`ts_rank_cd` term is approximated by unstemmed AND token
     matching + term frequency; it only gates the OR-filter and breaks
     similarity ties, and fixture text is written so stemming never decides an
     outcome.
  2. Production wiring today never passes an `embeddingProvider`:
     `/api/search` and MCP `search_notes` both run the **lexical-only** path
     (see `app/api/search/route.ts`, `server/mcp/tools.ts`). The harness
     measures the intended hybrid configuration *and* the lexical path, so the
     measurement also quantifies what that dormant wiring costs.
  3. Embeddings are the hash-based `DeterministicEmbeddingProvider` (token
     hashing, no semantics). Paraphrase queries therefore measure the real
     ceiling of the shipped embedding, not a strawman.

### Go/no-go threshold (Task 2, defined before looking at results)

Primary metric: **recall@8 on `retrieveGroundedSources`** with the hybrid
path — 8 = `MATCH_COUNT`, and every retrieved candidate becomes an assistant
source, so top-8 *is* what the assistant consumes.

- **Miss** = a query whose relevant chunks are entirely absent from the top-8
  (per-query recall@8 = 0).
- **Recoverable miss** = a miss whose relevant chunk *is* present in the
  20-candidate pool (the RPC's hard cap) — i.e. a reranker re-scoring top-20
  into top-8 could actually surface it.
- **Go** ⇔ misses ≥ 25% of fixture queries **AND** ≥ half of those misses are
  recoverable. Misses absent from the pool entirely are candidate-generation
  gaps — reranking cannot recover them, and query rewriting / embedding swaps
  are explicitly out of scope here.
- MRR and `searchLibrary` recall@5/MRR are reported as diagnostics, no
  threshold.

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

## Measurement (recorded 2026-06-11)

Harness: `apps/web/src/server/services/__tests__/retrieval-eval/` (12 study-note
documents + 2 lecture transcripts, 11 labeled queries), run in the normal
Vitest task. Each query hits the real `retrieveGroundedSources` through
`EvalSupabase` (faithful `websearch_to_tsquery` AND semantics + the reference
RPC scored on `DeterministicEmbeddingProvider` embeddings). The
`retrieval-eval.test.ts` assertions lock these numbers, so any ranking drift
fails `bun run check`.

| Metric (recall@8 / MRR over top-k consumed) | Hybrid | Lexical-only |
| --- | --- | --- |
| Overall recall@8 | **0.614** | 0.591 |
| Overall MRR | 0.636 | 0.636 |
| recall@8 — keyword queries | 1.000 | 1.000 |
| recall@8 — cross-chunk queries | 0.875 | 0.750 |
| recall@8 — paraphrase queries | 0.000 | 0.000 |

Miss breakdown (hybrid): 4 of 11 queries miss (36%) — **all four are
paraphrase** queries (query uses synonyms absent from the target text). Of
those, **1 is recoverable** (relevant chunk present in the 20-candidate pool);
the other 3 never enter the pool at all.

### Decision: NO-GO — no reranker ships

Threshold required misses ≥ 25% **and** ≥ half of misses recoverable.
Misses are 36% (clears the first bar) but only 1 of 4 is recoverable — below
the 2-of-4 needed. **Gate not met → no reranker.**

The failure mode the numbers expose is *semantic recall*, not candidate
*ordering*: hybrid retrieval already places every keyword and cross-chunk
relevant source in the consumed top-8, and a reranker only re-orders candidates
that retrieval already surfaced. For 3 of the 4 misses the relevant chunk is
absent from the pool entirely, so reranking cannot recover it. The lever that
would move paraphrase recall is a real embedding model replacing the hash-based
`DeterministicEmbeddingProvider` — explicitly out of scope here (and a separate
plan if the product motivates it). The harness ships as the instrument that
will re-measure that swap when it happens.

Diagnostic note (not part of the gate): the lexical-only path — what
`/api/search` and MCP `search_notes` actually run today, since neither passes an
`embeddingProvider` — measures only 0.023 recall@8 below hybrid on this corpus.
Wiring the embedding provider into those two call sites is the cheaper, higher-
leverage follow-up than any reranker; captured as a future item, out of scope
for this measurement milestone.

### Rejected alternatives

- **Ship a cross-encoder reranker anyway** — rejected: it cannot fix the
  measured gap (paraphrase recall, dominated by out-of-pool misses) and adds an
  ONNX model + CPU latency for no demonstrated lift.
- **Lower the go threshold to "any recoverable miss"** — rejected: that would
  let a single reorderable miss justify a permanent dependency; the threshold
  was fixed before measurement precisely to avoid post-hoc rationalization.

## Verification Gate

- `bun run check` green (harness included in the normal test run).
- The recorded measurement: metrics table, threshold, decision, and — if a
  reranker ships — before/after numbers on the same fixtures.
- If a reranker ships: unit tests for the rerank step (ordering, top-N
  cutoff, env-gating, graceful degrade to hybrid order on reranker error),
  and a manual spot check that sidebar search results still render correctly.
