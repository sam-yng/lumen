import { describe, expect, it } from "vitest";
import {
  createContext,
  type FakeSupabase,
} from "@/server/services/__tests__/fake-supabase";
import {
  linkTagToNode,
  listPageNodesByTag,
  setTagOnNodes,
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

describe("setTagOnNodes", () => {
  it("rejects an empty node selection as invalid input", async () => {
    const ctx = createContext({
      tags: [{ id: "t1", user_id: "user-1", name: "Exam", color: null }],
      library_nodes: [],
      tag_links: [],
    });

    await expect(
      setTagOnNodes(ctx, { tagId: "t1", nodeIds: [], linked: true }),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "Select at least one node.",
    });
  });

  it("links a tag to every owned node missing it", async () => {
    const ctx = createContext({
      tags: [{ id: "t1", user_id: "user-1", name: "Exam", color: null }],
      library_nodes: [docRow({ id: "n1" }), docRow({ id: "n2" })],
      tag_links: [{ id: "l1", tag_id: "t1", node_id: "n1" }],
    });

    const links = await setTagOnNodes(ctx, {
      tagId: "t1",
      nodeIds: ["n1", "n2", "n2"],
      linked: true,
    });

    expect(links.map((link) => link.node_id).toSorted()).toEqual(["n1", "n2"]);
    expect((ctx.supabase as FakeSupabase).tables.tag_links).toHaveLength(2);
  });

  it("unlinks a tag from every selected node that has it", async () => {
    const ctx = createContext({
      tags: [{ id: "t1", user_id: "user-1", name: "Exam", color: null }],
      library_nodes: [docRow({ id: "n1" }), docRow({ id: "n2" })],
      tag_links: [
        { id: "l1", tag_id: "t1", node_id: "n1" },
        { id: "l2", tag_id: "t1", node_id: "n2" },
        { id: "l3", tag_id: "t2", node_id: "n2" },
      ],
    });

    const removed = await setTagOnNodes(ctx, {
      tagId: "t1",
      nodeIds: ["n1", "n2"],
      linked: false,
    });

    expect(removed.map((link) => link.id).toSorted()).toEqual(["l1", "l2"]);
    expect((ctx.supabase as FakeSupabase).tables.tag_links).toEqual([
      { id: "l3", tag_id: "t2", node_id: "n2" },
    ]);
  });

  it("is idempotent when every node already has the desired state", async () => {
    const linkedCtx = createContext({
      tags: [{ id: "t1", user_id: "user-1", name: "Exam", color: null }],
      library_nodes: [docRow({ id: "n1" })],
      tag_links: [{ id: "l1", tag_id: "t1", node_id: "n1" }],
    });
    const unlinkedCtx = createContext({
      tags: [{ id: "t1", user_id: "user-1", name: "Exam", color: null }],
      library_nodes: [docRow({ id: "n1" })],
      tag_links: [],
    });

    await expect(
      setTagOnNodes(linkedCtx, {
        tagId: "t1",
        nodeIds: ["n1"],
        linked: true,
      }),
    ).resolves.toMatchObject([{ id: "l1" }]);
    await expect(
      setTagOnNodes(unlinkedCtx, {
        tagId: "t1",
        nodeIds: ["n1"],
        linked: false,
      }),
    ).resolves.toEqual([]);
  });

  it("rejects the whole operation when any selected node is not owned", async () => {
    const ctx = createContext({
      tags: [{ id: "t1", user_id: "user-1", name: "Exam", color: null }],
      library_nodes: [
        docRow({ id: "n1" }),
        docRow({ id: "n2", user_id: "user-2" }),
      ],
      tag_links: [],
    });

    await expect(
      setTagOnNodes(ctx, {
        tagId: "t1",
        nodeIds: ["n1", "n2"],
        linked: true,
      }),
    ).rejects.toMatchObject({
      code: "not_found",
      message: "Node not found.",
    });
    expect((ctx.supabase as FakeSupabase).tables.tag_links).toEqual([]);
  });
});
