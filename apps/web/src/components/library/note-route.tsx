"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { DocumentEditor } from "@/components/editor/document-editor";
import { fetchLibrarySnapshot, libraryQueryKey } from "./library-api";

export function NoteRoute({ documentId }: { documentId: string }) {
  const searchParams = useSearchParams();
  const rawBlock = searchParams.get("block");
  const citationBlockIndex = useMemo(
    () =>
      rawBlock !== null && /^\d+$/.test(rawBlock) ? Number(rawBlock) : null,
    [rawBlock],
  );
  const { data, error, isLoading } = useQuery({
    queryKey: libraryQueryKey,
    queryFn: fetchLibrarySnapshot,
  });

  const document =
    data?.documents.find((item) => item.id === documentId) ?? null;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background">
      <header className="sticky top-0 z-20 flex min-h-[52px] items-center gap-3 border-b border-[var(--border-soft)] bg-background/95 px-4 backdrop-blur lg:px-6">
        <Link
          href="/library"
          className="inline-flex items-center gap-1.5 rounded-md text-[13px] text-[var(--text-3)] transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to library
        </Link>
        {document ? (
          <span className="truncate text-[13px] font-medium text-foreground">
            {document.title}
          </span>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
        {isLoading ? (
          <div className="grid min-h-80 place-items-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="grid min-h-80 place-items-center text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not load note."}
          </div>
        ) : document ? (
          <DocumentEditor
            key={document.id}
            document={document}
            citationBlockIndex={citationBlockIndex}
          />
        ) : (
          <div className="grid min-h-80 place-items-center text-sm text-[var(--text-3)]">
            This note no longer exists.
          </div>
        )}
      </div>
    </div>
  );
}
