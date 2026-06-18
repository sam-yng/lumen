"use client";

import { Check, File as FileIcon, Folder, Mic, Globe } from "lucide-react";
import type { MouseEvent } from "react";
import type { LibraryNode } from "@/server/services/library-nodes";
import { nodeMetaLabel } from "./library-node-ui";

const iconByKind = {
  workspace: Globe,
  page: Folder,
  file: FileIcon,
  audio: Mic,
} satisfies Record<LibraryNode["kind"], typeof Folder>;

const metaByKind = {
  workspace: "Workspace",
  page: "Folder",
  file: "File",
  audio: "Audio",
} satisfies Record<LibraryNode["kind"], string>;

export function ItemRow({
  node,
  nodes = [node],
  isSelected,
  selectionIndex,
  disabled = false,
  onSelect,
  onOpen,
}: {
  node: LibraryNode;
  nodes?: LibraryNode[];
  isSelected: boolean;
  selectionIndex: number;
  disabled?: boolean;
  onSelect: (event: MouseEvent, nodeId: string) => void;
  onOpen: (nodeId: string) => void;
}) {
  const Icon = iconByKind[node.kind];
  const meta =
    node.kind === "file" || node.kind === "audio"
      ? `${node.mime_type ?? metaByKind[node.kind]} · ${node.size_bytes ?? 0} bytes`
      : nodeMetaLabel(node, nodes);

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
      </button>
    </li>
  );
}
