import { describe, expect, it } from "vitest";
import { createContext } from "@/server/services/__tests__/fake-supabase";
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
          user_id: "user-1",
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

  it("throws not_found for another user's tag", async () => {
    const ctx = createContext({
      tags: [{ id: "t2", user_id: "user-2", name: "x", color: null }],
    });
    await expect(listDocumentsByTag(ctx, { tagId: "t2" })).rejects.toThrow(
      "Tag not found.",
    );
  });
});
