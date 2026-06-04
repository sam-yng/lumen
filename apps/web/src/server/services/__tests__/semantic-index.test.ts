import { describe, expect, it } from "vitest";
import type { Tables } from "@/server/db/database.types";
import {
  createContext,
  otherUserId,
  type QueryLogEntry,
  type Row,
  userId,
} from "@/server/services/__tests__/fake-supabase";
import { EMBEDDING_DIMENSIONS } from "@/server/services/embedding-provider";
import {
  indexDocumentSearchChunks,
  indexTranscriptSearchChunks,
} from "@/server/services/semantic-index";

function document(overrides: Partial<Tables<"documents">> = {}) {
  return {
    id: "doc-1",
    user_id: userId,
    folder_id: null,
    title: "Biology notes",
    content_json: null,
    content_text: "mitochondria powers cells",
    content_tsv: null as unknown,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } satisfies Tables<"documents">;
}

function transcript(overrides: Partial<Tables<"transcripts">> = {}) {
  return {
    id: "transcript-1",
    user_id: userId,
    recording_id: "recording-1",
    full_text: "lecture about cells",
    full_text_tsv: null as unknown,
    language: "en",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } satisfies Tables<"transcripts">;
}

function segment(
  overrides: Partial<Tables<"transcript_segments">> = {},
): Tables<"transcript_segments"> {
  return {
    id: "segment-1",
    transcript_id: "transcript-1",
    start_ms: 0,
    end_ms: 1_000,
    text: "cells use energy",
    speaker: null,
    ...overrides,
  };
}

function chunkRow(overrides: Row = {}) {
  return {
    id: "chunk-1",
    user_id: userId,
    source_type: "document",
    document_id: "doc-1",
    transcript_id: null,
    recording_id: null,
    start_ms: null,
    end_ms: null,
    chunk_index: 0,
    content: "stale content",
    embedding: "[0]",
    content_tsv: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function vector(value: number) {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) =>
    index === 0 ? value : 0,
  );
}

function embeddingProvider(vectors: number[][]) {
  const calls: string[][] = [];

  return {
    calls,
    provider: {
      async embed(texts: string[]) {
        calls.push(texts);
        return vectors.slice(0, texts.length);
      },
    },
  };
}

function queryLog(ctx: ReturnType<typeof createContext>) {
  return (
    ctx.supabase as unknown as {
      queryLog: QueryLogEntry[];
    }
  ).queryLog;
}

function expectFilters(
  entry: QueryLogEntry | undefined,
  expected: Record<string, unknown>,
) {
  expect(entry).toBeDefined();

  for (const [column, value] of Object.entries(expected)) {
    expect(entry?.filters).toContainEqual({ column, value });
  }
}

describe("indexDocumentSearchChunks", () => {
  it("deletes only owned chunks for the document source and inserts fresh chunks", async () => {
    const tables = {
      semantic_search_chunks: [
        chunkRow({ id: "owned-stale" }),
        chunkRow({ id: "other-user-stale", user_id: otherUserId }),
        chunkRow({ id: "other-doc", document_id: "doc-2" }),
        chunkRow({
          id: "transcript-same-id",
          source_type: "transcript",
          document_id: null,
          transcript_id: "doc-1",
          recording_id: "recording-1",
        }),
      ],
    };
    const ctx = createContext(tables);
    const { calls, provider } = embeddingProvider([vector(0.25)]);

    await indexDocumentSearchChunks(ctx, {
      document: document({ content_text: "fresh biology content" }),
      provider,
    });

    const deleteEntry = queryLog(ctx).find(
      (entry) =>
        entry.action === "delete" && entry.table === "semantic_search_chunks",
    );
    expectFilters(deleteEntry, {
      user_id: userId,
      source_type: "document",
      document_id: "doc-1",
    });

    const remainingIds = tables.semantic_search_chunks.map((row) => row.id);
    expect(remainingIds).not.toContain("owned-stale");
    expect(remainingIds).toContain("other-user-stale");
    expect(remainingIds).toContain("other-doc");
    expect(remainingIds).toContain("transcript-same-id");

    expect(calls).toEqual([["fresh biology content"]]);
    expect(tables.semantic_search_chunks.at(-1)).toMatchObject({
      user_id: userId,
      source_type: "document",
      document_id: "doc-1",
      transcript_id: null,
      recording_id: null,
      start_ms: null,
      end_ms: null,
      chunk_index: 0,
      content: "fresh biology content",
      embedding: `[${vector(0.25).join(",")}]`,
    });
  });

  it("deletes owned stale document chunks and skips embedding and insert for blank text", async () => {
    const tables = {
      semantic_search_chunks: [
        chunkRow({ id: "owned-stale" }),
        chunkRow({ id: "other-user-stale", user_id: otherUserId }),
      ],
    };
    const ctx = createContext(tables);
    const { calls, provider } = embeddingProvider([vector(1)]);

    await indexDocumentSearchChunks(ctx, {
      document: document({ content_text: " \n\t " }),
      provider,
    });

    expect(tables.semantic_search_chunks.map((row) => row.id)).toEqual([
      "other-user-stale",
    ]);
    expect(calls).toEqual([]);
    expect(queryLog(ctx).some((entry) => entry.action === "insert")).toBe(
      false,
    );
  });
});

