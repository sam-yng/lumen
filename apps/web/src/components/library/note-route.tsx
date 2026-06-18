"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { DocumentEditor } from "@/components/editor/document-editor";
import { fetchLibrarySnapshot, libraryQueryKey } from "./library-api";

export function NoteRoute({ nodeId }: { nodeId: string }) {
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

  const page =
    data?.nodes.find((item) => item.id === nodeId && item.kind === "page") ??
    null;

  return (
    <div className="min-h-0 flex-1">
      {isLoading ? (
        <div className="grid min-h-80 place-items-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="grid min-h-80 place-items-center text-sm text-destructive">
          {error instanceof Error ? error.message : "Could not load note."}
        </div>
      ) : page ? (
        <DocumentEditor
          key={page.id}
          page={page}
          citationBlockIndex={citationBlockIndex}
        />
      ) : (
        <div className="grid min-h-80 place-items-center text-sm text-[var(--text-3)]">
          This note no longer exists.
        </div>
      )}
    </div>
  );
}
