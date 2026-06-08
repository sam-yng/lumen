import { describe, expect, it } from "vitest";
import { createContext } from "@/server/services/__tests__/fake-supabase";
import {
  type AnthropicLike,
  connectMcpBridge,
  runAssistant,
} from "@/server/services/assistant";

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

function fakeAnthropic(
  scripted: Array<{
    stop_reason: string;
    content: Array<Record<string, unknown>>;
  }>,
): AnthropicLike {
  let i = 0;
  return {
    messages: {
      async create() {
        const next = scripted[i] ?? scripted[scripted.length - 1];
        i += 1;
        return next as never;
      },
    },
  };
}

describe("runAssistant", () => {
  it("returns the final text with no tool calls", async () => {
    const ctx = createContext({ documents: [], folders: [] });
    const anthropic = fakeAnthropic([
      {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Hi there." }],
      },
    ]);
    const result = await runAssistant(ctx, {
      anthropic,
      messages: [{ role: "user", content: "hello" }],
    });
    expect(result.message).toBe("Hi there.");
    expect(result.toolCalls).toEqual([]);
  });

  it("executes a tool call then returns the follow-up answer", async () => {
    const ctx = createContext({ documents: [], folders: [] });
    const anthropic = fakeAnthropic([
      {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "create_note",
            input: { title: "Note", folderId: null },
          },
        ],
      },
      {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Created the note." }],
      },
    ]);
    const result = await runAssistant(ctx, {
      anthropic,
      messages: [{ role: "user", content: "make a note called Note" }],
    });
    expect(result.message).toBe("Created the note.");
    expect(result.toolCalls).toEqual([{ name: "create_note", ok: true }]);
  });

  it("stops at the iteration cap", async () => {
    const ctx = createContext({ documents: [], folders: [] });
    const anthropic = fakeAnthropic([
      {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "t",
            name: "search_notes",
            input: { query: "x" },
          },
        ],
      },
    ]);
    const result = await runAssistant(ctx, {
      anthropic,
      messages: [{ role: "user", content: "loop" }],
      maxIterations: 2,
    });
    expect(result.stoppedAtCap).toBe(true);
    expect(result.toolCalls.length).toBe(2);
  });

  it("records a failed tool call and lets the model recover", async () => {
    const ctx = createContext({ documents: [], folders: [] });
    const anthropic = fakeAnthropic([
      {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "does_not_exist",
            input: {},
          },
        ],
      },
      {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "That tool failed." }],
      },
    ]);
    const result = await runAssistant(ctx, {
      anthropic,
      messages: [{ role: "user", content: "use a bad tool" }],
    });
    expect(result.toolCalls).toEqual([{ name: "does_not_exist", ok: false }]);
    expect(result.message).toBe("That tool failed.");
  });
});
