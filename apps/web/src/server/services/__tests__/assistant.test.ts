import { describe, expect, it } from "vitest";
import { createContext } from "@/server/services/__tests__/fake-supabase";
import { connectMcpBridge } from "@/server/services/assistant";

describe("connectMcpBridge", () => {
  it("lists the MCP tools as Anthropic tool defs", async () => {
    const ctx = createContext({ documents: [], folders: [] });
    const bridge = await connectMcpBridge(ctx);
    try {
      const names = bridge.tools.map((t) => t.name).sort();
      expect(names).toContain("search_notes");
      expect(names).toContain("create_note");
      for (const tool of bridge.tools) {
        expect(tool.input_schema.type).toBe("object");
      }
    } finally {
      await bridge.close();
    }
  });

  it("dispatches a tool call through MCP and returns text", async () => {
    const ctx = createContext({ documents: [], folders: [] });
    const bridge = await connectMcpBridge(ctx);
    try {
      const result = await bridge.callTool("create_note", {
        title: "Hello",
        folderId: null,
      });
      expect(result).toContain("Hello");
    } finally {
      await bridge.close();
    }
  });
});
