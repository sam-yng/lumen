// apps/web/src/server/mcp/__tests__/isolation.test.ts
import { describe, expect, it } from "vitest";
import { runGetDocument, runListByTag } from "@/server/mcp/tools";
import {
  FakeSupabase,
  otherUserId,
  userId,
} from "@/server/services/__tests__/fake-supabase";
import type { ServiceContext } from "@/server/services/context";

function contextFor(
  id: string,
  tables: Record<string, Record<string, unknown>[]>,
): ServiceContext {
  return { userId: id, supabase: new FakeSupabase(tables) };
}

const userBDocument = {
  id: "doc-b",
  user_id: otherUserId,
  folder_id: null,
  title: "User B secret",
  content_json: null,
  content_text: "secret",
  content_tsv: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("MCP tenant isolation", () => {
  it("user A cannot read user B's document via get_document", async () => {
    const ctx = contextFor(userId, { documents: [{ ...userBDocument }] });
    const result = await runGetDocument(ctx, { id: "doc-b" });
    expect(result.isError).toBe(true);
    expect(String((result.content[0] as { text: string }).text)).toContain(
      "not found",
    );
  });

  it("user A cannot list user B's tag via list_by_tag", async () => {
    const ctx = contextFor(userId, {
      tags: [{ id: "tag-b", user_id: otherUserId, name: "b", color: null }],
      tag_links: [],
      documents: [{ ...userBDocument }],
    });
    const result = await runListByTag(ctx, { tagId: "tag-b" });
    expect(result.isError).toBe(true);
    expect(String((result.content[0] as { text: string }).text)).toContain(
      "not found",
    );
  });
});
