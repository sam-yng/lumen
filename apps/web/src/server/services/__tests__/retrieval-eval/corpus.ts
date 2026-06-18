/**
 * Deterministic fixture corpus for the v4 m3 retrieval-quality harness.
 * Documents/transcripts are chunked with the real chunkers; chunk rows are
 * embedded with the real DeterministicEmbeddingProvider so the reference RPC
 * scores them exactly as Postgres would. See
 * docs/exec-plans/active/v4/retrieval-quality-reranking.md.
 */

import { userId } from "@/server/services/__tests__/fake-supabase";
import type { FixtureChunkRow } from "@/server/services/__tests__/retrieval-eval/reference-rpc";
import { DeterministicEmbeddingProvider } from "@/server/services/embedding-provider";
import {
  chunkDocument,
  chunkTranscript,
} from "@/server/services/semantic-chunking";

export type FixtureDocument = {
  id: string;
  title: string;
  text: string;
};

export type FixtureTranscriptSegment = {
  startMs: number;
  endMs: number;
  text: string;
};

export type FixtureTranscript = {
  id: string;
  recordingId: string;
  fileName: string;
  segments: FixtureTranscriptSegment[];
};

export type QueryKind = "paraphrase" | "keyword" | "cross-chunk";

export type FixtureQuery = {
  id: string;
  kind: QueryKind;
  text: string;
  /** Source ids (doc:<id> / tx:<id>) the answer should surface. */
  relevantSourceIds: string[];
};

export type Corpus = {
  tables: Record<string, Record<string, unknown>[]>;
  chunkRows: FixtureChunkRow[];
  queries: FixtureQuery[];
};

const TIMESTAMP = "2026-01-01T00:00:00Z";

export function documentSourceId(documentId: string): string {
  return `doc:${documentId}`;
}

export function transcriptSourceId(transcriptId: string): string {
  return `tx:${transcriptId}`;
}

export async function buildCorpus(input: {
  documents: FixtureDocument[];
  transcripts: FixtureTranscript[];
  queries: FixtureQuery[];
}): Promise<Corpus> {
  const provider = new DeterministicEmbeddingProvider();

  const documentRows = input.documents.map((doc) => ({
    id: doc.id,
    user_id: userId,
    workspace_id: "workspace-1",
    parent_id: "workspace-1",
    kind: "page",
    title: doc.title,
    slug: `${doc.id}-page`,
    content_json: null,
    content_text: doc.text,
    content_tsv: null,
    mime_type: null,
    size_bytes: null,
    storage_key: null,
    is_pinned: false,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
  }));

  const recordingRows: Record<string, unknown>[] = [];
  const audioRows: Record<string, unknown>[] = [];
  const transcriptRows: Record<string, unknown>[] = [];
  const segmentRows: Record<string, unknown>[] = [];

  for (const transcript of input.transcripts) {
    const nodeId = `audio-${transcript.recordingId}`;
    audioRows.push({
      id: nodeId,
      user_id: userId,
      workspace_id: "workspace-1",
      parent_id: "workspace-1",
      kind: "audio",
      title: transcript.fileName,
      slug: `${nodeId}-audio`,
      content_json: null,
      content_text: null,
      mime_type: "audio/mp4",
      size_bytes: 1,
      storage_key: `${userId}/${nodeId}`,
      is_pinned: false,
      created_at: TIMESTAMP,
      updated_at: TIMESTAMP,
    });
    recordingRows.push({
      id: transcript.recordingId,
      user_id: userId,
      node_id: nodeId,
      created_at: TIMESTAMP,
    });
    transcriptRows.push({
      id: transcript.id,
      user_id: userId,
      recording_id: transcript.recordingId,
      full_text: transcript.segments.map((s) => s.text).join(" "),
      created_at: TIMESTAMP,
    });
    transcript.segments.forEach((segment, index) => {
      segmentRows.push({
        id: `${transcript.id}-seg-${index}`,
        transcript_id: transcript.id,
        start_ms: segment.startMs,
        end_ms: segment.endMs,
        text: segment.text,
      });
    });
  }

  const chunkRows = await buildChunkRows(input, provider);

  return {
    tables: {
      library_nodes: [...documentRows, ...audioRows],
      recordings: recordingRows,
      transcripts: transcriptRows,
      transcript_segments: segmentRows,
    },
    chunkRows,
    queries: input.queries,
  };
}

async function buildChunkRows(
  input: { documents: FixtureDocument[]; transcripts: FixtureTranscript[] },
  provider: DeterministicEmbeddingProvider,
): Promise<FixtureChunkRow[]> {
  const pending: Omit<FixtureChunkRow, "embedding">[] = [];

  for (const doc of input.documents) {
    chunkDocument({ documentId: doc.id, text: doc.text }).forEach(
      (chunk, index) => {
        pending.push({
          id: `${doc.id}-chunk-${index}`,
          userId,
          sourceType: "page",
          nodeId: doc.id,
          transcriptId: null,
          recordingId: null,
          startMs: null,
          endMs: null,
          documentAnchor: chunk.documentAnchor,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          updatedAt: TIMESTAMP,
        });
      },
    );
  }

  for (const transcript of input.transcripts) {
    const chunks = chunkTranscript(
      transcript.segments.map((segment) => ({
        transcriptId: transcript.id,
        recordingId: transcript.recordingId,
        startMs: segment.startMs,
        endMs: segment.endMs,
        text: segment.text,
      })),
    );
    chunks.forEach((chunk, index) => {
      if (chunk.sourceType !== "transcript") return;
      pending.push({
        id: `${transcript.id}-chunk-${index}`,
        userId,
        sourceType: "transcript",
        nodeId: null,
        transcriptId: transcript.id,
        recordingId: transcript.recordingId,
        startMs: chunk.startMs,
        endMs: chunk.endMs,
        documentAnchor: null,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        updatedAt: TIMESTAMP,
      });
    });
  }

  if (pending.length === 0) return [];
  const embeddings = await provider.embed(pending.map((row) => row.content));
  return pending.map((row, index) => ({
    ...row,
    embedding: embeddings[index] ?? [],
  }));
}
