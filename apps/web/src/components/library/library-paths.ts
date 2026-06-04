import type { LibrarySnapshot } from "@/server/services/library";

export function folderName(snapshot: LibrarySnapshot, folderId: string | null) {
  if (folderId === null) return "Library";
  return (
    snapshot.folders.find((folder) => folder.id === folderId)?.name ?? "Library"
  );
}
