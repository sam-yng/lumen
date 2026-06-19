import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryWorkspace } from "@/components/library/library-workspace";
import type { LibraryNode } from "@/server/services/library-nodes";

const apiMocks = vi.hoisted(() => ({
  createPage: vi.fn(),
  createTag: vi.fn(),
  createWorkspace: vi.fn(),
  deleteTag: vi.fn(),
  fetchLibrarySnapshot: vi.fn(),
  setTagForNodes: vi.fn(),
  uploadFile: vi.fn(),
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
  setTagForNodes: apiMocks.setTagForNodes,
  uploadFile: apiMocks.uploadFile,
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
  LibraryContent: ({
    selectedIds = new Set<string>(),
    onSelectedIdsChange = () => undefined,
  }: {
    selectedIds?: Set<string>;
    onSelectedIdsChange?: (next: Set<string>) => void;
  }) => (
    <div data-testid="library-content">
      <span>{selectedIds.size} selected</span>
      <button
        type="button"
        onClick={() => onSelectedIdsChange(new Set(["alpha", "beta"]))}
      >
        Select alpha and beta
      </button>
    </div>
  ),
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
vi.mock("@/components/transcripts/record-audio-form", () => ({
  RecordAudioForm: ({ onSave }: { onSave: (file: File) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSave(new File(["audio"], "recording.webm", { type: "audio/webm" }))
      }
    >
      Record audio
    </button>
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
  props: Partial<React.ComponentProps<typeof LibraryWorkspace>> & {
    view?: "library" | "recents";
  } = {},
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
    expect(routerMocks.push).not.toHaveBeenCalled();
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

  it("does not client-redirect a selected audio node during render", async () => {
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
      recordings: [
        {
          id: "recording-1",
          user_id: "user-1",
          node_id: "audio-1",
          status: "done",
          duration_sec: 60,
          error: null,
          created_at: "2026-06-18T00:00:00.000Z",
        },
      ],
      tags: [],
      tagLinks: [],
      transcripts: [],
    });

    renderWorkspace({
      workspaceSlug: "biology-abcd1234",
      nodeSlug: "lecture-audio-11111111",
    });

    expect(
      await screen.findByRole("heading", { name: "Lecture audio" }),
    ).toBeInTheDocument();
    expect(routerMocks.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "New workspace" })).toBeNull();
  });

  it("does not client-redirect a selected leaf note during render", async () => {
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

    expect(
      await screen.findByRole("heading", { name: "Cell biology" }),
    ).toBeVisible();
    expect(routerMocks.push).not.toHaveBeenCalled();
    expect(screen.queryByTestId("note-route")).toBeNull();
  });

  it("restores workspace actions and uploads instant recordings into the selected workspace", async () => {
    apiMocks.fetchLibrarySnapshot.mockResolvedValue({
      nodes: [
        node("workspace-1", "workspace", {
          title: "Biology",
          slug: "biology-abcd1234",
        }),
      ],
      tags: [],
      tagLinks: [],
      recordings: [],
      transcripts: [],
    });

    renderWorkspace({ workspaceSlug: "biology-abcd1234" });

    expect(
      (await screen.findAllByRole("button", { name: "New note" })).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "New folder" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Upload" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Live session" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Record audio" }));
    await waitFor(() =>
      expect(apiMocks.uploadFile.mock.calls[0]?.[0]).toMatchObject({
        parentId: "workspace-1",
      }),
    );
  });

  it("stays on the current route after creating a note", async () => {
    apiMocks.fetchLibrarySnapshot.mockResolvedValue({
      nodes: [
        node("workspace-1", "workspace", {
          title: "Biology",
          slug: "biology-abcd1234",
        }),
      ],
      tags: [],
      tagLinks: [],
      recordings: [],
      transcripts: [],
    });
    apiMocks.createPage.mockResolvedValue(
      node("note-1", "page", {
        title: "New note",
        slug: "new-note-11111111",
      }),
    );

    renderWorkspace({ workspaceSlug: "biology-abcd1234" });

    const actionButtons = await screen.findAllByRole("button", {
      name: "New note",
    });
    fireEvent.click(actionButtons.at(-1) as HTMLElement);
    fireEvent.change(screen.getByPlaceholderText("Untitled note"), {
      target: { value: "New note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create note" }));

    await waitFor(() =>
      expect(apiMocks.createPage.mock.calls[0]?.[0]).toMatchObject({
        title: "New note",
        parentId: "workspace-1",
        role: "note",
      }),
    );
    expect(routerMocks.push).not.toHaveBeenCalled();
  });

  it("persists a tag for selected nodes without clearing selection", async () => {
    apiMocks.fetchLibrarySnapshot.mockResolvedValue({
      nodes: [
        node("workspace-1", "workspace", {
          title: "Biology",
          slug: "biology-abcd1234",
        }),
        node("alpha", "page", { title: "Alpha" }),
        node("beta", "file", { title: "Beta" }),
      ],
      tags: [
        {
          id: "tag-1",
          user_id: "user-1",
          name: "Exam",
          color: "#22c55e",
        },
      ],
      tagLinks: [],
      recordings: [],
      transcripts: [],
    });
    apiMocks.setTagForNodes.mockResolvedValue([]);

    renderWorkspace({ workspaceSlug: "biology-abcd1234" });

    fireEvent.click(
      await screen.findByRole("button", { name: "Select alpha and beta" }),
    );
    fireEvent.pointerDown(screen.getByRole("button", { name: "Tags" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Exam" }));

    await waitFor(() =>
      expect(apiMocks.setTagForNodes).toHaveBeenCalledWith(
        {
          tagId: "tag-1",
          nodeIds: ["alpha", "beta"],
          linked: true,
        },
        expect.anything(),
      ),
    );
    expect(screen.getByText("2 selected")).toBeVisible();
  });

  it("retains selection and surfaces an error when tag persistence fails", async () => {
    apiMocks.fetchLibrarySnapshot.mockResolvedValue({
      nodes: [
        node("workspace-1", "workspace", {
          title: "Biology",
          slug: "biology-abcd1234",
        }),
        node("alpha", "page", { title: "Alpha" }),
        node("beta", "file", { title: "Beta" }),
      ],
      tags: [
        {
          id: "tag-1",
          user_id: "user-1",
          name: "Exam",
          color: "#22c55e",
        },
      ],
      tagLinks: [],
      recordings: [],
      transcripts: [],
    });
    apiMocks.setTagForNodes.mockRejectedValue(
      new Error("Could not update tags."),
    );

    renderWorkspace({ workspaceSlug: "biology-abcd1234" });

    fireEvent.click(
      await screen.findByRole("button", { name: "Select alpha and beta" }),
    );
    fireEvent.pointerDown(screen.getByRole("button", { name: "Tags" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Exam" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not update tags.",
    );
    expect(screen.getByText("2 selected")).toBeVisible();
    await waitFor(() =>
      expect(apiMocks.fetchLibrarySnapshot).toHaveBeenCalledTimes(2),
    );
  });

  it("renders a recents view for recently updated notes", async () => {
    apiMocks.fetchLibrarySnapshot.mockResolvedValue({
      nodes: [
        node("workspace-1", "workspace", {
          title: "Biology",
          slug: "biology-abcd1234",
        }),
        node("old-note", "page", {
          title: "Old note",
          updated_at: "2026-06-17T00:00:00.000Z",
        }),
        node("new-note", "page", {
          title: "New note",
          updated_at: "2026-06-18T00:00:00.000Z",
        }),
        node("file-1", "file", { title: "Syllabus.pdf" }),
      ],
      tags: [],
      tagLinks: [],
      recordings: [],
      transcripts: [],
    });

    renderWorkspace({ view: "recents" });

    expect(
      await screen.findByRole("heading", { name: "Recents" }),
    ).toBeVisible();
    const recentsList = screen.getByRole("list", {
      name: "Recently updated notes",
    });
    const newNote = within(recentsList).getByRole("button", {
      name: /New note/,
    });
    const oldNote = within(recentsList).getByRole("button", {
      name: /Old note/,
    });
    expect(newNote.compareDocumentPosition(oldNote)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.queryByText("Syllabus.pdf")).toBeNull();
  });
});
