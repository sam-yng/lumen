"use client";

import { Check } from "lucide-react";
import type { MouseEvent } from "react";
import type { Tables } from "@/server/db/database.types";
import type { LibraryNode } from "@/server/services/library-nodes";
import { libraryNodeIcon, nodeMetaLabel } from "./library-node-ui";

const EMPTY_TAGS: Tables<"tags">[] = [];

export function ItemRow({
  node,
  nodes = [node],
  assignedTags = EMPTY_TAGS,
  isSelected,
  selectionIndex,
  disabled = false,
  onSelect,
  onOpen,
}: {
  node: LibraryNode;
  nodes?: LibraryNode[];
  assignedTags?: Tables<"tags">[];
  isSelected: boolean;
  selectionIndex: number;
  disabled?: boolean;
  onSelect: (event: MouseEvent, nodeId: string) => void;
  onOpen: (nodeId: string) => void;
}) {
  const Icon = libraryNodeIcon(node, nodes);
  const meta =
    node.kind === "file" || node.kind === "audio"
      ? `${node.mime_type ?? nodeMetaLabel(node, nodes)} · ${node.size_bytes ?? 0} bytes`
      : nodeMetaLabel(node, nodes);
  const visibleTags = assignedTags.slice(0, 3);
  const hiddenTags = assignedTags.slice(3);
  const hiddenTagNames = hiddenTags.map((tag) => tag.name).join(", ");

  return (
    <li
      data-selection-index={selectionIndex}
      className={`group border-b border-border-soft last:border-b-0 ${
        isSelected
          ? "rounded-md bg-(--accent-soft) outline outline-(--accent-line)"
          : "hover:bg-surface-2"
      }`}
    >
      <button
        type="button"
        aria-pressed={isSelected}
        disabled={disabled}
        onClick={(event) => onSelect(event, node.id)}
        onDoubleClick={() => onOpen(node.id)}
        className="flex min-h-[52px] w-full min-w-0 items-center gap-3 rounded-md px-2 py-1 text-left disabled:cursor-wait"
      >
        <span
          className={`grid size-[34px] shrink-0 place-items-center rounded-md border ${
            isSelected
              ? "border-(--accent-line) bg-canvas text-accent-text"
              : "border-border-soft bg-surface-2 text-text-2"
          }`}
        >
          {isSelected ? (
            <Check className="size-4" />
          ) : (
            <Icon className="size-5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-foreground">
            {node.title}
          </span>
          <span className="block truncate font-mono text-[11.5px] text-text-3">
            {meta}
          </span>
        </span>
        {assignedTags.length > 0 ? (
          <span className="flex max-w-[45%] shrink-0 items-center justify-end gap-1 overflow-hidden whitespace-nowrap">
            <span className="sr-only">Tags:</span>
            {visibleTags.map((tag) => (
              <span
                key={tag.id}
                title={tag.name}
                className="min-w-0 max-w-24 truncate rounded-full border border-border-soft bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-text-2"
              >
                {tag.name}
              </span>
            ))}
            {hiddenTags.length > 0 ? (
              <span
                title={`${hiddenTags.length} more tags: ${hiddenTagNames}`}
                className="shrink-0 rounded-full border border-border-soft bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-text-2"
              >
                <span aria-hidden="true">+{hiddenTags.length}</span>
                <span className="sr-only">
                  {hiddenTags.length} more tags: {hiddenTagNames}
                </span>
              </span>
            ) : null}
          </span>
        ) : null}
      </button>
    </li>
  );
}
