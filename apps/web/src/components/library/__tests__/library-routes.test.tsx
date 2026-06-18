import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NoteRoute } from "@/components/library/note-route";
import { TranscriptRoute } from "@/components/library/transcript-route";
import type { LibraryNode } from "@/server/services/library-nodes";

const apiMocks = vi.hoisted(() => ({
  fetchLibrarySnapshot: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/library/library-api", () => ({
  fetchLibrarySnapshot: apiMocks.fetchLibrarySnapshot,
  libraryQueryKey: ["library"],
}));

vi.mock("@/components/editor/document-editor", () => ({
  DocumentEditor: ({ page }: { page: LibraryNode }) => (
    <div data-testid="page-editor">
      {page.title}: {page.content_text}
    </div>
  ),
}));

vi.mock("@/components/transcripts/transcript-viewer", () => ({
  TranscriptViewer: ({ recording }: { recording: { node_id: string } }) => (
    <div data-testid="transcript-viewer">{recording.node_id}</div>
  ),
}));

function node(
  id: string,
  kind: LibraryNode["kind"],
  overrides: Partial<LibraryNode> = {},
): LibraryNode {
  return {
    id,
    user_id: "user-1",
    workspace_id: kind === "workspace" ? id : "workspace-1",
    parent_id: kind === "workspace" ? null : "workspace-1",
    kind,
    title: id,
    slug: `${id}-slug`,
    content_json: null,
    content_text: null,
    content_tsv: null,
    mime_type: kind === "audio" ? "audio/webm" : null,
    size_bytes: kind === "audio" ? 42 : null,
    storage_key: kind === "audio" ? `user-1/${id}` : null,
    is_pinned: false,
    created_at: "2026-06-18T00:00:00Z",
    updated_at: "2026-06-18T00:00:00Z",
    ...overrides,
  };
}

function renderRoute(route: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{route}</QueryClientProvider>,
  );
}

describe("node content routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a page node in the editor", async () => {
    apiMocks.fetchLibrarySnapshot.mockResolvedValue({
      nodes: [
        node("page-1", "page", {
          title: "Cell biology",
          content_text: "Mitochondria",
        }),
      ],
      recordings: [],
      transcripts: [],
      tags: [],
      tagLinks: [],
    });

    renderRoute(<NoteRoute nodeId="page-1" />);

    expect(await screen.findByTestId("page-editor")).toHaveTextContent(
      "Cell biology: Mitochondria",
    );
  });

  it("renders the recording attached to an audio node", async () => {
    apiMocks.fetchLibrarySnapshot.mockResolvedValue({
      nodes: [node("audio-1", "audio", { title: "Lecture audio" })],
      recordings: [
        {
          id: "recording-1",
          user_id: "user-1",
          node_id: "audio-1",
          status: "done",
          duration_sec: 60,
          error: null,
          created_at: "2026-06-18T00:00:00Z",
        },
      ],
      transcripts: [],
      tags: [],
      tagLinks: [],
    });

    renderRoute(<TranscriptRoute nodeId="audio-1" />);

    expect(await screen.findByText("Lecture audio")).toBeVisible();
    expect(await screen.findByTestId("transcript-viewer")).toHaveTextContent(
      "audio-1",
    );
  });
});
