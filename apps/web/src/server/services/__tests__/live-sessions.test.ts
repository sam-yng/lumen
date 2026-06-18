import { describe, expect, it } from "vitest";
import type {
  StreamingSegment,
  StreamingTranscriptionEvent,
  StreamingTranscriptionProvider,
} from "@/lib/transcription/streaming-provider";
import {
  createContext,
  otherUserId,
  type Row,
  userId,
} from "@/server/services/__tests__/fake-supabase";
import { ServiceError } from "@/server/services/errors";
import {
  appendLiveSegments,
  cancelLiveSession,
  finalizeLiveSession,
  startLiveSession,
} from "@/server/services/live-sessions";
import type { StorageProvider } from "@/server/services/storage-provider";

const BUCKET = "library-files";

class FakeStorage implements StorageProvider {
  readonly uploaded: Array<{
    bucket: string;
    key: string;
    bytes: Uint8Array;
    contentType: string;
  }> = [];
  failUploads = false;

  async upload(input: {
    bucket: string;
    key: string;
    bytes: Uint8Array;
    contentType: string;
  }) {
    if (this.failUploads) throw new Error("storage offline");
    this.uploaded.push(input);
  }

  async remove() {}
}

/**
 * Fake StreamingTranscriptionProvider: replays a script of interim/final
 * events when the session is driven, mirroring how the browser provider
 * surfaces Whisper output.
 */
class FakeStreamingProvider implements StreamingTranscriptionProvider {
  constructor(private readonly script: StreamingTranscriptionEvent[]) {}

  async startSession(options: {
    onEvent: (event: StreamingTranscriptionEvent) => void;
  }) {
    const script = this.script;
    return {
      pushAudio(_samples: Float32Array) {
        const event = script.shift();
        if (event) options.onEvent(event);
      },
      async finish() {
        for (const event of script.splice(0)) options.onEvent(event);
      },
      abort() {
        script.length = 0;
      },
    };
  }
}

function segment(startMs: number, endMs: number, text: string) {
  return { startMs, endMs, text, speaker: null } satisfies StreamingSegment;
}

function tablesFor(ctx: ReturnType<typeof createContext>) {
  return (
    ctx.supabase as unknown as {
      tables: Record<string, Row[]>;
    }
  ).tables;
}

function liveTables(extra: Partial<Record<string, Row[]>> = {}) {
  return {
    library_nodes: [
      {
        id: "workspace-1",
        user_id: userId,
        workspace_id: "workspace-1",
        parent_id: null,
        kind: "workspace",
        title: "Workspace",
        slug: "workspace-1",
      },
    ],
    recordings: [],
    transcripts: [],
    transcript_segments: [],
    semantic_search_chunks: [],
    ...extra,
  };
}

async function startedSession(extra: Partial<Record<string, Row[]>> = {}) {
  const ctx = createContext(liveTables(extra));
  const session = await startLiveSession(ctx, {
    name: "Algebra lecture",
    parentId: "workspace-1",
    workspaceId: "workspace-1",
  });
  return { ctx, session };
}

