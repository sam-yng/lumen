import { describe, expect, it } from "vitest";
import { buildSummarizeRecordingPrompt } from "@/server/mcp/prompts";
import { createContext } from "@/server/services/__tests__/fake-supabase";

describe("buildSummarizeRecordingPrompt", () => {
  it("injects transcript text and a summarize instruction", async () => {
    const ctx = createContext({
      recordings: [
        {
          id: "r1",
          user_id: "user-1",
          file_id: "f1",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      files: [
        {
          id: "f1",
          user_id: "user-1",
          name: "lecture.mp3",
          folder_id: null,
          mime_type: "audio/mpeg",
          size_bytes: 1,
          storage_key: "k",
          kind: "audio",
          created_at: "2026-01-01T00:00:00Z",
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

    const result = await buildSummarizeRecordingPrompt(ctx, {
      recordingId: "r1",
    });
    const text = String((result.messages[0].content as { text: string }).text);
    expect(text).toContain("Mitochondria are organelles.");
    expect(text.toLowerCase()).toContain("summarize");
  });
});
