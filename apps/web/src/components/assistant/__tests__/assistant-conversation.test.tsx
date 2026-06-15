import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantConversation } from "@/components/assistant/assistant-conversation";

function renderConversation() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AssistantConversation />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("AssistantConversation", () => {
  it("shows the empty state initially", () => {
    renderConversation();
    expect(screen.getByText(/ask about your notes/i)).toBeInTheDocument();
  });

  it("renders the answer after a successful run", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          state: "ok",
          message: "Here you go.",
          toolCalls: [],
          stoppedAtCap: false,
          sources: [],
        }),
      ),
    );
    renderConversation();
    fireEvent.change(screen.getByPlaceholderText(/ask/i), {
      target: { value: "hi" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() =>
      expect(screen.getByText("Here you go.")).toBeInTheDocument(),
    );
  });

  it("renders citation chips and source cards on a cited answer", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          state: "ok",
          message: "The powerhouse [S1], says no one [S9].",
          toolCalls: [{ name: "search_notes", ok: true }],
          stoppedAtCap: false,
          invalidCitations: ["S9"],
          citationSummary: { validMentions: 1, invalidMentions: 1 },
          sources: [
            {
              citationId: "S1",
              kind: "transcript",
              title: "Lecture 3.wav",
              snippet: "the krebs cycle",
              score: 0.8,
              source: {
                transcriptId: "t1",
                recordingId: "r1",
                segmentId: "seg-1",
                startMs: 65000,
                endMs: 70000,
              },
            },
          ],
        }),
      ),
    );
    renderConversation();
    fireEvent.change(screen.getByPlaceholderText(/ask/i), {
      target: { value: "powerhouse?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "S1" })).toHaveAttribute(
        "href",
        "/library/transcripts/r1?segment=seg-1",
      ),
    );
    // The invalid label degrades to a non-link chip plus an honesty note; the
    // source card shows title + timestamp.
    expect(screen.queryByRole("link", { name: "S9" })).not.toBeInTheDocument();
    expect(screen.getByText("S9")).toBeInTheDocument();
    expect(
      screen.getByText(/could not be matched to a source/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Lecture 3.wav")).toBeInTheDocument();
    expect(screen.getByText("1:05")).toBeInTheDocument();
    // Turns POSTed to the API are plain {role, content} — no sources payload.
    const body = JSON.parse(
      String(vi.mocked(fetchSpy).mock.calls[0]?.[1]?.body),
    );
    expect(body.messages).toEqual([{ role: "user", content: "powerhouse?" }]);
  });

  it("prompts to add a key on no_api_key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ state: "no_api_key" })),
    );
    renderConversation();
    fireEvent.change(screen.getByPlaceholderText(/ask/i), {
      target: { value: "hi" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() =>
      expect(screen.getByText(/add your claude api key/i)).toBeInTheDocument(),
    );
  });
});
