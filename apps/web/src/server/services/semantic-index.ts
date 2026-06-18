import type { Tables, TablesInsert } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import { extractTipTapTextBlocks } from "@/server/services/editor-content";
import type { EmbeddingProvider } from "@/server/services/embedding-provider";
import { assertEmbedding } from "@/server/services/embedding-provider";
import { assertNoDatabaseError, ServiceError } from "@/server/services/errors";
import {
  chunkDocument,
  chunkTranscript,
  type SearchChunk,
} from "@/server/services/semantic-chunking";

type SearchChunkInsert = TablesInsert<"semantic_search_chunks">;

export function serializeEmbedding(vector: number[]): string {
  return `[${assertEmbedding(vector).join(",")}]`;
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
  if (embeddings.length !== chunks.length) {
    throw new ServiceError(
      "invalid_input",
      `Embedding provider returned ${embeddings.length} embeddings for ${chunks.length} chunks.`,
    );
  }

  const rows: SearchChunkInsert[] = chunks.map((chunk, index) => ({
    user_id: ctx.userId,
    source_type: chunk.sourceType === "document" ? "page" : "transcript",
    node_id: chunk.documentId,
    transcript_id: chunk.transcriptId,
    recording_id: chunk.recordingId,
    start_ms: chunk.startMs,
    end_ms: chunk.endMs,
    document_anchor_block_start: chunk.documentAnchor?.blockStart ?? null,
    document_anchor_block_end: chunk.documentAnchor?.blockEnd ?? null,
    chunk_index: chunk.chunkIndex,
    content: chunk.content,
    embedding: serializeEmbedding(embeddings[index] ?? []),
  }));

  const { error } = await ctx.supabase
    .from<Tables<"semantic_search_chunks">>("semantic_search_chunks")
    .insert(rows);

  assertNoDatabaseError(error, "Could not insert semantic search chunks");
}

export async function indexDocumentSearchChunks(
  ctx: ServiceContext,
  input: { page: Tables<"library_nodes">; provider: EmbeddingProvider },
): Promise<void> {
  if (input.page.user_id !== ctx.userId) {
    throw new ServiceError(
      "invalid_input",
      "Page does not belong to the current user.",
    );
  }
  if (input.page.kind !== "page") {
    throw new ServiceError("invalid_input", "Only page nodes can be indexed.");
  }

  const chunks = chunkDocument({
    documentId: input.page.id,
    text: input.page.content_text,
    blocks:
      input.page.content_json !== null
        ? extractTipTapTextBlocks(input.page.content_json)
        : undefined,
  });

  const { error } = await ctx.supabase
    .from<Tables<"semantic_search_chunks">>("semantic_search_chunks")
    .delete()
    .eq("user_id", ctx.userId)
    .eq("source_type", "page")
    .eq("node_id", input.page.id);

  assertNoDatabaseError(error, "Could not delete semantic page chunks");

  await insertFreshChunks(ctx, chunks, input.provider);
}

export async function reindexAllPageSearchChunks(
  ctx: ServiceContext,
  input: { provider: EmbeddingProvider },
): Promise<{ indexed: number; failed: number }> {
  const { data, error } = await ctx.supabase
    .from<Tables<"library_nodes">>("library_nodes")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("kind", "page");

  assertNoDatabaseError(error, "Could not load pages for semantic reindex");

  let indexed = 0;
  let failed = 0;
  for (const page of data) {
    try {
      await indexDocumentSearchChunks(ctx, {
        page,
        provider: input.provider,
      });
      indexed += 1;
    } catch (error) {
      failed += 1;
      console.error("Page semantic reindex failed", {
        nodeId: page.id,
        error,
      });
    }
  }

  return { indexed, failed };
}

export async function indexTranscriptSearchChunks(
  ctx: ServiceContext,
  input: {
    transcript: Tables<"transcripts">;
    segments: Tables<"transcript_segments">[];
    provider: EmbeddingProvider;
  },
): Promise<void> {
  if (input.transcript.user_id !== ctx.userId) {
    throw new ServiceError(
      "invalid_input",
      "Transcript does not belong to the current user.",
    );
  }

  if (
    input.segments.some(
      (segment) => segment.transcript_id !== input.transcript.id,
    )
  ) {
    throw new ServiceError(
      "invalid_input",
      "Transcript segment does not belong to the indexed transcript.",
    );
  }

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
