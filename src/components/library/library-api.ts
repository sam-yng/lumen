import type { Database, Tables } from "@/server/db/database.types";
import type { LibrarySnapshot } from "@/server/services/library";

type FileKind = Database["public"]["Enums"]["file_kind"];
type TargetType = Database["public"]["Enums"]["tag_target_type"];

async function requestJson<T>(
  path: string,
  init: RequestInit & { body?: string } = {},
) {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "Request failed.");
  }

  return (await response.json()) as T;
}

export const libraryQueryKey = ["library"] as const;

export function fetchLibrarySnapshot() {
  return requestJson<LibrarySnapshot>("/api/library");
}

export function createFolder(input: { name: string; parentId: string | null }) {
  return requestJson<Tables<"folders">>("/api/library/folders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateFolder(input: {
  id: string;
  name?: string;
  parentId?: string | null;
}) {
  return requestJson<Tables<"folders">>(`/api/library/folders/${input.id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteFolder(id: string) {
  return requestJson<Tables<"folders">>(`/api/library/folders/${id}`, {
    method: "DELETE",
  });
}

export function createDocument(input: {
  title: string;
  folderId: string | null;
}) {
  return requestJson<Tables<"documents">>("/api/library/documents", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateDocument(input: {
  id: string;
  title?: string;
  folderId?: string | null;
}) {
  return requestJson<Tables<"documents">>(
    `/api/library/documents/${input.id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function deleteDocument(id: string) {
  return requestJson<Tables<"documents">>(`/api/library/documents/${id}`, {
    method: "DELETE",
  });
}

export function createFileMetadata(input: {
  name: string;
  mimeType: string;
  sizeBytes: number;
  kind: FileKind;
  folderId: string | null;
}) {
  return requestJson<Tables<"files">>("/api/library/files", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateFileMetadata(input: {
  id: string;
  name?: string;
  mimeType?: string;
  sizeBytes?: number;
  kind?: FileKind;
  folderId?: string | null;
}) {
  return requestJson<Tables<"files">>(`/api/library/files/${input.id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteFileMetadata(id: string) {
  return requestJson<Tables<"files">>(`/api/library/files/${id}`, {
    method: "DELETE",
  });
}

export function createTag(input: { name: string; color: string | null }) {
  return requestJson<Tables<"tags">>("/api/library/tags", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTag(input: {
  id: string;
  name?: string;
  color?: string | null;
}) {
  return requestJson<Tables<"tags">>(`/api/library/tags/${input.id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteTag(id: string) {
  return requestJson<Tables<"tags">>(`/api/library/tags/${id}`, {
    method: "DELETE",
  });
}

export function linkTag(input: {
  tagId: string;
  targetType: TargetType;
  targetId: string;
}) {
  return requestJson<Tables<"tag_links">>("/api/library/tag-links", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function unlinkTag(linkId: string) {
  return requestJson<Tables<"tag_links">>(`/api/library/tag-links/${linkId}`, {
    method: "DELETE",
  });
}
