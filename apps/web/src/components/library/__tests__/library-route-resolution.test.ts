import { describe, expect, it } from "vitest";
import { resolveLibraryNodeRoute } from "@/components/library/library-route-resolution";
import type {
  LibraryNode,
  LibraryNodeSnapshot,
} from "@/server/services/library-nodes";

function node(
  id: string,
  kind: LibraryNode["kind"],
  overrides: Partial<LibraryNode> = {},
): LibraryNode {
  return {
    id,
    user_id: "user-1",
    workspace_id: kind === "workspace" ? id : "workspace-1",
    parent_id: kind === "workspace" ? null : "workspace-1",
    kind,
    title: id,
    slug: `${id}-slug`,
    content_json: null,
    content_text: null,
    content_tsv: null,
    mime_type: null,
    size_bytes: null,
    storage_key: null,
    is_pinned: false,
    created_at: "2026-06-18T00:00:00.000Z",
    updated_at: "2026-06-18T00:00:00.000Z",
    ...overrides,
  };
}

function snapshot(nodes: LibraryNode[]): LibraryNodeSnapshot {
  return {
    nodes,
    recordings: [],
    transcripts: [],
    tags: [],
    tagLinks: [],
  };
}

describe("resolveLibraryNodeRoute", () => {
  it("keeps workspace and folder containers in the workspace shell", () => {
    const workspace = node("workspace-1", "workspace", {
      slug: "biology-abcd1234",
    });
    const folder = node("folder-1", "page", {
      slug: "unit-one-efab5678",
      content_json: { type: "lumen-folder" },
    });
    const data = snapshot([workspace, folder]);

    expect(
      resolveLibraryNodeRoute(data, "biology-abcd1234", "unit-one-efab5678"),
    ).toEqual({ kind: "render" });
  });

  it("redirects a leaf note to its standalone editor", () => {
    const workspace = node("workspace-1", "workspace", {
      slug: "biology-abcd1234",
    });
    const note = node("note-1", "page", { slug: "cells-efab5678" });

    expect(
      resolveLibraryNodeRoute(
        snapshot([workspace, note]),
        "biology-abcd1234",
        "cells-efab5678",
      ),
    ).toEqual({ kind: "redirect", href: "/library/notes/note-1" });
  });

  it("redirects recorded audio to its standalone transcript", () => {
    const workspace = node("workspace-1", "workspace", {
      slug: "biology-abcd1234",
    });
    const audio = node("audio-1", "audio", { slug: "lecture-efab5678" });
    const data = snapshot([workspace, audio]);
    data.recordings.push({
      id: "recording-1",
      user_id: "user-1",
      node_id: "audio-1",
      status: "done",
      duration_sec: 60,
      error: null,
      created_at: "2026-06-18T00:00:00.000Z",
    });

    expect(
      resolveLibraryNodeRoute(data, "biology-abcd1234", "lecture-efab5678"),
    ).toEqual({
      kind: "redirect",
      href: "/library/transcripts/recording-1",
    });
  });

  it("keeps unresolved and unrecorded audio routes in the workspace shell", () => {
    const workspace = node("workspace-1", "workspace", {
      slug: "biology-abcd1234",
    });
    const audio = node("audio-1", "audio", { slug: "lecture-efab5678" });
    const data = snapshot([workspace, audio]);

    expect(
      resolveLibraryNodeRoute(data, "biology-abcd1234", "lecture-efab5678"),
    ).toEqual({ kind: "render" });
    expect(
      resolveLibraryNodeRoute(data, "biology-abcd1234", "missing"),
    ).toEqual({ kind: "render" });
  });
});
