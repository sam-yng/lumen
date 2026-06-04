"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Clock,
  File as FileIcon,
  FileText,
  Folder,
  FolderPlus,
  Library as LibraryIcon,
  Loader2,
  LogOut,
  Mic,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { DocumentEditor } from "@/components/editor/document-editor";
import { SearchPanel } from "@/components/search/search-panel";
import { RecordAudioForm } from "@/components/transcripts/record-audio-form";
import { TranscriptViewer } from "@/components/transcripts/transcript-viewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Database, Tables } from "@/server/db/database.types";
import type { LibrarySnapshot } from "@/server/services/library";
import {
  createDocument,
  createFolder,
  createTag,
  deleteDocument,
  deleteFileMetadata,
  deleteFolder,
  deleteTag,
  fetchLibrarySnapshot,
  libraryQueryKey,
  linkTag,
  unlinkTag,
  updateDocument,
  updateFileMetadata,
  updateFolder,
  updateTag,
  uploadFile,
} from "./library-api";

type FolderRow = Tables<"folders">;
type DocumentRow = Tables<"documents">;
type FileRow = Tables<"files">;
type RecordingRow = Tables<"recordings">;
type TagRow = Tables<"tags">;
type TagLinkRow = Tables<"tag_links">;
type TargetType = Database["public"]["Enums"]["tag_target_type"];
type SignOutAction = () => Promise<void>;

const STATUS_TONE = {
  pending:
    "bg-[var(--warn-soft)] text-[var(--warn)] ring-1 ring-[color-mix(in_oklch,var(--warn),transparent_65%)]",
  processing:
    "bg-[var(--busy-soft)] text-[var(--busy)] ring-1 ring-[color-mix(in_oklch,var(--busy),transparent_65%)]",
  done: "bg-[var(--ok-soft)] text-[var(--ok)] ring-1 ring-[color-mix(in_oklch,var(--ok),transparent_65%)]",
  failed:
    "bg-[var(--danger-soft)] text-[var(--danger)] ring-1 ring-[color-mix(in_oklch,var(--danger),transparent_65%)]",
} satisfies Record<RecordingRow["status"], string>;

function useLibraryMutation<Input, Output>(
  mutate: (input: Input) => Promise<Output>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutate,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: libraryQueryKey }),
  });
}

function tagsForTarget(
  snapshot: LibrarySnapshot,
  targetType: TargetType,
  targetId: string,
) {
  const tagIds = new Set(
    snapshot.tagLinks
      .filter(
        (link) =>
          link.target_type === targetType && link.target_id === targetId,
      )
      .map((link) => link.tag_id),
  );
  return snapshot.tags.filter((tag) => tagIds.has(tag.id));
}

function tagLinkForTarget(
  snapshot: LibrarySnapshot,
  targetType: TargetType,
  targetId: string,
  tagId: string,
) {
  return snapshot.tagLinks.find(
    (link) =>
      link.target_type === targetType &&
      link.target_id === targetId &&
      link.tag_id === tagId,
  );
}

function folderName(snapshot: LibrarySnapshot, folderId: string | null) {
  if (folderId === null) return "Library";
  return (
    snapshot.folders.find((folder) => folder.id === folderId)?.name ?? "Library"
  );
}

