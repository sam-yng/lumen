import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LibraryItemActions } from "@/components/library/library-item-actions";
import type { Tables } from "@/server/db/database.types";

const tags: Tables<"tags">[] = [
  { id: "t1", user_id: "user-1", name: "Exam", color: "#22c55e" },
  { id: "t2", user_id: "user-1", name: "Review", color: null },
  { id: "t3", user_id: "user-1", name: "Later", color: "#f59e0b" },
];

const tagLinks: Tables<"tag_links">[] = [
  { id: "l1", tag_id: "t1", node_id: "n1" },
  { id: "l2", tag_id: "t1", node_id: "n2" },
  { id: "l3", tag_id: "t2", node_id: "n1" },
];

function renderActions(
  overrides: Partial<React.ComponentProps<typeof LibraryItemActions>> = {},
) {
  const onSetTag = vi.fn();
  render(
    <LibraryItemActions
      selectedCount={0}
      selectedNodeIds={new Set<string>()}
      tags={tags}
      tagLinks={tagLinks}
      tagMutationPending={false}
      tagMutationError={null}
      isBusy={false}
      onMove={vi.fn()}
      onSetTag={onSetTag}
      onDelete={vi.fn()}
      onClear={vi.fn()}
      {...overrides}
    />,
  );
  return { onSetTag };
}

describe("LibraryItemActions tag menu", () => {
  it("places Tags between Move and Delete", () => {
    renderActions();

    expect(
      screen.getAllByRole("button").map((button) => button.textContent?.trim()),
    ).toEqual(["Move", "Tags", "Delete", "Clear"]);
  });

  it("keeps Tags visible and disabled without a selection", () => {
    renderActions();

    expect(screen.getByRole("button", { name: "Tags" })).toBeDisabled();
  });

  it("disables Tags while a mutation is pending", () => {
    renderActions({
      selectedCount: 1,
      selectedNodeIds: new Set(["n1"]),
      tagMutationPending: true,
    });

    expect(screen.getByRole("button", { name: "Tags" })).toBeDisabled();
  });

  it("renders tri-state items and applies the safe desired state", () => {
    const { onSetTag } = renderActions({
      selectedCount: 2,
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
    renderActions({
      selectedCount: 1,
      selectedNodeIds: new Set(["n1"]),
      tags: [],
    });

    fireEvent.pointerDown(screen.getByRole("button", { name: "Tags" }), {
      button: 0,
      ctrlKey: false,
    });

    expect(screen.getByText("No tags created yet")).toBeVisible();
  });

  it("renders mutation failures next to the selection actions", () => {
    renderActions({ tagMutationError: new Error("Could not update tags.") });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not update tags.",
    );
  });
});
