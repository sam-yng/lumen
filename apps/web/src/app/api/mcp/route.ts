// apps/web/src/app/api/mcp/route.ts
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getMcpServiceContext } from "@/server/mcp/auth";
import { buildMcpServer } from "@/server/mcp/server";

export async function POST(request: Request): Promise<Response> {
  const ctx = await getMcpServiceContext(request);
  if (!ctx) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const server = buildMcpServer(ctx);
  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless: no session persistence — fits Vercel function execution.
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}
