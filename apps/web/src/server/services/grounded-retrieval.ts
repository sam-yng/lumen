import type { Tables } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import type { EmbeddingProvider } from "@/server/services/embedding-provider";
import { assertEmbedding } from "@/server/services/embedding-provider";
import { assertNoDatabaseError, ServiceError } from "@/server/services/errors";
import { serializeEmbedding } from "@/server/services/semantic-index";

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
    candidates.flatMap((c) => (c.transcript ? [c.transcript.transcriptId] : [])),
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
