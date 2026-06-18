import { describe, expect, it } from "vitest";
import {
  createContext,
  type FakeSupabase,
  otherUserId,
  type Row,
  userId,
} from "@/server/services/__tests__/fake-supabase";
import {
  bulkDeleteLibraryNodes,
  bulkMoveLibraryNodes,
  createPageNode,
  createWorkspaceNode,
  getLibraryNodeSnapshot,
  type LibraryNode,
  updateLibraryNode,
} from "@/server/services/library-nodes";

function nodeRow(overrides: Partial<LibraryNode> & { id: string }): Row {
  return {
    id: overrides.id,
    user_id: overrides.user_id ?? userId,
    workspace_id: overrides.workspace_id ?? overrides.id,
    parent_id: overrides.parent_id ?? null,
    kind: overrides.kind ?? "page",
    title: overrides.title ?? "Node",
    slug: overrides.slug ?? overrides.id,
    content_json: overrides.content_json ?? null,
    content_text: overrides.content_text ?? null,
    mime_type: overrides.mime_type ?? null,
    size_bytes: overrides.size_bytes ?? null,
    storage_key: overrides.storage_key ?? null,
    is_pinned: overrides.is_pinned ?? false,
    created_at: overrides.created_at ?? "2026-06-18T00:00:00Z",
    updated_at: overrides.updated_at ?? "2026-06-18T00:00:00Z",
  };
}

function tableOf(ctx: ReturnType<typeof createContext>) {
  return (ctx.supabase as unknown as FakeSupabase).tables
    .library_nodes as Row[];
}

