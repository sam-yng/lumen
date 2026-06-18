"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { TranscriptViewer } from "@/components/transcripts/transcript-viewer";
import { fetchLibrarySnapshot, libraryQueryKey } from "./library-api";

export function TranscriptRoute({ nodeId }: { nodeId: string }) {
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

  const audioNode =
    data?.nodes.find((item) => item.id === nodeId && item.kind === "audio") ??
    null;
  const recording =
    data?.recordings.find((item) => item.node_id === audioNode?.id) ?? null;

  return (
    <div className="min-h-0 flex-1">
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
        <div className="grid min-h-80 place-items-center text-sm text-[var(--text-3)]">
          This transcript no longer exists.
        </div>
      )}
    </div>
  );
}
