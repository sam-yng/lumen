import { z } from "zod";
import type { Tables } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import type { EmbeddingProvider } from "@/server/services/embedding-provider";
import { assertEmbedding } from "@/server/services/embedding-provider";
import { assertNoDatabaseError, ServiceError } from "@/server/services/errors";
import { buildSnippet } from "@/server/services/search";
import { serializeEmbedding } from "@/server/services/semantic-index";

export type GroundedDocumentSource = {
  documentId: string;
  anchor?: {
    blockStart: number;
    blockEnd: number;
  };
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

const groundedSourceSchema: z.ZodType<GroundedSource> = z.object({
  citationId: z.string(),
  kind: z.enum(["document", "transcript"]),
  title: z.string(),
  snippet: z.string(),
  score: z.number().nullable(),
  source: z.union([
    z.object({
      documentId: z.string(),
      anchor: z
        .object({
          blockStart: z.number().int().nonnegative(),
          blockEnd: z.number().int().nonnegative(),
        })
        .optional(),
    }),
    z.object({
      transcriptId: z.string(),
      recordingId: z.string(),
      segmentId: z.string().nullable(),
      startMs: z.number().nullable(),
      endMs: z.number().nullable(),
    }),
  ]),
});

const searchNotesToolResultSchema: z.ZodType<SearchNotesToolResult> = z.object({
  query: z.string(),
  sources: z.array(groundedSourceSchema),
});

/**
 * Parse a search_notes tool result back from its MCP text payload (the JSON
 * runSearchNotes emits). Anything malformed returns null — callers treat the
 * turn as having no recoverable sources rather than failing the run.
 */
export function parseSearchNotesResult(
  text: string,
): SearchNotesToolResult | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = searchNotesToolResultSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

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

export type GroundedSemanticRow = {
  id: string;
  user_id: string;
  source_type: "page" | "transcript";
  source: unknown;
  chunk_index: number;
  content: string;
  similarity: number;
  text_rank: number;
};

export type GroundedSemanticDoc = {
  documentId: string;
  anchor?: {
    blockStart: number;
    blockEnd: number;
  };
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

    if (row.source_type === "page") {
      const nodeId = row.source.nodeId;
      if (typeof nodeId !== "string") continue;
      const anchor = parseDocumentAnchor(row.source.anchor);
      documents.push({
        documentId: nodeId,
        ...(anchor ? { anchor } : {}),
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

const MATCH_COUNT = 8;

/** A candidate before titles, segments, ranking, and labels are applied. */
type RawCandidate = {
  kind: "document" | "transcript";
  snippet: string;
  score: number | null;
  documentId?: string;
  documentAnchor?: {
    blockStart: number;
    blockEnd: number;
  };
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
    : await collectLexicalCandidates(ctx, query);

  return hydrateGroundedSources(ctx, query, candidates);
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

async function collectLexicalCandidates(
  ctx: ServiceContext,
  query: string,
): Promise<RawCandidate[]> {
  const pattern = `%${escapeLikePattern(query)}%`;

  const [pageBody, pageTitle, transcripts] = await Promise.all([
    ctx.supabase
      .from<Tables<"library_nodes">>("library_nodes")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("kind", "page")
      .textSearch("content_tsv", query, { type: "websearch" }),
    ctx.supabase
      .from<Tables<"library_nodes">>("library_nodes")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("kind", "page")
      .ilike("title", pattern),
    ctx.supabase
      .from<Tables<"transcripts">>("transcripts")
      .select("*")
      .eq("user_id", ctx.userId)
      .textSearch("full_text_tsv", query, { type: "websearch" }),
  ]);

  assertNoDatabaseError(pageBody.error, "Could not search pages");
  assertNoDatabaseError(pageTitle.error, "Could not search page titles");
  assertNoDatabaseError(transcripts.error, "Could not search transcripts");

  // Dedupe documents by id; a body hit's snippet beats a title-only hit.
  const documentCandidates = new Map<string, RawCandidate>();
  for (const row of pageBody.data) {
    documentCandidates.set(row.id, {
      kind: "document",
      snippet: buildSnippet(row.content_text, query),
      score: null,
      documentId: row.id,
    });
  }
  for (const row of pageTitle.data) {
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
        documentAnchor: hit.anchor,
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
    candidates.flatMap((c) => (c.transcript ? [c.transcript.recordingId] : [])),
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
        source: {
          documentId: candidate.documentId,
          ...(candidate.documentAnchor
            ? { anchor: candidate.documentAnchor }
            : {}),
        },
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
    .from<Tables<"library_nodes">>("library_nodes")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("kind", "page")
    .in("id", documentIds);
  assertNoDatabaseError(error, "Could not load grounded pages");
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

  const nodeIds = uniqueStrings(recordings.map((row) => row.node_id));
  if (nodeIds.length === 0) return new Map();

  const { data: nodes, error: nodeError } = await ctx.supabase
    .from<Tables<"library_nodes">>("library_nodes")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("kind", "audio")
    .in("id", nodeIds);
  assertNoDatabaseError(nodeError, "Could not load grounded audio nodes");

  const titleByNode = new Map(nodes.map((row) => [row.id, row.title]));
  const titleByRecording = new Map<string, string>();
  for (const recording of recordings) {
    const title = titleByNode.get(recording.node_id);
    if (title !== undefined) titleByRecording.set(recording.id, title);
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

function parseDocumentAnchor(value: unknown) {
  if (!isRecord(value)) return null;
  const { blockStart, blockEnd } = value;
  if (
    typeof blockStart !== "number" ||
    typeof blockEnd !== "number" ||
    !Number.isInteger(blockStart) ||
    !Number.isInteger(blockEnd) ||
    blockStart < 0 ||
    blockEnd < blockStart
  ) {
    return null;
  }
  return { blockStart, blockEnd };
}
