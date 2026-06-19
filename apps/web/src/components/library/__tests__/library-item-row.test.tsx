import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ItemRow } from "@/components/library/library-item-row";
import { tagsByNodeId } from "@/components/library/library-tags";
import type { Tables } from "@/server/db/database.types";
import type { LibraryNode } from "@/server/services/library-nodes";

const page: LibraryNode = {
  id: "page-1",
  user_id: "user-1",
  workspace_id: "workspace-1",
  parent_id: "workspace-1",
  kind: "page",
  title: "Lecture notes",
  slug: "lecture-notes-abcd1234",
  content_json: null,
  content_text: null,
  content_tsv: null,
  mime_type: null,
  size_bytes: null,
  storage_key: null,
  is_pinned: false,
  created_at: "2026-06-18T00:00:00.000Z",
  updated_at: "2026-06-18T00:00:00.000Z",
};

describe("ItemRow selection", () => {
  it("forwards click modifiers and opens only on double-click", () => {
    const onSelect = vi.fn();
    const onOpen = vi.fn();
    render(
      <ul>
        <ItemRow
          node={page}
          isSelected={false}
          selectionIndex={3}
          onSelect={onSelect}
          onOpen={onOpen}
        />
      </ul>,
    );

    const rowButton = screen.getByRole("button", { name: /Lecture notes/ });
    fireEvent.click(rowButton);
    fireEvent.click(rowButton, { metaKey: true });
    fireEvent.click(rowButton, { ctrlKey: true });
    fireEvent.click(rowButton, { shiftKey: true });

    expect(onSelect).toHaveBeenCalledTimes(4);
    expect(onSelect.mock.calls[1]?.[0].metaKey).toBe(true);
    expect(onSelect.mock.calls[2]?.[0].ctrlKey).toBe(true);
    expect(onSelect.mock.calls[3]?.[0].shiftKey).toBe(true);
    expect(onSelect).toHaveBeenLastCalledWith(expect.anything(), "page-1");
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.doubleClick(rowButton);
    expect(onOpen).toHaveBeenCalledWith("page-1");
  });

  it("exposes a visible selected state", () => {
    render(
      <ul>
        <ItemRow
          node={page}
          isSelected
          selectionIndex={0}
          onSelect={vi.fn()}
          onOpen={vi.fn()}
        />
      </ul>,
    );

    expect(
      screen.getByRole("button", { name: /Lecture notes/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});

function nodeOf(overrides: Partial<LibraryNode> & { id: string }): LibraryNode {
  return { ...page, ...overrides };
}

function renderRow(
  node: LibraryNode,
  nodes: LibraryNode[] = [node],
  assignedTags: Tables<"tags">[] = [],
) {
  return render(
    <ul>
      <ItemRow
        node={node}
        nodes={nodes}
        assignedTags={assignedTags}
        isSelected={false}
        selectionIndex={0}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
      />
    </ul>,
  );
}

describe("ItemRow display kind", () => {
  it("renders a workspace with the globe icon and Workspace label", () => {
    const { container } = renderRow(
      nodeOf({ id: "ws", kind: "workspace", title: "Biology" }),
    );
    expect(container.querySelector(".lucide-globe")).not.toBeNull();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
  });

  it("renders a page with children as a folder", () => {
    const folder = nodeOf({ id: "folder", kind: "page", title: "Unit 1" });
    const child = nodeOf({ id: "child", kind: "page", parent_id: "folder" });
    const { container } = renderRow(folder, [folder, child]);
    expect(container.querySelector(".lucide-folder")).not.toBeNull();
    expect(screen.getByText("Folder")).toBeInTheDocument();
  });

  it("renders a page with folder content as a folder", () => {
    const folder = nodeOf({
      id: "folder",
      kind: "page",
      title: "Unit 1",
      content_json: { type: "lumen-folder" },
    });
    const { container } = renderRow(folder);
    expect(container.querySelector(".lucide-folder")).not.toBeNull();
    expect(screen.getByText("Folder")).toBeInTheDocument();
  });

  it("renders a childless note page as a file", () => {
    const { container } = renderRow(
      nodeOf({ id: "note", kind: "page", title: "Lecture" }),
    );
    expect(container.querySelector(".lucide-file")).not.toBeNull();
    expect(container.querySelector(".lucide-file-text")).toBeNull();
    expect(screen.getByText("File")).toBeInTheDocument();
  });

  it("renders an uploaded file as an imported file with the FileText icon", () => {
    const { container } = renderRow(
      nodeOf({
        id: "upload",
        kind: "file",
        title: "syllabus.pdf",
        mime_type: "application/pdf",
        size_bytes: 1024,
      }),
    );
    expect(container.querySelector(".lucide-file-text")).not.toBeNull();
    expect(
      screen.getByText("application/pdf · 1024 bytes"),
    ).toBeInTheDocument();
  });

  it("falls back to the Imported File label when an upload has no mime", () => {
    renderRow(
      nodeOf({ id: "upload", kind: "file", title: "blob", size_bytes: 0 }),
    );
    expect(screen.getByText("Imported File · 0 bytes")).toBeInTheDocument();
  });

  it("renders audio with the mic icon", () => {
    const { container } = renderRow(
      nodeOf({
        id: "rec",
        kind: "audio",
        title: "Lecture audio",
        mime_type: "audio/webm",
        size_bytes: 2048,
      }),
    );
    expect(container.querySelector(".lucide-mic")).not.toBeNull();
    expect(screen.getByText("audio/webm · 2048 bytes")).toBeInTheDocument();
  });
});

const rowTags: Tables<"tags">[] = [
  { id: "exam", user_id: "user-1", name: "Exam", color: "#22c55e" },
  { id: "review", user_id: "user-1", name: "Review", color: "#22c55e" },
  { id: "later", user_id: "user-1", name: "Later", color: null },
  { id: "archive", user_id: "user-1", name: "Archive", color: null },
  { id: "urgent", user_id: "user-1", name: "Urgent", color: null },
];

describe("ItemRow tag summary", () => {
  it("groups tags by node in stable snapshot order", () => {
    const links: Tables<"tag_links">[] = [
      { id: "l-review", node_id: page.id, tag_id: "review" },
      { id: "l-missing", node_id: page.id, tag_id: "missing" },
      { id: "l-exam", node_id: page.id, tag_id: "exam" },
    ];

    const grouped = tagsByNodeId(rowTags, links);

    expect(grouped.get(page.id)).toEqual(rowTags.slice(0, 2));
    expect(grouped.has("untagged")).toBe(false);
  });

  it("shows three tag names and summarizes the overflow without wrapping", () => {
    renderRow(page, [page], rowTags);

    const summary = screen.getByText("Tags:").parentElement;
    expect(summary).toHaveClass("whitespace-nowrap");
    expect(screen.getByText("Exam")).toHaveAttribute("title", "Exam");
    expect(screen.getByText("Review")).toHaveAttribute("title", "Review");
    expect(screen.getByText("Later")).toHaveAttribute("title", "Later");
    expect(screen.queryByText("Archive")).toBeNull();
    expect(screen.queryByText("Urgent")).toBeNull();
    const overflow = screen.getByTitle("2 more tags: Archive, Urgent");
    expect(overflow).toHaveTextContent("+2");
    expect(overflow).toHaveTextContent("2 more tags: Archive, Urgent");
    expect(overflow).toHaveAttribute("title", "2 more tags: Archive, Urgent");
  });

  it("renders no tag region for an untagged node", () => {
    renderRow(page);

    expect(screen.queryByText("Tags:")).toBeNull();
  });
});
