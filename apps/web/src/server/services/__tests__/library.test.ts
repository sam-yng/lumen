import { describe, expect, it } from "vitest";
import {
  createContext,
  otherUserId,
  type Row,
  userId,
} from "@/server/services/__tests__/fake-supabase";
import { extractTipTapText } from "@/server/services/editor-content";
import {
  EMBEDDING_DIMENSIONS,
  type EmbeddingProvider,
} from "@/server/services/embedding-provider";
import { updateLibraryNode } from "@/server/services/library-nodes";
import { retryRecordingTranscription } from "@/server/services/recordings";
import type { StorageProvider } from "@/server/services/storage-provider";
import { createTag } from "@/server/services/tags";
import {
  getTranscriptDetail,
  writeRecordingTranscript,
} from "@/server/services/transcripts";
import { createUploadedFile } from "@/server/services/uploads";

class FakeStorage implements StorageProvider {
  readonly uploaded: Array<{
    bucket: string;
    key: string;
    bytes: Uint8Array;
    contentType: string;
  }> = [];
  readonly removed: Array<{ bucket: string; key: string }> = [];

  async upload(input: {
    bucket: string;
    key: string;
    bytes: Uint8Array;
    contentType: string;
  }) {
    this.uploaded.push(input);
  }

  async remove(input: { bucket: string; key: string }) {
    this.removed.push(input);
  }
}

function ownedWorkspaceRows(): Row[] {
  return [
    {
      id: "workspace-a",
      user_id: userId,
      workspace_id: "workspace-a",
      parent_id: null,
      kind: "workspace",
      title: "Lectures",
      slug: "lectures-a",
    },
  ];
}

function vector(value: number) {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) =>
    index === 0 ? value : 0,
  );
}

function embeddingProvider(vectors: number[][]) {
  const calls: string[][] = [];
  const provider: EmbeddingProvider = {
    async embed(texts: string[]) {
      calls.push(texts);
      return vectors.slice(0, texts.length);
    },
  };

  return { calls, provider };
}

function tablesFor(ctx: ReturnType<typeof createContext>) {
  return (
    ctx.supabase as unknown as {
      tables: Record<string, Row[]>;
    }
  ).tables;
}

