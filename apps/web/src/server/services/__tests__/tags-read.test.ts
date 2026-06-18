import { describe, expect, it } from "vitest";
import {
  createContext,
  type FakeSupabase,
} from "@/server/services/__tests__/fake-supabase";
import {
  linkTagToNode,
  listPageNodesByTag,
  unlinkTag,
} from "@/server/services/tags";

const docRow = (over: Record<string, unknown>) => ({
  id: "d1",
  user_id: "user-1",
  workspace_id: "workspace-1",
  parent_id: "workspace-1",
  kind: "page",
  title: "Bio",
  slug: "bio-d1",
  content_json: null,
  content_text: "cells",
  content_tsv: null,
  mime_type: null,
  size_bytes: null,
  storage_key: null,
  is_pinned: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...over,
});

describe("listPageNodesByTag", () => {
  it("returns owned pages linked to the tag", async () => {
    const ctx = createContext({
      tags: [{ id: "t1", user_id: "user-1", name: "exam", color: null }],
      tag_links: [
        {
          id: "l1",
          tag_id: "t1",
          node_id: "d1",
        },
      ],
      library_nodes: [docRow({ id: "d1" })],
    });
    const docs = await listPageNodesByTag(ctx, { tagId: "t1" });
    expect(docs.map((d) => d.id)).toEqual(["d1"]);
  });

  it("returns multiple linked pages in a single query", async () => {
    const ctx = createContext({
      tags: [{ id: "t1", user_id: "user-1", name: "exam", color: null }],
      tag_links: [
        { id: "l1", tag_id: "t1", node_id: "d1" },
        { id: "l2", tag_id: "t1", node_id: "d2" },
        { id: "l3", tag_id: "t1", node_id: "f1" },
      ],
      library_nodes: [
        docRow({ id: "d1", title: "Bio" }),
        docRow({ id: "d2", title: "Chem" }),
        docRow({ id: "d3", title: "Unlinked" }),
        docRow({ id: "d4", user_id: "user-2", title: "Other user" }),
        docRow({ id: "f1", kind: "file", title: "Attachment" }),
      ],
    });

    const docs = await listPageNodesByTag(ctx, { tagId: "t1" });
    expect(docs.map((d) => d.id)).toEqual(["d1", "d2"]);

    const documentSelects = (ctx.supabase as FakeSupabase).queryLog.filter(
      (entry) => entry.table === "library_nodes" && entry.action === "select",
    );
    expect(documentSelects).toHaveLength(1);
    expect(documentSelects[0].filters).toContainEqual({
      column: "id",
      value: ["d1", "d2", "f1"],
    });
  });

  it("throws not_found for another user's tag", async () => {
    const ctx = createContext({
      tags: [{ id: "t2", user_id: "user-2", name: "x", color: null }],
    });
    await expect(listPageNodesByTag(ctx, { tagId: "t2" })).rejects.toThrow(
      "Tag not found.",
    );
  });
});

describe("linkTagToNode", () => {
  it("links a tag to an owned library node using node_id", async () => {
    const ctx = createContext({
      tags: [{ id: "t1", user_id: "user-1", name: "exam", color: null }],
      tag_links: [],
      library_nodes: [docRow({ id: "d1" })],
    });

    const link = await linkTagToNode(ctx, { tagId: "t1", nodeId: "d1" });

    expect(link).toMatchObject({ tag_id: "t1", node_id: "d1" });
    expect(link).not.toHaveProperty("target_type");
    expect(link).not.toHaveProperty("target_id");
  });

  it("rejects a node owned by another user", async () => {
    const ctx = createContext({
      tags: [{ id: "t1", user_id: "user-1", name: "exam", color: null }],
      tag_links: [],
      library_nodes: [docRow({ id: "d1", user_id: "user-2" })],
    });

    await expect(
      linkTagToNode(ctx, { tagId: "t1", nodeId: "d1" }),
    ).rejects.toMatchObject({
      code: "not_found",
      message: "Node not found.",
    });
  });
});

describe("unlinkTag", () => {
  it("rejects a link whose tag belongs to another user", async () => {
    const ctx = createContext({
      tags: [{ id: "t2", user_id: "user-2", name: "private", color: null }],
      tag_links: [{ id: "l2", tag_id: "t2", node_id: "d2" }],
    });

    await expect(unlinkTag(ctx, { linkId: "l2" })).rejects.toMatchObject({
      code: "not_found",
      message: "Tag not found.",
    });
  });
});
