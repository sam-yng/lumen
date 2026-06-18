import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getLibraryNodeSnapshot, redirect } = vi.hoisted(() => ({
  getLibraryNodeSnapshot: vi.fn(),
  redirect: vi.fn(),
}));
const nodeId = "11111111-1111-4111-8111-111111111111";

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/server/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/server/db/client", () => ({
  createServerSupabase: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-1", email: "reader@example.com" } },
      }),
    },
  }),
}));
vi.mock("@/server/services/library-nodes", () => ({
  getLibraryNodeSnapshot,
}));
vi.mock("@/components/library/library-workspace", () => ({
  LibraryWorkspace: ({
    view,
    workspaceSlug,
    nodeSlug,
  }: {
    view?: "library" | "recents";
    workspaceSlug?: string;
    nodeSlug?: string;
  }) => (
    <div>
      <span data-testid="view">{view ?? "library"}</span>
      <span data-testid="workspace-slug">{workspaceSlug ?? "root"}</span>
      <span data-testid="node-slug">{nodeSlug ?? "none"}</span>
    </div>
  ),
}));
vi.mock("@/components/library/live-session-route", () => ({
  LiveSessionRoute: ({
    parentId,
    workspaceId,
  }: {
    parentId: string | null;
    workspaceId: string;
  }) => (
    <div data-testid="live-route">
      {workspaceId}:{parentId ?? "root"}
    </div>
  ),
}));
vi.mock("@/components/library/note-route", () => ({
  NoteRoute: ({ nodeId }: { nodeId: string }) => (
    <div data-testid="note-route">{nodeId}</div>
  ),
}));
vi.mock("@/components/library/transcript-route", () => ({
  TranscriptRoute: ({ recordingId }: { recordingId: string }) => (
    <div data-testid="transcript-route">{recordingId}</div>
  ),
}));

import NodePage from "@/app/(app)/[workspaceSlug]/[nodeSlug]/page";
import WorkspacePage from "@/app/(app)/[workspaceSlug]/page";
import LegacyLivePage from "@/app/(app)/library/live/page";
import LegacyNotePage from "@/app/(app)/library/notes/[id]/page";
import LegacyLibraryPage from "@/app/(app)/library/page";
import LegacyRecentsPage from "@/app/(app)/library/recents/page";
import LegacyTagsPage from "@/app/(app)/library/tags/page";
import LegacyTranscriptPage from "@/app/(app)/library/transcripts/[recordingId]/page";
import HomePage from "@/app/(app)/page";

async function renderPage(page: Promise<ReactNode> | ReactNode) {
  render(await page);
}

describe("node navigation pages", () => {
  beforeEach(() => {
    redirect.mockClear();
    getLibraryNodeSnapshot.mockResolvedValue({
      nodes: [
        {
          id: "workspace-1",
          user_id: "user-1",
          workspace_id: "workspace-1",
          parent_id: null,
          kind: "workspace",
          title: "Research",
          slug: "research-abcd1234",
          content_json: null,
          content_text: null,
          content_tsv: null,
          mime_type: null,
          size_bytes: null,
          storage_key: null,
          is_pinned: false,
          created_at: "2026-06-18T00:00:00.000Z",
          updated_at: "2026-06-18T00:00:00.000Z",
        },
      ],
      recordings: [],
      transcripts: [],
      tags: [],
      tagLinks: [],
    });
  });

  it("renders the root library shell without route slugs", async () => {
    await renderPage(HomePage());
    expect(screen.getByTestId("workspace-slug")).toHaveTextContent("root");
    expect(screen.getByTestId("node-slug")).toHaveTextContent("none");
  });

  it("passes the workspace slug to the shared library shell", async () => {
    await renderPage(
      WorkspacePage({
        params: Promise.resolve({ workspaceSlug: "research-abcd1234" }),
      }),
    );
    expect(screen.getByTestId("workspace-slug")).toHaveTextContent(
      "research-abcd1234",
    );
    expect(screen.getByTestId("node-slug")).toHaveTextContent("none");
  });

  it("passes workspace and node slugs to the shared library shell", async () => {
    await renderPage(
      NodePage({
        params: Promise.resolve({
          workspaceSlug: "research-abcd1234",
          nodeSlug: "notes-efab5678",
        }),
      }),
    );
    expect(screen.getByTestId("workspace-slug")).toHaveTextContent(
      "research-abcd1234",
    );
    expect(screen.getByTestId("node-slug")).toHaveTextContent("notes-efab5678");
  });

  it("redirects a leaf note before rendering the workspace shell", async () => {
    getLibraryNodeSnapshot.mockResolvedValue({
      nodes: [
        {
          id: "workspace-1",
          user_id: "user-1",
          workspace_id: "workspace-1",
          parent_id: null,
          kind: "workspace",
          title: "Research",
          slug: "research-abcd1234",
          content_json: null,
          content_text: null,
          content_tsv: null,
          mime_type: null,
          size_bytes: null,
          storage_key: null,
          is_pinned: false,
          created_at: "2026-06-18T00:00:00.000Z",
          updated_at: "2026-06-18T00:00:00.000Z",
        },
        {
          id: nodeId,
          user_id: "user-1",
          workspace_id: "workspace-1",
          parent_id: "workspace-1",
          kind: "page",
          title: "Notes",
          slug: "notes-efab5678",
          content_json: null,
          content_text: null,
          content_tsv: null,
          mime_type: null,
          size_bytes: null,
          storage_key: null,
          is_pinned: false,
          created_at: "2026-06-18T00:00:00.000Z",
          updated_at: "2026-06-18T00:00:00.000Z",
        },
      ],
      recordings: [],
      transcripts: [],
      tags: [],
      tagLinks: [],
    });

    await renderPage(
      NodePage({
        params: Promise.resolve({
          workspaceSlug: "research-abcd1234",
          nodeSlug: "notes-efab5678",
        }),
      }),
    );

    expect(redirect).toHaveBeenCalledWith(`/library/notes/${nodeId}`);
  });

  it("keeps the legacy library route redirected to the root", async () => {
    await LegacyLibraryPage();
    await LegacyTagsPage();
    expect(redirect).toHaveBeenCalledTimes(2);
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("renders recents instead of redirecting it", async () => {
    await renderPage(LegacyRecentsPage());
    expect(screen.getByTestId("view")).toHaveTextContent("recents");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("renders live, note, and transcript standalone routes", async () => {
    await renderPage(
      LegacyLivePage({
        searchParams: Promise.resolve({
          parentId: "22222222-2222-4222-8222-222222222222",
          workspaceId: nodeId,
        }),
      }),
    );
    expect(screen.getByTestId("live-route")).toHaveTextContent(
      `${nodeId}:22222222-2222-4222-8222-222222222222`,
    );

    await renderPage(
      LegacyNotePage({ params: Promise.resolve({ id: nodeId }) }),
    );
    expect(screen.getByTestId("note-route")).toHaveTextContent(nodeId);

    await renderPage(
      LegacyTranscriptPage({
        params: Promise.resolve({ recordingId: nodeId }),
      }),
    );
    expect(screen.getByTestId("transcript-route")).toHaveTextContent(nodeId);
    expect(redirect).not.toHaveBeenCalled();
  });
});