function FolderTree({
  folders,
  selectedFolderId,
  onSelect,
}: {
  folders: FolderRow[];
  selectedFolderId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, FolderRow[]>();
    for (const folder of folders) {
      const key = folder.parent_id;
      map.set(key, [...(map.get(key) ?? []), folder]);
    }
    for (const children of map.values()) {
      children.sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [folders]);

  function renderFolders(parentId: string | null, depth = 0) {
    return (childrenByParent.get(parentId) ?? []).map((folder) => (
      <div key={folder.id}>
        <button
          type="button"
          onClick={() => onSelect(folder.id)}
          className={`group relative flex h-[var(--row-h)] w-full items-center gap-2 rounded-md pr-2 text-left text-sm text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-foreground ${
            selectedFolderId === folder.id
              ? "bg-[var(--accent-soft)] font-medium text-[var(--accent-text)]"
              : ""
          }`}
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          {selectedFolderId === folder.id ? (
            <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-primary" />
          ) : null}
          <ChevronRight className="size-3.5 shrink-0 text-[var(--text-4)]" />
          <Folder className="size-4 shrink-0" />
          <span className="truncate">{folder.name}</span>
        </button>
        {renderFolders(folder.id, depth + 1)}
      </div>
    ));
  }

  return (
    <nav className="space-y-1">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`group relative flex h-[var(--row-h)] w-full items-center gap-2 rounded-md px-2 text-left text-sm text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-foreground ${
          selectedFolderId === null
            ? "bg-[var(--accent-soft)] font-medium text-[var(--accent-text)]"
            : ""
        }`}
      >
        {selectedFolderId === null ? (
          <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-primary" />
        ) : null}
        <LibraryIcon className="size-4 shrink-0" />
        <span className="truncate">Library</span>
      </button>
      {renderFolders(null)}
    </nav>
  );
}

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

function ItemRow({
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
  const targetType = type === "file" ? "file" : "document";

  function rename() {
    const nextName = window.prompt("Rename", name);
    if (!nextName) return;
    if (type === "folder") renameFolder.mutate({ id: item.id, name: nextName });
    if (type === "document") {
      renameDocument.mutate({ id: item.id, title: nextName });
    }
    if (type === "file") renameFile.mutate({ id: item.id, name: nextName });
  }

  function remove() {
    if (!window.confirm(`Delete ${name}?`)) return;
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
          onClick={rename}
          title={`Rename ${name}`}
        >
          <span className="sr-only">Rename {name}</span>
          <Pencil className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={remove}
          title={`Delete ${name}`}
        >
          <span className="sr-only">Delete {name}</span>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}

function CreateForms({
  selectedFolderId,
}: {
  selectedFolderId: string | null;
}) {
  const folder = useLibraryMutation(createFolder);
  const document = useLibraryMutation(createDocument);
  const file = useLibraryMutation(uploadFile);

  return (
    <div className="grid gap-3 border-b border-[var(--border-soft)] pb-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const formData = new FormData(form);
          const name = String(formData.get("name") ?? "");
          if (!name.trim()) return;
          folder.mutate({ name, parentId: selectedFolderId });
          form.reset();
        }}
      >
        <Input name="name" placeholder="Folder name" />
        <Button type="submit" variant="outline" title="Create folder">
          <span className="sr-only">Create folder</span>
          <FolderPlus className="size-4" />
        </Button>
      </form>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const formData = new FormData(form);
          const title = String(formData.get("title") ?? "");
          if (!title.trim()) return;
          document.mutate({ title, folderId: selectedFolderId });
          form.reset();
        }}
      >
        <Input name="title" placeholder="Document title" />
        <Button type="submit" title="Create document">
          <span className="sr-only">Create document</span>
          <Plus className="size-4" />
        </Button>
      </form>
      <form
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const formData = new FormData(form);
          const upload = formData.get("file");
          if (!(upload instanceof globalThis.File) || upload.size === 0) return;
          file.mutate({ file: upload, folderId: selectedFolderId });
          form.reset();
        }}
      >
        <Input name="file" type="file" aria-label="Upload file" />
        <Button type="submit" variant="outline" title="Upload file">
          <span className="sr-only">Upload file</span>
          <Upload className="size-4" />
        </Button>
      </form>
      <RecordAudioForm
        onSave={(upload) =>
          file.mutate({ file: upload, folderId: selectedFolderId })
        }
      />
    </div>
  );
}

