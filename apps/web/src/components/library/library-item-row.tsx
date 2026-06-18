"use client";

import { Check, File as FileIcon, FileText, Folder, Mic } from "lucide-react";
import type { MouseEvent } from "react";
import type { LibraryNode } from "@/server/services/library-nodes";

const iconByKind = {
  workspace: Folder,
  page: FileText,
  file: FileIcon,
  audio: Mic,
} satisfies Record<LibraryNode["kind"], typeof Folder>;

const metaByKind = {
  workspace: "Workspace",
  page: "Page",
  file: "File",
  audio: "Audio",
} satisfies Record<LibraryNode["kind"], string>;

export function ItemRow({
  node,
  isSelected,
  selectionIndex,
  disabled = false,
  onSelect,
  onOpen,
}: {
  node: LibraryNode;
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
      : metaByKind[node.kind];

  return (
    <li
      data-selection-index={selectionIndex}
      className={`group border-b border-[var(--border-soft)] last:border-b-0 ${
        isSelected
          ? "rounded-md bg-[var(--accent-soft)] outline outline-1 outline-[var(--accent-line)]"
          : "hover:bg-[var(--surface-2)]"
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
              ? "border-[var(--accent-line)] bg-[var(--canvas)] text-[var(--accent-text)]"
              : "border-[var(--border-soft)] bg-[var(--surface-2)] text-[var(--text-2)]"
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
          <span className="block truncate font-mono text-[11.5px] text-[var(--text-3)]">
            {meta}
          </span>
        </span>
      </button>
    </li>
  );
}
