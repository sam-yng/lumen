import { describe, expect, it } from "vitest";
import {
  buildMakeFlashcardsPrompt,
  buildSummarizeRecordingPrompt,
} from "@/server/mcp/prompts";
import { createContext } from "@/server/services/__tests__/fake-supabase";

const fixtureCtx = () =>
  createContext({
    recordings: [
      {
        id: "r1",
        user_id: "user-1",
        node_id: "f1",
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    library_nodes: [
      {
        id: "f1",
        user_id: "user-1",
        workspace_id: "workspace-1",
        parent_id: "workspace-1",
        title: "lecture.mp3",
        slug: "lecture-f1",
        mime_type: "audio/mpeg",
        size_bytes: 1,
        storage_key: "k",
        kind: "audio",
        content_json: null,
        content_text: null,
        content_tsv: null,
        is_pinned: false,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
    transcripts: [
      {
        id: "t1",
        user_id: "user-1",
        recording_id: "r1",
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    transcript_segments: [
      {
        id: "s1",
        transcript_id: "t1",
        start_ms: 0,
        end_ms: 1000,
        text: "Mitochondria are organelles.",
        speaker: null,
      },
    ],
  });

describe("buildSummarizeRecordingPrompt", () => {
  it("injects transcript text and a summarize instruction", async () => {
    const ctx = fixtureCtx();
    const result = await buildSummarizeRecordingPrompt(ctx, {
      recordingId: "r1",
    });
    const text = String((result.messages[0].content as { text: string }).text);
    expect(text).toContain("Mitochondria are organelles.");
    expect(text.toLowerCase()).toContain("summarize");
  });
});

describe("buildMakeFlashcardsPrompt", () => {
  it("injects transcript text and a flashcard format marker", async () => {
    const ctx = fixtureCtx();
    const result = await buildMakeFlashcardsPrompt(ctx, {
      recordingId: "r1",
    });
    const text = String((result.messages[0].content as { text: string }).text);
    expect(text).toContain("Mitochondria are organelles.");
    expect(text).toContain("Q:");
  });
});
