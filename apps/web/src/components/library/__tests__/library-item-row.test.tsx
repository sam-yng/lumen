import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ItemRow } from "@/components/library/library-item-row";
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
