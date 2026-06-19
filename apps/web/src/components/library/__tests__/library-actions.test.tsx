import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LibraryActions } from "@/components/library/library-actions";
import { tagSelectionState } from "@/components/library/library-tags";
import type { Tables } from "@/server/db/database.types";

function link(id: string, tagId: string, nodeId: string) {
  return { id, tag_id: tagId, node_id: nodeId };
}

const tagLinks: Tables<"tag_links">[] = [
  link("l1", "t1", "n1"),
  link("l2", "t1", "n2"),
  link("l3", "t2", "n1"),
];

function renderActions(
  overrides: Partial<React.ComponentProps<typeof LibraryActions>> = {},
) {
  render(
    <LibraryActions
      atRoot={false}
      onCreateWorkspace={vi.fn()}
      onCreateNote={vi.fn()}
      onCreateFolder={vi.fn()}
      onUpload={vi.fn()}
      onStartLiveSession={vi.fn()}
      {...overrides}
    />,
  );
}

describe("tagSelectionState", () => {
  it("reports unchecked, indeterminate, and checked coverage", () => {
    const selected = new Set(["n1", "n2"]);

    expect(tagSelectionState("t3", selected, tagLinks)).toBe(false);
    expect(tagSelectionState("t2", selected, tagLinks)).toBe("indeterminate");
    expect(tagSelectionState("t1", selected, tagLinks)).toBe(true);
    expect(tagSelectionState("t1", new Set(), tagLinks)).toBe(false);
  });
});

describe("LibraryActions", () => {
  it("keeps tag editing out of the creation toolbar", () => {
    renderActions();

    expect(screen.queryByRole("button", { name: "Tags" })).toBeNull();
  });
});
