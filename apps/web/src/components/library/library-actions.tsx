"use client";

import { FolderPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LibraryActions({
  atRoot,
  onCreateWorkspace,
  onCreatePage,
}: {
  atRoot: boolean;
  onCreateWorkspace: () => void;
  onCreatePage: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-soft)] pb-4">
      {atRoot ? (
        <Button type="button" size="sm" onClick={onCreateWorkspace}>
          <FolderPlus className="size-4" />
          New workspace
        </Button>
      ) : (
        <Button type="button" size="sm" onClick={onCreatePage}>
          <Plus className="size-4" />
          New page
        </Button>
      )}
    </div>
  );
}
