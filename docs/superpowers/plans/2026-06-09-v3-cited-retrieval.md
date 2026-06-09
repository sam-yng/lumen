# V3 Cited Retrieval (Milestone 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a citation-aware retrieval contract so MCP `search_notes` and the in-app assistant return source-grounded `GroundedSource[]` with stable `[S#]` labels, transcript timestamp spans, and best-overlapping segment ids.

**Architecture:** A new service module `grounded-retrieval.ts` sits beside `search.ts`. It reuses the v2 `match_semantic_search_chunks` RPC (which already emits `documentId` / `transcriptId` / `recordingId` / `startMs` / `endMs` in its `source` JSON) when an embedding provider is supplied, and falls back to lexical FTS otherwise. Candidates are hydrated with document/recording titles and transcript-segment resolution, ranked by score, then labeled `S1..Sn`. `searchLibrary`, `/api/search`, and the sidebar stay byte-for-byte unchanged.

**Tech Stack:** TypeScript (strict), Vitest, Supabase service-layer client (`ServiceContext`), the in-memory MCP bridge, Anthropic tool-loop.

**Spec:** `docs/superpowers/specs/2026-06-09-v3-cited-retrieval-design.md`

---

## File Structure

- **Create** `apps/web/src/server/services/grounded-retrieval.ts` — types (`GroundedSource`, `GroundedDocumentSource`, `GroundedTranscriptSource`, `SearchNotesToolResult`), pure helpers (`assignCitationLabels`, `chooseBestTranscriptSegment`, `parseGroundedSemanticRows`), and the orchestrator `retrieveGroundedSources` with its IO helpers.
- **Create** `apps/web/src/server/services/__tests__/grounded-retrieval.test.ts` — pure-helper + service tests (labels, overlap, semantic, lexical, security).
- **Modify** `apps/web/src/server/mcp/tools.ts` — `runSearchNotes` returns `{ query, sources }`; update the `search_notes` tool description.
- **Modify** `apps/web/src/server/mcp/__tests__/tools.test.ts` — assert the `{ query, sources }` shape with citation labels.
- **Modify** `apps/web/src/server/services/assistant.ts` — add citation rules to `SYSTEM_PROMPT`.
- **Modify** `apps/web/src/server/services/__tests__/assistant.test.ts` — assert the prompt rules and that the tool loop still runs.

**Unchanged (regression guard, do not edit):** `apps/web/src/server/services/search.ts`, `apps/web/src/app/api/search/*`, the sidebar `SearchPanel`, `apps/web/src/server/services/__tests__/search.test.ts`.

**Facts established by reading the code (do not re-derive):**
- The RPC `match_semantic_search_chunks` returns rows shaped `{ id, user_id, source_type, source, chunk_index, content, similarity, text_rank }`. `source` for a transcript chunk is `{ transcriptId, recordingId, startMs, endMs }`; for a document chunk it is `{ documentId }` (see `supabase/migrations/20260604160000_semantic_search.sql` and existing `search.ts` parsers).
- `transcript_segments` columns: `id, transcript_id, start_ms, end_ms, text, speaker` (no `user_id`). Ownership is enforced in prod by RLS join; in the service layer we only ever query segments for transcript ids that came from user-filtered sources, so cross-user rows never reach segment resolution.
- `recordings` columns include `id, user_id, file_id`; `files` include `id, user_id, name`. Transcript titles resolve through `recording.file_id -> files.name`.
- `buildSnippet(text, query)` is already exported from `search.ts` and is reused here.
- `serializeEmbedding` is exported from `semantic-index.ts`; `assertEmbedding` from `embedding-provider.ts`; `assertNoDatabaseError` / `ServiceError` from `errors.ts`.
- Test context: `createContext(tables, rpcRows)` from `__tests__/fake-supabase.ts`; `userId = "user-1"`, `otherUserId = "user-2"`. The fake RPC filters `match_semantic_search_chunks` rows by `match_user_id`. `FakeQuery` supports `.select/.eq/.in/.ilike/.textSearch/.order` and awaiting returns `{ data, error }`.

---

### Task 1: Module skeleton, public types, and `assignCitationLabels`

**Files:**
- Create: `apps/web/src/server/services/grounded-retrieval.ts`
- Test: `apps/web/src/server/services/__tests__/grounded-retrieval.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/server/services/__tests__/grounded-retrieval.test.ts
import { describe, expect, it } from "vitest";
import {
  assignCitationLabels,
  type GroundedCandidate,
} from "@/server/services/grounded-retrieval";

function docCandidate(over: Partial<GroundedCandidate> = {}): GroundedCandidate {
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
    expect(labeled[0]).toMatchObject({ kind: "document", title: "Biology notes" });
  });

  it("returns an empty array for no candidates", () => {
    expect(assignCitationLabels([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && bunx vitest run src/server/services/__tests__/grounded-retrieval.test.ts`
Expected: FAIL — cannot find module `grounded-retrieval` / `assignCitationLabels` is not exported.

- [ ] **Step 3: Write the minimal implementation**

