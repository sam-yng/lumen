"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { TranscriptViewer } from "@/components/transcripts/transcript-viewer";
import { fetchLibrarySnapshot, libraryQueryKey } from "./library-api";

export function TranscriptRoute({
  nodeId,
  recordingId,
}: {
  nodeId?: string;
  recordingId?: string;
}) {
  const router = useRouter();
  // Citation deep link: ?segment=<id> targets a cited segment; ?t=<ms> is the
  // timestamp fallback when no segment was resolved. Neither -> open at top.
  const searchParams = useSearchParams();
  const segmentId = searchParams.get("segment");
  const rawT = searchParams.get("t");
  const tMs = rawT !== null && /^\d+$/.test(rawT) ? Number(rawT) : null;
  const deepLink = useMemo(
    () => (segmentId !== null || tMs !== null ? { segmentId, tMs } : undefined),
    [segmentId, tMs],
  );
  const { data, error, isLoading } = useQuery({
    queryKey: libraryQueryKey,
    queryFn: fetchLibrarySnapshot,
  });

  const recording =
    data?.recordings.find((item) =>
      recordingId ? item.id === recordingId : item.node_id === nodeId,
    ) ?? null;
  const audioNode =
    data?.nodes.find(
      (item) => item.id === recording?.node_id && item.kind === "audio",
    ) ?? null;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background">
      <header className="sticky top-0 z-20 flex min-h-(--topbar-h) items-center gap-3 border-b border-border-soft bg-background/95 px-4 backdrop-blur lg:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md text-[13px] text-text-3 transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to library
        </Link>
        {audioNode ? (
          <span className="truncate text-[13px] font-medium text-foreground">
            {audioNode.title}
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
            {error instanceof Error
              ? error.message
              : "Could not load transcript."}
          </div>
        ) : recording && audioNode ? (
          <>
            <span className="sr-only">{audioNode.title}</span>
            <TranscriptViewer
              key={recording.id}
              recording={recording}
              deepLink={deepLink}
              onClose={() => router.push("/")}
            />
          </>
        ) : (
          <div className="grid min-h-80 place-items-center text-sm text-text-3">
            This transcript no longer exists.
          </div>
        )}
      </div>
    </div>
  );
}
