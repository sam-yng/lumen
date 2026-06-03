import type { Tables } from "@/server/db/database.types";

export type DocumentSearchResult = {
  kind: "document";
  id: string;
  title: string;
  folderId: string | null;
  snippet: string;
  tier: 0 | 1;
};

export type TranscriptSearchResult = {
  kind: "transcript";
  id: string;
  recordingId: string;
  snippet: string;
  tier: 0;
};

export type FileSearchResult = {
  kind: "file";
  id: string;
  name: string;
  folderId: string | null;
  tier: 1;
};

export type SearchResult =
  | DocumentSearchResult
  | TranscriptSearchResult
  | FileSearchResult;

export type SearchInputs = {
  query: string;
  documentBodyHits: Tables<"documents">[];
  transcriptHits: Tables<"transcripts">[];
  documentTitleHits: Tables<"documents">[];
  fileNameHits: Tables<"files">[];
};

const SNIPPET_RADIUS = 80;
const SNIPPET_FALLBACK_LENGTH = 160;

export function buildSnippet(text: string | null, query: string): string {
  const source = (text ?? "").trim();
  if (source.length === 0) return "";
  const term = query.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const index = term ? source.toLowerCase().indexOf(term) : -1;
  if (index === -1) {
    return source.length > SNIPPET_FALLBACK_LENGTH
      ? `${source.slice(0, SNIPPET_FALLBACK_LENGTH)}…`
      : source;
  }
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(source.length, index + term.length + SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${source.slice(start, end)}${
    end < source.length ? "…" : ""
  }`;
}

export function rankResults(inputs: SearchInputs): SearchResult[] {
  const { query } = inputs;

  const docById = new Map<string, { row: Tables<"documents">; tier: 0 | 1 }>();
  for (const row of inputs.documentTitleHits)
    docById.set(row.id, { row, tier: 1 });
  for (const row of inputs.documentBodyHits)
    docById.set(row.id, { row, tier: 0 });

  const documents = [...docById.values()].map(({ row, tier }) => ({
    // Documents use updated_at for recency (they are edited); transcripts/files use created_at (they are write-once).
    ts: row.updated_at,
    result: {
      kind: "document" as const,
      id: row.id,
      title: row.title,
      folderId: row.folder_id,
      snippet: tier === 0 ? buildSnippet(row.content_text, query) : "",
      tier,
    } satisfies DocumentSearchResult,
  }));

  const transcripts = inputs.transcriptHits.map((row) => ({
    ts: row.created_at,
    result: {
      kind: "transcript" as const,
      id: row.id,
      recordingId: row.recording_id,
      snippet: buildSnippet(row.full_text, query),
      tier: 0 as const,
    } satisfies TranscriptSearchResult,
  }));

  const files = inputs.fileNameHits.map((row) => ({
    ts: row.created_at,
    result: {
      kind: "file" as const,
      id: row.id,
      name: row.name,
      folderId: row.folder_id,
      tier: 1 as const,
    } satisfies FileSearchResult,
  }));

  return [...documents, ...transcripts, ...files]
    .sort((a, b) =>
      a.result.tier !== b.result.tier
        ? a.result.tier - b.result.tier
        : b.ts.localeCompare(a.ts),
    )
    .map((entry) => entry.result);
}
