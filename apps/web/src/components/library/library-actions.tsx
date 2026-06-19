"use client";

import { FilePlus, FolderPlus, Radio, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LibraryActions({
  atRoot,
  onCreateWorkspace,
  onCreateNote,
  onCreateFolder,
  onUpload,
  onStartLiveSession,
}: {
  atRoot: boolean;
  onCreateWorkspace: () => void;
  onCreateNote: () => void;
  onCreateFolder: () => void;
  onUpload: () => void;
  onStartLiveSession: () => void;
}) {
  return (
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
          <Button type="button" variant="outline" size="sm" onClick={onUpload}>
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
    </div>
  );
}
