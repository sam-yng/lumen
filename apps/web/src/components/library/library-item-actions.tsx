"use client";

import {
  FolderInput,
  Loader2,
  Tags as TagsIcon,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Tables } from "@/server/db/database.types";
import { tagSelectionState } from "./library-tags";

export function LibraryItemActions({
  selectedCount,
  selectedNodeIds,
  tags,
  tagLinks,
  tagMutationPending,
  tagMutationError,
  isBusy,
  onMove,
  onSetTag,
  onDelete,
  onClear,
}: {
  selectedCount: number;
  selectedNodeIds: ReadonlySet<string>;
  tags: Tables<"tags">[];
  tagLinks: Tables<"tag_links">[];
  tagMutationPending: boolean;
  tagMutationError: Error | null;
  isBusy: boolean;
  onMove: () => void;
  onSetTag: (tagId: string, linked: boolean) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const hasSelection = selectedCount > 0;
  const disabled = isBusy || !hasSelection;
  const tagsDisabled = disabled || tagMutationPending;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-surface p-2">
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
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={tagsDisabled}
            >
              {tagMutationPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <TagsIcon className="size-4" />
              )}
              Tags
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {tags.length > 0 ? (
              tags.map((tag) => {
                const state = tagSelectionState(
                  tag.id,
                  selectedNodeIds,
                  tagLinks,
                );
                return (
                  <DropdownMenuCheckboxItem
                    key={tag.id}
                    checked={state}
                    onCheckedChange={() => onSetTag(tag.id, state !== true)}
                    onSelect={(event) => event.preventDefault()}
                  >
                    <span
                      aria-hidden="true"
                      className="size-2.5 rounded-sm bg-border-strong"
                      style={{ backgroundColor: tag.color ?? undefined }}
                    />
                    {tag.name}
                  </DropdownMenuCheckboxItem>
                );
              })
            ) : (
              <DropdownMenuItem disabled>No tags created yet</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
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
      {tagMutationError ? (
        <p role="alert" className="text-sm text-destructive">
          {tagMutationError.message}
        </p>
      ) : null}
    </div>
  );
}
