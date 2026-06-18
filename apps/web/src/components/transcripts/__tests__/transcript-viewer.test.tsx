import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveDeepLinkMs,
  type TranscriptDeepLink,
} from "@/components/transcripts/transcript-deep-link";
import { TranscriptViewer } from "@/components/transcripts/transcript-viewer";
import type { Tables } from "@/server/db/database.types";

const segments = [
  { id: "seg-1", start_ms: 0, end_ms: 4000 },
  { id: "seg-2", start_ms: 65_000, end_ms: 70_000 },
  { id: "seg-3", start_ms: 90_000, end_ms: 95_000 },
];

describe("resolveDeepLinkMs", () => {
  it("resolves a known segment id to its start", () => {
    expect(resolveDeepLinkMs({ segmentId: "seg-2", tMs: null }, segments)).toBe(
      65_000,
    );
  });

  it("prefers the segment over a timestamp when both are present", () => {
    expect(resolveDeepLinkMs({ segmentId: "seg-2", tMs: 1000 }, segments)).toBe(
      65_000,
    );
  });

  it("falls back to the timestamp for an unknown segment id", () => {
    expect(
      resolveDeepLinkMs({ segmentId: "gone", tMs: 90_000 }, segments),
    ).toBe(90_000);
  });

  it("returns null when there is nothing to resolve (open at top)", () => {
    expect(resolveDeepLinkMs({ segmentId: "gone", tMs: null }, segments)).toBe(
      null,
    );
    expect(resolveDeepLinkMs({ segmentId: null, tMs: null }, segments)).toBe(
      null,
    );
  });
});

const recording = {
  id: "r1",
  user_id: "user-1",
  node_id: "f1",
  status: "done",
  duration_sec: 120,
  error: null,
  created_at: "2026-01-01T00:00:00Z",
} as Tables<"recordings">;

const detail = {
  node: {
    id: "f1",
    title: "Lecture 3.wav",
    size_bytes: 1234,
    mime_type: "audio/wav",
  },
  recording,
  transcript: { id: "t1", language: "en" },
  segments: segments.map((segment, index) => ({
    ...segment,
    transcript_id: "t1",
    seq: index,
    text: `segment ${segment.id} text`,
    speaker: null,
  })),
};

function viewerTree(client: QueryClient, deepLink?: TranscriptDeepLink) {
  return (
    <QueryClientProvider client={client}>
      <TranscriptViewer
        recording={recording}
        deepLink={deepLink}
        onClose={() => {}}
      />
    </QueryClientProvider>
  );
}

function renderViewer(deepLink?: TranscriptDeepLink) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return { client, ...render(viewerTree(client, deepLink)) };
}

describe("TranscriptViewer deep links", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(detail)),
    );
    // jsdom has no Element.scrollTo; the viewer's scroll effect calls it.
    Element.prototype.scrollTo = vi.fn();
  });

  afterEach(() => vi.restoreAllMocks());

  it("highlights and scrolls to the cited segment via ?segment", async () => {
    renderViewer({ segmentId: "seg-2", tMs: null });
    const target = await screen.findByRole("button", {
      name: /segment seg-2 text/,
    });
    await waitFor(() => expect(target.className).toContain("border-l-primary"));
    expect(Element.prototype.scrollTo).toHaveBeenCalled();
    // currentTime jumped to the segment start: 1:05 of 2:00.
    expect(screen.getByText("1:05 / 2:00")).toBeInTheDocument();
  });

  it("re-seeks when a new citation targets the already-open transcript", async () => {
    const { client, rerender } = renderViewer({
      segmentId: "seg-2",
      tMs: null,
    });
    await waitFor(() =>
      expect(screen.getByText("1:05 / 2:00")).toBeInTheDocument(),
    );
    rerender(viewerTree(client, { segmentId: "seg-3", tMs: null }));
    await waitFor(() =>
      expect(screen.getByText("1:30 / 2:00")).toBeInTheDocument(),
    );
    const target = screen.getByRole("button", { name: /segment seg-3 text/ });
    expect(target.className).toContain("border-l-primary");
  });

  it("seeks by timestamp via ?t when no segment was resolved", async () => {
    renderViewer({ segmentId: null, tMs: 90_000 });
    const target = await screen.findByRole("button", {
      name: /segment seg-3 text/,
    });
    await waitFor(() => expect(target.className).toContain("border-l-primary"));
    expect(screen.getByText("1:30 / 2:00")).toBeInTheDocument();
  });

  it("opens at the top without a deep link", async () => {
    renderViewer();
    const first = await screen.findByRole("button", {
      name: /segment seg-1 text/,
    });
    expect(first.className).toContain("border-l-primary");
    expect(screen.getByText("0:00 / 2:00")).toBeInTheDocument();
  });
});
