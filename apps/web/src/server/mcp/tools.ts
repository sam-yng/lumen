import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod/v3";
import type { ServiceContext } from "@/server/services/context";
import { ServiceError } from "@/server/services/errors";
import { retrieveGroundedSources } from "@/server/services/grounded-retrieval";
import {
  canonicalLibraryNodeRoute,
  createPageNode,
  getLibraryNodeSnapshot,
  getPageNodeDetail,
} from "@/server/services/library-nodes";
import { listPageNodesByTag } from "@/server/services/tags";
import { getTranscriptDetail } from "@/server/services/transcripts";

function ok(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function fail(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Wrap a runner so ServiceError surfaces as an MCP error result, not a throw. */
async function guard(
  run: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    throw error;
  }
}

export function runSearchNotes(ctx: ServiceContext, args: { query: string }) {
  return guard(async () =>
    ok({
      query: args.query,
      sources: await retrieveGroundedSources(ctx, args.query),
    }),
  );
}

export function runGetDocument(ctx: ServiceContext, args: { id: string }) {
  return guard(async () => ok(await getPageNodeDetail(ctx, { id: args.id })));
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
  args: { title: string; parentId: string },
) {
  return guard(async () => {
    const node = await createPageNode(ctx, {
      title: args.title,
      parentId: args.parentId,
    });
    const { nodes } = await getLibraryNodeSnapshot(ctx);
    return ok({ node, route: canonicalLibraryNodeRoute(nodes, node) });
  });
}

export function runListByTag(ctx: ServiceContext, args: { tagId: string }) {
  return guard(async () => {
    const pages = await listPageNodesByTag(ctx, { tagId: args.tagId });
    const { nodes } = await getLibraryNodeSnapshot(ctx);
    return ok(
      pages.map((node) => ({
        node,
        route: canonicalLibraryNodeRoute(nodes, node),
      })),
    );
  });
}

// Zod v4 + MCP SDK type instantiation is excessively deep when registerTool is
// called directly (TS2589); cast the registration function but keep each
// callback's args parameter explicitly typed via the generic.
type RegisterToolFn = <Args>(
  name: string,
  config: { title?: string; description?: string; inputSchema?: unknown },
  cb: (args: Args) => CallToolResult | Promise<CallToolResult>,
) => unknown;

export function registerMcpTools(server: McpServer, ctx: ServiceContext) {
  const rt = server.registerTool.bind(server) as unknown as RegisterToolFn;

  rt<{ query: string }>(
    "search_notes",
    {
      title: "Search notes",
      description:
        "Search the user's pages/notes and transcripts and return citation-ready sources. " +
        "Each source has a stable citationId (S1, S2, …); cite claims only with those labels.",
      inputSchema: { query: z.string().min(1).max(200) },
    },
    (args) => runSearchNotes(ctx, args),
  );

  rt<{ id: string }>(
    "get_document",
    {
      title: "Get page",
      description: "Fetch a single page/note node by id with its stable route.",
      inputSchema: { id: z.string().uuid() },
    },
    (args) => runGetDocument(ctx, args),
  );

  rt<{ recordingId: string }>(
    "get_transcript",
    {
      title: "Get transcript",
      description: "Fetch a recording's transcript and segments.",
      inputSchema: { recordingId: z.string().uuid() },
    },
    (args) => runGetTranscript(ctx, args),
  );

  rt<{ title: string; parentId: string }>(
    "create_note",
    {
      title: "Create note",
      description: "Create a new page/note inside a workspace or page node.",
      inputSchema: {
        title: z.string().min(1).max(200),
        parentId: z.string().uuid(),
      },
    },
    (args) => runCreateNote(ctx, args),
  );

  rt<{ tagId: string }>(
    "list_by_tag",
    {
      title: "List pages by tag",
      description: "List page/note nodes linked to a tag with stable routes.",
      inputSchema: { tagId: z.string().uuid() },
    },
    (args) => runListByTag(ctx, args),
  );
}
