import type { Json, Tables } from "@/server/db/database.types";
import type {
  LibraryNode,
  LibraryNodeSnapshot,
} from "@/server/services/library-nodes";

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

async function requestForm<T>(path: string, body: FormData) {
  const response = await fetch(path, {
    method: "POST",
    body,
  });

  if (!response.ok) {
    const responseBody = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(responseBody?.error ?? "Request failed.");
  }

  return (await response.json()) as T;
}

export const libraryQueryKey = ["library"] as const;
export const transcriptQueryKey = (recordingId: string) =>
  ["transcript", recordingId] as const;

export function fetchLibrarySnapshot() {
  return requestJson<LibraryNodeSnapshot>("/api/library");
}

export function createWorkspace(input: { title: string }) {
  return requestJson<LibraryNode>("/api/library/nodes", {
    method: "POST",
    body: JSON.stringify({ kind: "workspace", ...input }),
  });
}

export function createPage(input: {
  title: string;
  parentId: string;
  role?: "note" | "folder";
}) {
  return requestJson<LibraryNode>("/api/library/nodes", {
    method: "POST",
    body: JSON.stringify({ kind: "page", ...input }),
  });
}

export function createNote(input: { title: string; parentId: string }) {
  return requestJson<LibraryNode>("/api/library/nodes", {
    method: "POST",
    body: JSON.stringify({ kind: "page", role: "note", ...input }),
  });
}

export function createFolder(input: { title: string; parentId: string }) {
  return requestJson<LibraryNode>("/api/library/nodes", {
    method: "POST",
    body: JSON.stringify({ kind: "page", role: "folder", ...input }),
  });
}

export function updateNode(input: {
  id: string;
  title?: string;
  parentId?: string | null;
  contentJson?: Json | null;
  isPinned?: boolean;
}) {
  return requestJson<LibraryNode>(`/api/library/nodes/${input.id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function bulkMoveNodes(input: {
  ids: string[];
  parentId: string | null;
}) {
  return requestJson<LibraryNode[]>("/api/library/nodes/bulk-move", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function bulkDeleteNodes(input: { ids: string[] }) {
  return requestJson<LibraryNode[]>("/api/library/nodes/bulk-delete", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function uploadFile(input: { file: File; parentId: string }) {
  const body = new FormData();
  body.set("file", input.file);
  body.set("name", input.file.name);
  body.set("parentId", input.parentId);

  return requestForm<{
    node: LibraryNode;
    recording: Tables<"recordings"> | null;
  }>("/api/library/uploads", body);
}

export function retryRecording(id: string) {
  return requestJson<Tables<"recordings">>(`/api/library/recordings/${id}`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
}

export function fetchTranscriptDetail(recordingId: string) {
  return requestJson<{
    node: LibraryNode;
    recording: Tables<"recordings">;
    transcript: Tables<"transcripts"> | null;
    segments: Tables<"transcript_segments">[];
  }>(`/api/library/transcripts/${recordingId}`);
}

export function startLiveSession(input: {
  name: string;
  parentId: string | null;
  workspaceId: string;
}) {
  return requestJson<{
    node: LibraryNode;
    recording: Tables<"recordings">;
    transcript: Tables<"transcripts">;
  }>("/api/library/live-sessions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function appendLiveSegments(input: {
  recordingId: string;
  segments: Array<{ startMs: number; endMs: number; text: string }>;
}) {
  return requestJson<{ inserted: number }>(
    `/api/library/live-sessions/${input.recordingId}/segments`,
    {
      method: "POST",
      body: JSON.stringify({ segments: input.segments }),
    },
  );
}

export function finalizeLiveSession(input: {
  recordingId: string;
  audio: Blob;
  language: string | null;
}) {
  const body = new FormData();
  body.set(
    "audio",
    new File([input.audio], "live-session.webm", {
      type: input.audio.type || "audio/webm",
    }),
  );
  if (input.language) body.set("language", input.language);

  return requestForm<{
    recording: Tables<"recordings">;
    transcript: Tables<"transcripts">;
  }>(`/api/library/live-sessions/${input.recordingId}/finalize`, body);
}

export function cancelLiveSession(recordingId: string) {
  return requestJson<{ deleted: boolean }>(
    `/api/library/live-sessions/${recordingId}`,
    { method: "DELETE" },
  );
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

export function linkTag(input: { tagId: string; nodeId: string }) {
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

export function setTagForNodes(input: {
  tagId: string;
  nodeIds: string[];
  linked: boolean;
}) {
  return requestJson<Tables<"tag_links">[]>("/api/library/tag-links/bulk", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
