import { describe, expect, it } from "vitest";
import {
  createContext,
  userId,
} from "@/server/services/__tests__/fake-supabase";
import { getTranscriptById } from "@/server/services/transcripts";

function tables() {
  return {
    transcripts: [
      {
        id: "t1",
        user_id: userId,
        recording_id: "r1",
        full_text: "hello world",
        // TSVector generated column — opaque/Postgres-only, not used in service logic
        full_text_tsv: null as unknown,
        language: "en",
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    recordings: [
      {
        id: "r1",
        user_id: userId,
        file_id: "f1",
        status: "done",
        duration_sec: 42,
        error: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    transcript_segments: [
      {
        id: "s2",
        transcript_id: "t1",
        start_ms: 1000,
        end_ms: 2000,
        text: "second",
        speaker: null,
      },
      {
        id: "s1",
        transcript_id: "t1",
        start_ms: 0,
        end_ms: 900,
        text: "first",
        speaker: "A",
      },
    ],
  };
}

describe("getTranscriptById", () => {
  it("returns the transcript, recording, and segments ordered by start_ms", async () => {
    const detail = await getTranscriptById(createContext(tables()), "t1");
    expect(detail).not.toBeNull();
    expect(detail?.recording?.status).toBe("done");
    expect(detail?.segments.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("returns null when the transcript belongs to another user", async () => {
    const other = tables();
    other.transcripts[0].user_id = "user-2";
    expect(await getTranscriptById(createContext(other), "t1")).toBeNull();
  });

  it("returns null when the transcript does not exist", async () => {
    expect(
      await getTranscriptById(createContext(tables()), "missing"),
    ).toBeNull();
  });
});
