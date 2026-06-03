"use client";

import { useQuery } from "@tanstack/react-query";
import {
  FileAudio,
  File as FileIcon,
  FileText,
  Loader2,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import type { SearchResult } from "@/server/services/search";
import { highlightMatch } from "./highlight";
import { fetchSearch, searchQueryKey } from "./search-api";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

type SearchPanelProps = {
  onOpenDocument: (documentId: string) => void;
  onOpenTranscript: (transcriptId: string, query: string) => void;
  onSelectFile: (fileId: string, folderId: string | null) => void;
};

export function SearchPanel({
  onOpenDocument,
  onOpenTranscript,
  onSelectFile,
}: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 250);

  const { data, isFetching } = useQuery({
    queryKey: searchQueryKey(debouncedQuery),
    queryFn: () => fetchSearch(debouncedQuery),
    enabled: debouncedQuery.length > 0,
  });

  const results = data?.results ?? [];

  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="relative">
        <Search
          className="absolute top-2.5 left-2 size-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          aria-label="Search notes and transcripts"
          className="pl-8"
          placeholder="Search notes and transcripts…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {debouncedQuery.length > 0 && (
        <div className="rounded-md border">
          {isFetching && results.length === 0 ? (
            <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No results.</p>
          ) : (
            <ul className="divide-y">
              {results.map((result) => (
                <li key={`${result.kind}-${result.id}`}>
                  <SearchResultRow
                    result={result}
                    query={debouncedQuery}
                    onOpenDocument={onOpenDocument}
                    onOpenTranscript={onOpenTranscript}
                    onSelectFile={onSelectFile}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SearchResultRow({
  result,
  query,
  onOpenDocument,
  onOpenTranscript,
  onSelectFile,
}: {
  result: SearchResult;
  query: string;
} & Pick<
  SearchPanelProps,
  "onOpenDocument" | "onOpenTranscript" | "onSelectFile"
>) {
  const rowClass = "flex w-full items-start gap-2 p-3 text-left hover:bg-muted";

  if (result.kind === "document") {
    return (
      <button
        type="button"
        className={rowClass}
        onClick={() => onOpenDocument(result.id)}
      >
        <FileText
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">
            {highlightMatch(result.title, query)}
          </span>
          {result.snippet && (
            <span className="text-xs text-muted-foreground">
              {highlightMatch(result.snippet, query)}
            </span>
          )}
        </span>
      </button>
    );
  }

  if (result.kind === "transcript") {
    return (
      <button
        type="button"
        className={rowClass}
        onClick={() => onOpenTranscript(result.id, query)}
      >
        <FileAudio
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium">Transcript</span>
          <span className="text-xs text-muted-foreground">
            {highlightMatch(result.snippet, query)}
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={rowClass}
      onClick={() => onSelectFile(result.id, result.folderId)}
    >
      <FileIcon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <span className="truncate text-sm font-medium">
        {highlightMatch(result.name, query)}
      </span>
    </button>
  );
}
