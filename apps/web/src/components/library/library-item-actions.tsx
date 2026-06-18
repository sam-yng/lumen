"use client";

import { FolderInput, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LibraryItemActions({
  selectedCount,
  isBusy,
  onMove,
  onDelete,
  onClear,
}: {
  selectedCount: number;
  isBusy: boolean;
  onMove: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const hasSelection = selectedCount > 0;
  const disabled = isBusy || !hasSelection;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border-strong)] bg-[var(--surface)] p-2 shadow-[var(--shadow-pop)]">
      <span className="mr-auto px-1 text-sm font-medium">
        {selectedCount} selected
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={onMove}
      >
        <FolderInput className="size-4" /> Move
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={disabled}
        onClick={onDelete}
      >
        <Trash2 className="size-4" /> Delete
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={onClear}
      >
        <X className="size-4" /> Clear
      </Button>
    </div>
  );
}
