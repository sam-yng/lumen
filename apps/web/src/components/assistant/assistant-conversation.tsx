"use client";

import { ArrowLeft, ArrowUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CitedText, SourceCards } from "@/components/assistant/citations";
import {
  type ChatTurn,
  newTurnId,
  useAssistant,
} from "@/components/assistant/use-assistant";
import { Button } from "@/components/ui/button";

export function AssistantConversation() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const assistant = useAssistant();

  function send() {
    // Guard both the click and Enter paths against double-submit while a
    // request is in flight (the button's disabled covers only the click).
    if (assistant.isPending) return;
    const text = draft.trim();
    if (text.length === 0) return;
    const next: ChatTurn[] = [
      ...turns,
      { id: newTurnId(), role: "user", content: text },
    ];
    setTurns(next);
    setDraft("");
    assistant.mutate(next, {
      onSuccess: (response) => {
        if (response.state === "ok") {
          setTurns((current) => [
            ...current,
            {
              id: newTurnId(),
              role: "assistant",
              content: response.message,
              sources: response.sources,
              invalidCitations: response.invalidCitations,
            },
          ]);
        }
      },
    });
  }

  const result = assistant.data;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-[var(--border-soft)] px-4 py-3">
        <Button asChild variant="ghost" size="icon-sm" title="Back to library">
          <Link href="/">
            <span className="sr-only">Back to library</span>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold">Assistant</h1>
          <p className="text-xs text-muted-foreground">
            Answers may be wrong — verify against your notes.
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 text-sm">
          {turns.length === 0 ? (
            <div className="pt-16 text-center">
              <p className="text-lg font-medium">Ask Lumen</p>
              <p className="mt-2 text-muted-foreground">
                Ask about your notes, transcripts, or documents.
              </p>
            </div>
          ) : (
            turns.map((turn) =>
              turn.role === "user" ? (
                <div key={turn.id} className="flex justify-end">
                  <p className="max-w-[80%] rounded-2xl bg-[var(--surface-2)] px-4 py-2 whitespace-pre-wrap">
                    {turn.content}
                  </p>
                </div>
              ) : (
                <div key={turn.id} className="space-y-2">
                  <CitedText text={turn.content} sources={turn.sources ?? []} />
                  {(turn.invalidCitations?.length ?? 0) > 0 ? (
                    <p className="text-xs text-amber-600">
                      {turn.invalidCitations?.join(", ")} could not be matched
                      to a source — treat those claims as unverified.
                    </p>
                  ) : null}
                  <SourceCards sources={turn.sources ?? []} />
                </div>
              ),
            )
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
      </div>

      <div className="border-t border-[var(--border-soft)]">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          <div className="flex items-end gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-2">
            <textarea
              aria-label="Ask the assistant"
              placeholder="Ask…"
              value={draft}
              rows={1}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              className="field-sizing-content max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button
              size="icon"
              onClick={send}
              disabled={assistant.isPending || draft.trim().length === 0}
              aria-label="Send message"
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Enter to send · Shift+Enter for a new line
          </p>
        </div>
      </div>
    </div>
  );
}
