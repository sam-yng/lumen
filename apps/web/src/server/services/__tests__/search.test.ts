import { describe, expect, it } from "vitest";
import {
  createContext,
  type FakeSupabase,
  otherUserId,
  userId,
} from "@/server/services/__tests__/fake-supabase";
import type { EmbeddingProvider } from "@/server/services/embedding-provider";
import {
  buildSnippet,
  rankResults,
  searchLibrary,
} from "@/server/services/search";

const queryEmbedding = Array.from({ length: 384 }, () => 0.01);
const embeddingProvider: EmbeddingProvider = {
  async embed(texts: string[]) {
    expect(texts).toEqual(["cell"]);
    return [queryEmbedding];
  },
};

function doc(over: Record<string, unknown> = {}) {
  return {
    id: "d1",
    user_id: "user-1",
    folder_id: null,
    title: "Biology notes",
    content_json: null,
    content_text: "The mitochondria is the powerhouse of the cell.",
    // TSVector generated column — opaque/Postgres-only, unused by the pure helpers
    content_tsv: null as unknown,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("buildSnippet", () => {
  it("windows around the first query term", () => {
    const snippet = buildSnippet(
      "alpha beta gamma mitochondria delta epsilon",
      "mitochondria",
    );
    expect(snippet).toContain("mitochondria");
  });

  it("falls back to the head when the term is absent", () => {
    expect(buildSnippet("short text", "absent")).toBe("short text");
  });

  it("returns empty string for empty source", () => {
    expect(buildSnippet(null, "x")).toBe("");
  });
});

describe("rankResults", () => {
  it("ranks body hits (tier 0) above name-only hits (tier 2)", () => {
    const results = rankResults({
      query: "cell",
      documentBodyHits: [doc({ id: "body" })],
      transcriptHits: [],
      documentTitleHits: [],
      fileNameHits: [
        {
          id: "f1",
          user_id: "user-1",
          folder_id: null,
          name: "cell-diagram.png",
          mime_type: "image/png",
          size_bytes: 1,
          storage_key: "k",
          kind: "other",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
    expect(results.map((r) => r.kind)).toEqual(["document", "file"]);
    expect(results[0].tier).toBe(0);
    expect(results[1].tier).toBe(2);
  });

  it("dedupes a document matching both body and title into one tier-0 hit", () => {
    const results = rankResults({
      query: "biology",
      documentBodyHits: [doc({ id: "same" })],
      transcriptHits: [],
      documentTitleHits: [doc({ id: "same" })],
      fileNameHits: [],
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ kind: "document", id: "same", tier: 0 });
  });

  it("includes transcript hits at tier 0 with a snippet", () => {
    const results = rankResults({
      query: "lecture",
      documentBodyHits: [],
      transcriptHits: [
        {
          id: "t1",
          user_id: "user-1",
          recording_id: "r1",
          full_text: "today's lecture covers cells",
          // TSVector generated column — opaque/Postgres-only, unused by the pure helpers
          full_text_tsv: null as unknown,
          language: "en",
          created_at: "2026-01-02T00:00:00Z",
        },
      ],
      documentTitleHits: [],
      fileNameHits: [],
    });
    expect(results[0]).toMatchObject({
      kind: "transcript",
      recordingId: "r1",
      tier: 0,
    });
    expect((results[0] as { snippet: string }).snippet).toContain("lecture");
  });

  it("recency tiebreak: newer document sorts before older at same tier", () => {
    const results = rankResults({
      query: "cell",
      documentBodyHits: [
        doc({ id: "older", updated_at: "2026-01-01T00:00:00Z" }),
        doc({ id: "newer", updated_at: "2026-02-01T00:00:00Z" }),
      ],
      transcriptHits: [],
      documentTitleHits: [],
      fileNameHits: [],
    });
    expect(results[0].id).toBe("newer");
    expect(results[1].id).toBe("older");
  });

  it("returns empty array when all hit arrays are empty", () => {
    const results = rankResults({
      query: "x",
      documentBodyHits: [],
      transcriptHits: [],
      documentTitleHits: [],
      fileNameHits: [],
    });
    expect(results).toEqual([]);
  });
});

describe("searchLibrary", () => {
  it("returns [] for an empty or whitespace query", async () => {
    const ctx = createContext({ documents: [doc()] });
    expect(await searchLibrary(ctx, "   ")).toEqual([]);
  });

  it("scopes results to the current user and includes each kind", async () => {
    const ctx = createContext({
      documents: [
        doc({ id: "mine", user_id: userId }),
        doc({ id: "theirs", user_id: "user-2" }),
      ],
      transcripts: [
        {
          id: "t1",
          user_id: userId,
          recording_id: "r1",
          full_text: "lecture about cells",
          // TSVector generated column — opaque/Postgres-only
          full_text_tsv: null as unknown,
          language: "en",
          created_at: "2026-01-02T00:00:00Z",
        },
      ],
      files: [
        {
          id: "f1",
          user_id: userId,
          folder_id: null,
          name: "cell.png",
          mime_type: "image/png",
          size_bytes: 1,
          storage_key: "k",
          kind: "other",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });

    const results = await searchLibrary(ctx, "cell");
    const ids = results.map((r) => r.id);
    expect(ids).toContain("mine");
    expect(ids).not.toContain("theirs");
    expect(results.some((r) => r.kind === "transcript")).toBe(true);
    expect(results.some((r) => r.kind === "file")).toBe(true);
  });

  it("returns semantic document chunks with semantic snippets above title and file hits", async () => {
    const ctx = createContext(
      {
        documents: [
          doc({
            id: "semantic-doc",
            user_id: userId,
            title: "Chemistry notes",
            content_text: "No lexical match here.",
            updated_at: "2026-01-01T00:00:00Z",
          }),
          doc({
            id: "title-doc",
            user_id: userId,
            title: "cell title only",
            content_text: "No body match here.",
            updated_at: "2026-02-01T00:00:00Z",
          }),
        ],
        transcripts: [],
        files: [
          {
            id: "file-hit",
            user_id: userId,
            folder_id: null,
            name: "cell-guide.pdf",
            mime_type: "application/pdf",
            size_bytes: 1,
            storage_key: "k",
            kind: "other",
            created_at: "2026-03-01T00:00:00Z",
          },
        ],
      },
      {
        match_semantic_search_chunks: [
          {
            id: "chunk-1",
            user_id: userId,
            source_type: "document",
            source: { documentId: "semantic-doc" },
            chunk_index: 0,
            content: "semantic chunk says membranes and organelles",
            similarity: 0.91,
            text_rank: 0,
          },
          {
            id: "chunk-other",
            user_id: otherUserId,
            source_type: "document",
            source: { documentId: "other-doc" },
            chunk_index: 0,
            content: "cross-user chunk must stay hidden",
            similarity: 0.99,
            text_rank: 0,
          },
        ],
      },
    );

    const results = await searchLibrary(ctx, "cell", { embeddingProvider });

    expect(results[0]?.id).toBe("semantic-doc");
    expect(
      results
        .slice(1)
        .map((result) => result.id)
        .sort(),
    ).toEqual(["file-hit", "title-doc"]);
    expect(results[0]).toMatchObject({
      kind: "document",
      id: "semantic-doc",
      snippet: "semantic chunk says membranes and organelles",
      tier: 1,
    });
    expect(results.slice(1).every((result) => result.tier === 2)).toBe(true);
    expect((ctx.supabase as FakeSupabase).rpcLog[0]?.args?.match_user_id).toBe(
      userId,
    );
  });

  it("returns semantic transcript chunks with recordingId", async () => {
    const ctx = createContext(
      { documents: [], transcripts: [], files: [] },
      {
        match_semantic_search_chunks: [
          {
            id: "chunk-1",
            user_id: userId,
            source_type: "transcript",
            source: {
              transcriptId: "transcript-1",
              recordingId: "recording-1",
              startMs: 100,
              endMs: 200,
            },
            chunk_index: 0,
            content: "semantic transcript passage",
            similarity: 0.88,
            text_rank: 0,
          },
        ],
      },
    );

    const results = await searchLibrary(ctx, "cell", { embeddingProvider });

    expect(results).toEqual([
      {
        kind: "transcript",
        id: "transcript-1",
        recordingId: "recording-1",
        snippet: "semantic transcript passage",
        tier: 1,
      },
    ]);
  });

  it("does not call the semantic RPC when no embedding provider is supplied", async () => {
    const ctx = createContext({
      documents: [doc()],
      transcripts: [],
      files: [],
    });

    const results = await searchLibrary(ctx, "cell");

    expect(results).toHaveLength(1);
    expect((ctx.supabase as FakeSupabase).rpcLog).toEqual([]);
  });

  it("rejects an invalid query embedding before calling the semantic RPC", async () => {
    const invalidProvider: EmbeddingProvider = {
      async embed() {
        return [[1, 2, 3]];
      },
    };
    const ctx = createContext({ documents: [], transcripts: [], files: [] });

    await expect(
      searchLibrary(ctx, "cell", { embeddingProvider: invalidProvider }),
    ).rejects.toThrow("Embedding must have 384 dimensions.");
    expect((ctx.supabase as FakeSupabase).rpcLog).toEqual([]);
  });
});
