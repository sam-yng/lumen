import { describe, expect, it } from "vitest";
import { readDocumentResource } from "@/server/mcp/resources";
import { createContext } from "@/server/services/__tests__/fake-supabase";

const doc = {
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

describe("readDocumentResource", () => {
  it("returns page contents and its stable node route", async () => {
    const ctx = createContext({ library_nodes: [workspace, { ...doc }] });
    const result = await readDocumentResource(ctx, "d1");
    expect((result.contents[0] as { text: string }).text).toContain("Bio");
    expect((result.contents[0] as { text: string }).text).toContain(
      "/biology/bio-d1",
    );
    expect(result.contents[0].uri).toBe("lumen://document/d1");
  });
});
