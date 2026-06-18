import { describe, expect, it } from "vitest";
import {
  createContext,
  type FakeSupabase,
  otherUserId,
  userId,
} from "@/server/services/__tests__/fake-supabase";
import type { EmbeddingProvider } from "@/server/services/embedding-provider";
import {
  assignCitationLabels,
  chooseBestTranscriptSegment,
  type GroundedCandidate,
  parseGroundedSemanticRows,
  parseSearchNotesResult,
  retrieveGroundedSources,
} from "@/server/services/grounded-retrieval";

const queryEmbedding = Array.from({ length: 384 }, () => 0.01);
const embeddingProvider: EmbeddingProvider = {
  async embed(texts: string[]) {
    expect(texts).toEqual(["mito"]);
    return [queryEmbedding];
  },
};

function pageRow(over: Record<string, unknown> = {}) {
  return {
    id: "d1",
    user_id: userId,
    workspace_id: "workspace-1",
    parent_id: "workspace-1",
    kind: "page",
    title: "Biology notes",
    slug: "biology-notes-d1",
    content_json: null,
    content_text: "The mitochondria is the powerhouse of the cell.",
    content_tsv: null as unknown,
    mime_type: null,
    size_bytes: null,
    storage_key: null,
    is_pinned: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function audioRow(id: string, title: string) {
  return {
    ...pageRow({ id, title, slug: `${id}-audio` }),
    kind: "audio",
    content_json: null,
    content_text: null,
    mime_type: "audio/mp4",
    size_bytes: 1,
    storage_key: `${userId}/${id}`,
  };
}

function docCandidate(
  over: Partial<GroundedCandidate> = {},
): GroundedCandidate {
  return {
    kind: "document",
    title: "Biology notes",
    snippet: "mitochondria",
    score: 0.9,
    source: { documentId: "d1" },
    ...over,
  };
}

describe("assignCitationLabels", () => {
  it("assigns sequential S# labels starting at S1", () => {
    const labeled = assignCitationLabels([
      docCandidate({ source: { documentId: "d1" } }),
      docCandidate({ source: { documentId: "d2" } }),
      docCandidate({ source: { documentId: "d3" } }),
    ]);
    expect(labeled.map((s) => s.citationId)).toEqual(["S1", "S2", "S3"]);
    expect(labeled[0]).toMatchObject({
      kind: "document",
      title: "Biology notes",
    });
  });

  it("returns an empty array for no candidates", () => {
    expect(assignCitationLabels([])).toEqual([]);
  });
});

describe("chooseBestTranscriptSegment", () => {
  const segments = [
    { id: "seg-a", startMs: 0, endMs: 1000 },
    { id: "seg-b", startMs: 900, endMs: 2000 },
    { id: "seg-c", startMs: 5000, endMs: 6000 },
  ];

  it("chooses the segment with the largest overlap", () => {
    // chunk 800..1900 overlaps seg-a by 200, seg-b by 1000 -> seg-b
    expect(
      chooseBestTranscriptSegment({ startMs: 800, endMs: 1900 }, segments),
    ).toBe("seg-b");
  });

  it("breaks ties by earliest start_ms", () => {
    const tied = [
      { id: "late", startMs: 100, endMs: 200 },
      { id: "early", startMs: 0, endMs: 100 },
    ];
    // chunk 0..200 overlaps each by 100; earliest start wins
    expect(chooseBestTranscriptSegment({ startMs: 0, endMs: 200 }, tied)).toBe(
      "early",
    );
  });

  it("counts a touching boundary as an overlap when nothing better exists", () => {
    // chunk 1000..1000 only touches seg-a's end (overlap 0) -> still resolves
    expect(
      chooseBestTranscriptSegment({ startMs: 1000, endMs: 1000 }, [
        segments[0],
      ]),
    ).toBe("seg-a");
  });

  it("returns null when no segment overlaps", () => {
    expect(
      chooseBestTranscriptSegment({ startMs: 3000, endMs: 4000 }, segments),
    ).toBeNull();
  });

  it("returns null for an empty segment list", () => {
    expect(
      chooseBestTranscriptSegment({ startMs: 0, endMs: 10 }, []),
    ).toBeNull();
  });
});

describe("parseGroundedSemanticRows", () => {
  it("keeps document and transcript metadata, dropping malformed rows", () => {
    const parsed = parseGroundedSemanticRows([
      {
        id: "c1",
        user_id: "user-1",
        source_type: "page",
        source: {
          nodeId: "d1",
          anchor: { blockStart: 2, blockEnd: 4 },
        },
        chunk_index: 0,
        content: "doc chunk",
        similarity: 0.9,
        text_rank: 0,
      },
      {
        id: "c2",
        user_id: "user-1",
        source_type: "transcript",
        source: {
          transcriptId: "t1",
          recordingId: "r1",
          startMs: 100,
          endMs: 200,
        },
        chunk_index: 0,
        content: "transcript chunk",
        similarity: 0.8,
        text_rank: 0,
      },
      {
        id: "bad-doc",
        user_id: "user-1",
        source_type: "page",
        source: { nodeId: 123 },
        chunk_index: 0,
        content: "bad",
        similarity: 0.7,
        text_rank: 0,
      },
      {
        id: "bad-transcript",
        user_id: "user-1",
        source_type: "transcript",
        source: { transcriptId: "t2" },
        chunk_index: 0,
        content: "bad",
        similarity: 0.7,
        text_rank: 0,
      },
    ]);

    expect(parsed.documents).toEqual([
      {
        documentId: "d1",
        anchor: { blockStart: 2, blockEnd: 4 },
        content: "doc chunk",
        similarity: 0.9,
      },
    ]);
    expect(parsed.transcripts).toEqual([
      {
        transcriptId: "t1",
        recordingId: "r1",
        startMs: 100,
        endMs: 200,
        content: "transcript chunk",
        similarity: 0.8,
      },
    ]);
  });
});

describe("retrieveGroundedSources (semantic)", () => {
  it("returns [] for an empty or whitespace query without calling the RPC", async () => {
    const ctx = createContext({ library_nodes: [pageRow()] });
    expect(
      await retrieveGroundedSources(ctx, "   ", { embeddingProvider }),
    ).toEqual([]);
    expect((ctx.supabase as FakeSupabase).rpcLog).toEqual([]);
  });

  it("labels a transcript chunk and resolves the best overlapping segment", async () => {
    const ctx = createContext(
      {
        library_nodes: [audioRow("f1", "seminar-week-4.m4a")],
        transcripts: [],
        recordings: [{ id: "r1", user_id: userId, node_id: "f1" }],
        transcript_segments: [
          {
            id: "seg-1",
            transcript_id: "t1",
            start_ms: 0,
            end_ms: 850,
            text: "intro",
            speaker: null,
          },
          {
            id: "seg-2",
            transcript_id: "t1",
            start_ms: 800,
            end_ms: 2000,
            text: "oxidative phosphorylation",
            speaker: null,
          },
        ],
      },
      {
        match_semantic_search_chunks: [
          {
            id: "chunk-1",
            user_id: userId,
            source_type: "transcript",
            source: {
              transcriptId: "t1",
              recordingId: "r1",
              startMs: 812,
              endMs: 1900,
            },
            chunk_index: 0,
            content: "The tutor defines oxidative phosphorylation",
            similarity: 0.88,
            text_rank: 0,
          },
        ],
      },
    );

    const sources = await retrieveGroundedSources(ctx, "mito", {
      embeddingProvider,
    });

    expect(sources).toEqual([
      {
        citationId: "S1",
        kind: "transcript",
        title: "seminar-week-4.m4a",
        snippet: "The tutor defines oxidative phosphorylation",
        score: 0.88,
        source: {
          transcriptId: "t1",
          recordingId: "r1",
          segmentId: "seg-2",
          startMs: 812,
          endMs: 1900,
        },
      },
    ]);
  });

  it("keeps the timestamp span and null segmentId when no segment overlaps", async () => {
    const ctx = createContext(
      {
        library_nodes: [audioRow("f1", "rec.m4a")],
        transcripts: [],
        recordings: [{ id: "r1", user_id: userId, node_id: "f1" }],
        transcript_segments: [
          {
            id: "seg-far",
            transcript_id: "t1",
            start_ms: 9000,
            end_ms: 9500,
            text: "later",
            speaker: null,
          },
        ],
      },
      {
        match_semantic_search_chunks: [
          {
            id: "chunk-1",
            user_id: userId,
            source_type: "transcript",
            source: {
              transcriptId: "t1",
              recordingId: "r1",
              startMs: 100,
              endMs: 200,
            },
            chunk_index: 0,
            content: "early passage",
            similarity: 0.7,
            text_rank: 0,
          },
        ],
      },
    );

    const sources = await retrieveGroundedSources(ctx, "mito", {
      embeddingProvider,
    });

    expect(sources[0]?.source).toEqual({
      transcriptId: "t1",
      recordingId: "r1",
      segmentId: null,
      startMs: 100,
      endMs: 200,
    });
  });

  it("ranks document and transcript hits by score and labels them S1, S2", async () => {
    const ctx = createContext(
      {
        library_nodes: [
          pageRow({ id: "d1", title: "Cell biology" }),
          audioRow("f1", "lecture.m4a"),
        ],
        transcripts: [],
        recordings: [{ id: "r1", user_id: userId, node_id: "f1" }],
        transcript_segments: [],
      },
      {
        match_semantic_search_chunks: [
          {
            id: "c-transcript",
            user_id: userId,
            source_type: "transcript",
            source: {
              transcriptId: "t1",
              recordingId: "r1",
              startMs: 0,
              endMs: 100,
            },
            chunk_index: 0,
            content: "transcript passage",
            similarity: 0.95,
            text_rank: 0,
          },
          {
            id: "c-doc",
            user_id: userId,
            source_type: "page",
            source: { nodeId: "d1" },
            chunk_index: 0,
            content: "document passage",
            similarity: 0.6,
            text_rank: 0,
          },
        ],
      },
    );

    const sources = await retrieveGroundedSources(ctx, "mito", {
      embeddingProvider,
    });

    expect(sources.map((s) => [s.citationId, s.kind, s.title])).toEqual([
      ["S1", "transcript", "lecture.m4a"],
      ["S2", "document", "Cell biology"],
    ]);
  });

  it("threads semantic document anchors into grounded document sources", async () => {
    const ctx = createContext(
      {
        library_nodes: [pageRow({ id: "d1", title: "Cell biology" })],
        transcripts: [],
        recordings: [],
        transcript_segments: [],
      },
      {
        match_semantic_search_chunks: [
          {
            id: "c-doc",
            user_id: userId,
            source_type: "page",
            source: {
              nodeId: "d1",
              anchor: { blockStart: 3, blockEnd: 3 },
            },
            chunk_index: 0,
            content: "document passage",
            similarity: 0.6,
            text_rank: 0,
          },
        ],
      },
    );

    const sources = await retrieveGroundedSources(ctx, "mito", {
      embeddingProvider,
    });

    expect(sources[0]).toMatchObject({
      kind: "document",
      source: {
        documentId: "d1",
        anchor: { blockStart: 3, blockEnd: 3 },
      },
    });
  });

  it("does not return cross-user semantic rows or cross-user segments", async () => {
    const ctx = createContext(
      {
        library_nodes: [audioRow("f1", "mine.m4a")],
        transcripts: [],
        recordings: [{ id: "r1", user_id: userId, node_id: "f1" }],
        transcript_segments: [
          {
            id: "seg-theirs",
            transcript_id: "t-theirs",
            start_ms: 0,
            end_ms: 100,
            text: "secret",
            speaker: null,
          },
        ],
      },
      {
        match_semantic_search_chunks: [
          {
            id: "mine",
            user_id: userId,
            source_type: "transcript",
            source: {
              transcriptId: "t1",
              recordingId: "r1",
              startMs: 0,
              endMs: 100,
            },
            chunk_index: 0,
            content: "my passage",
            similarity: 0.9,
            text_rank: 0,
          },
          {
            id: "theirs",
            user_id: otherUserId,
            source_type: "transcript",
            source: {
              transcriptId: "t-theirs",
              recordingId: "r-theirs",
              startMs: 0,
              endMs: 100,
            },
            chunk_index: 0,
            content: "their passage",
            similarity: 0.99,
            text_rank: 0,
          },
        ],
      },
    );

    const sources = await retrieveGroundedSources(ctx, "mito", {
      embeddingProvider,
    });

    expect(sources.map((s) => s.snippet)).toEqual(["my passage"]);
    const askedTranscriptIds = (ctx.supabase as FakeSupabase).queryLog
      .filter((e) => e.table === "transcript_segments")
      .flatMap((e) => e.filters)
      .filter((f) => f.column === "transcript_id")
      .flatMap((f) => (Array.isArray(f.value) ? f.value : [f.value]));
    expect(askedTranscriptIds).not.toContain("t-theirs");
  });
});

describe("retrieveGroundedSources (lexical fallback)", () => {
  it("returns lexical document and transcript citations without an RPC call", async () => {
    const ctx = createContext({
      library_nodes: [
        pageRow({
          id: "d1",
          title: "Cell notes",
          content_text: "The mitochondria is the powerhouse of the cell.",
        }),
        audioRow("f1", "lecture.m4a"),
      ],
      transcripts: [
        {
          id: "t1",
          user_id: userId,
          recording_id: "r1",
          full_text: "today the lecture covers mitochondria in depth",
          full_text_tsv: null as unknown,
          language: "en",
          created_at: "2026-01-02T00:00:00Z",
        },
      ],
      recordings: [{ id: "r1", user_id: userId, node_id: "f1" }],
      transcript_segments: [
        {
          id: "seg-1",
          transcript_id: "t1",
          start_ms: 0,
          end_ms: 500,
          text: "intro words",
          speaker: null,
        },
        {
          id: "seg-2",
          transcript_id: "t1",
          start_ms: 500,
          end_ms: 1500,
          text: "mitochondria explained",
          speaker: null,
        },
      ],
    });

    const sources = await retrieveGroundedSources(ctx, "mitochondria");

    expect((ctx.supabase as FakeSupabase).rpcLog).toEqual([]);
    const kinds = sources.map((s) => s.kind).sort();
    expect(kinds).toEqual(["document", "transcript"]);

    const doc = sources.find((s) => s.kind === "document");
    expect(doc).toMatchObject({
      title: "Cell notes",
      score: null,
      source: { documentId: "d1" },
    });

    const transcript = sources.find((s) => s.kind === "transcript");
    // first segment whose text contains the first query term ("mitochondria") -> seg-2
    expect(transcript).toMatchObject({
      title: "lecture.m4a",
      score: null,
      source: {
        transcriptId: "t1",
        recordingId: "r1",
        segmentId: "seg-2",
        startMs: 500,
        endMs: 1500,
      },
    });
  });

  it("cites a transcript with null timing when no segment matches the query term", async () => {
    const ctx = createContext({
      library_nodes: [audioRow("f1", "lecture.m4a")],
      transcripts: [
        {
          id: "t1",
          user_id: userId,
          recording_id: "r1",
          full_text: "mitochondria appears only in full_text",
          full_text_tsv: null as unknown,
          language: "en",
          created_at: "2026-01-02T00:00:00Z",
        },
      ],
      recordings: [{ id: "r1", user_id: userId, node_id: "f1" }],
      transcript_segments: [
        {
          id: "seg-1",
          transcript_id: "t1",
          start_ms: 0,
          end_ms: 500,
          text: "no matching term here",
          speaker: null,
        },
      ],
    });

    const sources = await retrieveGroundedSources(ctx, "mitochondria");

    expect(sources[0]?.source).toEqual({
      transcriptId: "t1",
      recordingId: "r1",
      segmentId: null,
      startMs: null,
      endMs: null,
    });
  });

  it("scopes lexical hits to the current user", async () => {
    const ctx = createContext({
      library_nodes: [
        pageRow({ id: "mine", user_id: userId, title: "Mine" }),
        pageRow({ id: "theirs", user_id: otherUserId, title: "Theirs" }),
      ],
      transcripts: [],
      recordings: [],
      transcript_segments: [],
    });

    const sources = await retrieveGroundedSources(ctx, "mitochondria");

    expect(
      sources.map((s) => (s.source as { documentId: string }).documentId),
    ).toEqual(["mine"]);
  });
});

describe("parseSearchNotesResult", () => {
  const documentSource = {
    citationId: "S1",
    kind: "document",
    title: "Biology notes",
    snippet: "mitochondria",
    score: 0.9,
    source: { documentId: "d1" },
  };
  const transcriptSource = {
    citationId: "S2",
    kind: "transcript",
    title: "Lecture 3",
    snippet: "krebs cycle",
    score: null,
    source: {
      transcriptId: "t1",
      recordingId: "r1",
      segmentId: "seg-1",
      startMs: 1000,
      endMs: 2000,
    },
  };

  it("round-trips the JSON payload runSearchNotes emits", () => {
    const payload = JSON.stringify(
      { query: "mito", sources: [documentSource, transcriptSource] },
      null,
      2,
    );
    expect(parseSearchNotesResult(payload)).toEqual({
      query: "mito",
      sources: [documentSource, transcriptSource],
    });
  });

  it("round-trips document sources with optional block anchors", () => {
    const anchoredDocumentSource = {
      ...documentSource,
      source: {
        documentId: "d1",
        anchor: { blockStart: 3, blockEnd: 4 },
      },
    };
    const payload = JSON.stringify({
      query: "mito",
      sources: [anchoredDocumentSource],
    });

    expect(parseSearchNotesResult(payload)?.sources[0]?.source).toEqual({
      documentId: "d1",
      anchor: { blockStart: 3, blockEnd: 4 },
    });
  });

  it("accepts transcript sources with null segment and timing", () => {
    const payload = JSON.stringify({
      query: "mito",
      sources: [
        {
          ...transcriptSource,
          source: {
            ...transcriptSource.source,
            segmentId: null,
            startMs: null,
            endMs: null,
          },
        },
      ],
    });
    expect(parseSearchNotesResult(payload)?.sources[0]?.source).toMatchObject({
      segmentId: null,
      startMs: null,
      endMs: null,
    });
  });

  it("returns null for non-JSON text", () => {
    expect(parseSearchNotesResult("Tool search_notes failed")).toBeNull();
  });

  it("returns null for JSON that is not a search_notes result", () => {
    expect(parseSearchNotesResult(JSON.stringify({ id: "d1" }))).toBeNull();
    expect(
      parseSearchNotesResult(
        JSON.stringify({ query: "x", sources: [{ citationId: 1 }] }),
      ),
    ).toBeNull();
  });
});
