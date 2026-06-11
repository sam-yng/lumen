/**
 * Query runner for the v4 m3 retrieval-quality harness: embeds a fixture query,
 * scores the corpus through the reference RPC, and drives the real
 * retrieveGroundedSources service to collect the source ids it would hand the
 * assistant. See docs/exec-plans/active/v4/retrieval-quality-reranking.md.
 */

import { userId } from "@/server/services/__tests__/fake-supabase";
import {
  type Corpus,
  documentSourceId,
  type FixtureQuery,
  transcriptSourceId,
} from "@/server/services/__tests__/retrieval-eval/corpus";
import { EvalSupabase } from "@/server/services/__tests__/retrieval-eval/eval-supabase";
import { matchSemanticSearchChunksReference } from "@/server/services/__tests__/retrieval-eval/reference-rpc";
import type { ServiceContext } from "@/server/services/context";
import type { EmbeddingProvider } from "@/server/services/embedding-provider";
import type {
  GroundedSemanticRow,
  GroundedSource,
} from "@/server/services/grounded-retrieval";
import { retrieveGroundedSources } from "@/server/services/grounded-retrieval";

export type EvalMode = "hybrid" | "lexical";

export type GroundedQueryResult = {
  /** Source ids retrieveGroundedSources returned, in rank order (top-k). */
  rankedSourceIds: string[];
  /** Source ids present in the 20-candidate RPC pool (hybrid only). */
  poolSourceIds: string[];
};

/** Stable source id for a grounded source (matches the corpus labeling). */
function groundedSourceId(source: GroundedSource): string {
  return source.kind === "document"
    ? documentSourceId((source.source as { documentId: string }).documentId)
    : transcriptSourceId(
        (source.source as { transcriptId: string }).transcriptId,
      );
}

function poolRowSourceId(row: GroundedSemanticRow): string | null {
  if (!row.source || typeof row.source !== "object") return null;
  const source = row.source as Record<string, unknown>;
  if (row.source_type === "document" && typeof source.documentId === "string") {
    return documentSourceId(source.documentId);
  }
  if (
    row.source_type === "transcript" &&
    typeof source.transcriptId === "string"
  ) {
    return transcriptSourceId(source.transcriptId);
  }
  return null;
}

function evalContext(corpus: Corpus): ServiceContext {
  return {
    userId,
    supabase: new EvalSupabase(corpus.tables, corpus.chunkRows, userId),
  };
}

/** The 20-candidate pool the RPC would return — the ceiling a reranker has. */
async function poolSourceIds(
  corpus: Corpus,
  query: FixtureQuery,
  provider: EmbeddingProvider,
): Promise<string[]> {
  const [embedding] = await provider.embed([query.text]);
  const rows: GroundedSemanticRow[] = matchSemanticSearchChunksReference({
    chunks: corpus.chunkRows,
    queryEmbedding: embedding ?? [],
    queryText: query.text,
    matchUserId: userId,
    matchCount: 20,
  });
  return [
    ...new Set(
      rows.map(poolRowSourceId).filter((id): id is string => id !== null),
    ),
  ];
}

export async function runGroundedQuery(input: {
  corpus: Corpus;
  query: FixtureQuery;
  provider: EmbeddingProvider;
  mode: EvalMode;
}): Promise<GroundedQueryResult> {
  const { corpus, query, provider, mode } = input;
  const ctx = evalContext(corpus);

  if (mode === "lexical") {
    const sources = await retrieveGroundedSources(ctx, query.text);
    return {
      rankedSourceIds: sources.map(groundedSourceId),
      poolSourceIds: [],
    };
  }

  const sources = await retrieveGroundedSources(ctx, query.text, {
    embeddingProvider: provider,
  });
  return {
    rankedSourceIds: sources.map(groundedSourceId),
    poolSourceIds: await poolSourceIds(corpus, query, provider),
  };
}
