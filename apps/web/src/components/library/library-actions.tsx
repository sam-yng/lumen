"use client";

import {
  FilePlus,
  FolderPlus,
  Loader2,
  Radio,
  Tags as TagsIcon,
  Upload,
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

const EMPTY_SELECTED_NODE_IDS: ReadonlySet<string> = new Set();
const EMPTY_TAGS: Tables<"tags">[] = [];
const EMPTY_TAG_LINKS: Tables<"tag_links">[] = [];

export function LibraryActions({
  atRoot,
  selectedNodeIds = EMPTY_SELECTED_NODE_IDS,
  tags = EMPTY_TAGS,
  tagLinks = EMPTY_TAG_LINKS,
  tagMutationPending = false,
  tagMutationError = null,
  onSetTag = () => undefined,
  onCreateWorkspace,
  onCreateNote,
  onCreateFolder,
  onUpload,
  onStartLiveSession,
}: {
  atRoot: boolean;
  selectedNodeIds?: ReadonlySet<string>;
  tags?: Tables<"tags">[];
  tagLinks?: Tables<"tag_links">[];
  tagMutationPending?: boolean;
  tagMutationError?: Error | null;
  onSetTag?: (tagId: string, linked: boolean) => void;
  onCreateWorkspace: () => void;
  onCreateNote: () => void;
  onCreateFolder: () => void;
  onUpload: () => void;
  onStartLiveSession: () => void;
}) {
  const tagsDisabled = selectedNodeIds.size === 0 || tagMutationPending;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 border-b border-border-soft pb-4">
        {atRoot ? (
          <Button type="button" size="sm" onClick={onCreateWorkspace}>
            <FolderPlus className="size-4" />
            New workspace
          </Button>
        ) : (
          <>
            <Button type="button" size="sm" onClick={onCreateNote}>
              <FilePlus className="size-4" />
              New note
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCreateFolder}
            >
              <FolderPlus className="size-4" />
              New folder
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onUpload}
            >
              <Upload className="size-4" />
              Upload
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onStartLiveSession}
            >
              <Radio className="size-4" />
              Live session
            </Button>
          </>
        )}

        <DropdownMenu>
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
      </div>

      {tagMutationError ? (
        <p role="alert" className="text-sm text-destructive">
          {tagMutationError.message}
        </p>
      ) : null}
    </div>
  );
}
