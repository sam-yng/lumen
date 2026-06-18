import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LibraryFilterChips } from "@/components/library/library-filter-chips";
import { LibrarySidebar } from "@/components/library/library-sidebar";
import { filterNodesBySelectedTags } from "@/components/library/library-tags";
import type { LibraryNode } from "@/server/services/library-nodes";

const apiMocks = vi.hoisted(() => ({
  createTag: vi.fn(),
  deleteTag: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("@/components/library/library-api", async (importOriginal) => ({
  ...(await importOriginal()),
  createTag: apiMocks.createTag,
  deleteTag: apiMocks.deleteTag,
  updateTag: apiMocks.updateTag,
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
    mime_type: null,
    size_bytes: null,
    storage_key: null,
    is_pinned: false,
    created_at: "2026-06-18T00:00:00.000Z",
    updated_at: "2026-06-18T00:00:00.000Z",
    ...overrides,
  };
}

function renderSidebar(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("LibrarySidebar", () => {
  it("renders pinned containers above the nested Library tree", () => {
    const nodes = [
      node("workspace-1", "workspace", {
        title: "Biology",
        slug: "biology-abcd1234",
      }),
      node("unit-1", "page", {
        title: "Unit one",
        slug: "unit-one-11111111",
        is_pinned: true,
      }),
      node("lesson-1", "page", {
        title: "Lesson",
        slug: "lesson-22222222",
        parent_id: "unit-1",
      }),
    ];

    renderSidebar(
      <LibrarySidebar
        nodes={nodes}
        tags={[]}
        tagLinks={[]}
        selectedTagIds={new Set()}
        selectedNodeId="lesson-1"
        userEmail="demo@lumen.test"
        signOutAction={vi.fn()}
        onCreatePage={vi.fn()}
        onFocusSearch={vi.fn()}
        onToggleTag={vi.fn()}
      />,
    );

    const pinned = screen.getByRole("navigation", { name: "Pinned" });
    const library = screen.getByRole("navigation", { name: "Library tree" });
    expect(
      within(pinned).getByRole("link", { name: "Unit one" }),
    ).toHaveAttribute("href", "/biology-abcd1234/unit-one-11111111");
    expect(
      within(library).getByRole("link", { name: "Biology" }),
    ).toBeVisible();
    expect(
      within(library).getByRole("link", { name: "Unit one" }),
    ).toBeVisible();
    expect(
      within(library).getByRole("link", { name: "Lesson" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      pinned.compareDocumentPosition(library) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders compact tag rows with counts and a delete action in the count slot", () => {
    renderSidebar(
      <LibrarySidebar
        nodes={[]}
        tags={[
          { id: "tag-1", user_id: "user-1", name: "Exam", color: "#22c55e" },
        ]}
        tagLinks={[
          { id: "link-1", tag_id: "tag-1", node_id: "page-1" },
          { id: "link-2", tag_id: "tag-1", node_id: "page-2" },
        ]}
        selectedTagIds={new Set(["tag-1"])}
        selectedNodeId={null}
        userEmail="demo@lumen.test"
        signOutAction={vi.fn()}
        onCreatePage={vi.fn()}
        onFocusSearch={vi.fn()}
        onToggleTag={vi.fn()}
      />,
    );

    const tagRow = screen.getByRole("button", { name: "Filter by Exam" });
    expect(tagRow).toHaveAttribute("aria-pressed", "true");
    expect(within(tagRow).getByText("#")).toBeVisible();
    expect(within(tagRow).getByText("2")).toHaveClass("group-hover:hidden");
    expect(screen.getByTitle("Delete Exam")).toHaveClass(
      "group-hover:inline-flex",
      "group-focus-within:inline-flex",
    );
  });

  it("deselects a selected filter chip", () => {
    const onToggleTag = vi.fn();
    render(
      <LibraryFilterChips
        tags={[{ id: "tag-1", user_id: "user-1", name: "Exam", color: null }]}
        selectedTagIds={new Set(["tag-1"])}
        onToggleTag={onToggleTag}
        onClearTags={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Exam" }));
    expect(onToggleTag).toHaveBeenCalledWith("tag-1");
  });

  it("filters nodes with OR semantics across selected tags", () => {
    const nodes = [
      node("page-1", "page"),
      node("page-2", "page"),
      node("page-3", "page"),
    ];
    const filtered = filterNodesBySelectedTags(
      nodes,
      [
        { id: "link-1", tag_id: "tag-1", node_id: "page-1" },
        { id: "link-2", tag_id: "tag-2", node_id: "page-2" },
        { id: "link-3", tag_id: "tag-3", node_id: "page-3" },
      ],
      new Set(["tag-1", "tag-2"]),
    );

    expect(filtered.map((item) => item.id)).toEqual(["page-1", "page-2"]);
  });
});
