"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { TranscriptViewer } from "@/components/transcripts/transcript-viewer";
import { fetchLibrarySnapshot, libraryQueryKey } from "./library-api";

export function TranscriptRoute({ recordingId }: { recordingId: string }) {
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
    data?.recordings.find((item) => item.id === recordingId) ?? null;
  const file = recording
    ? (data?.files.find((item) => item.id === recording.file_id) ?? null)
    : null;

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
        {file ? (
          <span className="truncate text-[13px] font-medium text-foreground">
            {file.name}
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
        ) : recording ? (
          <TranscriptViewer
            key={recording.id}
            recording={recording}
            deepLink={deepLink}
            onClose={() => router.push("/library")}
          />
        ) : (
          <div className="grid min-h-80 place-items-center text-sm text-[var(--text-3)]">
            This transcript no longer exists.
          </div>
        )}
      </div>
    </div>
  );
}
