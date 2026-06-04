"use client";

import { FileText } from "lucide-react";
import type { Database, Tables } from "@/server/db/database.types";
import type { LibrarySnapshot } from "@/server/services/library";
import { ItemRow } from "./library-item-row";

type DocumentRow = Tables<"documents">;
type FileRow = Tables<"files">;
type TagLinkRow = Tables<"tag_links">;
type TargetType = Database["public"]["Enums"]["tag_target_type"];

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

export function LibraryContent({
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
