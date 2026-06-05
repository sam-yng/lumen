import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServiceContext } from "@/server/services/context";
import { getDocumentDetail } from "@/server/services/documents";
import { getTranscriptDetail } from "@/server/services/transcripts";

export async function readDocumentResource(
  ctx: ServiceContext,
  id: string,
): Promise<ReadResourceResult> {
  const doc = await getDocumentDetail(ctx, { id });
  return {
    contents: [
      {
        uri: `lumen://document/${id}`,
        mimeType: "application/json",
        text: JSON.stringify(doc, null, 2),
      },
    ],
  };
}

export async function readTranscriptResource(
  ctx: ServiceContext,
  recordingId: string,
): Promise<ReadResourceResult> {
  const detail = await getTranscriptDetail(ctx, { recordingId });
  return {
    contents: [
      {
        uri: `lumen://transcript/${recordingId}`,
        mimeType: "application/json",
        text: JSON.stringify(detail, null, 2),
      },
    ],
  };
}

export function registerMcpResources(server: McpServer, ctx: ServiceContext) {
  server.registerResource(
    "document",
    new ResourceTemplate("lumen://document/{id}", { list: undefined }),
    { title: "Document", description: "A Lumen document by id." },
    (_uri, variables) => readDocumentResource(ctx, String(variables.id)),
  );

  server.registerResource(
    "transcript",
    new ResourceTemplate("lumen://transcript/{recordingId}", {
      list: undefined,
    }),
    { title: "Transcript", description: "A recording transcript by id." },
    (_uri, variables) =>
      readTranscriptResource(ctx, String(variables.recordingId)),
  );
}
