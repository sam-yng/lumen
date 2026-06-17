import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ItemRow } from "@/components/library/library-item-row";
import type { LibrarySnapshot } from "@/server/services/library";

const apiMocks = vi.hoisted(() => ({
  deleteDocument: vi.fn(),
  deleteFileMetadata: vi.fn(),
  deleteFolder: vi.fn(),
  linkTag: vi.fn(),
  unlinkTag: vi.fn(),
  updateDocument: vi.fn(),
  updateFileMetadata: vi.fn(),
  updateFolder: vi.fn(),
}));

vi.mock("@/components/library/library-api", () => ({
  libraryQueryKey: ["library"],
  deleteDocument: apiMocks.deleteDocument,
  deleteFileMetadata: apiMocks.deleteFileMetadata,
  deleteFolder: apiMocks.deleteFolder,
  linkTag: apiMocks.linkTag,
  unlinkTag: apiMocks.unlinkTag,
  updateDocument: apiMocks.updateDocument,
  updateFileMetadata: apiMocks.updateFileMetadata,
  updateFolder: apiMocks.updateFolder,
}));

function snapshot(): LibrarySnapshot {
  return {
    folders: [],
    documents: [],
    files: [],
    recordings: [],
    tags: [],
    tagLinks: [],
  };
}

function renderRow(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ul>{ui}</ul>
    </QueryClientProvider>,
  );
}

async function openDeleteDialog(name: string) {
  fireEvent.pointerDown(screen.getByTitle(`Actions for ${name}`), {
    button: 0,
    ctrlKey: false,
  });
  fireEvent.click(await screen.findByRole("menuitem", { name: /delete/i }));
}

describe("ItemRow delete confirmation", () => {
  it("warns before deleting a document", async () => {
    renderRow(
      <ItemRow
        snapshot={snapshot()}
        type="document"
        item={{
          id: "doc-a",
          user_id: "user-1",
          folder_id: null,
          title: "Lecture notes",
          content_json: null,
          content_text: null,
          content_tsv: null,
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-02T00:00:00.000Z",
        }}
      />,
    );

    await openDeleteDialog("Lecture notes");

    expect(
      await screen.findByText("This note will be permanently deleted."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete note" }),
    ).toBeInTheDocument();
  });

  it("warns before deleting a folder and its contents", async () => {
    renderRow(
      <ItemRow
        snapshot={snapshot()}
        type="folder"
        item={{
          id: "folder-a",
          user_id: "user-1",
          parent_id: null,
          name: "Coursework",
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-02T00:00:00.000Z",
        }}
      />,
    );

    await openDeleteDialog("Coursework");

    expect(
      await screen.findByText(
        "This folder and everything inside it will be permanently deleted.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete folder and contents" }),
    ).toBeInTheDocument();
  });
});
