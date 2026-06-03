"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { highlightMatch } from "@/components/search/highlight";
import {
  fetchTranscript,
  transcriptQueryKey,
} from "@/components/search/search-api";
import type { Tables } from "@/server/db/database.types";

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<Tables<"recordings">["status"], string> = {
  pending: "Transcription pending",
  processing: "Transcription in progress",
  done: "Transcribed",
  failed: "Transcription failed",
};

type TranscriptViewerProps = {
  transcriptId: string;
  highlightQuery?: string;
  onClose: () => void;
};

export function TranscriptViewer({
  transcriptId,
  highlightQuery,
  onClose,
}: TranscriptViewerProps) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: transcriptQueryKey(transcriptId),
    queryFn: () => fetchTranscript(transcriptId),
  });

  if (isPending) {
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Loading
        transcript…
      </p>
    );
  }

  if (isError) {
    return (
      <p className="p-4 text-sm text-destructive">
        {error instanceof Error ? error.message : "Could not load transcript."}
      </p>
    );
  }

  const status = data.recording?.status ?? "pending";

  return (
    <section className="flex flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-medium">{STATUS_LABEL[status]}</span>
          {data.recording?.duration_sec != null && (
            <span className="text-xs text-muted-foreground">
              Duration {formatTimestamp(data.recording.duration_sec * 1000)}
            </span>
          )}
        </div>
        <button
          type="button"
          className="text-sm text-muted-foreground hover:underline"
          onClick={onClose}
        >
          Close
        </button>
      </header>

      {status === "failed" && data.recording?.error && (
        <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {data.recording.error}
        </p>
      )}

      {data.segments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {status === "done"
            ? "No transcript text."
            : "Transcript not ready yet."}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {data.segments.map((segment) => (
            <li key={segment.id} className="flex gap-3 text-sm">
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                [{formatTimestamp(segment.start_ms)}]
              </span>
              <span>
                {segment.speaker && (
                  <span className="mr-1 font-medium">{segment.speaker}:</span>
                )}
                {highlightMatch(segment.text, highlightQuery)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