describe("indexTranscriptSearchChunks", () => {
  it("deletes only owned chunks for the transcript source and inserts fresh chunks", async () => {
    const tables = {
      semantic_search_chunks: [
        chunkRow({
          id: "owned-stale",
          source_type: "transcript",
          document_id: null,
          transcript_id: "transcript-1",
          recording_id: "recording-1",
          start_ms: 0,
          end_ms: 1_000,
        }),
        chunkRow({
          id: "other-user-stale",
          user_id: otherUserId,
          source_type: "transcript",
          document_id: null,
          transcript_id: "transcript-1",
          recording_id: "recording-1",
        }),
        chunkRow({
          id: "document-same-id",
          source_type: "document",
          document_id: "transcript-1",
          transcript_id: null,
          recording_id: null,
        }),
        chunkRow({
          id: "other-transcript",
          source_type: "transcript",
          document_id: null,
          transcript_id: "transcript-2",
          recording_id: "recording-2",
        }),
      ],
    };
    const ctx = createContext(tables);
    const { calls, provider } = embeddingProvider([vector(0.75)]);

    await indexTranscriptSearchChunks(ctx, {
      transcript: transcript(),
      segments: [
        segment({
          id: "segment-2",
          start_ms: 1_000,
          end_ms: 2_000,
          text: "energy becomes motion",
        }),
        segment({
          id: "segment-1",
          start_ms: 0,
          end_ms: 1_000,
          text: "cells use energy",
        }),
      ],
      provider,
    });

    const deleteEntry = queryLog(ctx).find(
      (entry) =>
        entry.action === "delete" && entry.table === "semantic_search_chunks",
    );
    expectFilters(deleteEntry, {
      user_id: userId,
      source_type: "transcript",
      transcript_id: "transcript-1",
    });

    const remainingIds = tables.semantic_search_chunks.map((row) => row.id);
    expect(remainingIds).not.toContain("owned-stale");
    expect(remainingIds).toContain("other-user-stale");
    expect(remainingIds).toContain("document-same-id");
    expect(remainingIds).toContain("other-transcript");

    expect(calls).toEqual([["cells use energy energy becomes motion"]]);
    expect(tables.semantic_search_chunks.at(-1)).toMatchObject({
      user_id: userId,
      source_type: "transcript",
      document_id: null,
      transcript_id: "transcript-1",
      recording_id: "recording-1",
      start_ms: 0,
      end_ms: 2_000,
      chunk_index: 0,
      content: "cells use energy energy becomes motion",
      embedding: `[${vector(0.75).join(",")}]`,
    });
  });

  it("deletes owned stale transcript chunks and skips embedding and insert when all segments are blank", async () => {
    const tables = {
      semantic_search_chunks: [
        chunkRow({
          id: "owned-stale",
          source_type: "transcript",
          document_id: null,
          transcript_id: "transcript-1",
          recording_id: "recording-1",
          start_ms: 0,
          end_ms: 1_000,
        }),
        chunkRow({
          id: "other-user-stale",
          user_id: otherUserId,
          source_type: "transcript",
          document_id: null,
          transcript_id: "transcript-1",
          recording_id: "recording-1",
        }),
      ],
    };
    const ctx = createContext(tables);
    const { calls, provider } = embeddingProvider([vector(1)]);

    await indexTranscriptSearchChunks(ctx, {
      transcript: transcript(),
      segments: [
        segment({ id: "segment-1", text: " \n\t " }),
        segment({
          id: "segment-2",
          start_ms: 1_000,
          end_ms: 2_000,
          text: "",
        }),
      ],
      provider,
    });

    const deleteEntry = queryLog(ctx).find(
      (entry) =>
        entry.action === "delete" && entry.table === "semantic_search_chunks",
    );
    expectFilters(deleteEntry, {
      user_id: userId,
      source_type: "transcript",
      transcript_id: "transcript-1",
    });

    expect(tables.semantic_search_chunks.map((row) => row.id)).toEqual([
      "other-user-stale",
    ]);
    expect(calls).toEqual([]);
    expect(queryLog(ctx).some((entry) => entry.action === "insert")).toBe(
      false,
    );
  });

  it("embeds all transcript chunk contents in one call and serializes 384-dim vectors", async () => {
    const tables: { semantic_search_chunks: Row[] } = {
      semantic_search_chunks: [],
    };
    const ctx = createContext(tables);
    const firstText = "alpha ".repeat(200);
    const secondText = "bravo ".repeat(200);
    const expectedEmbeddings = [
      vector(0.1),
      vector(0.2),
      vector(0.3),
      vector(0.4),
    ];
    const { calls, provider } = embeddingProvider(expectedEmbeddings);

    await indexTranscriptSearchChunks(ctx, {
      transcript: transcript(),
      segments: [
        segment({
          id: "segment-1",
          start_ms: 0,
          end_ms: 1_000,
          text: firstText,
        }),
        segment({
          id: "segment-2",
          start_ms: 1_000,
          end_ms: 2_000,
          text: secondText,
        }),
      ],
      provider,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(tables.semantic_search_chunks.length);
    expect(tables.semantic_search_chunks).toHaveLength(4);
    expect(tables.semantic_search_chunks.map((row) => row.embedding)).toEqual([
      ...expectedEmbeddings.map((embedding) => `[${embedding.join(",")}]`),
    ]);
  });
});
