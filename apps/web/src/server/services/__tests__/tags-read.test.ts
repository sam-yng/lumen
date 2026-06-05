import { describe, expect, it } from "vitest";
import {
  createContext,
  type FakeSupabase,
} from "@/server/services/__tests__/fake-supabase";
import { listDocumentsByTag } from "@/server/services/tags";

const docRow = (over: Record<string, unknown>) => ({
  id: "d1",
  user_id: "user-1",
  folder_id: null,
  title: "Bio",
  content_json: null,
  content_text: "cells",
  content_tsv: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...over,
});

describe("listDocumentsByTag", () => {
  it("returns owned documents linked to the tag", async () => {
    const ctx = createContext({
      tags: [{ id: "t1", user_id: "user-1", name: "exam", color: null }],
      tag_links: [
        {
          id: "l1",
          tag_id: "t1",
          target_type: "document",
          target_id: "d1",
        },
      ],
      documents: [docRow({ id: "d1" })],
    });
    const docs = await listDocumentsByTag(ctx, { tagId: "t1" });
    expect(docs.map((d) => d.id)).toEqual(["d1"]);
  });

  it("returns multiple linked documents in a single query", async () => {
    const ctx = createContext({
      tags: [{ id: "t1", user_id: "user-1", name: "exam", color: null }],
      tag_links: [
        { id: "l1", tag_id: "t1", target_type: "document", target_id: "d1" },
        { id: "l2", tag_id: "t1", target_type: "document", target_id: "d2" },
        { id: "l3", tag_id: "t1", target_type: "file", target_id: "f1" },
      ],
      documents: [
        docRow({ id: "d1", title: "Bio" }),
        docRow({ id: "d2", title: "Chem" }),
        docRow({ id: "d3", title: "Unlinked" }),
        docRow({ id: "d4", user_id: "user-2", title: "Other user" }),
      ],
    });

    const docs = await listDocumentsByTag(ctx, { tagId: "t1" });
    expect(docs.map((d) => d.id)).toEqual(["d1", "d2"]);

    const documentSelects = (ctx.supabase as FakeSupabase).queryLog.filter(
      (entry) => entry.table === "documents" && entry.action === "select",
    );
    expect(documentSelects).toHaveLength(1);
    expect(documentSelects[0].filters).toContainEqual({
      column: "id",
      value: ["d1", "d2"],
    });
  });

  it("throws not_found for another user's tag", async () => {
    const ctx = createContext({
      tags: [{ id: "t2", user_id: "user-2", name: "x", color: null }],
    });
    await expect(listDocumentsByTag(ctx, { tagId: "t2" })).rejects.toThrow(
      "Tag not found.",
    );
  });
});