describe("library services", () => {
  it("extracts plain text from nested TipTap JSON", () => {
    const text = extractTipTapText({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Lecture 3" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Cells " },
            { type: "text", text: "use ATP." },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Mitochondria" }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(text).toBe("Lecture 3 Cells use ATP. Mitochondria");
  });

  it("persists page content JSON and derived plain text", async () => {
    const ctx = createContext({
      library_nodes: [
        {
          id: "doc-a",
          user_id: userId,
          workspace_id: "workspace-a",
          parent_id: "workspace-a",
          kind: "page",
          title: "Lecture",
          content_json: null,
          content_text: null,
        },
      ],
    });

    const contentJson = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Saved from TipTap" }],
        },
      ],
    };

    const page = await updateLibraryNode(ctx, {
      id: "doc-a",
      contentJson,
    });

    expect(page).toMatchObject({
      id: "doc-a",
      content_json: contentJson,
      content_text: "Saved from TipTap",
    });
  });

  it("uploads a non-audio file into storage and creates a file node", async () => {
    const ctx = createContext({
      library_nodes: ownedWorkspaceRows(),
    });
    const storage = new FakeStorage();
    const enqueued: unknown[] = [];

    const result = await createUploadedFile(ctx, {
      bucket: "library-files",
      name: "week 01.pdf",
      mimeType: "application/pdf",
      bytes: new Uint8Array([1, 2, 3]),
      parentId: "workspace-a",
      storage,
      enqueueTranscription: async (payload) => enqueued.push(payload),
    });

    expect(result.recording).toBeNull();
    expect(result.node).toMatchObject({
      user_id: userId,
      workspace_id: "workspace-a",
      parent_id: "workspace-a",
      title: "week 01.pdf",
      mime_type: "application/pdf",
      size_bytes: 3,
      kind: "file",
    });
    expect(String(result.node.storage_key)).toMatch(/^user-1\/.+-week-01-pdf$/);
    expect(storage.uploaded).toEqual([
      {
        bucket: "library-files",
        key: result.node.storage_key,
        bytes: new Uint8Array([1, 2, 3]),
        contentType: "application/pdf",
      },
    ]);
    expect(enqueued).toEqual([]);
  });

  it("uploads audio, creates a pending recording, and enqueues transcription", async () => {
    const ctx = createContext({
      library_nodes: ownedWorkspaceRows(),
      recordings: [],
    });
    const storage = new FakeStorage();
    const enqueued: unknown[] = [];

    const result = await createUploadedFile(ctx, {
      bucket: "library-files",
      name: "lecture.mp3",
      mimeType: "audio/mpeg",
      bytes: new Uint8Array([4, 5, 6, 7]),
      parentId: "workspace-a",
      storage,
      enqueueTranscription: async (payload) => enqueued.push(payload),
    });

    expect(result.node).toMatchObject({
      user_id: userId,
      workspace_id: "workspace-a",
      parent_id: "workspace-a",
      title: "lecture.mp3",
      mime_type: "audio/mpeg",
      size_bytes: 4,
      kind: "audio",
    });
    expect(result.recording).toMatchObject({
      user_id: userId,
      node_id: result.node.id,
      status: "pending",
      error: null,
    });
    expect(enqueued).toEqual([
      {
        userId,
        recordingId: result.recording?.id,
        nodeId: result.node.id,
        storageKey: result.node.storage_key,
      },
    ]);
  });

  it("marks the recording failed (not stranded pending) when enqueue fails", async () => {
    const ctx = createContext({
      library_nodes: ownedWorkspaceRows(),
      recordings: [],
    });
    const storage = new FakeStorage();

    const result = await createUploadedFile(ctx, {
      bucket: "library-files",
      name: "lecture.mp3",
      mimeType: "audio/mpeg",
      bytes: new Uint8Array([8, 9]),
      parentId: "workspace-a",
      storage,
      enqueueTranscription: async () => {
        throw new Error("queue unavailable");
      },
    });

    // A recording with no job behind it must never sit at "pending": surface it
    // as a retryable failure instead.
    expect(result.recording).toMatchObject({
      status: "failed",
      error: "Could not queue transcription: queue unavailable",
    });
    // The stored audio is kept so a retry can re-enqueue without re-uploading.
    expect(storage.removed).toEqual([]);
    expect(storage.uploaded).toHaveLength(1);
  });

  it("retries failed recordings by resetting status and enqueueing transcription", async () => {
    const ctx = createContext({
      library_nodes: [
        {
          id: "node-a",
          user_id: userId,
          kind: "audio",
          storage_key: "user-1/node-a-lecture-mp3",
        },
      ],
      recordings: [
        {
          id: "recording-a",
          user_id: userId,
          node_id: "node-a",
          status: "failed",
          error: "Whisper failed",
        },
      ],
    });
    const enqueued: unknown[] = [];

    const recording = await retryRecordingTranscription(ctx, {
      id: "recording-a",
      enqueueTranscription: async (payload) => enqueued.push(payload),
    });

    expect(recording).toMatchObject({
      id: "recording-a",
      status: "pending",
      error: null,
    });
    expect(enqueued).toEqual([
      {
        userId,
        recordingId: "recording-a",
        nodeId: "node-a",
        storageKey: "user-1/node-a-lecture-mp3",
      },
    ]);
  });

  it("reverts a retried recording to failed when re-enqueue fails", async () => {
    const ctx = createContext({
      library_nodes: [
        {
          id: "node-a",
          user_id: userId,
          kind: "audio",
          storage_key: "user-1/node-a-lecture-mp3",
        },
      ],
      recordings: [
        {
          id: "recording-a",
          user_id: userId,
          node_id: "node-a",
          status: "failed",
          error: "Whisper failed",
        },
      ],
    });

    await expect(
      retryRecordingTranscription(ctx, {
        id: "recording-a",
        enqueueTranscription: async () => {
          throw new Error("queue unavailable");
        },
      }),
    ).rejects.toMatchObject({
      code: "database",
      message: "Could not queue transcription: queue unavailable",
    });

    // The recording must not be stranded at "pending" — it stays retryable.
    const recordings = tablesFor(ctx).recordings as Array<{
      status: string;
      error: string;
    }>;
    expect(recordings[0]).toMatchObject({
      status: "failed",
      error: "Could not queue transcription: queue unavailable",
    });
  });

  it.each(["pending", "processing", "done"] as const)(
    "rejects retrying a %s recording",
    async (status) => {
      const ctx = createContext({
        recordings: [
          {
            id: "recording-a",
            user_id: userId,
            node_id: "node-a",
            status,
            error: null,
          },
        ],
      });

      await expect(
        retryRecordingTranscription(ctx, {
          id: "recording-a",
          enqueueTranscription: async () => undefined,
        }),
      ).rejects.toMatchObject({
        code: "invalid_input",
        message: "Only failed recordings can be retried.",
      });
    },
  );

  it("writes transcript text and ordered segments for an owned recording", async () => {
    const ctx = createContext({
      recordings: [
        {
          id: "recording-a",
          user_id: userId,
          node_id: "node-a",
          status: "processing",
          error: null,
        },
      ],
      transcripts: [],
      transcript_segments: [],
    });

    const result = await writeRecordingTranscript(ctx, {
      recordingId: "recording-a",
      fullText: "Hello world Another thought",
      language: "en",
      segments: [
        { startMs: 1200, endMs: 2400, text: "Another thought", speaker: null },
        { startMs: 0, endMs: 1000, text: "Hello world", speaker: null },
      ],
    });

    expect(result.recording).toMatchObject({
      id: "recording-a",
      status: "done",
      error: null,
      duration_sec: 3,
    });
    expect(result.transcript).toMatchObject({
      user_id: userId,
      recording_id: "recording-a",
      full_text: "Hello world Another thought",
      language: "en",
    });
    expect(ctx.supabase).toMatchObject({
      tables: {
        transcript_segments: [
          {
            transcript_id: result.transcript.id,
            start_ms: 0,
            end_ms: 1000,
            text: "Hello world",
          },
          {
            transcript_id: result.transcript.id,
            start_ms: 1200,
            end_ms: 2400,
            text: "Another thought",
          },
        ],
      },
    });
  });

  it("refreshes semantic chunks after writing transcript segments", async () => {
    const ctx = createContext({
      recordings: [
        {
          id: "recording-a",
          user_id: userId,
          node_id: "node-a",
          status: "processing",
          error: null,
        },
      ],
      transcripts: [],
      transcript_segments: [],
      semantic_search_chunks: [],
    });
    const { calls, provider } = embeddingProvider([vector(0.75)]);

    const result = await writeRecordingTranscript(ctx, {
      recordingId: "recording-a",
      fullText: "Hello world",
      language: "en",
      segments: [
        { startMs: 0, endMs: 1000, text: "Hello world", speaker: null },
      ],
      embeddingProvider: provider,
    });

    expect(calls).toEqual([["Hello world"]]);
    const tables = tablesFor(ctx);
    expect(tables.semantic_search_chunks).toHaveLength(1);
    expect(tables.semantic_search_chunks[0]).toMatchObject({
      user_id: userId,
      source_type: "transcript",
      transcript_id: result.transcript.id,
      recording_id: "recording-a",
      start_ms: 0,
      end_ms: 1000,
      content: "Hello world",
      embedding: `[${vector(0.75).join(",")}]`,
    });
  });

  it("reads transcript detail for an owned recording", async () => {
    const ctx = createContext({
      library_nodes: [
        {
          id: "node-a",
          user_id: userId,
          title: "lecture.mp3",
          kind: "audio",
          storage_key: "user-1/node-a-lecture-mp3",
        },
      ],
      recordings: [
        {
          id: "recording-a",
          user_id: userId,
          node_id: "node-a",
          status: "done",
        },
      ],
      transcripts: [
        {
          id: "transcript-a",
          user_id: userId,
          recording_id: "recording-a",
          full_text: "First Second",
          language: "en",
        },
      ],
      transcript_segments: [
        {
          id: "segment-b",
          transcript_id: "transcript-a",
          start_ms: 1000,
          end_ms: 2000,
          text: "Second",
          speaker: null,
        },
        {
          id: "segment-a",
          transcript_id: "transcript-a",
          start_ms: 0,
          end_ms: 900,
          text: "First",
          speaker: null,
        },
      ],
    });

    const detail = await getTranscriptDetail(ctx, {
      recordingId: "recording-a",
    });

    expect(detail.node.id).toBe("node-a");
    expect(detail.node.title).toBe("lecture.mp3");
    expect(detail.recording.id).toBe("recording-a");
    expect(detail.transcript?.id).toBe("transcript-a");
    expect(detail.segments.map((segment) => segment.id)).toEqual([
      "segment-a",
      "segment-b",
    ]);
  });

  it("rejects transcript detail for another user's recording", async () => {
    const ctx = createContext({
      recordings: [
        {
          id: "recording-a",
          user_id: otherUserId,
          node_id: "node-a",
          status: "done",
        },
      ],
    });

    await expect(
      getTranscriptDetail(ctx, { recordingId: "recording-a" }),
    ).rejects.toMatchObject({
      code: "not_found",
      message: "Recording not found.",
    });
  });

  it("rejects duplicate tag names for the same user before inserting", async () => {
    const ctx = createContext({
      tags: [{ id: "tag-a", user_id: userId, name: "biology", color: null }],
    });

    await expect(
      createTag(ctx, { name: "biology", color: "#22c55e" }),
    ).rejects.toMatchObject({
      code: "conflict",
      message: "A tag with that name already exists.",
    });
  });
});
