"use client";

import {
  File as FileIcon,
  FileText,
  Folder,
  FolderInput,
  Mic,
  MoreHorizontal,
  Pencil,
  Tag,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  ConfirmDialog,
  SelectDialog,
  TextInputDialog,
} from "./library-dialogs";
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
  live: "bg-[var(--danger-soft)] text-[var(--danger)] ring-1 ring-[color-mix(in_oklch,var(--danger),transparent_65%)]",
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
    <div className="mt-1.5 flex flex-wrap gap-1">
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
  const attachTag = useLibraryMutation(linkTag);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);

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

  const availableTags = snapshot.tags.filter(
    (tag) =>
      !snapshot.tagLinks.some(
        (tagLink) =>
          tagLink.target_type === targetType &&
          tagLink.target_id === item.id &&
          tagLink.tag_id === tag.id,
      ),
  );

  // Radix closes the menu after onSelect and restores focus; mounting a
  // dialog in the same tick lets that teardown dismiss it. Defer one tick.
  function openAfterMenuCloses(open: (value: boolean) => void) {
    setTimeout(() => open(true), 0);
  }

  function openItem() {
    if (type === "folder") onOpenFolder?.(item.id);
    if (type === "document") onOpenDocument?.(item.id);
    if (recording) onOpenRecording?.(recording.id);
  }

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

  function applyMove(folderId: string) {
    const dest = folderId === "" ? null : folderId;
    if (type === "folder") {
      moveFolderMutation.mutate({ id: item.id, parentId: dest });
    }
    if (type === "document") {
      moveDocumentMutation.mutate({ id: item.id, folderId: dest });
    }
    if (type === "file")
      moveFileMutation.mutate({ id: item.id, folderId: dest });
  }

  const meta =
    type === "file" && "mime_type" in item
      ? `${item.mime_type ?? "file"} · ${item.size_bytes} bytes`
      : type === "folder"
        ? "Folder"
        : "Rich-text note";

  return (
    <li className="group flex items-start gap-2 border-b border-[var(--border-soft)] py-2.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={openItem}
          className="flex min-h-[44px] w-full min-w-0 items-center gap-3 rounded-md py-1 text-left"
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
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{name}</p>
            <p className="truncate font-mono text-[11.5px] text-[var(--text-3)]">
              {meta}
            </p>
          </div>
        </button>
        {type !== "folder" && (
          <div className="pl-[46px]">
            <TagChips
              snapshot={snapshot}
              targetType={targetType}
              targetId={item.id}
            />
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-2">
        {recording && (
          <span
            className={`l-badge hidden sm:inline-flex ${STATUS_TONE[recording.status]}`}
          >
            {recording.status}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="md:opacity-0 md:transition-opacity md:group-focus-within:opacity-100 md:group-hover:opacity-100 md:aria-expanded:opacity-100"
              title={`Actions for ${name}`}
            >
              <span className="sr-only">Actions for {name}</span>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {type === "document" && (
              <DropdownMenuItem onSelect={() => onOpenDocument?.(item.id)}>
                <FileText /> Open
              </DropdownMenuItem>
            )}
            {recording && (
              <DropdownMenuItem
                onSelect={() => onOpenRecording?.(recording.id)}
              >
                <Mic /> Transcript
              </DropdownMenuItem>
            )}
            {type !== "folder" && availableTags.length > 0 && (
              <DropdownMenuItem
                onSelect={() => openAfterMenuCloses(setTagOpen)}
              >
                <Tag /> Add tag…
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => openAfterMenuCloses(setMoveOpen)}>
              <FolderInput /> Move…
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => openAfterMenuCloses(setRenameOpen)}
            >
              <Pencil /> Rename…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => openAfterMenuCloses(setDeleteOpen)}
            >
              <Trash2 /> Delete…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
      <SelectDialog
        open={tagOpen}
        onOpenChange={setTagOpen}
        title={`Tag ${name}`}
        label="Tag"
        options={availableTags.map((tag) => ({
          value: tag.id,
          label: tag.name,
        }))}
        defaultValue={availableTags[0]?.id ?? ""}
        submitLabel="Add tag"
        onSubmit={(tagId) =>
          attachTag.mutate({ tagId, targetType, targetId: item.id })
        }
      />
      <SelectDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        title={`Move ${name}`}
        label="Destination"
        options={[
          { value: "", label: "Library" },
          ...snapshot.folders
            .filter((folder) => folder.id !== item.id)
            .map((folder) => ({ value: folder.id, label: folder.name })),
        ]}
        defaultValue={
          ("folder_id" in item ? item.folder_id : item.parent_id) ?? ""
        }
        submitLabel="Move"
        onSubmit={applyMove}
      />
    </li>
  );
}