function TagPanel({
  tags,
  selectedTagId,
  onSelectTag,
}: {
  tags: TagRow[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
}) {
  const create = useLibraryMutation(createTag);
  const rename = useLibraryMutation(updateTag);
  const remove = useLibraryMutation(deleteTag);

  return (
    <section className="space-y-3 border-t border-[var(--border-soft)] pt-4">
      <form
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_96px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const formData = new FormData(form);
          const name = String(formData.get("name") ?? "");
          const color = String(formData.get("color") ?? "");
          if (!name.trim()) return;
          create.mutate({ name, color: color || null });
          form.reset();
        }}
      >
        <Input name="name" placeholder="Tag name" />
        <Input name="color" placeholder="#22c55e" />
        <Button type="submit" variant="outline" title="Create tag">
          <span className="sr-only">Create tag</span>
          <Tag className="size-4" />
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={selectedTagId === null ? "default" : "outline"}
          size="sm"
          onClick={() => onSelectTag(null)}
        >
          All
        </Button>
        {tags.map((tag) => (
          <div key={tag.id} className="inline-flex items-center gap-1">
            <Button
              type="button"
              variant={selectedTagId === tag.id ? "default" : "outline"}
              size="sm"
              onClick={() => onSelectTag(tag.id)}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: tag.color ?? "#64748b" }}
              />
              {tag.name}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              title={`Rename ${tag.name}`}
              onClick={() => {
                const name = window.prompt("Rename tag", tag.name);
                if (name) rename.mutate({ id: tag.id, name });
              }}
            >
              <span className="sr-only">Rename {tag.name}</span>
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              title={`Delete ${tag.name}`}
              onClick={() => {
                if (window.confirm(`Delete ${tag.name}?`))
                  remove.mutate(tag.id);
              }}
            >
              <span className="sr-only">Delete {tag.name}</span>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function filterByTag<Item extends DocumentRow | FileRow>(
  items: Item[],
  links: TagLinkRow[],
  targetType: TargetType,
  selectedTagId: string | null,
) {
  if (selectedTagId === null) return items;
  const targetIds = new Set(
    links
      .filter(
        (link) =>
          link.tag_id === selectedTagId && link.target_type === targetType,
      )
      .map((link) => link.target_id),
  );
  return items.filter((item) => targetIds.has(item.id));
}

function LibraryContent({
  snapshot,
  selectedFolderId,
  selectedTagId,
  onSelectFolder,
  onOpenDocument,
  onOpenRecording,
}: {
  snapshot: LibrarySnapshot;
  selectedFolderId: string | null;
  selectedTagId: string | null;
  onSelectFolder: (folderId: string) => void;
  onOpenDocument: (documentId: string) => void;
  onOpenRecording: (recordingId: string) => void;
}) {
  const childFolders =
    selectedTagId === null
      ? snapshot.folders.filter(
          (folder) => folder.parent_id === selectedFolderId,
        )
      : [];
  const documents = filterByTag(
    snapshot.documents.filter(
      (document) => document.folder_id === selectedFolderId,
    ),
    snapshot.tagLinks,
    "document",
    selectedTagId,
  );
  const files = filterByTag(
    snapshot.files.filter((file) => file.folder_id === selectedFolderId),
    snapshot.tagLinks,
    "file",
    selectedTagId,
  );
  const hasItems =
    childFolders.length > 0 || documents.length > 0 || files.length > 0;
  const recordingByFileId = new Map(
    snapshot.recordings.map((recording) => [recording.file_id, recording]),
  );

  return (
    <div className="space-y-6">
      {childFolders.length > 0 ? (
        <section>
          <h3 className="mb-2 font-mono text-[11.5px] font-medium text-[var(--text-3)] uppercase">
            Folders
          </h3>
          <ul className="rounded-md border border-[var(--border-soft)] bg-[var(--surface)] px-3">
            {childFolders.map((folder) => (
              <ItemRow
                key={folder.id}
                snapshot={snapshot}
                item={folder}
                type="folder"
                onOpenFolder={onSelectFolder}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {documents.length > 0 || files.length > 0 ? (
        <section>
          <h3 className="mb-2 font-mono text-[11.5px] font-medium text-[var(--text-3)] uppercase">
            Notes & files
          </h3>
          <ul className="rounded-md border border-[var(--border-soft)] bg-[var(--surface)] px-3">
            {documents.map((document) => (
              <ItemRow
                key={document.id}
                snapshot={snapshot}
                item={document}
                type="document"
                onOpenDocument={onOpenDocument}
              />
            ))}
            {files.map((file) => (
              <ItemRow
                key={file.id}
                snapshot={snapshot}
                item={file}
                type="file"
                recording={recordingByFileId.get(file.id) ?? null}
                onOpenRecording={onOpenRecording}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {!hasItems && (
        <div className="grid min-h-80 place-items-center rounded-md border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-8 text-center">
          <div className="max-w-sm">
            <div className="mx-auto grid size-12 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
              <FileText className="size-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Nothing here yet</h3>
            <p className="mt-1 text-sm text-[var(--text-3)]">
              Create a note, upload a file, or record audio in this folder.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function LibraryWorkspace({
  signOutAction,
  userEmail,
}: {
  signOutAction: SignOutAction;
  userEmail: string;
}) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  );
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(
    null,
  );
  const quickCreateDocument = useLibraryMutation(createDocument);
  const { data, error, isLoading } = useQuery({
    queryKey: libraryQueryKey,
    queryFn: fetchLibrarySnapshot,
  });

  if (isLoading) {
    return (
      <div className="grid min-h-96 place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="grid min-h-96 place-items-center text-sm text-destructive">
        {error instanceof Error ? error.message : "Could not load library."}
      </div>
    );
  }

  const selectedDocument =
    data.documents.find((document) => document.id === selectedDocumentId) ??
    null;
  const selectedRecording =
    data.recordings.find((recording) => recording.id === selectedRecordingId) ??
    null;

  const selectedTagName = selectedTagId
    ? data.tags.find((tag) => tag.id === selectedTagId)?.name
    : null;

  return (
    <div className="grid h-dvh min-h-0 flex-1 grid-cols-1 overflow-hidden bg-background lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col overflow-hidden border-b border-[var(--border-soft)] bg-[var(--surface)] lg:border-r lg:border-b-0">
        <div className="border-b border-[var(--border-soft)] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="inline-flex items-center gap-2">
              <span className="size-[11px] rounded-full bg-primary shadow-[0_0_24px_var(--accent-glow)]" />
              <h1 className="font-semibold">Lumen</h1>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Settings"
            >
              <Settings className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Button
              type="button"
              onClick={() => {
                const title = window.prompt("New note title", "Untitled note");
                if (title?.trim()) {
                  quickCreateDocument.mutate({
                    title: title.trim(),
                    folderId: selectedFolderId,
                  });
                }
              }}
            >
              <Plus className="size-4" />
              New note
            </Button>
            <Button type="button" variant="outline" size="icon" title="Search">
              <Search className="size-4" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <nav className="mb-4 space-y-1">
            <button
              type="button"
              className="flex h-8 w-full items-center gap-2 rounded-md bg-[var(--accent-soft)] px-2 text-left text-sm font-medium text-[var(--accent-text)]"
            >
              <LibraryIcon className="size-4" />
              Library
            </button>
            <button
              type="button"
              className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)]"
            >
              <Clock className="size-4" />
              Recents
            </button>
            <button
              type="button"
              className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)]"
            >
              <Tag className="size-4" />
              Tags
            </button>
            <button
              type="button"
              className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)]"
            >
              <Sparkles className="size-4 text-[var(--accent-text)]" />
              Ask Lumen
              <span className="ml-auto font-mono text-[10px] text-[var(--text-4)]">
                v2
              </span>
            </button>
          </nav>
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[11.5px] font-medium text-[var(--text-3)] uppercase">
              Library
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title="New folder"
            >
              <FolderPlus className="size-3.5" />
            </Button>
          </div>
          <FolderTree
            folders={data.folders}
            selectedFolderId={selectedFolderId}
            onSelect={(folderId) => {
              setSelectedFolderId(folderId);
              setSelectedDocumentId(null);
              setSelectedRecordingId(null);
            }}
          />
          <TagPanel
            tags={data.tags}
            selectedTagId={selectedTagId}
            onSelectTag={setSelectedTagId}
          />
        </div>
        <div className="border-t border-[var(--border-soft)] p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-full bg-[linear-gradient(135deg,var(--accent),var(--busy))] text-sm font-semibold text-[var(--on-accent)]">
              {userEmail.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">Workspace</p>
              <p className="truncate text-xs text-[var(--text-3)]">
                {userEmail}
              </p>
            </div>
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="ghost"
                size="icon-sm"
                title="Log out"
              >
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      </aside>
      <section className="min-h-0 overflow-auto">
        <div className="sticky top-0 z-20 flex min-h-[52px] items-center justify-between gap-3 border-b border-[var(--border-soft)] bg-background/95 px-4 backdrop-blur lg:px-6">
          <div className="flex min-w-0 items-center gap-2 text-sm text-[var(--text-3)]">
            <button
              type="button"
              className="truncate hover:text-foreground"
              onClick={() => setSelectedFolderId(null)}
            >
              Library
            </button>
            {selectedFolderId ? (
              <>
                <ChevronRight className="size-4 shrink-0" />
                <span className="truncate text-foreground">
                  {folderName(data, selectedFolderId)}
                </span>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="icon-sm" title="Search">
              <Search className="size-4" />
            </Button>
            <Button type="button" variant="outline" size="sm">
              <Upload className="size-4" />
              Upload
            </Button>
            <Button type="button" size="sm">
              <Plus className="size-4" />
              New note
            </Button>
          </div>
        </div>
        <div className="p-4 lg:p-6">
          <div className="mb-5">
            <h2 className="text-2xl font-semibold">
              {folderName(data, selectedFolderId)}
            </h2>
            <p className="font-mono text-[11.5px] text-[var(--text-3)]">
              {selectedTagName
                ? `Filtered by ${selectedTagName}`
                : `${data.folders.length + data.documents.length + data.files.length} items`}
            </p>
          </div>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11.5px] text-[var(--text-3)]">
              Filter
            </span>
            <Button
              type="button"
              variant={selectedTagId === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTagId(null)}
            >
              All
            </Button>
            {data.tags.map((tag) => (
              <Button
                key={tag.id}
                type="button"
                variant={selectedTagId === tag.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTagId(tag.id)}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: tag.color ?? "var(--accent)" }}
                />
                {tag.name}
              </Button>
            ))}
          </div>
          <SearchPanel
            onOpenDocument={(documentId) => {
              setSelectedRecordingId(null);
              setSelectedDocumentId(documentId);
            }}
            onOpenTranscript={(recordingId) => {
              setSelectedDocumentId(null);
              setSelectedRecordingId(recordingId);
            }}
            onSelectFile={(_fileId, folderId) => {
              setSelectedFolderId(folderId);
              setSelectedTagId(null);
              setSelectedDocumentId(null);
              setSelectedRecordingId(null);
            }}
          />
          <div
            className={
              selectedDocument
                ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]"
                : selectedRecording
                  ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(460px,0.9fr)]"
                  : ""
            }
          >
            <div className="space-y-5">
              <CreateForms selectedFolderId={selectedFolderId} />
              <LibraryContent
                snapshot={data}
                selectedFolderId={selectedFolderId}
                selectedTagId={selectedTagId}
                onSelectFolder={(folderId) => {
                  setSelectedFolderId(folderId);
                  setSelectedDocumentId(null);
                  setSelectedRecordingId(null);
                }}
                onOpenDocument={(documentId) => {
                  setSelectedRecordingId(null);
                  setSelectedDocumentId(documentId);
                }}
                onOpenRecording={(recordingId) => {
                  setSelectedDocumentId(null);
                  setSelectedRecordingId(recordingId);
                }}
              />
            </div>
            {selectedDocument && (
              <DocumentEditor
                key={selectedDocument.id}
                document={selectedDocument}
              />
            )}
            {selectedRecording && (
              <TranscriptViewer
                key={selectedRecording.id}
                recording={selectedRecording}
                onClose={() => setSelectedRecordingId(null)}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
