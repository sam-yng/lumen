"use client";

import { useMutation } from "@tanstack/react-query";
import type { GroundedSource } from "@/server/services/grounded-retrieval";

// Turns are plain text. Prior assistant turns are re-sent as strings, so the
// model sees a coherent transcript but not earlier tool_use/tool_result blocks
// — a deliberate v2 tradeoff (no tool context carried across turns).
// Assistant turns also carry the citation sources from their run; id and
// sources are display concerns only and are stripped before turns go back to
// the API.
export type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: GroundedSource[];
  invalidCitations?: string[];
};

export function newTurnId(): string {
  return crypto.randomUUID();
}
export type AssistantResponse =
  | {
      state: "ok";
      message: string;
      toolCalls: { name: string; ok: boolean }[];
      stoppedAtCap: boolean;
      sources: GroundedSource[];
      invalidCitations: string[];
      citationSummary: { validMentions: number; invalidMentions: number };
    }
  | { state: "no_api_key" }
  | { state: "invalid_key" }
  | { state: "rate_limited" }
  | { state: "error" };

export function useAssistant() {
  return useMutation<AssistantResponse, Error, ChatTurn[]>({
    mutationFn: async (turns) => {
      const messages = turns.map(({ role, content }) => ({ role, content }));
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      if (res.status === 401) throw new Error("Please sign in again.");
      return (await res.json()) as AssistantResponse;
    },
  });
}
