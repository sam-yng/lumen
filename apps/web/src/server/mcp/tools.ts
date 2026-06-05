import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  createDocument,
  getDocumentDetail,
} from "@/server/services/documents";
import type { ServiceContext } from "@/server/services/context";
import { ServiceError } from "@/server/services/errors";
import { searchLibrary } from "@/server/services/search";
import { listDocumentsByTag } from "@/server/services/tags";
import { getTranscriptDetail } from "@/server/services/transcripts";

function ok(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function fail(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Wrap a runner so ServiceError surfaces as an MCP error result, not a throw. */
async function guard(run: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    throw error;
  }
}

export function runSearchNotes(ctx: ServiceContext, args: { query: string }) {
  return guard(async () => ok(await searchLibrary(ctx, args.query)));
}

export function runGetDocument(ctx: ServiceContext, args: { id: string }) {
  return guard(async () => ok(await getDocumentDetail(ctx, { id: args.id })));
}

export function runGetTranscript(
  ctx: ServiceContext,
  args: { recordingId: string },
) {
  return guard(async () =>
    ok(await getTranscriptDetail(ctx, { recordingId: args.recordingId })),
  );
}

export function runCreateNote(
  ctx: ServiceContext,
  args: { title: string; folderId: string | null },
) {
  return guard(async () =>
    ok(await createDocument(ctx, { title: args.title, folderId: args.folderId })),
  );
}

export function runListByTag(ctx: ServiceContext, args: { tagId: string }) {
  return guard(async () => ok(await listDocumentsByTag(ctx, { tagId: args.tagId })));
}

export function registerMcpTools(server: McpServer, ctx: ServiceContext) {
  server.registerTool(
    "search_notes",
    {
      title: "Search notes",
      description: "Full-text search across documents, transcripts, and files.",
      inputSchema: { query: z.string().min(1).max(200) },
    },
    (args) => runSearchNotes(ctx, args),
  );

  server.registerTool(
    "get_document",
    {
      title: "Get document",
      description: "Fetch a single document by id.",
      inputSchema: { id: z.string().uuid() },
    },
    (args) => runGetDocument(ctx, args),
  );

  server.registerTool(
    "get_transcript",
    {
      title: "Get transcript",
      description: "Fetch a recording's transcript and segments.",
      inputSchema: { recordingId: z.string().uuid() },
    },
    (args) => runGetTranscript(ctx, args),
  );

  server.registerTool(
    "create_note",
    {
      title: "Create note",
      description: "Create a new document, optionally inside a folder.",
      inputSchema: {
        title: z.string().min(1).max(200),
        folderId: z.string().uuid().nullable(),
      },
    },
    (args) => runCreateNote(ctx, args),
  );

  server.registerTool(
    "list_by_tag",
    {
      title: "List documents by tag",
      description: "List documents linked to a tag.",
      inputSchema: { tagId: z.string().uuid() },
    },
    (args) => runListByTag(ctx, args),
  );
}
