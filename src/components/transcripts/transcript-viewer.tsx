"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Clock, Loader2, Mic, Play } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  fetchTranscriptDetail,
  libraryQueryKey,
  retryRecording,
  transcriptQueryKey,
} from "@/components/library/library-api";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/server/db/database.types";

type RecordingRow = Tables<"recordings">;
type SegmentRow = Tables<"transcript_segments">;

function formatTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function activeSegmentIndex(segments: SegmentRow[], currentTime: number) {
  const currentMs = currentTime * 1000;
  let active = -1;
  for (let index = 0; index < segments.length; index += 1) {
    if (segments[index]?.start_ms <= currentMs) active = index;
  }
  return active;
}

function StatusState({
  recording,
  onRetry,
  retrying,
}: {
  recording: RecordingRow;
  onRetry: () => void;
  retrying: boolean;
}) {
  if (recording.status === "failed") {
    return (
      <div className="grid min-h-80 place-items-center rounded-md border p-6 text-center">
        <div className="space-y-3">
          <AlertCircle className="mx-auto size-8 text-destructive" />
          <p className="font-medium">Transcription failed</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {recording.error ??
              "The local worker could not transcribe this file."}
          </p>
          <Button type="button" onClick={onRetry} disabled={retrying}>
            {retrying && <Loader2 className="size-4 animate-spin" />}
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const processing = recording.status === "processing";
  return (
    <div className="grid min-h-80 place-items-center rounded-md border p-6 text-center">
      <div className="space-y-3">
        {processing ? (
          <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
        ) : (
          <Clock className="mx-auto size-8 text-muted-foreground" />
        )}
        <p className="font-medium">
          {processing ? "Transcribing locally" : "Queued for transcription"}
        </p>
        <p className="text-sm text-muted-foreground">
          base.en · local CPU · no data leaves your machine
        </p>
      </div>
    </div>
  );
}

export function TranscriptViewer({
  recording,
  onClose,
}: {
  recording: RecordingRow;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const { data, error, isLoading } = useQuery({
    queryKey: transcriptQueryKey(recording.id),
    queryFn: () => fetchTranscriptDetail(recording.id),
  });
  const retry = useMutation({
    mutationFn: retryRecording,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryQueryKey });
      queryClient.invalidateQueries({
        queryKey: transcriptQueryKey(recording.id),
      });
    },
  });
  const segments = data?.segments ?? [];
  const activeIndex = useMemo(
    () => activeSegmentIndex(segments, currentTime),
    [segments, currentTime],
  );

  if (isLoading) {
    return (
      <section className="grid min-h-96 place-items-center rounded-md border p-6">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="grid min-h-96 place-items-center rounded-md border p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : "Could not load transcript."}
      </section>
    );
  }

  return (
    <section className="min-w-0 space-y-4 rounded-md border p-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md border bg-muted/50">
            <Mic className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{data.file.name}</h3>
            <p className="text-xs text-muted-foreground">
              {data.recording.duration_sec
                ? `${data.recording.duration_sec}s · `
                : ""}
              {data.transcript?.language ?? "language pending"} ·{" "}
              {data.recording.status}
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </header>

      {data.recording.status !== "done" || !data.transcript ? (
        <StatusState
          recording={data.recording}
          onRetry={() => retry.mutate(data.recording.id)}
          retrying={retry.isPending}
        />
      ) : (
        <>
          <div className="sticky top-0 z-10 rounded-md border bg-background p-3">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const audio = audioRef.current;
                  if (!audio) return;
                  if (audio.paused) void audio.play();
                  else audio.pause();
                }}
              >
                <Play className="size-4" />
              </Button>
              {/* biome-ignore lint/a11y/useMediaCaption: Transcript text is rendered as interactive segments adjacent to the player. */}
              <audio
                ref={audioRef}
                className="h-9 min-w-0 flex-1"
                controls
                src={`/api/library/files/${data.file.id}`}
                onTimeUpdate={(event) =>
                  setCurrentTime(event.currentTarget.currentTime)
                }
              />
            </div>
          </div>
          <ol className="mx-auto max-w-3xl space-y-1">
            {segments.map((segment, index) => (
              <li key={segment.id}>
                <button
                  type="button"
                  className={`grid w-full grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-md border-l-2 px-3 py-2 text-left hover:bg-muted ${
                    index === activeIndex
                      ? "border-l-primary bg-muted"
                      : "border-l-transparent"
                  }`}
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = segment.start_ms / 1000;
                    }
                  }}
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatTime(segment.start_ms)}
                  </span>
                  <span className="text-sm leading-6">{segment.text}</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
