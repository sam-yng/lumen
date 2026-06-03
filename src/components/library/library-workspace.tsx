"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  File as FileIcon,
  FileText,
  FileUp,
  Folder,
  FolderPlus,
  Loader2,
  Mic,
  Pencil,
  Tag,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { DocumentEditor } from "@/components/editor/document-editor";
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
          className={`flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted ${
            selectedFolderId === folder.id ? "bg-muted font-medium" : ""
          }`}
          style={{ paddingLeft: 8 + depth * 16 }}
        >
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
        className={`flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted ${
          selectedFolderId === null ? "bg-muted font-medium" : ""
        }`}
      >
        <Folder className="size-4 shrink-0" />
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
            className="inline-flex h-6 items-center gap-1 rounded border px-2 text-xs"
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
        className="h-8 rounded-md border bg-background px-2 text-xs"
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
        className="h-8 rounded-md border bg-background px-2 text-xs"
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
  onOpenDocument,
  onOpenRecording,
}: {
  snapshot: LibrarySnapshot;
  item: FolderRow | DocumentRow | FileRow;
  type: "folder" | "document" | "file";
  recording?: RecordingRow | null;
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

  return (
    <li className="grid gap-3 border-b py-4 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0 space-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-md border bg-muted/40">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{name}</p>
            <p className="text-xs text-muted-foreground">
              {type === "file" && "mime_type" in item
                ? `${item.mime_type} · ${item.size_bytes} bytes`
                : type}
            </p>
          </div>
        </div>
        {recording && (
          <span className="inline-flex h-6 w-fit items-center rounded border px-2 text-xs capitalize text-muted-foreground">
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
      <div className="flex flex-wrap items-center gap-2">
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
          size="sm"
          onClick={rename}
          title={`Rename ${name}`}
        >
          <span className="sr-only">Rename {name}</span>
          <Pencil className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
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
    <div className="grid gap-3 border-b pb-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
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
        <Button type="submit" variant="outline" title="Create document">
          <span className="sr-only">Create document</span>
          <FileText className="size-4" />
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
          <FileUp className="size-4" />
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
    <section className="space-y-3 border-t pt-4">
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
  onOpenDocument,
  onOpenRecording,
}: {
  snapshot: LibrarySnapshot;
  selectedFolderId: string | null;
  selectedTagId: string | null;
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
    <ul>
      {childFolders.map((folder) => (
        <ItemRow
          key={folder.id}
          snapshot={snapshot}
          item={folder}
          type="folder"
        />
      ))}
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
      {!hasItems && (
        <li className="py-12 text-center text-sm text-muted-foreground">
          Nothing here yet.
        </li>
      )}
    </ul>
  );
}

export function LibraryWorkspace() {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  );
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(
    null,
  );
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

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="min-h-0 overflow-auto border-b p-4 lg:border-r lg:border-b-0">
        <div className="mb-4">
          <h1 className="text-lg font-semibold">Lumen</h1>
          <p className="text-sm text-muted-foreground">Study library</p>
        </div>
        <FolderTree
          folders={data.folders}
          selectedFolderId={selectedFolderId}
          onSelect={setSelectedFolderId}
        />
        <TagPanel
          tags={data.tags}
          selectedTagId={selectedTagId}
          onSelectTag={setSelectedTagId}
        />
      </aside>
      <section className="min-h-0 overflow-auto p-4 lg:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              {folderName(data, selectedFolderId)}
            </h2>
            <p className="text-sm text-muted-foreground">
              {selectedTagId
                ? `Filtered by ${
                    data.tags.find((tag) => tag.id === selectedTagId)?.name ??
                    "tag"
                  }`
                : "Folders, documents, and file metadata"}
            </p>
          </div>
        </div>
        <div
          className={
            selectedDocument
              ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]"
              : selectedRecording
                ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(460px,0.9fr)]"
                : ""
          }
        >
          <div>
            <CreateForms selectedFolderId={selectedFolderId} />
            <LibraryContent
              snapshot={data}
              selectedFolderId={selectedFolderId}
              selectedTagId={selectedTagId}
              onOpenDocument={setSelectedDocumentId}
              onOpenRecording={setSelectedRecordingId}
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
      </section>
    </div>
  );
}
