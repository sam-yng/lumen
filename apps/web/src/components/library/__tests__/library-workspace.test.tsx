import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LibraryWorkspace } from "@/components/library/library-workspace";

const apiMocks = vi.hoisted(() => ({
  createDocument: vi.fn(),
  createFolder: vi.fn(),
  fetchLibrarySnapshot: vi.fn(),
  deleteDocument: vi.fn(),
  deleteFileMetadata: vi.fn(),
  deleteFolder: vi.fn(),
  uploadFile: vi.fn(),
  updateDocument: vi.fn(),
  updateFileMetadata: vi.fn(),
  updateFolder: vi.fn(),
  linkTag: vi.fn(),
  unlinkTag: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock("@/components/library/library-api", () => ({
  libraryQueryKey: ["library"],
  createDocument: apiMocks.createDocument,
  createFolder: apiMocks.createFolder,
  deleteDocument: apiMocks.deleteDocument,
  deleteFileMetadata: apiMocks.deleteFileMetadata,
  deleteFolder: apiMocks.deleteFolder,
  fetchLibrarySnapshot: apiMocks.fetchLibrarySnapshot,
  linkTag: apiMocks.linkTag,
  uploadFile: apiMocks.uploadFile,
  updateDocument: apiMocks.updateDocument,
  updateFileMetadata: apiMocks.updateFileMetadata,
  updateFolder: apiMocks.updateFolder,
  unlinkTag: apiMocks.unlinkTag,
}));

vi.mock("@/components/transcripts/record-audio-form", () => ({
  RecordAudioForm: ({ onSave }: { onSave: (file: File) => void }) => (
    <button
      type="button"
      data-testid="mock-record-audio-form"
      onClick={() =>
        onSave(new File(["audio"], "recording.webm", { type: "audio/webm" }))
      }
    >
      Record audio
    </button>
  ),
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
      <div data-testid="library-sidebar">{sidebar}</div>
      <div data-testid="library-topbar">{topBar}</div>
      <main>{children}</main>
    </div>
  ),
}));

vi.mock("@/components/library/library-sidebar", () => ({
  LibrarySidebar: () => <nav aria-label="Library sidebar" />,
}));

vi.mock("@/components/library/library-actions", () => ({
  LibraryActions: () => <div data-testid="library-actions" />,
}));

vi.mock("@/components/search/search-panel", () => ({
  SearchPanel: () => <div data-testid="search-panel" />,
}));

vi.mock("@/components/library/library-filter-chips", () => ({
  LibraryFilterChips: () => <div data-testid="library-filter-chips" />,
}));

function snapshot() {
  return {
    folders: [],
    documents: [],
    files: [],
    recordings: [],
    tags: [],
    tagLinks: [],
  };
}

function renderWorkspace({
  view = "library",
}: {
  view?: "library" | "tags" | "recents";
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LibraryWorkspace
        signOutAction={async () => undefined}
        userEmail="demo@lumen.test"
        view={view as never}
      />
    </QueryClientProvider>,
  );
}

describe("LibraryWorkspace top bar", () => {
  it("uses the recorder with a right-aligned search button instead of the old upload/new-note cluster", async () => {
    apiMocks.fetchLibrarySnapshot.mockResolvedValueOnce(snapshot());

    renderWorkspace();

    const topBar = await screen.findByTestId("library-topbar");
    expect(
      within(topBar).getByTestId("mock-record-audio-form"),
    ).toBeInTheDocument();
    expect(within(topBar).getByTitle("Search")).toBeInTheDocument();
    expect(
      within(topBar).queryByRole("button", { name: /upload/i }),
    ).not.toBeInTheDocument();
    expect(
      within(topBar).queryByRole("button", { name: /new note/i }),
    ).not.toBeInTheDocument();
  });

  it("shows recent documents newest-first without folders or files", async () => {
    apiMocks.fetchLibrarySnapshot.mockResolvedValueOnce({
      folders: [
        {
          id: "folder-a",
          user_id: "user-1",
          parent_id: null,
          name: "Projects",
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      documents: [
        {
          id: "doc-older",
          user_id: "user-1",
          folder_id: null,
          title: "Older note",
          content_json: null,
          content_text: null,
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-10T00:00:00.000Z",
        },
        {
          id: "doc-newer",
          user_id: "user-1",
          folder_id: "folder-a",
          title: "Newer note",
          content_json: null,
          content_text: null,
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-12T00:00:00.000Z",
        },
      ],
      files: [
        {
          id: "file-a",
          user_id: "user-1",
          folder_id: null,
          name: "lecture.pdf",
          mime_type: "application/pdf",
          size_bytes: 42,
          kind: "other",
          storage_key: "metadata/user-1/lecture-pdf",
          created_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      recordings: [],
      tags: [],
      tagLinks: [],
    });

    renderWorkspace({ view: "recents" });

    expect(
      await screen.findByRole("heading", { name: "Recents" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Projects")).not.toBeInTheDocument();
    expect(screen.queryByText("lecture.pdf")).not.toBeInTheDocument();

    const newer = screen.getByText("Newer note");
    const older = screen.getByText("Older note");
    expect(
      newer.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