```ts
// apps/web/src/server/services/grounded-retrieval.ts

export type GroundedDocumentSource = {
  documentId: string;
};

export type GroundedTranscriptSource = {
  transcriptId: string;
  recordingId: string;
  segmentId: string | null;
  startMs: number | null;
  endMs: number | null;
};

export type GroundedSource = {
  citationId: string;
  kind: "document" | "transcript";
  title: string;
  snippet: string;
  score: number | null;
  source: GroundedDocumentSource | GroundedTranscriptSource;
};

export type SearchNotesToolResult = {
  query: string;
  sources: GroundedSource[];
};

/** A ranked source before its stable citation label is assigned. */
export type GroundedCandidate = Omit<GroundedSource, "citationId">;

/** Assign deterministic S1..Sn labels to already-ranked candidates. */
export function assignCitationLabels(
  candidates: GroundedCandidate[],
): GroundedSource[] {
  return candidates.map((candidate, index) => ({
    citationId: `S${index + 1}`,
    ...candidate,
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && bunx vitest run src/server/services/__tests__/grounded-retrieval.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/services/grounded-retrieval.ts apps/web/src/server/services/__tests__/grounded-retrieval.test.ts
git commit -m "feat(retrieval): add grounded source types and citation labeling"
```

---

### Task 2: `chooseBestTranscriptSegment` (timestamp overlap resolution)

**Files:**
- Modify: `apps/web/src/server/services/grounded-retrieval.ts`
- Test: `apps/web/src/server/services/__tests__/grounded-retrieval.test.ts`

- [ ] **Step 1: Write the failing test** (append to the test file)

```ts
import { chooseBestTranscriptSegment } from "@/server/services/grounded-retrieval";

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
      chooseBestTranscriptSegment({ startMs: 1000, endMs: 1000 }, [segments[0]]),
    ).toBe("seg-a");
  });

  it("returns null when no segment overlaps", () => {
    expect(
      chooseBestTranscriptSegment({ startMs: 3000, endMs: 4000 }, segments),
    ).toBeNull();
  });

  it("returns null for an empty segment list", () => {
    expect(chooseBestTranscriptSegment({ startMs: 0, endMs: 10 }, [])).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && bunx vitest run src/server/services/__tests__/grounded-retrieval.test.ts`
Expected: FAIL — `chooseBestTranscriptSegment` is not exported.

- [ ] **Step 3: Write the minimal implementation** (append to `grounded-retrieval.ts`)

```ts
export type SegmentOverlapInput = {
  id: string;
  startMs: number;
  endMs: number;
};

/**
 * Pick the transcript segment that best covers a chunk's [startMs, endMs] span.
 * Overlap predicate: segment.startMs <= chunk.endMs && segment.endMs >= chunk.startMs.
 * Ranking: largest overlap; ties broken by earliest startMs. No overlap -> null.
 */
export function chooseBestTranscriptSegment(
  chunk: { startMs: number; endMs: number },
  segments: SegmentOverlapInput[],
): string | null {
  let best: { id: string; overlap: number; startMs: number } | null = null;

  for (const segment of segments) {
    if (segment.startMs > chunk.endMs || segment.endMs < chunk.startMs) {
      continue;
    }
    const overlap =
      Math.min(chunk.endMs, segment.endMs) -
      Math.max(chunk.startMs, segment.startMs);

    if (
      best === null ||
      overlap > best.overlap ||
      (overlap === best.overlap && segment.startMs < best.startMs)
    ) {
      best = { id: segment.id, overlap, startMs: segment.startMs };
    }
  }

  return best?.id ?? null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && bunx vitest run src/server/services/__tests__/grounded-retrieval.test.ts`
