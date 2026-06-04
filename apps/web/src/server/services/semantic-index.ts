import type { Tables, TablesInsert } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import type { EmbeddingProvider } from "@/server/services/embedding-provider";
import { assertEmbedding } from "@/server/services/embedding-provider";
import { assertNoDatabaseError } from "@/server/services/errors";
import {
  chunkDocument,
  chunkTranscript,
  type SearchChunk,
} from "@/server/services/semantic-chunking";

type SearchChunkInsert = TablesInsert<"semantic_search_chunks">;

export function serializeEmbedding(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

async function insertFreshChunks(
  ctx: ServiceContext,
  chunks: SearchChunk[],
  provider: EmbeddingProvider,
) {
  if (chunks.length === 0) {
    return;
  }

  const embeddings = await provider.embed(chunks.map((chunk) => chunk.content));
  const rows: SearchChunkInsert[] = chunks.map((chunk, index) => ({
    user_id: ctx.userId,
    source_type: chunk.sourceType,
    document_id: chunk.documentId,
    transcript_id: chunk.transcriptId,
    recording_id: chunk.recordingId,
    start_ms: chunk.startMs,
    end_ms: chunk.endMs,
    chunk_index: chunk.chunkIndex,
    content: chunk.content,
    embedding: serializeEmbedding(assertEmbedding(embeddings[index] ?? [])),
  }));

  const { error } = await ctx.supabase
    .from<Tables<"semantic_search_chunks">>("semantic_search_chunks")
    .insert(rows);

  assertNoDatabaseError(error, "Could not insert semantic search chunks");
}

export async function indexDocumentSearchChunks(
  ctx: ServiceContext,
  input: { document: Tables<"documents">; provider: EmbeddingProvider },
): Promise<void> {
  const chunks = chunkDocument({
    documentId: input.document.id,
    text: input.document.content_text,
  });

  const { error } = await ctx.supabase
    .from<Tables<"semantic_search_chunks">>("semantic_search_chunks")
    .delete()
    .eq("user_id", ctx.userId)
    .eq("source_type", "document")
    .eq("document_id", input.document.id);

  assertNoDatabaseError(error, "Could not delete semantic document chunks");

  await insertFreshChunks(ctx, chunks, input.provider);
}

export async function indexTranscriptSearchChunks(
  ctx: ServiceContext,
  input: {
    transcript: Tables<"transcripts">;
    segments: Tables<"transcript_segments">[];
    provider: EmbeddingProvider;
  },
): Promise<void> {
  const chunks = chunkTranscript(
    input.segments.map((segment) => ({
      transcriptId: input.transcript.id,
      recordingId: input.transcript.recording_id,
      startMs: segment.start_ms,
      endMs: segment.end_ms,
      text: segment.text,
    })),
  );

  const { error } = await ctx.supabase
    .from<Tables<"semantic_search_chunks">>("semantic_search_chunks")
    .delete()
    .eq("user_id", ctx.userId)
    .eq("source_type", "transcript")
    .eq("transcript_id", input.transcript.id);

  assertNoDatabaseError(error, "Could not delete semantic transcript chunks");

  await insertFreshChunks(ctx, chunks, input.provider);
}
