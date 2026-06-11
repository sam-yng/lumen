import { describe, expect, it } from "vitest";
import {
  cosineSimilarity,
  type FixtureChunkRow,
  matchSemanticSearchChunksReference,
} from "@/server/services/__tests__/retrieval-eval/reference-rpc";

const DIMS = 384;

function vec(entries: Record<number, number>): number[] {
  const v = Array.from({ length: DIMS }, () => 0);
  for (const [index, value] of Object.entries(entries)) {
    v[Number(index)] = value;
  }
  return v;
}

function chunk(over: Partial<FixtureChunkRow> = {}): FixtureChunkRow {
  return {
    id: "c1",
    userId: "user-1",
    sourceType: "document",
    documentId: "d1",
    transcriptId: null,
    recordingId: null,
    startMs: null,
    endMs: null,
    documentAnchor: null,
    chunkIndex: 0,
    content: "mitochondria produce energy",
    embedding: vec({ 0: 1 }),
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("cosineSimilarity", () => {
  it("is 1 for identical directions and 0 for orthogonal ones", () => {
    expect(cosineSimilarity(vec({ 0: 2 }), vec({ 0: 1 }))).toBeCloseTo(1, 12);
    expect(cosineSimilarity(vec({ 0: 1 }), vec({ 1: 1 }))).toBeCloseTo(0, 12);
  });
});

describe("matchSemanticSearchChunksReference", () => {
  it("excludes other users' chunks", () => {
    const rows = matchSemanticSearchChunksReference({
      chunks: [chunk({ userId: "user-2" })],
      queryEmbedding: vec({ 0: 1 }),
      queryText: "mitochondria",
      matchUserId: "user-1",
    });
    expect(rows).toEqual([]);
  });

  it("filters out chunks that fail both the distance and FTS gates", () => {
    const rows = matchSemanticSearchChunksReference({
      chunks: [
        // Orthogonal embedding (distance 1) and no query token in content.
        chunk({
          id: "far",
          content: "unrelated text",
          embedding: vec({ 5: 1 }),
        }),
      ],
      queryEmbedding: vec({ 0: 1 }),
      queryText: "mitochondria",
      matchUserId: "user-1",
    });
    expect(rows).toEqual([]);
  });

  it("keeps a distant chunk when every query token matches its content", () => {
    const rows = matchSemanticSearchChunksReference({
      chunks: [chunk({ id: "far-but-fts", embedding: vec({ 5: 1 }) })],
      queryEmbedding: vec({ 0: 1 }),
      queryText: "mitochondria energy",
      matchUserId: "user-1",
    });
    expect(rows.map((r) => r.id)).toEqual(["far-but-fts"]);
  });

  it("orders by similarity desc, then text rank desc, then updated_at desc", () => {
    const near = vec({ 0: 1, 1: 0.1 });
    const rows = matchSemanticSearchChunksReference({
      chunks: [
        chunk({ id: "low-sim", embedding: vec({ 0: 1, 1: 2 }) }),
        chunk({ id: "high-sim", embedding: near }),
        // Same similarity; FTS rank should break the tie.
        chunk({
          id: "tie-no-term",
          embedding: vec({ 0: 1, 1: 2 }),
          content: "no relevant words here",
        }),
        // Same similarity + same rank; newer updated_at wins.
        chunk({
          id: "tie-newer",
          embedding: vec({ 0: 1, 1: 2 }),
          content: "no relevant words here",
          updatedAt: "2026-02-01T00:00:00Z",
        }),
      ],
      queryEmbedding: near,
      queryText: "mitochondria",
      matchUserId: "user-1",
    });
    expect(rows.map((r) => r.id)).toEqual([
      "high-sim",
      "low-sim",
      "tie-newer",
      "tie-no-term",
    ]);
  });

  it("clamps match_count to at most 20 and at least 1", () => {
    const chunks = Array.from({ length: 25 }, (_, i) =>
      chunk({ id: `c${i}`, embedding: vec({ 0: 1, 1: i * 0.01 }) }),
    );
    const query = vec({ 0: 1 });
    expect(
      matchSemanticSearchChunksReference({
        chunks,
        queryEmbedding: query,
        queryText: "mitochondria",
        matchUserId: "user-1",
        matchCount: 50,
      }),
    ).toHaveLength(20);
    expect(
      matchSemanticSearchChunksReference({
        chunks,
        queryEmbedding: query,
        queryText: "mitochondria",
        matchUserId: "user-1",
        matchCount: 0,
      }),
    ).toHaveLength(1);
  });

  it("emits the RPC row shape, including document anchors", () => {
    const [row] = matchSemanticSearchChunksReference({
      chunks: [
        chunk({
          documentAnchor: { blockStart: 2, blockEnd: 3 },
          chunkIndex: 4,
        }),
      ],
      queryEmbedding: vec({ 0: 1 }),
      queryText: "mitochondria",
      matchUserId: "user-1",
    });
    expect(row).toMatchObject({
      id: "c1",
      user_id: "user-1",
      source_type: "document",
      source: { documentId: "d1", anchor: { blockStart: 2, blockEnd: 3 } },
      chunk_index: 4,
      content: "mitochondria produce energy",
    });
    expect(row?.similarity).toBeCloseTo(1, 12);
  });

  it("emits transcript source payloads with timing", () => {
    const [row] = matchSemanticSearchChunksReference({
      chunks: [
        chunk({
          sourceType: "transcript",
          documentId: null,
          transcriptId: "t1",
          recordingId: "r1",
          startMs: 1000,
          endMs: 2000,
        }),
      ],
      queryEmbedding: vec({ 0: 1 }),
      queryText: "mitochondria",
      matchUserId: "user-1",
    });
    expect(row?.source).toEqual({
      transcriptId: "t1",
      recordingId: "r1",
      startMs: 1000,
      endMs: 2000,
    });
  });
});
