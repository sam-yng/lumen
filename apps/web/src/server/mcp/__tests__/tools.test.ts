import { describe, expect, it } from "vitest";
import {
  runCreateNote,
  runGetDocument,
  runSearchNotes,
} from "@/server/mcp/tools";
import {
  createContext,
  userId,
} from "@/server/services/__tests__/fake-supabase";

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
  it("returns a { query, sources } payload with stable citation labels", async () => {
    const ctx = createContext({
      documents: [
        {
          id: "d1",
          user_id: userId,
          folder_id: null,
          title: "Bio",
          content_json: null,
          content_text: "the cell mitochondria",
          content_tsv: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      transcripts: [],
      recordings: [],
      files: [],
      transcript_segments: [],
    });

    const result = await runSearchNotes(ctx, { query: "mitochondria" });
    expect(result.content[0].type).toBe("text");

    const payload = JSON.parse((result.content[0] as { text: string }).text);
    expect(payload.query).toBe("mitochondria");
    expect(Array.isArray(payload.sources)).toBe(true);
    expect(payload.sources[0].citationId).toBe("S1");
    expect(payload.sources[0]).toMatchObject({
      kind: "document",
      source: { documentId: "d1" },
    });
  });

  it("returns an empty sources array for a query with no matches", async () => {
    const ctx = createContext({
      documents: [],
      transcripts: [],
      recordings: [],
      files: [],
      transcript_segments: [],
    });
    const result = await runSearchNotes(ctx, { query: "nothing" });
    const payload = JSON.parse((result.content[0] as { text: string }).text);
    expect(payload).toEqual({ query: "nothing", sources: [] });
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
