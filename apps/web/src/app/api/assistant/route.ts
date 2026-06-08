import { z } from "zod";
import {
  getRouteServiceContext,
  parseJsonBody,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { getDecryptedApiKey } from "@/server/services/ai-credentials";
import {
  type AssistantMessage,
  anthropicForKey,
  runAssistant,
} from "@/server/services/assistant";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.unknown(),
      }),
    )
    .min(1)
    .max(50),
});

function statusOf(error: unknown): number | undefined {
  return typeof error === "object" && error !== null && "status" in error
    ? (error as { status?: number }).status
    : undefined;
}

export async function POST(request: Request) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const apiKey = await getDecryptedApiKey(ctx);
  if (!apiKey) return Response.json({ state: "no_api_key" });

  try {
    const result = await runAssistant(ctx, {
      anthropic: anthropicForKey(apiKey),
      messages: parsed.data.messages as AssistantMessage[],
    });
    return Response.json({ state: "ok", ...result });
  } catch (error) {
    const status = statusOf(error);
    if (status === 401 || status === 403)
      return Response.json({ state: "invalid_key" });
    if (status === 429) return Response.json({ state: "rate_limited" });
    console.error("Assistant run failed", error);
    return Response.json({ state: "error" });
  }
}
