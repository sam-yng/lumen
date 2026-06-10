import type { LibrarySnapshot } from "@/server/services/library";

export function folderName(snapshot: LibrarySnapshot, folderId: string | null) {
  if (folderId === null) return "Library";
  return (
    snapshot.folders.find((folder) => folder.id === folderId)?.name ?? "Library"
  );
}

/** Ancestor chain root→folder for breadcrumbs; empty array at the library root. */
export function folderPath(
  snapshot: LibrarySnapshot,
  folderId: string | null,
): { id: string; name: string }[] {
  const byId = new Map(snapshot.folders.map((folder) => [folder.id, folder]));
  const path: { id: string; name: string }[] = [];
  const visited = new Set<string>();
  let current = folderId ? byId.get(folderId) : undefined;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift({ id: current.id, name: current.name });
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return path;
}
