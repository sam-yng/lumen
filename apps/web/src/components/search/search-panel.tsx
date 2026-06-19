"use client";

import { useQuery } from "@tanstack/react-query";
import {
  FileAudio,
  File as FileIcon,
  FileText,
  Loader2,
  Search,
} from "lucide-react";
import { type Ref, useEffect, useState } from "react";
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
  onOpenTranscript: (recordingId: string) => void;
  onSelectFile: (fileId: string, folderId: string | null) => void;
  inputRef?: Ref<HTMLInputElement>;
};

export function SearchPanel({
  onOpenDocument,
  onOpenTranscript,
  onSelectFile,
  inputRef,
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
    <div className="relative mb-5 flex flex-col gap-2">
      <div className="relative">
        <Search
          className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-text-3"
          aria-hidden
        />
        <Input
          ref={inputRef}
          aria-label="Search notes and transcripts"
          className="h-14 rounded-lg border-border-soft bg-surface pl-11 text-[16px] focus-visible:border-(--accent-line) sm:text-[15px]"
          placeholder="Search notes and transcripts…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {debouncedQuery.length > 0 && (
        <div className="absolute top-full right-0 left-0 z-30 mt-2 max-h-[60vh] overflow-y-auto rounded-md border border-border-soft bg-surface shadow-lg">
          {isFetching && results.length === 0 ? (
            <p className="flex items-center gap-2 p-3 text-sm text-text-3">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-text-3">No results.</p>
          ) : (
            <ul className="divide-y divide-border-soft">
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
  const rowClass =
    "flex min-h-[44px] w-full items-start gap-3 p-3 text-left transition hover:bg-surface-2";

  if (result.kind === "document") {
    return (
      <button
        type="button"
        className={rowClass}
        onClick={() => onOpenDocument(result.id)}
      >
        <FileText
          className="mt-0.5 size-4 shrink-0 text-accent-text"
          aria-hidden
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">
            {highlightMatch(result.title, query)}
          </span>
          {result.snippet && (
            <span className="font-serif text-[13px] leading-5 text-text-2">
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
        onClick={() => onOpenTranscript(result.recordingId)}
      >
        <FileAudio className="mt-0.5 size-4 shrink-0 text-busy" aria-hidden />
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium">Transcript</span>
          <span className="font-serif text-[13px] leading-5 text-text-2">
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
      <FileIcon className="mt-0.5 size-4 shrink-0 text-text-3" aria-hidden />
      <span className="truncate text-sm font-medium">
        {highlightMatch(result.name, query)}
      </span>
    </button>
  );
}
