import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { ServiceContext } from "@/server/services/context";
import { getTranscriptDetail } from "@/server/services/transcripts";

function userMessage(text: string): GetPromptResult {
  return { messages: [{ role: "user", content: { type: "text", text } }] };
}

function transcriptText(
  segments: { text: string }[],
): string {
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

export function registerMcpPrompts(server: McpServer, ctx: ServiceContext) {
  server.registerPrompt(
    "summarize-recording",
    {
      title: "Summarize recording",
      description: "Summarize a recording transcript into study notes.",
      argsSchema: { recordingId: z.string().uuid() },
    },
    (args) => buildSummarizeRecordingPrompt(ctx, args),
  );

  server.registerPrompt(
    "make-flashcards",
    {
      title: "Make flashcards",
      description: "Generate Q&A flashcards from a recording transcript.",
      argsSchema: { recordingId: z.string().uuid() },
    },
    (args) => buildMakeFlashcardsPrompt(ctx, args),
  );
}
