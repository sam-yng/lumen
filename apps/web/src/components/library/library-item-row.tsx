"use client";

import {
  File as FileIcon,
  FileText,
  Folder,
  Mic,
  Pencil,
  Tag,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Database, Tables } from "@/server/db/database.types";
import type { LibrarySnapshot } from "@/server/services/library";
import {
  deleteDocument,
  deleteFileMetadata,
  deleteFolder,
  linkTag,
  unlinkTag,
  updateDocument,
  updateFileMetadata,
  updateFolder,
} from "./library-api";
import { ConfirmDialog, TextInputDialog } from "./library-dialogs";
import { useLibraryMutation } from "./library-hooks";
import { tagLinkForTarget, tagsForTarget } from "./library-tags";

type FolderRow = Tables<"folders">;
type DocumentRow = Tables<"documents">;
type FileRow = Tables<"files">;
type RecordingRow = Tables<"recordings">;
type TargetType = Database["public"]["Enums"]["tag_target_type"];

export const STATUS_TONE = {
  pending:
    "bg-[var(--warn-soft)] text-[var(--warn)] ring-1 ring-[color-mix(in_oklch,var(--warn),transparent_65%)]",
  processing:
    "bg-[var(--busy-soft)] text-[var(--busy)] ring-1 ring-[color-mix(in_oklch,var(--busy),transparent_65%)]",
  done: "bg-[var(--ok-soft)] text-[var(--ok)] ring-1 ring-[color-mix(in_oklch,var(--ok),transparent_65%)]",
  failed:
    "bg-[var(--danger-soft)] text-[var(--danger)] ring-1 ring-[color-mix(in_oklch,var(--danger),transparent_65%)]",
} satisfies Record<RecordingRow["status"], string>;

function TagChips({
  snapshot,
  targetType,
  targetId,
}: {
  snapshot: LibrarySnapshot;
  targetType: TargetType;
  targetId: string;
}) {
  const unlink = useLibraryMutation(unlinkTag);
  const tags = tagsForTarget(snapshot, targetType, targetId);

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => {
        const link = tagLinkForTarget(snapshot, targetType, targetId, tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => link && unlink.mutate(link.id)}
            className="l-chip border-[var(--border-soft)] bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--border-strong)]"
            aria-label={`Remove ${tag.name} tag`}
            title={`Remove ${tag.name} tag`}
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: tag.color ?? "#64748b" }}
            />
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}

function TagAttachForm({
  snapshot,
  targetType,
  targetId,
}: {
  snapshot: LibrarySnapshot;
  targetType: TargetType;
  targetId: string;
}) {
  const link = useLibraryMutation(linkTag);
  const attached = new Set(
    snapshot.tagLinks
      .filter(
        (tagLink) =>
          tagLink.target_type === targetType && tagLink.target_id === targetId,
      )
      .map((tagLink) => tagLink.tag_id),
  );
  const availableTags = snapshot.tags.filter((tag) => !attached.has(tag.id));

  if (availableTags.length === 0) return null;

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const tagId = String(formData.get("tagId") ?? "");
        if (!tagId) return;
        link.mutate({ tagId, targetType, targetId });
        event.currentTarget.reset();
      }}
    >
      <select
        name="tagId"
        className="h-8 rounded-md border border-input bg-[var(--surface-2)] px-2 text-xs text-foreground outline-none focus-visible:border-[var(--accent-line)] focus-visible:ring-3 focus-visible:ring-[var(--accent-soft)]"
        aria-label="Tag"
      >
        {availableTags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.name}
          </option>
        ))}
      </select>
      <Button type="submit" variant="outline" size="sm">
        <span className="sr-only">Add tag</span>
        <Tag className="size-4" />
      </Button>
    </form>
  );
}

