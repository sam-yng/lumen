import type { Tables } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import type { EmbeddingProvider } from "@/server/services/embedding-provider";
import { assertEmbedding } from "@/server/services/embedding-provider";
import { assertNoDatabaseError, ServiceError } from "@/server/services/errors";
import { serializeEmbedding } from "@/server/services/semantic-index";

type SearchTier = 0 | 1 | 2;

export type DocumentSearchResult = {
  kind: "document";
  id: string;
  title: string;
  folderId: string | null;
  snippet: string;
  tier: SearchTier;
};

export type TranscriptSearchResult = {
  kind: "transcript";
  id: string;
  recordingId: string;
  snippet: string;
  tier: 0 | 1;
};

export type FileSearchResult = {
  kind: "file";
  id: string;
  name: string;
  folderId: string | null;
  tier: 2;
};

export type SearchResult =
  | DocumentSearchResult
  | TranscriptSearchResult
  | FileSearchResult;

export type SearchInputs = {
  query: string;
  pageBodyHits: Tables<"library_nodes">[];
  transcriptHits: Tables<"transcripts">[];
  pageTitleHits: Tables<"library_nodes">[];
  fileNodeHits: Tables<"library_nodes">[];
  semanticPageHits?: SemanticPageHit[];
  semanticTranscriptHits?: SemanticTranscriptHit[];
};

type SemanticPageHit = {
  page: Tables<"library_nodes">;
  snippet: string;
  similarity: number;
};

type SemanticTranscriptHit = {
  id: string;
  recordingId: string;
  snippet: string;
  similarity: number;
};

type SemanticSearchRow = {
  id: string;
  user_id: string;
  source_type: "page" | "transcript";
  source: unknown;
  chunk_index: number;
  content: string;
  similarity: number;
  text_rank: number;
};

const SNIPPET_RADIUS = 80;
const SNIPPET_FALLBACK_LENGTH = 160;