describe("startLiveSession", () => {
  it("creates a live recording with a reserved storage key and empty transcript", async () => {
    const { ctx, session } = await startedSession();

    expect(session.recording.status).toBe("live");
    expect(session.recording.node_id).toBe(session.node.id);
    expect(session.node.size_bytes).toBe(0);
    expect(session.node.kind).toBe("audio");
    expect(session.node.storage_key?.startsWith(`${userId}/`)).toBe(true);
    expect(session.transcript.recording_id).toBe(session.recording.id);
    expect(session.transcript.full_text).toBe("");
    expect(tablesFor(ctx).transcript_segments).toHaveLength(0);
  });

  it("rejects a parent node owned by another user", async () => {
    const ctx = createContext(
      liveTables({
        library_nodes: [
          {
            id: "workspace-2",
            user_id: otherUserId,
            workspace_id: "workspace-2",
            parent_id: null,
            kind: "workspace",
            title: "Theirs",
            slug: "theirs-2",
          },
        ],
      }),
    );

    await expect(
      startLiveSession(ctx, {
        name: "Algebra",
        parentId: "workspace-2",
        workspaceId: "workspace-2",
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects a root session in another user's workspace", async () => {
    const ctx = createContext(
      liveTables({
        library_nodes: [
          {
            id: "workspace-2",
            user_id: otherUserId,
            workspace_id: "workspace-2",
            parent_id: null,
            kind: "workspace",
            title: "Theirs",
            slug: "theirs-2",
          },
        ],
      }),
    );

    await expect(
      startLiveSession(ctx, {
        name: "Algebra",
        parentId: null,
        workspaceId: "workspace-2",
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects a blank session name", async () => {
    const ctx = createContext(liveTables());

    await expect(
      startLiveSession(ctx, {
        name: "   ",
        parentId: "workspace-1",
        workspaceId: "workspace-1",
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });
});

describe("live session driven by a streaming provider", () => {
  it("persists only final segments and finalizes them in start order", async () => {
    const { ctx, session } = await startedSession();
    const storage = new FakeStorage();

    // Interim → final ordering as the browser provider would emit it; the
    // second chunk's final lands before the first one's (out-of-order POSTs).
    const provider = new FakeStreamingProvider([
      { kind: "interim", segment: segment(0, 900, "hello") },
      { kind: "interim", segment: segment(0, 1800, "hello world") },
      { kind: "final", segment: segment(2000, 4000, "how are you") },
      { kind: "final", segment: segment(0, 2000, "hello world") },
    ]);

    const appended: StreamingSegment[] = [];
    const streamingSession = await provider.startSession({
      onEvent: (event) => {
        if (event.kind !== "final") return;
        appended.push(event.segment);
      },
    });

    for (let i = 0; i < 4; i += 1)
      streamingSession.pushAudio(new Float32Array());
    await streamingSession.finish();

    for (const final of appended) {
      await appendLiveSegments(ctx, {
        recordingId: session.recording.id,
        segments: [final],
      });
    }

    expect(tablesFor(ctx).transcript_segments).toHaveLength(2);

    const { recording, transcript } = await finalizeLiveSession(ctx, {
      recordingId: session.recording.id,
      audio: { bytes: new Uint8Array([1, 2, 3]), contentType: "audio/webm" },
      language: "en",
      bucket: BUCKET,
      storage,
    });

    expect(recording.status).toBe("done");
    expect(recording.duration_sec).toBe(4);
    expect(recording.error).toBeNull();
    expect(transcript.full_text).toBe("hello world how are you");
    expect(transcript.language).toBe("en");

    const finalSegments = tablesFor(ctx)
      .transcript_segments.filter((row) => row.transcript_id === transcript.id)
      .sort((a, b) => Number(a.start_ms) - Number(b.start_ms));
    expect(
      finalSegments.map((row) => [row.start_ms, row.end_ms, row.text]),
    ).toEqual([
      [0, 2000, "hello world"],
      [2000, 4000, "how are you"],
    ]);
    expect(finalSegments.every((row) => row.speaker === null)).toBe(true);

    expect(storage.uploaded).toHaveLength(1);
    expect(storage.uploaded[0]?.key).toBe(session.node.storage_key);
    const nodeRow = tablesFor(ctx).library_nodes.find(
      (row) => row.id === session.node.id,
    );
    expect(nodeRow?.size_bytes).toBe(3);
    expect(nodeRow?.mime_type).toBe("audio/webm");
  });
});

describe("appendLiveSegments", () => {
  it("skips empty text and rejects invalid times", async () => {
    const { ctx, session } = await startedSession();

    const blank = await appendLiveSegments(ctx, {
      recordingId: session.recording.id,
      segments: [{ startMs: 0, endMs: 1000, text: "   " }],
    });
    expect(blank.inserted).toBe(0);

    await expect(
      appendLiveSegments(ctx, {
        recordingId: session.recording.id,
        segments: [{ startMs: 2000, endMs: 1000, text: "backwards" }],
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("rejects recordings owned by another user", async () => {
    const { ctx, session } = await startedSession();
    const recording = tablesFor(ctx).recordings.find(
      (row) => row.id === session.recording.id,
    );
    if (recording) recording.user_id = otherUserId;

    await expect(
      appendLiveSegments(ctx, {
        recordingId: session.recording.id,
        segments: [{ startMs: 0, endMs: 1000, text: "hi" }],
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects recordings that are not live", async () => {
    const { ctx, session } = await startedSession();
    const recording = tablesFor(ctx).recordings.find(
      (row) => row.id === session.recording.id,
    );
    if (recording) recording.status = "done";

    await expect(
      appendLiveSegments(ctx, {
        recordingId: session.recording.id,
        segments: [{ startMs: 0, endMs: 1000, text: "hi" }],
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("finalizeLiveSession", () => {
  it("marks the recording failed when the audio upload fails", async () => {
    const { ctx, session } = await startedSession();
    const storage = new FakeStorage();
    storage.failUploads = true;

    await expect(
      finalizeLiveSession(ctx, {
        recordingId: session.recording.id,
        audio: { bytes: new Uint8Array([1]), contentType: "audio/webm" },
        language: null,
        bucket: BUCKET,
        storage,
      }),
    ).rejects.toThrow("storage offline");

    const recording = tablesFor(ctx).recordings.find(
      (row) => row.id === session.recording.id,
    );
    expect(recording?.status).toBe("failed");
    expect(recording?.error).toBe("storage offline");
  });

  it("rejects empty audio and marks the recording failed", async () => {
    const { ctx, session } = await startedSession();
    const storage = new FakeStorage();

    await expect(
      finalizeLiveSession(ctx, {
        recordingId: session.recording.id,
        audio: { bytes: new Uint8Array(), contentType: "audio/webm" },
        language: null,
        bucket: BUCKET,
        storage,
      }),
    ).rejects.toBeInstanceOf(ServiceError);

    const recording = tablesFor(ctx).recordings.find(
      (row) => row.id === session.recording.id,
    );
    expect(recording?.status).toBe("failed");
    expect(storage.uploaded).toHaveLength(0);
  });

  it("rejects recordings owned by another user", async () => {
    const { ctx, session } = await startedSession();
    const recording = tablesFor(ctx).recordings.find(
      (row) => row.id === session.recording.id,
    );
    if (recording) recording.user_id = otherUserId;

    await expect(
      finalizeLiveSession(ctx, {
        recordingId: session.recording.id,
        audio: { bytes: new Uint8Array([1]), contentType: "audio/webm" },
        language: null,
        bucket: BUCKET,
        storage: new FakeStorage(),
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("cancelLiveSession", () => {
  it("deletes the session node (cascading the recording and transcript)", async () => {
    const { ctx, session } = await startedSession();

    const result = await cancelLiveSession(ctx, {
      recordingId: session.recording.id,
    });

    expect(result.deleted).toBe(true);
    expect(
      tablesFor(ctx).library_nodes.find((row) => row.id === session.node.id),
    ).toBeUndefined();
  });

  it("rejects sessions that already finalized", async () => {
    const { ctx, session } = await startedSession();
    const recording = tablesFor(ctx).recordings.find(
      (row) => row.id === session.recording.id,
    );
    if (recording) recording.status = "done";

    await expect(
      cancelLiveSession(ctx, { recordingId: session.recording.id }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("rejects recordings owned by another user", async () => {
    const { ctx, session } = await startedSession();
    const recording = tablesFor(ctx).recordings.find(
      (row) => row.id === session.recording.id,
    );
    if (recording) recording.user_id = otherUserId;

    await expect(
      cancelLiveSession(ctx, { recordingId: session.recording.id }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