function MoveSelect({
  folders,
  currentFolderId,
  onMove,
}: {
  folders: FolderRow[];
  currentFolderId: string | null;
  onMove: (folderId: string | null) => void;
}) {
  const [value, setValue] = useState(currentFolderId ?? "");

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-8 rounded-md border border-input bg-[var(--surface-2)] px-2 text-xs text-foreground outline-none focus-visible:border-[var(--accent-line)] focus-visible:ring-3 focus-visible:ring-[var(--accent-soft)]"
        aria-label="Move to folder"
      >
        <option value="">Library</option>
        {folders.map((folder) => (
          <option key={folder.id} value={folder.id}>
            {folder.name}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onMove(value === "" ? null : value)}
      >
        Move
      </Button>
    </div>
  );
}

export function ItemRow({
  snapshot,
  item,
  type,
  recording,
  onOpenFolder,
  onOpenDocument,
  onOpenRecording,
}: {
  snapshot: LibrarySnapshot;
  item: FolderRow | DocumentRow | FileRow;
  type: "folder" | "document" | "file";
  recording?: RecordingRow | null;
  onOpenFolder?: (folderId: string) => void;
  onOpenDocument?: (documentId: string) => void;
  onOpenRecording?: (recordingId: string) => void;
}) {
  const renameFolder = useLibraryMutation(updateFolder);
  const renameDocument = useLibraryMutation(updateDocument);
  const renameFile = useLibraryMutation(updateFileMetadata);
  const moveFolderMutation = useLibraryMutation(updateFolder);
  const moveDocumentMutation = useLibraryMutation(updateDocument);
  const moveFileMutation = useLibraryMutation(updateFileMetadata);
  const removeFolder = useLibraryMutation(deleteFolder);
  const removeDocument = useLibraryMutation(deleteDocument);
  const removeFile = useLibraryMutation(deleteFileMetadata);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const icon =
    type === "folder" ? (
      <Folder className="size-5" />
    ) : type === "document" ? (
      <FileText className="size-5" />
    ) : recording ? (
      <Mic className="size-5" />
    ) : (
      <FileIcon className="size-5" />
    );
  const name = "title" in item ? item.title : item.name;
  const targetType: TargetType = type === "file" ? "file" : "document";

  function applyRename(nextName: string) {
    if (type === "folder") renameFolder.mutate({ id: item.id, name: nextName });
    if (type === "document") {
      renameDocument.mutate({ id: item.id, title: nextName });
    }
    if (type === "file") renameFile.mutate({ id: item.id, name: nextName });
  }

  function applyDelete() {
    if (type === "folder") removeFolder.mutate(item.id);
    if (type === "document") removeDocument.mutate(item.id);
    if (type === "file") removeFile.mutate(item.id);
  }

  const meta =
    type === "file" && "mime_type" in item
      ? `${item.mime_type ?? "file"} · ${item.size_bytes} bytes`
      : type === "folder"
        ? "Folder"
        : "Rich-text note";

  return (
    <li className="group grid min-h-[58px] gap-3 border-b border-[var(--border-soft)] py-3 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0 space-y-2">
        <button
          type="button"
          onClick={() => {
            if (type === "folder") onOpenFolder?.(item.id);
            if (type === "document") onOpenDocument?.(item.id);
            if (recording) onOpenRecording?.(recording.id);
          }}
          className="flex min-w-0 items-center gap-3 rounded-md text-left"
        >
          <div
            className={`grid size-[34px] shrink-0 place-items-center rounded-md border ${
              recording
                ? "border-[var(--busy-soft)] bg-[var(--busy-soft)] text-[var(--busy)]"
                : type === "folder"
                  ? "border-[var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                  : "border-[var(--border-soft)] bg-[var(--surface-2)] text-[var(--text-2)]"
            }`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{name}</p>
            <p className="font-mono text-[11.5px] text-[var(--text-3)]">
              {meta}
            </p>
          </div>
        </button>
        {recording && (
          <span className={`l-badge w-fit ${STATUS_TONE[recording.status]}`}>
            {recording.status}
          </span>
        )}
        {type !== "folder" && (
          <TagChips
            snapshot={snapshot}
            targetType={targetType}
            targetId={item.id}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        {type === "document" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenDocument?.(item.id)}
          >
            Open
          </Button>
        )}
        {recording && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenRecording?.(recording.id)}
          >
            Transcript
          </Button>
        )}
        {type !== "folder" && (
          <TagAttachForm
            snapshot={snapshot}
            targetType={targetType}
            targetId={item.id}
          />
        )}
        <MoveSelect
          folders={snapshot.folders.filter((folder) => folder.id !== item.id)}
          currentFolderId={
            "folder_id" in item ? item.folder_id : item.parent_id
          }
          onMove={(folderId) => {
            if (type === "folder")
              moveFolderMutation.mutate({ id: item.id, parentId: folderId });
            if (type === "document") {
              moveDocumentMutation.mutate({ id: item.id, folderId });
            }
            if (type === "file")
              moveFileMutation.mutate({ id: item.id, folderId });
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => setRenameOpen(true)}
          title={`Rename ${name}`}
        >
          <span className="sr-only">Rename {name}</span>
          <Pencil className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => setDeleteOpen(true)}
          title={`Delete ${name}`}
        >
          <span className="sr-only">Delete {name}</span>
          <Trash2 className="size-4" />
        </Button>
      </div>
      <TextInputDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title={`Rename ${name}`}
        label="Name"
        defaultValue={name}
        submitLabel="Rename"
        onSubmit={applyRename}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${name}?`}
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={applyDelete}
      />
    </li>
  );
}