export function buildSnippet(text: string | null, query: string): string {
  const source = (text ?? "").trim();
  if (source.length === 0) return "";
  const term = query.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const index = term ? source.toLowerCase().indexOf(term) : -1;
  if (index === -1) {
    return source.length > SNIPPET_FALLBACK_LENGTH
      ? `${source.slice(0, SNIPPET_FALLBACK_LENGTH)}…`
      : source;
  }
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(source.length, index + term.length + SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${source.slice(start, end)}${
    end < source.length ? "…" : ""
  }`;
}

export function rankResults(inputs: SearchInputs): SearchResult[] {
  const { query } = inputs;

  const docById = new Map<
    string,
    {
      row: Tables<"library_nodes">;
      tier: SearchTier;
      snippet: string;
      semanticScore: number | null;
    }
  >();

  function upsertDocument(input: {
    row: Tables<"library_nodes">;
    tier: SearchTier;
    snippet: string;
    semanticScore?: number;
  }) {
    const current = docById.get(input.row.id);
    const semanticScore = input.semanticScore ?? null;

    if (
      !current ||
      input.tier < current.tier ||
      (input.tier === current.tier &&
        semanticScore !== null &&
        (current.semanticScore ?? Number.NEGATIVE_INFINITY) < semanticScore)
    ) {
      docById.set(input.row.id, {
        row: input.row,
        tier: input.tier,
        snippet: input.snippet,
        semanticScore,
      });
    }
  }

  for (const row of inputs.pageTitleHits)
    upsertDocument({ row, tier: 2, snippet: "" });
  for (const hit of inputs.semanticPageHits ?? [])
    upsertDocument({
      row: hit.page,
      tier: 1,
      snippet: hit.snippet,
      semanticScore: hit.similarity,
    });
  for (const row of inputs.pageBodyHits)
    upsertDocument({
      row,
      tier: 0,
      snippet: buildSnippet(row.content_text, query),
    });

  const documents = [...docById.values()].map(
    ({ row, tier, snippet, semanticScore }) => ({
      // Documents use updated_at for recency (they are edited); transcripts/files use created_at (they are write-once).
      ts: row.updated_at,
      semanticScore,
      result: {
        kind: "document" as const,
        id: row.id,
        title: row.title,
        folderId: row.parent_id,
        snippet,
        tier,
      } satisfies DocumentSearchResult,
    }),
  );

  const transcriptById = new Map<
    string,
    {
      result: TranscriptSearchResult;
      ts: string;
      semanticScore: number | null;
    }
  >();

  function upsertTranscript(input: {
    result: TranscriptSearchResult;
    ts?: string;
    semanticScore?: number;
  }) {
    const current = transcriptById.get(input.result.id);
    const semanticScore = input.semanticScore ?? null;

    if (
      !current ||
      input.result.tier < current.result.tier ||
      (input.result.tier === current.result.tier &&
        semanticScore !== null &&
        (current.semanticScore ?? Number.NEGATIVE_INFINITY) < semanticScore)
    ) {
      transcriptById.set(input.result.id, {
        result: input.result,
        ts: input.ts ?? "",
        semanticScore,
      });
    }
  }

  for (const hit of inputs.semanticTranscriptHits ?? []) {
    upsertTranscript({
      result: {
        kind: "transcript",
        id: hit.id,
        recordingId: hit.recordingId,
        snippet: hit.snippet,
        tier: 1,
      },
      semanticScore: hit.similarity,
    });
  }

  for (const row of inputs.transcriptHits) {
    upsertTranscript({
      result: {
        kind: "transcript",
        id: row.id,
        recordingId: row.recording_id,
        snippet: buildSnippet(row.full_text, query),
        tier: 0,
      },
      ts: row.created_at,
    });
  }

  const transcripts = [...transcriptById.values()];

  const files = inputs.fileNodeHits.map((row) => ({
    ts: row.created_at,
    semanticScore: null,
    result: {
      kind: "file" as const,
      id: row.id,
      name: row.title,
      folderId: row.parent_id,
      tier: 2 as const,
    } satisfies FileSearchResult,
  }));

  return [...documents, ...transcripts, ...files]
    .sort((a, b) =>
      a.result.tier !== b.result.tier
        ? a.result.tier - b.result.tier
        : (b.semanticScore ?? Number.NEGATIVE_INFINITY) !==
            (a.semanticScore ?? Number.NEGATIVE_INFINITY)
          ? (b.semanticScore ?? Number.NEGATIVE_INFINITY) -
            (a.semanticScore ?? Number.NEGATIVE_INFINITY)
          : b.ts.localeCompare(a.ts),
    )
    .map((entry) => entry.result);
}

function escapeLikePattern(value: string): string {
  // Escape LIKE wildcards so user input is matched literally by ilike.
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function searchLibrary(
  ctx: ServiceContext,
  rawQuery: string,
  options: { embeddingProvider?: EmbeddingProvider } = {},
): Promise<SearchResult[]> {
  const query = rawQuery.trim();
  if (query.length === 0) return [];
  const pattern = `%${escapeLikePattern(query)}%`;

  const [pageBody, transcripts, pageTitle, files] = await Promise.all([
    ctx.supabase
      .from<Tables<"library_nodes">>("library_nodes")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("kind", "page")
      .textSearch("content_tsv", query, { type: "websearch" }),
    ctx.supabase
      .from<Tables<"transcripts">>("transcripts")
      .select("*")
      .eq("user_id", ctx.userId)
      .textSearch("full_text_tsv", query, { type: "websearch" }),
    ctx.supabase
      .from<Tables<"library_nodes">>("library_nodes")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("kind", "page")
      .ilike("title", pattern),
    ctx.supabase
      .from<Tables<"library_nodes">>("library_nodes")
      .select("*")
      .eq("user_id", ctx.userId)
      .in("kind", ["file", "audio"])
      .ilike("title", pattern),
  ]);

  assertNoDatabaseError(pageBody.error, "Could not search pages");
  assertNoDatabaseError(transcripts.error, "Could not search transcripts");
  assertNoDatabaseError(pageTitle.error, "Could not search page titles");
  assertNoDatabaseError(files.error, "Could not search files");

  const semanticHits = options.embeddingProvider
    ? await searchSemanticChunks(ctx, query, options.embeddingProvider, [
        ...pageBody.data,
        ...pageTitle.data,
      ])
    : { documents: [], transcripts: [] };

  return rankResults({
    query,
    pageBodyHits: pageBody.data,
    transcriptHits: transcripts.data,
    pageTitleHits: pageTitle.data,
    fileNodeHits: files.data,
    semanticPageHits: semanticHits.documents,
    semanticTranscriptHits: semanticHits.transcripts,
  });
}

async function searchSemanticChunks(
  ctx: ServiceContext,
  query: string,
  provider: EmbeddingProvider,
  knownPages: Tables<"library_nodes">[],
) {
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
  const { data, error } = await ctx.supabase.rpc<SemanticSearchRow>(
    "match_semantic_search_chunks",
    {
      query_embedding: queryEmbedding,
      query_text: query,
      match_user_id: ctx.userId,
      match_count: 8,
    },
  );

  assertNoDatabaseError(error, "Could not search semantic chunks");

  const semanticPages = parseSemanticPageRows(data);
  const pageById = await getSemanticPageMap(
    ctx,
    semanticPages.map((hit) => hit.nodeId),
    knownPages,
  );

  return {
    documents: semanticPages.flatMap((hit) => {
      const page = pageById.get(hit.nodeId);
      return page
        ? [
            {
              page,
              snippet: hit.content,
              similarity: hit.similarity,
            },
          ]
        : [];
    }),
    transcripts: parseSemanticTranscriptRows(data),
  };
}

function parseSemanticPageRows(rows: SemanticSearchRow[]) {
  return rows.flatMap((row) => {
    if (row.source_type !== "page" || !isRecord(row.source)) return [];
    const nodeId = row.source.nodeId;
    if (typeof nodeId !== "string") return [];

    return [
      {
        nodeId,
        content: row.content,
        similarity: row.similarity,
      },
    ];
  });
}

function parseSemanticTranscriptRows(rows: SemanticSearchRow[]) {
  return rows.flatMap((row): SemanticTranscriptHit[] => {
    if (row.source_type !== "transcript" || !isRecord(row.source)) return [];
    const transcriptId = row.source.transcriptId;
    const recordingId = row.source.recordingId;
    if (typeof transcriptId !== "string" || typeof recordingId !== "string") {
      return [];
    }

    return [
      {
        id: transcriptId,
        recordingId,
        snippet: row.content,
        similarity: row.similarity,
      },
    ];
  });
}

async function getSemanticPageMap(
  ctx: ServiceContext,
  nodeIds: string[],
  knownPages: Tables<"library_nodes">[],
) {
  const wantedIds = new Set(nodeIds);
  const pageById = new Map(
    knownPages
      .filter((page) => wantedIds.has(page.id))
      .map((page) => [page.id, page]),
  );
  const missingIds = [...wantedIds].filter((id) => !pageById.has(id));

  if (missingIds.length === 0) {
    return pageById;
  }

  const { data, error } = await ctx.supabase
    .from<Tables<"library_nodes">>("library_nodes")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("kind", "page")
    .in("id", missingIds);

  assertNoDatabaseError(error, "Could not load semantic pages");

  for (const page of data) {
    if (wantedIds.has(page.id)) {
      pageById.set(page.id, page);
    }
  }

  return pageById;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
