"use client";

import Link from "next/link";
import { useState } from "react";
import {
  type ChatTurn,
  useAssistant,
} from "@/components/assistant/use-assistant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AssistantPanel() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const assistant = useAssistant();

  function send() {
    // Guard both the click and Enter paths against double-submit while a
    // request is in flight (the button's disabled covers only the click).
    if (assistant.isPending) return;
    const text = draft.trim();
    if (text.length === 0) return;
    const next: ChatTurn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setDraft("");
    assistant.mutate(next, {
      onSuccess: (response) => {
        if (response.state === "ok") {
          setTurns((current) => [
            ...current,
            { role: "assistant", content: response.message },
          ]);
        }
      },
    });
  }

  const result = assistant.data;

  return (
    <div className="hidden h-full w-80 flex-col border-l bg-card p-4 lg:flex">
      <h2 className="text-sm font-semibold">Assistant</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Answers may be wrong — verify against your notes.
      </p>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto text-sm">
        {turns.length === 0 ? (
          <p className="text-muted-foreground">
            Ask about your notes, transcripts, or documents.
          </p>
        ) : (
          turns.map((turn, index) => (
            <p
              // biome-ignore lint/suspicious/noArrayIndexKey: append-only chat list
              key={index}
              className={turn.role === "user" ? "font-medium" : ""}
            >
              {turn.content}
            </p>
          ))
        )}

        {assistant.isPending ? (
          <p className="text-muted-foreground">Thinking…</p>
        ) : null}

        {result?.state === "ok" && result.toolCalls.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Used:{" "}
            {result.toolCalls
              .map((call) => `${call.name}${call.ok ? "" : " (failed)"}`)
              .join(", ")}
          </p>
        ) : null}

        {result?.state === "ok" && result.stoppedAtCap ? (
          <p className="text-xs text-amber-600">
            Stopped after several steps — ask a follow-up to continue.
          </p>
        ) : null}

        {result?.state === "no_api_key" ? (
          <p className="text-amber-600">
            <Link href="/settings" className="underline">
              Add your Claude API key
            </Link>{" "}
            to enable the assistant.
          </p>
        ) : null}
        {result?.state === "invalid_key" ? (
          <p className="text-destructive">
            Your key was rejected.{" "}
            <Link href="/settings" className="underline">
              Update it
            </Link>
            .
          </p>
        ) : null}
        {result?.state === "rate_limited" ? (
          <p className="text-destructive">
            Rate limited by Anthropic. Try again shortly.
          </p>
        ) : null}
        {result?.state === "error" ? (
          <p className="text-destructive">Something went wrong. Try again.</p>
        ) : null}
      </div>

      <div className="mt-3 flex gap-2">
        <Input
          aria-label="Ask the assistant"
          placeholder="Ask…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") send();
          }}
        />
        <Button onClick={send} disabled={assistant.isPending}>
          Send
        </Button>
      </div>
    </div>
  );
}
