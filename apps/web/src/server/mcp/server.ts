import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMcpPrompts } from "@/server/mcp/prompts";
import { registerMcpResources } from "@/server/mcp/resources";
import { registerMcpTools } from "@/server/mcp/tools";
import type { ServiceContext } from "@/server/services/context";

export function buildMcpServer(ctx: ServiceContext): McpServer {
  const server = new McpServer({ name: "lumen", version: "2.0.0" });
  registerMcpTools(server, ctx);
  registerMcpResources(server, ctx);
  registerMcpPrompts(server, ctx);
  return server;
}