Expected: PASS (all `chooseBestTranscriptSegment` cases + prior tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/services/grounded-retrieval.ts apps/web/src/server/services/__tests__/grounded-retrieval.test.ts
git commit -m "feat(retrieval): resolve best overlapping transcript segment"
```

---

### Task 3: `parseGroundedSemanticRows` (RPC row parsing that keeps timing metadata)

**Files:**
- Modify: `apps/web/src/server/services/grounded-retrieval.ts`
- Test: `apps/web/src/server/services/__tests__/grounded-retrieval.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```ts
import { parseGroundedSemanticRows } from "@/server/services/grounded-retrieval";

describe("parseGroundedSemanticRows", () => {
  it("keeps document and transcript metadata, dropping malformed rows", () => {
    const parsed = parseGroundedSemanticRows([
      {
        id: "c1",
        user_id: "user-1",
        source_type: "document",
        source: { documentId: "d1" },
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
        source_type: "document",
        source: { documentId: 123 },
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
      { documentId: "d1", content: "doc chunk", similarity: 0.9 },
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && bunx vitest run src/server/services/__tests__/grounded-retrieval.test.ts`
Expected: FAIL — `parseGroundedSemanticRows` is not exported.

- [ ] **Step 3: Write the minimal implementation** (append)

```ts
import type { SemanticSearchRow } from "@/server/services/grounded-retrieval";

export type GroundedSemanticRow = {
  id: string;
  user_id: string;
  source_type: "document" | "transcript";
  source: unknown;
  chunk_index: number;
  content: string;
  similarity: number;
  text_rank: number;
};

export type GroundedSemanticDoc = {
  documentId: string;
  content: string;
  similarity: number;
};

export type GroundedSemanticTranscript = {
  transcriptId: string;
  recordingId: string;
  startMs: number;
  endMs: number;
  content: string;
  similarity: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseGroundedSemanticRows(rows: GroundedSemanticRow[]): {
  documents: GroundedSemanticDoc[];
  transcripts: GroundedSemanticTranscript[];
} {
  const documents: GroundedSemanticDoc[] = [];
  const transcripts: GroundedSemanticTranscript[] = [];

  for (const row of rows) {
    if (!isRecord(row.source)) continue;

    if (row.source_type === "document") {
      const documentId = row.source.documentId;
      if (typeof documentId !== "string") continue;
      documents.push({
        documentId,
        content: row.content,
        similarity: row.similarity,
      });
      continue;
    }

    const { transcriptId, recordingId, startMs, endMs } = row.source;
    if (
      typeof transcriptId !== "string" ||
      typeof recordingId !== "string" ||
      typeof startMs !== "number" ||
      typeof endMs !== "number"
    ) {
      continue;
    }
    transcripts.push({
      transcriptId,
      recordingId,
      startMs,
      endMs,
      content: row.content,
      similarity: row.similarity,
    });
  }

  return { documents, transcripts };
}
```

> Note: delete the bogus `import type { SemanticSearchRow }` line shown in Step 3 — it was a copy slip; `GroundedSemanticRow` is defined locally and nothing imports `SemanticSearchRow`. The file must have no unused imports (Biome will fail otherwise).

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && bunx vitest run src/server/services/__tests__/grounded-retrieval.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/services/grounded-retrieval.ts apps/web/src/server/services/__tests__/grounded-retrieval.test.ts
git commit -m "feat(retrieval): parse semantic rows keeping transcript timing"
```

---

### Task 4: `retrieveGroundedSources` — semantic path with title + segment hydration and security scoping

**Files:**
- Modify: `apps/web/src/server/services/grounded-retrieval.ts`
- Test: `apps/web/src/server/services/__tests__/grounded-retrieval.test.ts`

This task adds the orchestrator with the semantic branch and the shared hydration (`hydrateGroundedSources`) used by both branches. The lexical branch is added in Task 5; until then `retrieveGroundedSources` returns `[]` when no embedding provider is supplied.

- [ ] **Step 1: Write the failing tests** (append)

```ts
import {
  createContext,
  type FakeSupabase,
  otherUserId,
  userId,
} from "@/server/services/__tests__/fake-supabase";
import type { EmbeddingProvider } from "@/server/services/embedding-provider";
import { retrieveGroundedSources } from "@/server/services/grounded-retrieval";

const queryEmbedding = Array.from({ length: 384 }, () => 0.01);
const embeddingProvider: EmbeddingProvider = {
  async embed(texts: string[]) {
    expect(texts).toEqual(["mito"]);
    return [queryEmbedding];
  },
};

function docRow(over: Record<string, unknown> = {}) {
  return {
    id: "d1",
    user_id: userId,
    folder_id: null,
    title: "Biology notes",
    content_json: null,
    content_text: "The mitochondria is the powerhouse of the cell.",
    content_tsv: null as unknown,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("retrieveGroundedSources (semantic)", () => {
  it("returns [] for an empty or whitespace query without calling the RPC", async () => {
    const ctx = createContext({ documents: [docRow()] });
    expect(
      await retrieveGroundedSources(ctx, "   ", { embeddingProvider }),
    ).toEqual([]);
    expect((ctx.supabase as FakeSupabase).rpcLog).toEqual([]);
  });

  it("labels a transcript chunk and resolves the best overlapping segment", async () => {
    const ctx = createContext(
      {
        documents: [],
        transcripts: [],
        recordings: [{ id: "r1", user_id: userId, file_id: "f1" }],
        files: [{ id: "f1", user_id: userId, name: "seminar-week-4.m4a" }],
        transcript_segments: [
          { id: "seg-1", transcript_id: "t1", start_ms: 0, end_ms: 850, text: "intro", speaker: null },
          { id: "seg-2", transcript_id: "t1", start_ms: 800, end_ms: 2000, text: "oxidative phosphorylation", speaker: null },
        ],
      },
      {
        match_semantic_search_chunks: [
          {
            id: "chunk-1",
            user_id: userId,
            source_type: "transcript",
            source: { transcriptId: "t1", recordingId: "r1", startMs: 812, endMs: 1900 },
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
        documents: [],
        transcripts: [],
        recordings: [{ id: "r1", user_id: userId, file_id: "f1" }],
        files: [{ id: "f1", user_id: userId, name: "rec.m4a" }],
        transcript_segments: [
          { id: "seg-far", transcript_id: "t1", start_ms: 9000, end_ms: 9500, text: "later", speaker: null },
        ],
      },
      {
        match_semantic_search_chunks: [
          {
            id: "chunk-1",
            user_id: userId,
            source_type: "transcript",
            source: { transcriptId: "t1", recordingId: "r1", startMs: 100, endMs: 200 },
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
        documents: [docRow({ id: "d1", title: "Cell biology" })],
        transcripts: [],
        recordings: [{ id: "r1", user_id: userId, file_id: "f1" }],
        files: [{ id: "f1", user_id: userId, name: "lecture.m4a" }],
        transcript_segments: [],
      },
      {
        match_semantic_search_chunks: [
          {
            id: "c-transcript",
            user_id: userId,
            source_type: "transcript",
            source: { transcriptId: "t1", recordingId: "r1", startMs: 0, endMs: 100 },
            chunk_index: 0,
            content: "transcript passage",
            similarity: 0.95,
            text_rank: 0,
          },
          {
            id: "c-doc",
            user_id: userId,
            source_type: "document",
            source: { documentId: "d1" },
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

  it("does not return cross-user semantic rows or cross-user segments", async () => {
    const ctx = createContext(
      {
        documents: [],
        transcripts: [],
        recordings: [{ id: "r1", user_id: userId, file_id: "f1" }],
        files: [{ id: "f1", user_id: userId, name: "mine.m4a" }],
        transcript_segments: [
          // belongs to a transcript the current user does NOT own; must never load
          { id: "seg-theirs", transcript_id: "t-theirs", start_ms: 0, end_ms: 100, text: "secret", speaker: null },
        ],
      },
      {
        match_semantic_search_chunks: [
          {
            id: "mine",
            user_id: userId,
            source_type: "transcript",
            source: { transcriptId: "t1", recordingId: "r1", startMs: 0, endMs: 100 },
            chunk_index: 0,
            content: "my passage",
            similarity: 0.9,
            text_rank: 0,
          },
          {
            id: "theirs",
            user_id: otherUserId,
            source_type: "transcript",
            source: { transcriptId: "t-theirs", recordingId: "r-theirs", startMs: 0, endMs: 100 },
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
    // We only query segments for owned transcript ids, so t-theirs is never asked for.
    const askedTranscriptIds = (ctx.supabase as FakeSupabase).queryLog
      .filter((e) => e.table === "transcript_segments")
      .flatMap((e) => e.filters)
      .filter((f) => f.column === "transcript_id")
      .flatMap((f) => (Array.isArray(f.value) ? f.value : [f.value]));
    expect(askedTranscriptIds).not.toContain("t-theirs");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/web && bunx vitest run src/server/services/__tests__/grounded-retrieval.test.ts`
Expected: FAIL — `retrieveGroundedSources` is not exported.

- [ ] **Step 3: Write the implementation** (append to `grounded-retrieval.ts`)

```ts
import type { Tables } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import type { EmbeddingProvider } from "@/server/services/embedding-provider";
import { assertEmbedding } from "@/server/services/embedding-provider";
import { assertNoDatabaseError, ServiceError } from "@/server/services/errors";
import { buildSnippet } from "@/server/services/search";
import { serializeEmbedding } from "@/server/services/semantic-index";

const MATCH_COUNT = 8;

/** A candidate before titles, segments, ranking, and labels are applied. */
type RawCandidate = {
  kind: "document" | "transcript";
  snippet: string;
  score: number | null;
  documentId?: string;
  transcript?: {
    transcriptId: string;
    recordingId: string;
    startMs: number | null;
    endMs: number | null;
  };
};

export async function retrieveGroundedSources(
  ctx: ServiceContext,
  rawQuery: string,
  options: { embeddingProvider?: EmbeddingProvider } = {},
): Promise<GroundedSource[]> {
  const query = rawQuery.trim();
  if (query.length === 0) return [];

  const candidates = options.embeddingProvider
    ? await collectSemanticCandidates(ctx, query, options.embeddingProvider)
    : []; // lexical branch added in Task 5

  return hydrateGroundedSources(ctx, query, candidates);
}

async function collectSemanticCandidates(
  ctx: ServiceContext,
  query: string,
  provider: EmbeddingProvider,
): Promise<RawCandidate[]> {
  const embeddings = await provider.embed([query]);
  if (embeddings.length !== 1) {
    throw new ServiceError(
      "invalid_input",
      `Embedding provider returned ${embeddings.length} embeddings for 1 query.`,
    );
  }

  const queryEmbedding = serializeEmbedding(
    assertEmbedding(embeddings[0] ?? []),
  );
  const { data, error } = await ctx.supabase.rpc<GroundedSemanticRow>(
    "match_semantic_search_chunks",
    {
      query_embedding: queryEmbedding,
      query_text: query,
      match_user_id: ctx.userId,
      match_count: MATCH_COUNT,
    },
  );
  assertNoDatabaseError(error, "Could not search semantic chunks");

  const { documents, transcripts } = parseGroundedSemanticRows(data);

  return [
    ...documents.map(
      (hit): RawCandidate => ({
        kind: "document",
        snippet: hit.content,
        score: hit.similarity,
        documentId: hit.documentId,
      }),
    ),
    ...transcripts.map(
      (hit): RawCandidate => ({
        kind: "transcript",
        snippet: hit.content,
        score: hit.similarity,
        transcript: {
          transcriptId: hit.transcriptId,
          recordingId: hit.recordingId,
          startMs: hit.startMs,
          endMs: hit.endMs,
        },
      }),
    ),
  ];
}

/** Resolve titles + transcript segments, rank by score, assign citation labels. */
async function hydrateGroundedSources(
  ctx: ServiceContext,
  query: string,
  candidates: RawCandidate[],
): Promise<GroundedSource[]> {
  if (candidates.length === 0) return [];

  const documentIds = uniqueStrings(
    candidates.map((c) => c.documentId).filter(isString),
  );
  const transcriptIds = uniqueStrings(
    candidates.flatMap((c) =>
      c.transcript ? [c.transcript.transcriptId] : [],
    ),
  );
  const recordingIds = uniqueStrings(
    candidates.flatMap((c) =>
      c.transcript ? [c.transcript.recordingId] : [],
    ),
  );

  const [titleByDocument, titleByRecording, segmentsByTranscript] =
    await Promise.all([
      loadDocumentTitles(ctx, documentIds),
      loadRecordingTitles(ctx, recordingIds),
      loadSegmentsByTranscript(ctx, transcriptIds),
    ]);

  const built: GroundedCandidate[] = [];
  for (const candidate of candidates) {
    if (candidate.documentId !== undefined) {
      const title = titleByDocument.get(candidate.documentId);
      if (title === undefined) continue; // not owned / hydration miss -> drop
      built.push({
        kind: "document",
        title,
        snippet: candidate.snippet,
        score: candidate.score,
        source: { documentId: candidate.documentId },
      });
      continue;
    }

    if (candidate.transcript) {
      const t = candidate.transcript;
      const segments = segmentsByTranscript.get(t.transcriptId) ?? [];
      const resolved = resolveTranscriptTiming(query, t, segments);
      built.push({
        kind: "transcript",
        title: titleByRecording.get(t.recordingId) ?? t.recordingId,
        snippet: candidate.snippet,
        score: candidate.score,
        source: {
          transcriptId: t.transcriptId,
          recordingId: t.recordingId,
          segmentId: resolved.segmentId,
          startMs: resolved.startMs,
          endMs: resolved.endMs,
        },
      });
    }
  }

  built.sort(
    (a, b) =>
      (b.score ?? Number.NEGATIVE_INFINITY) -
      (a.score ?? Number.NEGATIVE_INFINITY),
  );

  return assignCitationLabels(built);
}

type SegmentRow = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
};

/**
 * Resolve a transcript candidate's segment + timing.
 * - Semantic chunk (numeric span): pick best overlapping segment, keep the span.
 * - Lexical hit (null span): approximate by the first segment whose text contains
 *   the first query term; if none, return null timing.
 */
function resolveTranscriptTiming(
  query: string,
  candidate: { startMs: number | null; endMs: number | null },
  segments: SegmentRow[],
): { segmentId: string | null; startMs: number | null; endMs: number | null } {
  if (candidate.startMs !== null && candidate.endMs !== null) {
    const segmentId = chooseBestTranscriptSegment(
      { startMs: candidate.startMs, endMs: candidate.endMs },
      segments,
    );
    return {
      segmentId,
      startMs: candidate.startMs,
      endMs: candidate.endMs,
    };
  }

  const term = query.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const match = term
    ? segments.find((s) => s.text.toLowerCase().includes(term))
    : undefined;
  if (match) {
    return { segmentId: match.id, startMs: match.startMs, endMs: match.endMs };
  }
  return { segmentId: null, startMs: null, endMs: null };
}

async function loadDocumentTitles(
  ctx: ServiceContext,
  documentIds: string[],
): Promise<Map<string, string>> {
  if (documentIds.length === 0) return new Map();
  const { data, error } = await ctx.supabase
    .from<Tables<"documents">>("documents")
    .select("*")
    .eq("user_id", ctx.userId)
    .in("id", documentIds);
  assertNoDatabaseError(error, "Could not load grounded documents");
  return new Map(data.map((row) => [row.id, row.title]));
}

async function loadRecordingTitles(
  ctx: ServiceContext,
  recordingIds: string[],
): Promise<Map<string, string>> {
  if (recordingIds.length === 0) return new Map();
  const { data: recordings, error: recordingError } = await ctx.supabase
    .from<Tables<"recordings">>("recordings")
    .select("*")
    .eq("user_id", ctx.userId)
    .in("id", recordingIds);
  assertNoDatabaseError(recordingError, "Could not load grounded recordings");

  const fileIds = uniqueStrings(recordings.map((row) => row.file_id));
  if (fileIds.length === 0) return new Map();

  const { data: files, error: fileError } = await ctx.supabase
    .from<Tables<"files">>("files")
    .select("*")
    .eq("user_id", ctx.userId)
    .in("id", fileIds);
  assertNoDatabaseError(fileError, "Could not load grounded files");

  const nameByFile = new Map(files.map((row) => [row.id, row.name]));
  const titleByRecording = new Map<string, string>();
  for (const recording of recordings) {
    const name = nameByFile.get(recording.file_id);
    if (name !== undefined) titleByRecording.set(recording.id, name);
  }
  return titleByRecording;
}

async function loadSegmentsByTranscript(
  ctx: ServiceContext,
  transcriptIds: string[],
): Promise<Map<string, SegmentRow[]>> {
  if (transcriptIds.length === 0) return new Map();
  // Only owned transcript ids reach here (from user-filtered RPC / lexical query),
  // so this is the user's own segment data. transcript_segments has no user_id.
  const { data, error } = await ctx.supabase
    .from<Tables<"transcript_segments">>("transcript_segments")
    .select("*")
    .in("transcript_id", transcriptIds);
  assertNoDatabaseError(error, "Could not load transcript segments");

  const byTranscript = new Map<string, SegmentRow[]>();
  for (const row of data) {
    const list = byTranscript.get(row.transcript_id) ?? [];
    list.push({
      id: row.id,
      startMs: row.start_ms,
      endMs: row.end_ms,
      text: row.text,
    });
    byTranscript.set(row.transcript_id, list);
  }
  return byTranscript;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
```

> Reuse note: `buildSnippet` is imported now but only used by the lexical branch (Task 5). To keep Task 4 free of unused-import lint errors, add the import in Task 5 instead — in Task 4, do **not** import `buildSnippet`. Remove the `buildSnippet` line from the import block above for this task; add it back in Task 5 Step 3.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/web && bunx vitest run src/server/services/__tests__/grounded-retrieval.test.ts`
Expected: PASS (semantic suite + prior pure-helper suites).

- [ ] **Step 5: Run the gate and commit**

```bash
cd apps/web && bunx vitest run src/server/services/__tests__/grounded-retrieval.test.ts
cd /Users/samy/code/lumen && git add apps/web/src/server/services/grounded-retrieval.ts apps/web/src/server/services/__tests__/grounded-retrieval.test.ts
git commit -m "feat(retrieval): grounded semantic retrieval with citation labels"
```

---

### Task 5: `retrieveGroundedSources` — lexical fallback (no embedding provider)

**Files:**
- Modify: `apps/web/src/server/services/grounded-retrieval.ts`
- Test: `apps/web/src/server/services/__tests__/grounded-retrieval.test.ts`

- [ ] **Step 1: Write the failing tests** (append)

```ts
describe("retrieveGroundedSources (lexical fallback)", () => {
  it("returns lexical document and transcript citations without an RPC call", async () => {
    const ctx = createContext({
      documents: [
        docRow({
          id: "d1",
          title: "Cell notes",
          content_text: "The mitochondria is the powerhouse of the cell.",
        }),
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
      recordings: [{ id: "r1", user_id: userId, file_id: "f1" }],
      files: [{ id: "f1", user_id: userId, name: "lecture.m4a" }],
      transcript_segments: [
        { id: "seg-1", transcript_id: "t1", start_ms: 0, end_ms: 500, text: "intro words", speaker: null },
        { id: "seg-2", transcript_id: "t1", start_ms: 500, end_ms: 1500, text: "mitochondria explained", speaker: null },
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
      documents: [],
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
      recordings: [{ id: "r1", user_id: userId, file_id: "f1" }],
      files: [{ id: "f1", user_id: userId, name: "lecture.m4a" }],
      transcript_segments: [
        { id: "seg-1", transcript_id: "t1", start_ms: 0, end_ms: 500, text: "no matching term here", speaker: null },
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
      documents: [
        docRow({ id: "mine", user_id: userId, title: "Mine" }),
        docRow({ id: "theirs", user_id: otherUserId, title: "Theirs" }),
      ],
      transcripts: [],
      recordings: [],
      files: [],
      transcript_segments: [],
    });

    const sources = await retrieveGroundedSources(ctx, "mitochondria");

    expect(sources.map((s) => (s.source as { documentId: string }).documentId)).toEqual(
      ["mine"],
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/web && bunx vitest run src/server/services/__tests__/grounded-retrieval.test.ts`
Expected: FAIL — lexical query currently returns `[]` (no candidates collected).

- [ ] **Step 3: Implement the lexical branch**

First add the `buildSnippet` import to the import block at the top of the IO section (the one that imports from `@/server/services/search`):

```ts
import { buildSnippet } from "@/server/services/search";
```

Then replace the lexical placeholder in `retrieveGroundedSources`:

```ts
  const candidates = options.embeddingProvider
    ? await collectSemanticCandidates(ctx, query, options.embeddingProvider)
    : await collectLexicalCandidates(ctx, query);
```

And append the collector:

```ts
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

async function collectLexicalCandidates(
  ctx: ServiceContext,
  query: string,
): Promise<RawCandidate[]> {
  const pattern = `%${escapeLikePattern(query)}%`;

  const [documentBody, documentTitle, transcripts] = await Promise.all([
    ctx.supabase
      .from<Tables<"documents">>("documents")
      .select("*")
      .eq("user_id", ctx.userId)
      .textSearch("content_tsv", query, { type: "websearch" }),
    ctx.supabase
      .from<Tables<"documents">>("documents")
      .select("*")
      .eq("user_id", ctx.userId)
      .ilike("title", pattern),
    ctx.supabase
      .from<Tables<"transcripts">>("transcripts")
      .select("*")
      .eq("user_id", ctx.userId)
      .textSearch("full_text_tsv", query, { type: "websearch" }),
  ]);

  assertNoDatabaseError(documentBody.error, "Could not search documents");
  assertNoDatabaseError(documentTitle.error, "Could not search document titles");
  assertNoDatabaseError(transcripts.error, "Could not search transcripts");

  // Dedupe documents by id; a body hit's snippet beats a title-only hit.
  const documentCandidates = new Map<string, RawCandidate>();
  for (const row of documentBody.data) {
    documentCandidates.set(row.id, {
      kind: "document",
      snippet: buildSnippet(row.content_text, query),
      score: null,
      documentId: row.id,
    });
  }
  for (const row of documentTitle.data) {
    if (documentCandidates.has(row.id)) continue;
    documentCandidates.set(row.id, {
      kind: "document",
      snippet: "",
      score: null,
      documentId: row.id,
    });
  }

  const transcriptCandidates = transcripts.data.map(
    (row): RawCandidate => ({
      kind: "transcript",
      snippet: buildSnippet(row.full_text, query),
      score: null,
      transcript: {
        transcriptId: row.id,
        recordingId: row.recording_id,
        startMs: null,
        endMs: null,
      },
    }),
  );

  return [...documentCandidates.values(), ...transcriptCandidates];
}
```

> The lexical document candidate already loads `title` would be redundant; `hydrateGroundedSources` re-loads titles by id (it also drops non-owned ids). Loading lexical rows scoped by `user_id` plus the owned-id title hydration keeps the user-scoping invariant in one place.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/web && bunx vitest run src/server/services/__tests__/grounded-retrieval.test.ts`
Expected: PASS (lexical suite + all prior suites).

- [ ] **Step 5: Commit**

```bash
cd /Users/samy/code/lumen && git add apps/web/src/server/services/grounded-retrieval.ts apps/web/src/server/services/__tests__/grounded-retrieval.test.ts
git commit -m "feat(retrieval): lexical fallback for grounded sources"
```

---

### Task 6: MCP `search_notes` returns `{ query, sources }` with citation labels

**Files:**
- Modify: `apps/web/src/server/mcp/tools.ts:31-33` (`runSearchNotes`) and `:77-85` (tool registration/description)
- Test: `apps/web/src/server/mcp/__tests__/tools.test.ts`

- [ ] **Step 1: Write the failing test** (replace the existing `runSearchNotes` describe block)

```ts
import {
  runCreateNote,
  runGetDocument,
  runSearchNotes,
} from "@/server/mcp/tools";
import { createContext, userId } from "@/server/services/__tests__/fake-supabase";

describe("runSearchNotes", () => {
  it("returns a { query, sources } payload with stable citation labels", async () => {
    const ctx = createContext({
      documents: [
        {
          id: "d1",
          user_id: userId,
          folder_id: null,
          title: "Bio",
          content_json: null,
          content_text: "the cell mitochondria",
          content_tsv: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      transcripts: [],
      recordings: [],
      files: [],
      transcript_segments: [],
    });

    const result = await runSearchNotes(ctx, { query: "mitochondria" });
    expect(result.content[0].type).toBe("text");

    const payload = JSON.parse((result.content[0] as { text: string }).text);
    expect(payload.query).toBe("mitochondria");
    expect(Array.isArray(payload.sources)).toBe(true);
    expect(payload.sources[0].citationId).toBe("S1");
    expect(payload.sources[0]).toMatchObject({
      kind: "document",
      source: { documentId: "d1" },
    });
  });

  it("returns an empty sources array for a query with no matches", async () => {
    const ctx = createContext({
      documents: [],
      transcripts: [],
      recordings: [],
      files: [],
      transcript_segments: [],
    });
    const result = await runSearchNotes(ctx, { query: "nothing" });
    const payload = JSON.parse((result.content[0] as { text: string }).text);
    expect(payload).toEqual({ query: "nothing", sources: [] });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && bunx vitest run src/server/mcp/__tests__/tools.test.ts`
Expected: FAIL — `runSearchNotes` still returns legacy `SearchResult[]`; `payload.query` is undefined.

- [ ] **Step 3: Update `tools.ts`**

Replace the import and `runSearchNotes`:

```ts
import { retrieveGroundedSources } from "@/server/services/grounded-retrieval";
```

(remove the now-unused `import { searchLibrary } from "@/server/services/search";` line)

```ts
export function runSearchNotes(ctx: ServiceContext, args: { query: string }) {
  return guard(async () =>
    ok({
      query: args.query,
      sources: await retrieveGroundedSources(ctx, args.query),
    }),
  );
}
```

Update the tool description in `registerMcpTools`:

```ts
  rt<{ query: string }>(
    "search_notes",
    {
      title: "Search notes",
      description:
        "Search the user's documents and transcripts and return citation-ready sources. " +
        "Each source has a stable citationId (S1, S2, …); cite claims only with those labels.",
      inputSchema: { query: z.string().min(1).max(200) },
    },
    (args) => runSearchNotes(ctx, args),
  );
```

> The in-app assistant currently passes no embedding provider through the MCP bridge, so `search_notes` uses the lexical fallback. That is intended for milestone 1; wiring an embedding provider into the MCP path is a later change.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && bunx vitest run src/server/mcp/__tests__/tools.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/samy/code/lumen && git add apps/web/src/server/mcp/tools.ts apps/web/src/server/mcp/__tests__/tools.test.ts
git commit -m "feat(mcp): search_notes returns cited grounded sources"
```

---

### Task 7: Assistant system prompt citation rules

**Files:**
- Modify: `apps/web/src/server/services/assistant.ts:80-85` (`SYSTEM_PROMPT`)
- Test: `apps/web/src/server/services/__tests__/assistant.test.ts`

- [ ] **Step 1: Write the failing test** (append; first export the prompt — see Step 3)

```ts
import { SYSTEM_PROMPT } from "@/server/services/assistant";

describe("SYSTEM_PROMPT", () => {
  it("instructs the model to cite tool-returned sources with [S#] labels", () => {
    expect(SYSTEM_PROMPT).toMatch(/\[S1\]|\[S#\]/);
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("sources");
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("cite");
  });

  it("tells the model to say when sources are insufficient", () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toMatch(
      /insufficient|do not support|missing|not enough/,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && bunx vitest run src/server/services/__tests__/assistant.test.ts`
Expected: FAIL — `SYSTEM_PROMPT` is not exported / lacks citation language.

- [ ] **Step 3: Update `assistant.ts`** — export the prompt and add the three rules

```ts
export const SYSTEM_PROMPT = [
  "You are Lumen's study assistant. You help the user reason over their own",
  "notes, transcripts, and documents using the provided tools.",
  "For any factual claim about the user's workspace, use only sources returned",
  "by the tools. Each search_notes source has a citationId such as S1; cite every",
  "supported claim with the matching label in square brackets, for example [S1].",
  "If the returned sources are insufficient to answer, say what is missing",
  "instead of guessing.",
  "When you generate or summarize content, remind the user to verify it.",
  "Be concise.",
].join(" ");
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/web && bunx vitest run src/server/services/__tests__/assistant.test.ts`
Expected: PASS — new `SYSTEM_PROMPT` suite plus the existing `connectMcpBridge` / `runAssistant` tool-loop tests (which still execute through MCP unchanged).

- [ ] **Step 5: Commit**

```bash
cd /Users/samy/code/lumen && git add apps/web/src/server/services/assistant.ts apps/web/src/server/services/__tests__/assistant.test.ts
git commit -m "feat(assistant): require source-grounded citations in system prompt"
```

---

### Task 8: Regression guard + full gate + manual verification

**Files:**
- Modify: `apps/web/src/server/services/__tests__/search.test.ts` (add one explicit regression test; do not change existing tests)

- [ ] **Step 1: Add a regression test asserting the legacy contract is untouched** (append to `search.test.ts`)

```ts
import { searchLibrary } from "@/server/services/search";

describe("searchLibrary regression (unchanged by grounded retrieval)", () => {
  it("still returns the legacy SearchResult[] shape with kind/tier and no citationId", async () => {
    const ctx = createContext({
      documents: [doc({ id: "d1", user_id: userId })],
      transcripts: [],
      files: [],
    });
    const results = await searchLibrary(ctx, "cell");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ kind: "document", id: "d1", tier: 0 });
    expect(results[0]).not.toHaveProperty("citationId");
  });
});
```

- [ ] **Step 2: Run the focused regression test**

Run: `cd apps/web && bunx vitest run src/server/services/__tests__/search.test.ts`
Expected: PASS — all existing `searchLibrary` / `rankResults` / `buildSnippet` tests plus the new regression test.

- [ ] **Step 3: Run all focused suites touched by this milestone**

Run:
```bash
cd apps/web && bunx vitest run \
  src/server/services/__tests__/grounded-retrieval.test.ts \
  src/server/mcp/__tests__/tools.test.ts \
  src/server/services/__tests__/assistant.test.ts \
  src/server/services/__tests__/search.test.ts
```
Expected: PASS (all suites green).

- [ ] **Step 4: Run the full gate**

Run: `cd /Users/samy/code/lumen && bun run check`
Expected: PASS — root Biome + Turbo typecheck/test all green. Fix any lint (unused imports) or type errors before continuing.

- [ ] **Step 5: Manual happy path**

1. Start the stack: `cd apps/web && bunx supabase start` (if not running), then `bun run dev`.
2. Ensure a transcript exists (upload + transcribe an audio file, or reuse an existing recording) and that an Anthropic key is configured for the assistant.
3. **Assistant over a transcript:** open the in-app assistant, ask a factual question whose answer is in the transcript (e.g. "What does the seminar say about oxidative phosphorylation?"). Confirm the answer cites `[S1]`-style labels that correspond to returned sources, and that an unanswerable question yields a "sources don't cover this" style reply rather than a guess.
4. **MCP `search_notes` shape:** with the MCP server running, call `search_notes` (via an MCP client or the in-app bridge) and confirm the JSON is `{ query, sources: [...] }`, each source has a stable `citationId` (`S1`, `S2`, …), transcript sources include `transcriptId` / `recordingId` / `segmentId` / `startMs` / `endMs`, and document sources include `documentId`.
5. **Sidebar unchanged:** run a search in the sidebar `SearchPanel` and confirm results render exactly as before (document/transcript/file rows, no regressions).

- [ ] **Step 6: Commit the regression test**

```bash
cd /Users/samy/code/lumen && git add apps/web/src/server/services/__tests__/search.test.ts
git commit -m "test(search): guard legacy SearchResult contract against grounded retrieval"
```

---

## Self-Review (completed during planning)

**Spec coverage:**
- Citation-rich retrieval contract / `retrieveGroundedSources` → Tasks 4–5.
- Stable `[S1]` labels through `search_notes` → Tasks 1, 6.
- Transcript chunk → best overlapping `transcript_segments` row → Task 2 + Task 4.
- Lexical fallback when no embedding provider → Task 5.
- Assistant prompt cites returned labels → Task 7.
- Tests: labels (T1), overlap (T2), segment resolution + MCP shape (T4/T6), prompt behavior (T7), security isolation (T4/T5), `/api/search`/`searchLibrary` regression (T8).
- `/api/search` + sidebar `SearchPanel` untouched → no edits to those files; T8 guards the contract.
- Out of scope (streaming, diarization, Python sidecar, citation popovers, server-built `answer_question`, document offsets) → none introduced.

**Type consistency:** `GroundedSource` / `GroundedCandidate` / `GroundedTranscriptSource` field names (`citationId`, `segmentId`, `startMs`, `endMs`, `documentId`, `recordingId`, `transcriptId`) are used identically across Tasks 1, 4, 5, 6. `chooseBestTranscriptSegment` signature is stable between Tasks 2 and 4. `SearchNotesToolResult` matches the `{ query, sources }` payload asserted in Task 6.

**Placeholder scan:** No TBD/"handle edge cases"/"similar to" placeholders; every code step shows full code. Two deliberate import-hygiene notes (drop the stray `SemanticSearchRow` import in T3; defer the `buildSnippet` import to T5) prevent Biome unused-import failures.
