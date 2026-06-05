import { describe, expect, it } from "vitest";
import { createContext } from "@/server/services/__tests__/fake-supabase";
import { getDocumentDetail } from "@/server/services/documents";

const doc = {
  id: "d1",
  user_id: "user-1",
  folder_id: null,
  title: "Bio",
  content_json: null,
  content_text: "cells",
  content_tsv: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("getDocumentDetail", () => {
  it("returns an owned document", async () => {
    const ctx = createContext({ documents: [{ ...doc }] });
    const result = await getDocumentDetail(ctx, { id: "d1" });
    expect(result.title).toBe("Bio");
  });

  it("throws not_found for another user's document", async () => {
    const ctx = createContext({
      documents: [{ ...doc, id: "d2", user_id: "user-2" }],
    });
    await expect(getDocumentDetail(ctx, { id: "d2" })).rejects.toThrow(
      "Document not found.",
    );
  });
});
