import { describe, expect, it } from "vitest";
import { createContext } from "@/server/services/__tests__/fake-supabase";
import { readDocumentResource } from "@/server/mcp/resources";

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

describe("readDocumentResource", () => {
  it("returns document contents for an owned id", async () => {
    const ctx = createContext({ documents: [{ ...doc }] });
    const result = await readDocumentResource(ctx, "d1");
    expect(result.contents[0].text).toContain("Bio");
    expect(result.contents[0].uri).toBe("lumen://document/d1");
  });
});
