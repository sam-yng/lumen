import type { SearchResult } from "@/server/services/search";
import type { TranscriptDetail } from "@/server/services/transcripts";

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "Request failed.");
  }
  return (await response.json()) as T;
}

export const searchQueryKey = (query: string) => ["search", query] as const;
export const transcriptQueryKey = (id: string) => ["transcript", id] as const;

export function fetchSearch(query: string) {
  return requestJson<{ results: SearchResult[] }>(
    `/api/search?q=${encodeURIComponent(query)}`,
  );
}

export function fetchTranscript(id: string) {
  return requestJson<TranscriptDetail>(`/api/transcripts/${id}`);
}
