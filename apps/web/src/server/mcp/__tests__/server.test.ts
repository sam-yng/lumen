import { describe, expect, it } from "vitest";
import { buildMcpServer } from "@/server/mcp/server";
import { createContext } from "@/server/services/__tests__/fake-supabase";

describe("buildMcpServer", () => {
  it("registers the expected tools", async () => {
    const ctx = createContext({});
    const server = buildMcpServer(ctx);
    // McpServer exposes the underlying low-level server; assert tool names.
    const names = Object.keys(
      (server as unknown as { _registeredTools: Record<string, unknown> })
        ._registeredTools,
    );
    expect(names.sort()).toEqual(
      [
        "create_note",
        "get_document",
        "get_transcript",
        "list_by_tag",
        "search_notes",
      ].sort(),
    );
  });
});
