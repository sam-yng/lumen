import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod/v3";
import type { ServiceContext } from "@/server/services/context";
import { getTranscriptDetail } from "@/server/services/transcripts";

const recordingIdSchema = { recordingId: z.string().uuid() } as const;

function userMessage(text: string): GetPromptResult {
  return { messages: [{ role: "user", content: { type: "text", text } }] };
}

function transcriptText(segments: { text: string }[]): string {
  return segments.map((segment) => segment.text).join(" ");
}

export async function buildSummarizeRecordingPrompt(
  ctx: ServiceContext,
  args: { recordingId: string },
): Promise<GetPromptResult> {
  const { segments } = await getTranscriptDetail(ctx, {
    recordingId: args.recordingId,
  });
  const body = transcriptText(segments);
  return userMessage(
    `Summarize the following lecture transcript into concise study notes with key points and definitions.\n\nTranscript:\n${body}`,
  );
}

export async function buildMakeFlashcardsPrompt(
  ctx: ServiceContext,
  args: { recordingId: string },
): Promise<GetPromptResult> {
  const { segments } = await getTranscriptDetail(ctx, {
    recordingId: args.recordingId,
  });
  const body = transcriptText(segments);
  return userMessage(
    `Create question-and-answer flashcards from the following transcript. Return each card as "Q: ... / A: ...".\n\nTranscript:\n${body}`,
  );
}

type RegisterPromptFn = (
  name: string,
  config: { title?: string; description?: string; argsSchema?: unknown },
  // Zod v4 + MCP SDK type instantiation is excessively deep when called directly;
  // cast the registration function but keep the callback parameter explicitly typed.
  cb: (args: {
    recordingId: string;
  }) => GetPromptResult | Promise<GetPromptResult>,
) => unknown;

export function registerMcpPrompts(server: McpServer, ctx: ServiceContext) {
  const rp = server.registerPrompt.bind(server) as unknown as RegisterPromptFn;

  rp(
    "summarize-recording",
    {
      title: "Summarize recording",
      description: "Summarize a recording transcript into study notes.",
      argsSchema: recordingIdSchema,
    },
    (args) => buildSummarizeRecordingPrompt(ctx, args),
  );

  rp(
    "make-flashcards",
    {
      title: "Make flashcards",
      description: "Generate Q&A flashcards from a recording transcript.",
      argsSchema: recordingIdSchema,
    },
    (args) => buildMakeFlashcardsPrompt(ctx, args),
  );
}