describe("library-nodes service", () => {
  it("creates a workspace with a stable readable slug", async () => {
    const ctx = createContext({ library_nodes: [] });

    const workspace = await createWorkspaceNode(ctx, { title: "Biology 101" });

    expect(workspace.kind).toBe("workspace");
    expect(workspace.parent_id).toBeNull();
    expect(workspace.workspace_id).toBe(workspace.id);
    expect(workspace.slug).toMatch(/^biology-101-[0-9a-f]{8}$/);
  });

  it("creates nested page nodes scoped to a workspace", async () => {
    const ctx = createContext({ library_nodes: [] });
    const workspace = await createWorkspaceNode(ctx, { title: "Course" });

    const page = await createPageNode(ctx, {
      title: "Lecture 4",
      parentId: workspace.id,
    });
    const child = await createPageNode(ctx, {
      title: "Sub note",
      parentId: page.id,
    });

    expect(page.kind).toBe("page");
    expect(page.parent_id).toBe(workspace.id);
    expect(page.workspace_id).toBe(workspace.id);
    expect(child.parent_id).toBe(page.id);
    expect(child.workspace_id).toBe(workspace.id);
  });

  it("rejects creating a page under a file/audio leaf", async () => {
    const ctx = createContext({
      library_nodes: [
        nodeRow({ id: "ws", kind: "workspace", workspace_id: "ws" }),
        nodeRow({
          id: "audio",
          kind: "audio",
          workspace_id: "ws",
          parent_id: "ws",
          mime_type: "audio/webm",
          size_bytes: 10,
          storage_key: "k",
        }),
      ],
    });

    await expect(
      createPageNode(ctx, { title: "Nope", parentId: "audio" }),
    ).rejects.toThrow();
  });

  it("rejects moving a node into itself or a descendant", async () => {
    const ctx = createContext({
      library_nodes: [
        nodeRow({ id: "ws", kind: "workspace", workspace_id: "ws" }),
        nodeRow({ id: "a", workspace_id: "ws", parent_id: "ws" }),
        nodeRow({ id: "b", workspace_id: "ws", parent_id: "a" }),
      ],
    });

    await expect(
      updateLibraryNode(ctx, { id: "a", parentId: "a" }),
    ).rejects.toThrow();
    await expect(
      updateLibraryNode(ctx, { id: "a", parentId: "b" }),
    ).rejects.toThrow();
    await expect(
      bulkMoveLibraryNodes(ctx, { ids: ["a"], parentId: "b" }),
    ).rejects.toThrow();
  });

  it("bulk deletes selected nodes and descendants for the current user only", async () => {
    const ctx = createContext({
      library_nodes: [
        nodeRow({ id: "ws", kind: "workspace", workspace_id: "ws" }),
        nodeRow({ id: "a", workspace_id: "ws", parent_id: "ws" }),
        nodeRow({ id: "b", workspace_id: "ws", parent_id: "a" }),
        nodeRow({
          id: "other",
          user_id: otherUserId,
          kind: "workspace",
          workspace_id: "other",
        }),
      ],
    });

    await bulkDeleteLibraryNodes(ctx, { ids: ["a"] });

    const remaining = tableOf(ctx).map((row) => row.id);
    expect(remaining).toContain("ws");
    expect(remaining).toContain("other");
    expect(remaining).not.toContain("a");
    expect(remaining).not.toContain("b");
  });

  it("allows pinning workspaces and container pages only", async () => {
    const ctx = createContext({
      library_nodes: [
        nodeRow({ id: "ws", kind: "workspace", workspace_id: "ws" }),
        nodeRow({ id: "container", workspace_id: "ws", parent_id: "ws" }),
        nodeRow({
          id: "leafChild",
          workspace_id: "ws",
          parent_id: "container",
        }),
        nodeRow({ id: "leaf", workspace_id: "ws", parent_id: "ws" }),
        nodeRow({
          id: "file",
          kind: "file",
          workspace_id: "ws",
          parent_id: "ws",
          mime_type: "application/pdf",
          size_bytes: 10,
          storage_key: "k",
        }),
      ],
    });

    const ws = await updateLibraryNode(ctx, { id: "ws", isPinned: true });
    expect(ws.is_pinned).toBe(true);

    const container = await updateLibraryNode(ctx, {
      id: "container",
      isPinned: true,
    });
    expect(container.is_pinned).toBe(true);

    await expect(
      updateLibraryNode(ctx, { id: "leaf", isPinned: true }),
    ).rejects.toThrow();
    await expect(
      updateLibraryNode(ctx, { id: "file", isPinned: true }),
    ).rejects.toThrow();
  });

  it("returns a snapshot scoped to the current user", async () => {
    const ctx = createContext({
      library_nodes: [
        nodeRow({ id: "ws", kind: "workspace", workspace_id: "ws" }),
        nodeRow({ id: "a", workspace_id: "ws", parent_id: "ws" }),
        nodeRow({
          id: "other",
          user_id: otherUserId,
          kind: "workspace",
          workspace_id: "other",
        }),
      ],
      tags: [
        { id: "tag-a", user_id: userId, name: "Exam", color: null },
        { id: "tag-b", user_id: otherUserId, name: "Private", color: null },
      ],
      tag_links: [
        { id: "link-a", tag_id: "tag-a", node_id: "a" },
        { id: "link-b", tag_id: "tag-b", node_id: "other" },
      ],
      recordings: [
        { id: "recording-a", user_id: userId, node_id: "a" },
        { id: "recording-b", user_id: otherUserId, node_id: "other" },
      ],
      transcripts: [
        { id: "transcript-a", user_id: userId, recording_id: "recording-a" },
        {
          id: "transcript-b",
          user_id: otherUserId,
          recording_id: "recording-b",
        },
      ],
    });

    const snapshot = await getLibraryNodeSnapshot(ctx);
    const ids = snapshot.nodes.map((node) => node.id);

    expect(ids).toContain("ws");
    expect(ids).toContain("a");
    expect(ids).not.toContain("other");
    expect(snapshot.tags.map((tag) => tag.id)).toEqual(["tag-a"]);
    expect(snapshot.tagLinks.map((link) => link.id)).toEqual(["link-a"]);
    expect(snapshot.recordings.map((recording) => recording.id)).toEqual([
      "recording-a",
    ]);
    expect(snapshot.transcripts.map((transcript) => transcript.id)).toEqual([
      "transcript-a",
    ]);
  });
});
