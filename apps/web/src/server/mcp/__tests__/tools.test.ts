import { describe, expect, it } from "vitest";
import {
  runCreateNote,
  runGetDocument,
  runSearchNotes,
} from "@/server/mcp/tools";
import { createContext } from "@/server/services/__tests__/fake-supabase";

const doc = {
  id: "d1",
  user_id: "user-1",
  folder_id: null,
  title: "Bio",
  content_json: null,
  content_text: "the cell",
  content_tsv: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("runGetDocument", () => {
  it("returns the document title in text content", async () => {
    const ctx = createContext({ documents: [{ ...doc }] });
    const result = await runGetDocument(ctx, { id: "d1" });
    expect(result.content[0]).toMatchObject({ type: "text" });
    expect(String((result.content[0] as { text: string }).text)).toContain(
      "Bio",
    );
  });

  it("reports not-found as an error result, not a throw", async () => {
    const ctx = createContext({ documents: [] });
    const result = await runGetDocument(ctx, { id: "missing" });
    expect(result.isError).toBe(true);
    expect(String((result.content[0] as { text: string }).text)).toContain(
      "not found",
    );
  });
});

describe("runSearchNotes", () => {
  it("returns structured search results", async () => {
    const ctx = createContext({
      documents: [{ ...doc }],
      transcripts: [],
      files: [],
    });
    const result = await runSearchNotes(ctx, { query: "cell" });
    expect(result.content[0].type).toBe("text");
  });
});

describe("runCreateNote", () => {
  it("creates a document and returns its id", async () => {
    const ctx = createContext({ documents: [], folders: [] });
    const result = await runCreateNote(ctx, { title: "New", folderId: null });
    expect(String((result.content[0] as { text: string }).text)).toContain(
      "New",
    );
  });
});
