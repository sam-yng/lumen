import { describe, expect, it } from "vitest";
import {
  runCreateNote,
  runGetDocument,
  runListByTag,
  runSearchNotes,
} from "@/server/mcp/tools";
import {
  createContext,
  userId,
} from "@/server/services/__tests__/fake-supabase";

const doc = {
  id: "d1",
  user_id: "user-1",
  workspace_id: "workspace-1",
  parent_id: "workspace-1",
  kind: "page",
  title: "Bio",
  slug: "bio-d1",
  content_json: null,
  content_text: "the cell",
  content_tsv: null,
  mime_type: null,
  size_bytes: null,
  storage_key: null,
  is_pinned: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const workspace = {
  ...doc,
  id: "workspace-1",
  workspace_id: "workspace-1",
  parent_id: null,
  kind: "workspace",
  title: "Biology",
  slug: "biology",
};

describe("runGetDocument", () => {
  it("returns the page and its stable node route", async () => {
    const ctx = createContext({ library_nodes: [workspace, { ...doc }] });
    const result = await runGetDocument(ctx, { id: "d1" });
    expect(result.content[0]).toMatchObject({ type: "text" });
    expect(String((result.content[0] as { text: string }).text)).toContain(
      "Bio",
    );
    expect(
      JSON.parse((result.content[0] as { text: string }).text),
    ).toMatchObject({
      node: { id: "d1", kind: "page" },
      route: "/biology/bio-d1",
    });
  });

  it("reports not-found as an error result, not a throw", async () => {
    const ctx = createContext({ library_nodes: [] });
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
      library_nodes: [
        workspace,
        { ...doc, user_id: userId, content_text: "the cell mitochondria" },
      ],
      transcripts: [],
      recordings: [],
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
      library_nodes: [],
      transcripts: [],
      recordings: [],
      transcript_segments: [],
    });
    const result = await runSearchNotes(ctx, { query: "nothing" });
    const payload = JSON.parse((result.content[0] as { text: string }).text);
    expect(payload).toEqual({ query: "nothing", sources: [] });
  });
});

describe("runCreateNote", () => {
  it("creates a page node and returns its stable route", async () => {
    const ctx = createContext({ library_nodes: [workspace] });
    const result = await runCreateNote(ctx, {
      title: "New",
      parentId: "workspace-1",
    });
    const payload = JSON.parse((result.content[0] as { text: string }).text);
    expect(payload.node).toMatchObject({ title: "New", kind: "page" });
    expect(payload.route).toMatch(/^\/biology\/new-/);
  });
});

describe("runListByTag", () => {
  it("returns tagged page nodes with stable routes", async () => {
    const ctx = createContext({
      library_nodes: [workspace, { ...doc }],
      tags: [{ id: "tag-1", user_id: userId, name: "biology" }],
      tag_links: [{ id: "link-1", tag_id: "tag-1", node_id: "d1" }],
    });

    const result = await runListByTag(ctx, { tagId: "tag-1" });
    const payload = JSON.parse((result.content[0] as { text: string }).text);
    expect(payload).toEqual([
      expect.objectContaining({
        node: expect.objectContaining({ id: "d1", kind: "page" }),
        route: "/biology/bio-d1",
      }),
    ]);
  });
});
