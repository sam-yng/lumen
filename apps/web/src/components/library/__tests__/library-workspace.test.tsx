import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryWorkspace } from "@/components/library/library-workspace";
import type { LibraryNode } from "@/server/services/library-nodes";

const apiMocks = vi.hoisted(() => ({
  createPage: vi.fn(),
  createTag: vi.fn(),
  createWorkspace: vi.fn(),
  deleteTag: vi.fn(),
  fetchLibrarySnapshot: vi.fn(),
  updateTag: vi.fn(),
}));
const routerMocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));
vi.mock("@/components/library/library-api", () => ({
  libraryQueryKey: ["library"],
  createPage: apiMocks.createPage,
  createTag: apiMocks.createTag,
  createWorkspace: apiMocks.createWorkspace,
  deleteTag: apiMocks.deleteTag,
  fetchLibrarySnapshot: apiMocks.fetchLibrarySnapshot,
  updateTag: apiMocks.updateTag,
}));
vi.mock("@/components/library/library-shell", () => ({
  LibraryShell: ({
    children,
    sidebar,
    topBar,
  }: {
    children: React.ReactNode;
    sidebar: React.ReactNode;
    topBar: React.ReactNode;
  }) => (
    <div>
      <div data-testid="sidebar">{sidebar}</div>
      <div data-testid="topbar">{topBar}</div>
      <main>{children}</main>
    </div>
  ),
}));
vi.mock("@/components/library/library-content", () => ({
  LibraryContent: () => <div data-testid="library-content" />,
}));
vi.mock("@/components/library/note-route", () => ({
  NoteRoute: ({ nodeId }: { nodeId: string }) => (
    <div data-testid="note-route">{nodeId}</div>
  ),
}));
vi.mock("@/components/library/transcript-route", () => ({
  TranscriptRoute: ({ nodeId }: { nodeId: string }) => (
    <div data-testid="transcript-route">{nodeId}</div>
  ),
}));
vi.mock("@/components/search/search-panel", () => ({
  SearchPanel: () => <div data-testid="search-panel" />,
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
    mime_type: kind === "file" || kind === "audio" ? "text/plain" : null,
    size_bytes: kind === "file" || kind === "audio" ? 1 : null,
    storage_key: kind === "file" || kind === "audio" ? `nodes/${id}` : null,
    is_pinned: false,
    created_at: "2026-06-18T00:00:00.000Z",
    updated_at: "2026-06-18T00:00:00.000Z",
    ...overrides,
  };
}

function renderWorkspace(
  props: Partial<React.ComponentProps<typeof LibraryWorkspace>> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LibraryWorkspace
        signOutAction={async () => undefined}
        userEmail="demo@lumen.test"
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe("LibraryWorkspace node routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens a blocking workspace dialog at root when no workspaces exist", async () => {
    apiMocks.fetchLibrarySnapshot.mockResolvedValue({ nodes: [] });
    apiMocks.createWorkspace.mockResolvedValue(
      node("workspace-1", "workspace", {
        title: "Biology",
        slug: "biology-abcd1234",
      }),
    );

    renderWorkspace();

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Create a workspace");
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Workspace name"), {
      target: { value: "Biology" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));

    await waitFor(() =>
      expect(apiMocks.createWorkspace.mock.calls[0]?.[0]).toEqual({
        title: "Biology",
      }),
    );
    await waitFor(() =>
      expect(routerMocks.push).toHaveBeenCalledWith("/biology-abcd1234"),
    );
  });

  it("resolves route slugs and renders breadcrumbs from parent links", async () => {
    apiMocks.fetchLibrarySnapshot.mockResolvedValue({
      nodes: [
        node("workspace-1", "workspace", {
          title: "Biology",
          slug: "biology-abcd1234",
        }),
        node("unit-1", "page", {
          title: "Unit one",
          slug: "unit-one-11111111",
        }),
        node("lesson-1", "page", {
          title: "Lesson",
          slug: "lesson-22222222",
          parent_id: "unit-1",
        }),
      ],
    });

    renderWorkspace({
      workspaceSlug: "biology-abcd1234",
      nodeSlug: "lesson-22222222",
    });

    const topbar = await screen.findByTestId("topbar");
    expect(topbar).toHaveTextContent("Library");
    expect(topbar).toHaveTextContent("Biology");
    expect(topbar).toHaveTextContent("Unit one");
    expect(topbar).toHaveTextContent("Lesson");
    expect(
      await screen.findByRole("heading", { name: "Lesson" }),
    ).toBeInTheDocument();
  });

  it("does not treat a selected leaf node as the Library root", async () => {
    apiMocks.fetchLibrarySnapshot.mockResolvedValue({
      nodes: [
        node("workspace-1", "workspace", {
          title: "Biology",
          slug: "biology-abcd1234",
        }),
        node("audio-1", "audio", {
          title: "Lecture audio",
          slug: "lecture-audio-11111111",
        }),
      ],
    });

    renderWorkspace({
      workspaceSlug: "biology-abcd1234",
      nodeSlug: "lecture-audio-11111111",
    });

    expect(
      await screen.findByRole("heading", { name: "Lecture audio" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("transcript-route")).toHaveTextContent("audio-1");
    expect(screen.queryByRole("button", { name: "New workspace" })).toBeNull();
  });

  it("opens a selected page node in the editor route", async () => {
    apiMocks.fetchLibrarySnapshot.mockResolvedValue({
      nodes: [
        node("workspace-1", "workspace", {
          title: "Biology",
          slug: "biology-abcd1234",
        }),
        node("page-1", "page", {
          title: "Cell biology",
          slug: "cell-biology-11111111",
        }),
      ],
    });

    renderWorkspace({
      workspaceSlug: "biology-abcd1234",
      nodeSlug: "cell-biology-11111111",
    });

    expect(await screen.findByTestId("note-route")).toHaveTextContent("page-1");
  });
});
