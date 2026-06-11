import { beforeAll, describe, expect, it } from "vitest";
import {
  buildCorpus,
  type Corpus,
} from "@/server/services/__tests__/retrieval-eval/corpus";
import {
  documents,
  queries,
  transcripts,
} from "@/server/services/__tests__/retrieval-eval/fixtures";
import {
  mean,
  recallAtK,
  reciprocalRank,
} from "@/server/services/__tests__/retrieval-eval/metrics";
import {
  type EvalMode,
  runGroundedQuery,
} from "@/server/services/__tests__/retrieval-eval/run-eval";
import { DeterministicEmbeddingProvider } from "@/server/services/embedding-provider";

const provider = new DeterministicEmbeddingProvider();
const CONSUMED_K = 8;

type PerQuery = {
  id: string;
  kind: string;
  recall: number;
  rr: number;
  miss: boolean;
  recoverable: boolean;
};

async function measure(corpus: Corpus, mode: EvalMode): Promise<PerQuery[]> {
  const rows: PerQuery[] = [];
  for (const query of queries) {
    const { rankedSourceIds, poolSourceIds } = await runGroundedQuery({
      corpus,
      query,
      provider,
      mode,
    });
    const recall = recallAtK(
      rankedSourceIds,
      query.relevantSourceIds,
      CONSUMED_K,
    );
    const miss = recall === 0;
    const recoverable =
      miss && query.relevantSourceIds.some((id) => poolSourceIds.includes(id));
    rows.push({
      id: query.id,
      kind: query.kind,
      recall,
      rr: reciprocalRank(rankedSourceIds, query.relevantSourceIds),
      miss,
      recoverable,
    });
  }
  return rows;
}

describe("retrieval-quality measurement (v4 m3)", () => {
  let hybrid: PerQuery[];
  let lexical: PerQuery[];

  beforeAll(async () => {
    const corpus = await buildCorpus({ documents, transcripts, queries });
    hybrid = await measure(corpus, "hybrid");
    lexical = await measure(corpus, "lexical");

    if (process.env.RETRIEVAL_EVAL_REPORT) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(
        process.env.RETRIEVAL_EVAL_REPORT,
        JSON.stringify(
          {
            hybrid: {
              recallAt8: mean(hybrid.map((r) => r.recall)),
              mrr: mean(hybrid.map((r) => r.rr)),
              rows: hybrid,
            },
            lexical: {
              recallAt8: mean(lexical.map((r) => r.recall)),
              mrr: mean(lexical.map((r) => r.rr)),
              rows: lexical,
            },
          },
          null,
          2,
        ),
      );
    }
  });

  function recallByKind(rows: PerQuery[], kind: string): number {
    const subset = rows.filter((r) => r.kind === kind);
    return mean(subset.map((r) => r.recall));
  }

  it("covers every fixture query in both modes", () => {
    expect(hybrid).toHaveLength(queries.length);
    expect(lexical).toHaveLength(queries.length);
  });

  // Recorded aggregate metrics (see the plan's Measurement section). These are
  // deterministic; a drift here means retrieval ranking behavior changed.
  it("records the hybrid-path metrics", () => {
    expect(mean(hybrid.map((r) => r.recall))).toBeCloseTo(0.6136, 4);
    expect(mean(hybrid.map((r) => r.rr))).toBeCloseTo(0.6364, 4);
    expect(recallByKind(hybrid, "keyword")).toBe(1);
    expect(recallByKind(hybrid, "cross-chunk")).toBeCloseTo(0.875, 4);
    expect(recallByKind(hybrid, "paraphrase")).toBe(0);
  });

  it("records the lexical-path metrics", () => {
    expect(mean(lexical.map((r) => r.recall))).toBeCloseTo(0.5909, 4);
    expect(recallByKind(lexical, "keyword")).toBe(1);
    expect(recallByKind(lexical, "cross-chunk")).toBeCloseTo(0.75, 4);
    expect(recallByKind(lexical, "paraphrase")).toBe(0);
  });

  // Go/no-go gate, evaluated on the hybrid path (the threshold defined in the
  // plan before measurement): GO iff misses >= 25% of queries AND at least half
  // of those misses are recoverable (relevant chunk present in the 20-pool).
  it("resolves the reranker decision to NO-GO", () => {
    const misses = hybrid.filter((r) => r.miss);
    const recoverable = misses.filter((r) => r.recoverable);

    expect(misses).toHaveLength(4);
    expect(recoverable).toHaveLength(1);

    const missRate = misses.length / hybrid.length;
    const go = missRate >= 0.25 && recoverable.length >= misses.length / 2;

    expect(missRate).toBeGreaterThanOrEqual(0.25);
    expect(go).toBe(false);
    // Every miss is paraphrase, and 3 of 4 are absent from the candidate pool:
    // a reranker reorders candidates, it cannot retrieve what the embedding
    // never surfaced. The lever is the embedding model, which is out of scope.
    expect(misses.every((r) => r.kind === "paraphrase")).toBe(true);
  });
});
