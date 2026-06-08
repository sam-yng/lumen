"use client";

import { useMutation } from "@tanstack/react-query";

// Turns are plain text. Prior assistant turns are re-sent as strings, so the
// model sees a coherent transcript but not earlier tool_use/tool_result blocks
// — a deliberate v2 tradeoff (no tool context carried across turns).
export type ChatTurn = { role: "user" | "assistant"; content: string };
export type AssistantResponse =
  | {
      state: "ok";
      message: string;
      toolCalls: { name: string; ok: boolean }[];
      stoppedAtCap: boolean;
    }
  | { state: "no_api_key" }
  | { state: "invalid_key" }
  | { state: "rate_limited" }
  | { state: "error" };

export function useAssistant() {
  return useMutation<AssistantResponse, Error, ChatTurn[]>({
    mutationFn: async (messages) => {
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
