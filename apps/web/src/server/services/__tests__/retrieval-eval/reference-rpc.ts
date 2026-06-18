/**
 * TS reference implementation of the `match_semantic_search_chunks` Postgres
 * RPC (apps/web/supabase/migrations/20260611115000_document_chunk_anchors.sql)
 * for the no-network retrieval-quality harness.
 *
 * Mirrored exactly: user scoping, the `cosine distance < 0.85 OR FTS match`
 * gate, ordering (similarity desc -> text_rank desc -> updated_at desc), the
 * `greatest(1, least(match_count, 20))` limit, and the source jsonb shapes.
 * Approximated (recorded in the m3 plan): `websearch_to_tsquery`/`ts_rank_cd`
 * is replaced by unstemmed AND token matching + term frequency — it only
 * gates the OR-filter and breaks similarity ties.
 */

import type { GroundedSemanticRow } from "@/server/services/grounded-retrieval";

export type FixtureChunkRow = {
  id: string;
  userId: string;
  sourceType: "page" | "transcript";
  nodeId: string | null;
  transcriptId: string | null;
  recordingId: string | null;
  startMs: number | null;
  endMs: number | null;
  documentAnchor: { blockStart: number; blockEnd: number } | null;
  chunkIndex: number;
  content: string;
  embedding: number[];
  updatedAt: string;
};

const MAX_COSINE_DISTANCE = 0.85;
const MAX_MATCH_COUNT = 20;

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** All query tokens present in the content (websearch AND semantics, unstemmed). */
function ftsMatches(contentTokens: string[], queryTokens: string[]): boolean {
  if (queryTokens.length === 0) return false;
  const content = new Set(contentTokens);
  return queryTokens.every((token) => content.has(token));
}

/** Term-frequency stand-in for ts_rank_cd; 0 when the AND gate fails. */
function textRank(content: string, queryTokens: string[]): number {
  const contentTokens = tokenize(content);
  if (!ftsMatches(contentTokens, queryTokens)) return 0;
  const wanted = new Set(queryTokens);
  const occurrences = contentTokens.filter((token) => wanted.has(token)).length;
  return occurrences / (1 + contentTokens.length);
}

function sourcePayload(chunk: FixtureChunkRow): Record<string, unknown> {
  if (chunk.sourceType === "page") {
    return {
      nodeId: chunk.nodeId,
      ...(chunk.documentAnchor ? { anchor: chunk.documentAnchor } : {}),
    };
  }
  return {
    transcriptId: chunk.transcriptId,
    recordingId: chunk.recordingId,
    startMs: chunk.startMs,
    endMs: chunk.endMs,
  };
}

export function matchSemanticSearchChunksReference(input: {
  chunks: FixtureChunkRow[];
  queryEmbedding: number[];
  queryText: string;
  matchUserId: string;
  matchCount?: number;
}): GroundedSemanticRow[] {
  const queryTokens = tokenize(input.queryText);
  const limit = Math.max(1, Math.min(input.matchCount ?? 8, MAX_MATCH_COUNT));

  return input.chunks
    .filter((chunk) => chunk.userId === input.matchUserId)
    .map((chunk) => ({
      chunk,
      similarity: cosineSimilarity(chunk.embedding, input.queryEmbedding),
      rank: textRank(chunk.content, queryTokens),
    }))
    .filter(
      ({ similarity, rank }) =>
        1 - similarity < MAX_COSINE_DISTANCE || rank > 0,
    )
    .sort(
      (a, b) =>
        b.similarity - a.similarity ||
        b.rank - a.rank ||
        b.chunk.updatedAt.localeCompare(a.chunk.updatedAt),
    )
    .slice(0, limit)
    .map(({ chunk, similarity, rank }) => ({
      id: chunk.id,
      user_id: chunk.userId,
      source_type: chunk.sourceType,
      source: sourcePayload(chunk),
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
      similarity,
      text_rank: rank,
    }));
}
