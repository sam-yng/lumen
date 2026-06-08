import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildMcpServer } from "@/server/mcp/server";
import type { ServiceContext } from "@/server/services/context";

export type AnthropicToolDef = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
};

export type McpBridge = {
  tools: AnthropicToolDef[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<string>;
  close: () => Promise<void>;
};

/** Connect an in-memory MCP client to the same server external hosts use. */
export async function connectMcpBridge(
  ctx: ServiceContext,
): Promise<McpBridge> {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = buildMcpServer(ctx);
  const client = new Client({ name: "lumen-in-app", version: "2.0.0" });

  const close = async () => {
    // Tear down both ends; allSettled so one failure can't strand the other.
    await Promise.allSettled([client.close(), server.close()]);
  };

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  // listTools runs after connect, before the caller holds a close() handle —
  // if it throws, tear down here or we leak the server/client/transport set.
  let listed: Awaited<ReturnType<Client["listTools"]>>;
  try {
    listed = await client.listTools();
  } catch (error) {
    await close();
    throw error;
  }

  const tools: AnthropicToolDef[] = listed.tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    input_schema: (tool.inputSchema as AnthropicToolDef["input_schema"]) ?? {
      type: "object",
    },
  }));

  return {
    tools,
    async callTool(name, args) {
      const result = await client.callTool({ name, arguments: args });
      const blocks = Array.isArray(result.content) ? result.content : [];
      // Tools currently emit text only; non-text blocks are dropped.
      const text = blocks
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      if (result.isError) throw new Error(text || `Tool ${name} failed`);
      return text;
    },
    close,
  };
}
