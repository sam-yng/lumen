import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LibraryActions } from "@/components/library/library-actions";
import { tagSelectionState } from "@/components/library/library-tags";
import type { Tables } from "@/server/db/database.types";

const tags: Tables<"tags">[] = [
  { id: "t1", user_id: "user-1", name: "Exam", color: "#22c55e" },
  { id: "t2", user_id: "user-1", name: "Review", color: null },
  { id: "t3", user_id: "user-1", name: "Later", color: "#f59e0b" },
];

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
  const onSetTag = vi.fn();
  render(
    <LibraryActions
      atRoot={false}
      selectedNodeIds={new Set<string>()}
      tags={tags}
      tagLinks={tagLinks}
      tagMutationPending={false}
      tagMutationError={null}
      onSetTag={onSetTag}
      onCreateWorkspace={vi.fn()}
      onCreateNote={vi.fn()}
      onCreateFolder={vi.fn()}
      onUpload={vi.fn()}
      onStartLiveSession={vi.fn()}
      {...overrides}
    />,
  );
  return { onSetTag };
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

describe("LibraryActions tag menu", () => {
  it("keeps the Tags trigger visible and disabled without a selection", () => {
    renderActions();

    expect(screen.getByRole("button", { name: "Tags" })).toBeDisabled();
  });

  it("disables the Tags trigger while a mutation is pending", () => {
    renderActions({
      selectedNodeIds: new Set(["n1"]),
      tagMutationPending: true,
    });

    expect(screen.getByRole("button", { name: "Tags" })).toBeDisabled();
  });

  it("renders tri-state items and applies the safe desired state", () => {
    const { onSetTag } = renderActions({
      selectedNodeIds: new Set(["n1", "n2"]),
    });

    fireEvent.pointerDown(screen.getByRole("button", { name: "Tags" }), {
      button: 0,
      ctrlKey: false,
    });

    const checked = screen.getByRole("menuitemcheckbox", { name: "Exam" });
    const mixed = screen.getByRole("menuitemcheckbox", { name: "Review" });
    const unchecked = screen.getByRole("menuitemcheckbox", { name: "Later" });
    expect(checked).toHaveAttribute("aria-checked", "true");
    expect(mixed).toHaveAttribute("aria-checked", "mixed");
    expect(unchecked).toHaveAttribute("aria-checked", "false");

    fireEvent.click(checked);
    expect(onSetTag).toHaveBeenLastCalledWith("t1", false);
    expect(mixed).toBeVisible();

    fireEvent.click(mixed);
    expect(onSetTag).toHaveBeenLastCalledWith("t2", true);
    expect(unchecked).toBeVisible();

    fireEvent.click(unchecked);
    expect(onSetTag).toHaveBeenLastCalledWith("t3", true);
  });

  it("explains when no tags have been created", () => {
    renderActions({ selectedNodeIds: new Set(["n1"]), tags: [] });

    fireEvent.pointerDown(screen.getByRole("button", { name: "Tags" }), {
      button: 0,
      ctrlKey: false,
    });

    expect(screen.getByText("No tags created yet")).toBeVisible();
  });

  it("renders mutation failures next to the action bar", () => {
    renderActions({ tagMutationError: new Error("Could not update tags.") });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not update tags.",
    );
  });
});
