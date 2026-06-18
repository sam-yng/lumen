import { describe, expect, it } from "vitest";
import {
  createContext,
  otherUserId,
  type Row,
  userId,
} from "@/server/services/__tests__/fake-supabase";
import { createDocument, updateDocument } from "@/server/services/documents";
import { extractTipTapText } from "@/server/services/editor-content";
import {
  EMBEDDING_DIMENSIONS,
  type EmbeddingProvider,
} from "@/server/services/embedding-provider";
import { createFileMetadata } from "@/server/services/files";
import {
  createFolder,
  deleteFolder,
  moveFolder,
} from "@/server/services/folders";
import { getLibrarySnapshot } from "@/server/services/library";
import { retryRecordingTranscription } from "@/server/services/recordings";
import type { StorageProvider } from "@/server/services/storage-provider";
import { createTag, linkTagToTarget } from "@/server/services/tags";
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
  it("returns a unified snapshot scoped to the current user", async () => {
    const ctx = createContext({
      folders: [
        { id: "folder-a", user_id: userId, name: "Course notes" },
        { id: "folder-b", user_id: otherUserId, name: "Someone else" },
      ],
      documents: [
        { id: "doc-a", user_id: userId, title: "Photosynthesis" },
        { id: "doc-b", user_id: otherUserId, title: "Private" },
      ],
      files: [
        { id: "file-a", user_id: userId, name: "slides.pdf" },
        { id: "file-b", user_id: otherUserId, name: "other.pdf" },
      ],
      recordings: [
        {
          id: "recording-a",
          user_id: userId,
          file_id: "file-a",
          status: "pending",
        },
        {
          id: "recording-b",
          user_id: otherUserId,
          file_id: "file-b",
          status: "done",
        },
      ],
      tags: [
        { id: "tag-a", user_id: userId, name: "biology" },
        { id: "tag-b", user_id: otherUserId, name: "math" },
      ],
      tag_links: [
        {
          id: "link-a",
          tag_id: "tag-a",
          target_type: "document",
          target_id: "doc-a",
        },
        {
          id: "link-b",
          tag_id: "tag-b",
          target_type: "document",
          target_id: "doc-b",
        },
      ],
    });

    const snapshot = await getLibrarySnapshot(ctx);

    expect(snapshot.folders.map((folder) => folder.id)).toEqual(["folder-a"]);
    expect(snapshot.documents.map((document) => document.id)).toEqual([
      "doc-a",
    ]);
    expect(snapshot.files.map((file) => file.id)).toEqual(["file-a"]);
    expect(snapshot.recordings.map((recording) => recording.id)).toEqual([
      "recording-a",
    ]);
    expect(snapshot.tags.map((tag) => tag.id)).toEqual(["tag-a"]);
    expect(snapshot.tagLinks.map((link) => link.id)).toEqual(["link-a"]);
  });

  it("rejects moving a folder into one of its descendants", async () => {
    const ctx = createContext({
      folders: [
        { id: "root", user_id: userId, parent_id: null, name: "Root" },
        { id: "child", user_id: userId, parent_id: "root", name: "Child" },
        {
          id: "grandchild",
          user_id: userId,
          parent_id: "child",
          name: "Grandchild",
        },
      ],
    });

    await expect(
      moveFolder(ctx, { id: "root", parentId: "grandchild" }),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "A folder cannot be moved into itself or a descendant.",
    });
  });

  it("creates and deletes folders under the current user", async () => {
    const ctx = createContext({ folders: [] });

    const folder = await createFolder(ctx, {
      name: "Seminars",
      parentId: null,
    });

    expect(folder).toMatchObject({
      user_id: userId,
      name: "Seminars",
      parent_id: null,
    });

    const deleted = await deleteFolder(ctx, { id: String(folder.id) });

    expect(deleted.id).toBe(folder.id);
    expect(ctx.supabase).toMatchObject({
      tables: { folders: [] },
    });
  });

  it("deletes a folder subtree with its documents and files", async () => {
    const ctx = createContext({
      folders: [
        {
          id: "root",
          user_id: userId,
          parent_id: null,
          name: "Root",
        },
        {
          id: "child",
          user_id: userId,
          parent_id: "root",
          name: "Child",
        },
        {
          id: "grandchild",
          user_id: userId,
          parent_id: "child",
          name: "Grandchild",
        },
        {
          id: "outside",
          user_id: userId,
          parent_id: null,
          name: "Outside",
        },
        {
          id: "foreign-child",
          user_id: otherUserId,
          parent_id: "root",
          name: "Foreign child",
        },
      ],
      documents: [
        {
          id: "doc-root",
          user_id: userId,
          folder_id: "root",
          title: "Root doc",
        },
        {
          id: "doc-child",
          user_id: userId,
          folder_id: "child",
          title: "Child doc",
        },
        {
          id: "doc-grandchild",
          user_id: userId,
          folder_id: "grandchild",
          title: "Grandchild doc",
        },
        {
          id: "doc-outside",
          user_id: userId,
          folder_id: "outside",
          title: "Outside doc",
        },
        {
          id: "doc-foreign",
          user_id: otherUserId,
          folder_id: "child",
          title: "Foreign doc",
        },
      ],
      files: [
        {
          id: "file-root",
          user_id: userId,
          folder_id: "root",
          name: "root.pdf",
        },
        {
          id: "file-child",
          user_id: userId,
          folder_id: "child",
          name: "child.pdf",
        },
        {
          id: "file-grandchild",
          user_id: userId,
          folder_id: "grandchild",
          name: "grandchild.pdf",
        },
        {
          id: "file-outside",
          user_id: userId,
          folder_id: "outside",
          name: "outside.pdf",
        },
        {
          id: "file-foreign",
          user_id: otherUserId,
          folder_id: "child",
          name: "foreign.pdf",
        },
      ],
    });

    const deleted = await deleteFolder(ctx, { id: "root" });
    const tables = tablesFor(ctx);

    expect(deleted.id).toBe("root");
    expect(tables.folders.map((folder) => folder.id).sort()).toEqual([
      "foreign-child",
      "outside",
    ]);
    expect(tables.documents.map((document) => document.id).sort()).toEqual([
      "doc-foreign",
      "doc-outside",
    ]);
    expect(tables.files.map((file) => file.id).sort()).toEqual([
      "file-foreign",
      "file-outside",
    ]);
  });

  it("creates documents under the current user and validates folder ownership", async () => {
    const ctx = createContext({
      folders: [
        { id: "owned-folder", user_id: userId, name: "Owned" },
        { id: "foreign-folder", user_id: otherUserId, name: "Foreign" },
      ],
      documents: [],
    });

    await expect(
      createDocument(ctx, {
        title: "Lecture outline",
        folderId: "foreign-folder",
      }),
    ).rejects.toMatchObject({
      code: "not_found",
      message: "Folder not found.",
    });

    const document = await createDocument(ctx, {
      title: "Lecture outline",
      folderId: "owned-folder",
    });

    expect(document).toMatchObject({
      user_id: userId,
      title: "Lecture outline",
      folder_id: "owned-folder",
      content_json: null,
      content_text: null,
    });
  });

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

  it("persists document content JSON and derived plain text", async () => {
    const ctx = createContext({
      documents: [
        {
          id: "doc-a",
          user_id: userId,
          title: "Lecture",
          folder_id: null,
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

    const document = await updateDocument(ctx, {
      id: "doc-a",
      contentJson,
    });

    expect(document).toMatchObject({
      id: "doc-a",
      content_json: contentJson,
      content_text: "Saved from TipTap",
    });
  });

  it("refreshes semantic chunks when document content is updated with a provider", async () => {
    const ctx = createContext({
      documents: [
        {
          id: "doc-a",
          user_id: userId,
          title: "Lecture",
          folder_id: null,
          content_json: null,
          content_text: null,
        },
      ],
      semantic_search_chunks: [
        {
          id: "owned-stale",
          user_id: userId,
          source_type: "document",
          document_id: "doc-a",
          transcript_id: null,
          recording_id: null,
          start_ms: null,
          end_ms: null,
          chunk_index: 0,
          content: "stale",
          embedding: "[0]",
        },
        {
          id: "other-user-stale",
          user_id: otherUserId,
          source_type: "document",
          document_id: "doc-a",
          transcript_id: null,
          recording_id: null,
          start_ms: null,
          end_ms: null,
          chunk_index: 0,
          content: "private",
          embedding: "[0]",
        },
      ],
    });
    const { calls, provider } = embeddingProvider([vector(0.5)]);
    const contentJson = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Indexed from TipTap" }],
        },
      ],
    };

    await updateDocument(ctx, {
      id: "doc-a",
      contentJson,
      embeddingProvider: provider,
    });

    expect(calls).toEqual([["Indexed from TipTap"]]);
    const tables = tablesFor(ctx);
    expect(tables.semantic_search_chunks.map((row) => row.id)).toContain(
      "other-user-stale",
    );
    expect(tables.semantic_search_chunks.map((row) => row.id)).not.toContain(
      "owned-stale",
    );
    expect(tables.semantic_search_chunks.at(-1)).toMatchObject({
      user_id: userId,
      source_type: "document",
      document_id: "doc-a",
      content: "Indexed from TipTap",
      embedding: `[${vector(0.5).join(",")}]`,
    });
  });

  it("creates metadata-only file records for the current user", async () => {
    const ctx = createContext({
      folders: [{ id: "folder-a", user_id: userId, name: "Lectures" }],
      files: [],
    });

    const file = await createFileMetadata(ctx, {
      name: "week-01.pdf",
      mimeType: "application/pdf",
      sizeBytes: 42_000,
      kind: "other",
      folderId: "folder-a",
    });

    expect(file).toMatchObject({
      user_id: userId,
      folder_id: "folder-a",
      name: "week-01.pdf",
      mime_type: "application/pdf",
      size_bytes: 42_000,
      kind: "other",
      storage_key: "metadata/user-1/week-01-pdf",
    });
  });

  it("uploads a non-audio file into storage and creates a file row", async () => {
    const ctx = createContext({
      folders: [{ id: "folder-a", user_id: userId, name: "Lectures" }],
      files: [],
    });
    const storage = new FakeStorage();
    const enqueued: unknown[] = [];

    const result = await createUploadedFile(ctx, {
      bucket: "library-files",
      name: "week 01.pdf",
      mimeType: "application/pdf",
      bytes: new Uint8Array([1, 2, 3]),
      folderId: "folder-a",
      storage,
      enqueueTranscription: async (payload) => enqueued.push(payload),
    });

    expect(result.recording).toBeNull();
    expect(result.file).toMatchObject({
      user_id: userId,
      folder_id: "folder-a",
      name: "week 01.pdf",
      mime_type: "application/pdf",
      size_bytes: 3,
      kind: "other",
    });
    expect(String(result.file.storage_key)).toMatch(/^user-1\/.+-week-01-pdf$/);
    expect(storage.uploaded).toEqual([
      {
        bucket: "library-files",
        key: result.file.storage_key,
        bytes: new Uint8Array([1, 2, 3]),
        contentType: "application/pdf",
      },
    ]);
    expect(enqueued).toEqual([]);
  });

  it("uploads audio, creates a pending recording, and enqueues transcription", async () => {
    const ctx = createContext({
      files: [],
      recordings: [],
    });
    const storage = new FakeStorage();
    const enqueued: unknown[] = [];

    const result = await createUploadedFile(ctx, {
      bucket: "library-files",
      name: "lecture.mp3",
      mimeType: "audio/mpeg",
      bytes: new Uint8Array([4, 5, 6, 7]),
      folderId: null,
      storage,
      enqueueTranscription: async (payload) => enqueued.push(payload),
    });

    expect(result.file).toMatchObject({
      user_id: userId,
      name: "lecture.mp3",
      mime_type: "audio/mpeg",
      size_bytes: 4,
      kind: "audio",
    });
    expect(result.recording).toMatchObject({
      user_id: userId,
      file_id: result.file.id,
      status: "pending",
      error: null,
    });
    expect(enqueued).toEqual([
      {
        userId,
        recordingId: result.recording?.id,
        fileId: result.file.id,
        storageKey: result.file.storage_key,
      },
    ]);
  });

  it("marks the recording failed (not stranded pending) when enqueue fails", async () => {
    const ctx = createContext({
      files: [],
      recordings: [],
    });
    const storage = new FakeStorage();

    const result = await createUploadedFile(ctx, {
      bucket: "library-files",
      name: "lecture.mp3",
      mimeType: "audio/mpeg",
      bytes: new Uint8Array([8, 9]),
      folderId: null,
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
      files: [
        {
          id: "file-a",
          user_id: userId,
          storage_key: "user-1/file-a-lecture-mp3",
        },
      ],
      recordings: [
        {
          id: "recording-a",
          user_id: userId,
          file_id: "file-a",
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
        fileId: "file-a",
        storageKey: "user-1/file-a-lecture-mp3",
      },
    ]);
  });

  it("reverts a retried recording to failed when re-enqueue fails", async () => {
    const ctx = createContext({
      files: [
        {
          id: "file-a",
          user_id: userId,
          storage_key: "user-1/file-a-lecture-mp3",
        },
      ],
      recordings: [
        {
          id: "recording-a",
          user_id: userId,
          file_id: "file-a",
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
            file_id: "file-a",
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
          file_id: "file-a",
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
          file_id: "file-a",
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
      files: [
        {
          id: "file-a",
          user_id: userId,
          name: "lecture.mp3",
          storage_key: "user-1/file-a-lecture-mp3",
        },
      ],
      recordings: [
        {
          id: "recording-a",
          user_id: userId,
          file_id: "file-a",
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

    expect(detail.file.id).toBe("file-a");
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
          file_id: "file-a",
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

  it("rejects linking a tag to a target the current user does not own", async () => {
    const ctx = createContext({
      tags: [{ id: "tag-a", user_id: userId, name: "biology", color: null }],
      documents: [
        { id: "foreign-doc", user_id: otherUserId, title: "Private" },
      ],
      tag_links: [],
    });

    await expect(
      linkTagToTarget(ctx, {
        tagId: "tag-a",
        targetType: "document",
        targetId: "foreign-doc",
      }),
    ).rejects.toMatchObject({
      code: "not_found",
      message: "Target not found.",
    });
  });
});
