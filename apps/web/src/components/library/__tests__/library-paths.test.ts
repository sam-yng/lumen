import { describe, expect, it } from "vitest";
import { nodePath } from "@/components/library/library-paths";
import type { LibraryNode } from "@/server/services/library-nodes";

const base = {
  user_id: "user-1",
  content_json: null,
  content_text: null,
  content_tsv: null,
  mime_type: null,
  size_bytes: null,
  storage_key: null,
  is_pinned: false,
  created_at: "2026-06-18T00:00:00.000Z",
  updated_at: "2026-06-18T00:00:00.000Z",
} satisfies Partial<LibraryNode>;

describe("nodePath", () => {
  it("builds the root-to-node chain from parent links", () => {
    const nodes: LibraryNode[] = [
      {
        ...base,
        id: "workspace",
        workspace_id: "workspace",
        parent_id: null,
        kind: "workspace",
        title: "Biology",
        slug: "biology-1",
      },
      {
        ...base,
        id: "unit",
        workspace_id: "workspace",
        parent_id: "workspace",
        kind: "page",
        title: "Unit one",
        slug: "unit-1",
      },
      {
        ...base,
        id: "lesson",
        workspace_id: "workspace",
        parent_id: "unit",
        kind: "page",
        title: "Lesson",
        slug: "lesson-1",
      },
    ];

    expect(nodePath(nodes, "lesson").map((node) => node.id)).toEqual([
      "workspace",
      "unit",
      "lesson",
    ]);
  });
});
