import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildMcpServer } from "@/server/mcp/server";
import type { ServiceContext } from "@/server/services/context";
import {
  type GroundedSource,
  parseSearchNotesResult,
} from "@/server/services/grounded-retrieval";

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

export const ASSISTANT_MODEL = "claude-opus-4-8";
const DEFAULT_MAX_ITERATIONS = 8;

export const SYSTEM_PROMPT = [
  "You are Lumen's study assistant. You help the user reason over their own",
  "notes, transcripts, and documents using the provided tools.",
  "For any factual claim about the user's workspace, use only sources returned",
  "by the tools. Each search_notes source has a citationId such as S1; cite every",
  "supported claim with the matching label in square brackets, for example [S1].",
  "If the returned sources are insufficient to answer, say what is missing",
  "instead of guessing.",
  "When you generate or summarize content, remind the user to verify it.",
  "Be concise.",
].join(" ");

export type AnthropicLike = {
  messages: {
    create(params: Record<string, unknown>): Promise<{
      stop_reason: string;
      content: Array<Record<string, unknown>>;
    }>;
  };
};

export type AssistantMessage = { role: "user" | "assistant"; content: unknown };
export type ToolCallTrace = { name: string; ok: boolean };
export type AssistantResult = {
  message: string;
  toolCalls: ToolCallTrace[];
  stoppedAtCap: boolean;
  /** Citation sources from this turn's search_notes calls, keyed by [S#] label. */
  sources: GroundedSource[];
};

export async function runAssistant(
  ctx: ServiceContext,
  input: {
    anthropic: AnthropicLike;
    messages: AssistantMessage[];
    maxIterations?: number;
  },
): Promise<AssistantResult> {
  const maxIterations = input.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const bridge = await connectMcpBridge(ctx);
  const toolCalls: ToolCallTrace[] = [];
  const messages: AssistantMessage[] = [...input.messages];
  // Citation sources seen this turn. Labels restart at S1 per search_notes
  // call, so a later search overwrites a reused label — matching the sources
  // the model saw most recently when it wrote its final text.
  const sourcesByLabel = new Map<string, GroundedSource>();
  // Most recent assistant text, surfaced if we stop at the iteration cap so the
  // caller never gets a blank turn.
  let lastText = "";

  try {
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const response = await input.anthropic.messages.create({
        model: ASSISTANT_MODEL,
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        system: SYSTEM_PROMPT,
        tools: bridge.tools,
        messages,
      });

      messages.push({ role: "assistant", content: response.content });
      lastText = extractText(response.content) || lastText;

      // Server-side tools (none today, but the seam is open) can pause a turn
      // mid-flight; re-send to resume rather than treating it as final.
      if (response.stop_reason === "pause_turn") {
        continue;
      }

      if (response.stop_reason !== "tool_use") {
        return {
          message: lastText,
          toolCalls,
          stoppedAtCap: false,
          sources: orderedSources(sourcesByLabel),
        };
      }

      const toolUses = response.content.filter(
        (
          block,
        ): block is {
          type: "tool_use";
          id: string;
          name: string;
          input: Record<string, unknown>;
        } => block.type === "tool_use",
      );

      const results: unknown[] = [];
      for (const use of toolUses) {
        try {
          const text = await bridge.callTool(use.name, use.input);
          toolCalls.push({ name: use.name, ok: true });
          if (use.name === "search_notes") {
            const parsed = parseSearchNotesResult(text);
            for (const source of parsed?.sources ?? []) {
              sourcesByLabel.set(source.citationId, source);
            }
          }
          results.push({
            type: "tool_result",
            tool_use_id: use.id,
            content: text,
          });
        } catch (error) {
          toolCalls.push({ name: use.name, ok: false });
          results.push({
            type: "tool_result",
            tool_use_id: use.id,
            content: error instanceof Error ? error.message : "Tool failed.",
            is_error: true,
          });
        }
      }
      messages.push({ role: "user", content: results });
    }

    return {
      message: lastText,
      toolCalls,
      stoppedAtCap: true,
      sources: orderedSources(sourcesByLabel),
    };
  } finally {
    await bridge.close();
  }
}

/** S2 sorts after S1 and before S10 regardless of Map insertion order. */
function orderedSources(byLabel: Map<string, GroundedSource>): GroundedSource[] {
  return [...byLabel.values()].sort(
    (a, b) =>
      Number(a.citationId.replace(/\D/g, "")) -
      Number(b.citationId.replace(/\D/g, "")),
  );
}

function extractText(content: Array<Record<string, unknown>>): string {
  return content
    .filter(
      (block): block is { type: "text"; text: string } => block.type === "text",
    )
    .map((block) => block.text)
    .join("\n")
    .trim();
}

/** Build a production Anthropic client bound to the user's key. */
export function anthropicForKey(apiKey: string): AnthropicLike {
  return new Anthropic({ apiKey }) as unknown as AnthropicLike;
}
