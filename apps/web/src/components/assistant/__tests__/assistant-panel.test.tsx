import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantPanel } from "@/components/assistant/assistant-panel";

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AssistantPanel />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("AssistantPanel", () => {
  it("shows the empty state initially", () => {
    renderPanel();
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
        }),
      ),
    );
    renderPanel();
    fireEvent.change(screen.getByPlaceholderText(/ask/i), {
      target: { value: "hi" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() =>
      expect(screen.getByText("Here you go.")).toBeInTheDocument(),
    );
  });

  it("prompts to add a key on no_api_key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ state: "no_api_key" })),
    );
    renderPanel();
    fireEvent.change(screen.getByPlaceholderText(/ask/i), {
      target: { value: "hi" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() =>
      expect(screen.getByText(/add your claude api key/i)).toBeInTheDocument(),
    );
  });
});
