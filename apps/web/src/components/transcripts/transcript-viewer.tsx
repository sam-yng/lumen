"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Clock,
  Download,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchTranscriptDetail,
  libraryQueryKey,
  retryRecording,
  transcriptQueryKey,
} from "@/components/library/library-api";
import {
  resolveDeepLinkMs,
  type TranscriptDeepLink,
} from "@/components/transcripts/transcript-deep-link";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/server/db/database.types";

type RecordingRow = Tables<"recordings">;
type SegmentRow = Tables<"transcript_segments">;

const RATES = [1, 1.25, 1.5, 1.75, 2, 2.25] as const;
const WAVEFORM_BARS = Array.from({ length: 150 }, (_, index) => {
  const wave = Math.sin(index * 0.42) * 0.34 + Math.sin(index * 0.11) * 0.22;
  return {
    id: `bar-${index}`,
    height: Math.round(22 + Math.abs(wave) * 42 + (index % 7) * 1.6),
  };
});

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
  if (recording.status === "live") {
    return (
      <div className="grid min-h-80 place-items-center rounded-md border border-[var(--border-soft)] bg-[var(--surface)] p-6 text-center">
        <div className="space-y-3">
          <Mic className="mx-auto size-8 animate-pulse text-[var(--danger)]" />
          <p className="font-medium">Live session in progress</p>
          <p className="max-w-md font-mono text-[11.5px] text-[var(--text-3)]">
            This recording is still being captured. If the session was
            interrupted before it could be saved, delete it from the library.
          </p>
        </div>
      </div>
    );
  }

  if (recording.status === "failed") {
    return (
      <div className="grid min-h-80 place-items-center rounded-md border border-[var(--border-soft)] bg-[var(--surface)] p-6 text-center">
        <div className="space-y-3">
          <AlertCircle className="mx-auto size-8 text-destructive" />
          <p className="font-medium">Transcription failed</p>
          <p className="max-w-md font-mono text-[11.5px] text-[var(--text-3)]">
            {recording.error ??
              "The local worker could not transcribe this file."}
          </p>
          <div className="flex justify-center gap-2">
            <Button type="button" onClick={onRetry} disabled={retrying}>
              {retrying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              Retry
            </Button>
            <Button type="button" variant="outline">
              <Download className="size-4" />
              Download
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const processing = recording.status === "processing";
  return (
    <div className="grid min-h-80 place-items-center rounded-md border border-[var(--border-soft)] bg-[var(--surface)] p-6 text-center">
      <div className="w-full max-w-md space-y-4">
        {processing ? (
          <Loader2 className="mx-auto size-8 animate-spin text-[var(--busy)]" />
        ) : (
          <Clock className="mx-auto size-8 text-[var(--warn)]" />
        )}
        <div>
          <span
            className={`l-badge mx-auto ${processing ? "bg-[var(--busy-soft)] text-[var(--busy)]" : "bg-[var(--warn-soft)] text-[var(--warn)]"}`}
          >
            {processing ? "transcribing" : "queued"}
          </span>
          <p className="mt-3 font-medium">
            {processing ? "Transcribing locally" : "Queued for transcription"}
          </p>
          <p className="mt-1 font-mono text-[11.5px] text-[var(--text-3)]">
            base.en · local CPU · no data leaves your machine
          </p>
        </div>
        {processing ? (
          <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
            <div className="h-full w-2/3 rounded-full bg-[linear-gradient(90deg,var(--busy),var(--accent))]" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TranscriptViewer({
  recording,
  deepLink,
  onClose,
}: {
  recording: RecordingRow;
  deepLink?: TranscriptDeepLink;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const segmentListRef = useRef<HTMLOListElement | null>(null);
  const segmentRefs = useRef(new Map<string, HTMLButtonElement>());
  // Audio seek (in seconds) waiting for the media element to have metadata.
  const pendingSeekSec = useRef<number | null>(null);
  // Time the media has actually reported (handlers only); null until then.
  const [mediaTimeSec, setMediaTimeSec] = useState<number | null>(null);
  const [duration, setDuration] = useState(recording.duration_sec ?? 0);
  const [playing, setPlaying] = useState(false);
  const [rateIndex, setRateIndex] = useState(0);
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
  // Stable identity so the memos/effects below only re-run when the
  // transcript actually changes, not on every render.
  const segments = useMemo(() => data?.segments ?? [], [data?.segments]);

  // A citation deep link resolves to a target position; until the media
  // element reports its own time, the displayed time (highlight, playhead,
  // clock) is derived from it — nothing is copied into state.
  const deepLinkMs = useMemo(
    () => (deepLink ? resolveDeepLinkMs(deepLink, segments) : null),
    [deepLink, segments],
  );
  const currentTime =
    mediaTimeSec ?? (deepLinkMs !== null ? deepLinkMs / 1000 : 0);

  const activeIndex = useMemo(
    () => activeSegmentIndex(segments, currentTime),
    [segments, currentTime],
  );
  const progress = duration > 0 ? currentTime / duration : 0;
  const rate = RATES[rateIndex] ?? 1;

  // Push the deep-link position into the media element (an external system):
  // directly when it already has metadata (a new citation clicked into an
  // already-open transcript), otherwise queued for onLoadedMetadata.
  useEffect(() => {
    if (deepLinkMs === null) return;
    const audio = audioRef.current;
    if (audio && audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      audio.currentTime = deepLinkMs / 1000;
    } else {
      pendingSeekSec.current = deepLinkMs / 1000;
    }
  }, [deepLinkMs]);

  useEffect(() => {
    const activeSegment = activeIndex >= 0 ? segments[activeIndex] : null;
    const container = segmentListRef.current;
    if (!activeSegment || !container) return;

    const activeButton = segmentRefs.current.get(activeSegment.id);
    if (!activeButton) return;

    const target =
      activeButton.offsetTop -
      container.clientHeight * 0.4 +
      activeButton.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }, [activeIndex, segments]);

  if (isLoading) {
    return (
      <section className="grid min-h-96 place-items-center rounded-md border border-[var(--border-soft)] bg-[var(--surface)] p-6">
        <Loader2 className="size-6 animate-spin text-[var(--text-3)]" />
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="grid min-h-96 place-items-center rounded-md border border-[var(--border-soft)] bg-[var(--surface)] p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : "Could not load transcript."}
      </section>
    );
  }

  function seek(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(seconds, duration || seconds));
    setMediaTimeSec(audio.currentTime);
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-[var(--border-soft)] bg-[var(--surface)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md border border-[var(--busy-soft)] bg-[var(--busy-soft)] text-[var(--busy)]">
            <Mic className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[19px] font-semibold">
              {data.file.name}
            </h3>
            <p className="font-mono text-[11.5px] text-[var(--text-3)]">
              {data.recording.duration_sec
                ? `${formatTime(data.recording.duration_sec * 1000)} · `
                : ""}
              {data.file.size_bytes} bytes ·{" "}
              {data.transcript?.language ?? "language pending"} · base.en
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="l-badge bg-[var(--ok-soft)] text-[var(--ok)]">
            {data.recording.status}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </header>

      {data.recording.status !== "done" || !data.transcript ? (
        <div className="p-4">
          <StatusState
            recording={data.recording}
            onRetry={() => retry.mutate(data.recording.id)}
            retrying={retry.isPending}
          />
        </div>
      ) : (
        <>
          <div className="sticky top-0 z-10 border-b border-[var(--border-soft)] bg-[var(--surface)] p-3">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="icon-lg"
                className="size-11 rounded-full"
                title={playing ? "Pause" : "Play"}
                onClick={() => {
                  const audio = audioRef.current;
                  if (!audio) return;
                  if (audio.paused) void audio.play();
                  else audio.pause();
                }}
              >
                <span className="sr-only">{playing ? "Pause" : "Play"}</span>
                {playing ? (
                  <Pause className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
              </Button>
              <button
                type="button"
                className="relative flex h-14 min-w-0 flex-1 items-center gap-px overflow-hidden rounded-md border border-[var(--border-soft)] bg-[var(--surface-2)] px-2"
                aria-label="Seek audio"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const ratio = (event.clientX - rect.left) / rect.width;
                  seek(ratio * duration);
                }}
              >
                {WAVEFORM_BARS.map((bar, index) => {
                  const filled = index / WAVEFORM_BARS.length <= progress;
                  return (
                    <span
                      key={bar.id}
                      className={`flex-1 rounded-full ${filled ? "bg-primary" : "bg-[var(--border-strong)]"}`}
                      style={{ height: `${bar.height}%` }}
                    />
                  );
                })}
                <span
                  className="absolute top-1 bottom-1 w-px rounded-full bg-primary shadow-[0_0_18px_var(--accent-glow)]"
                  style={{
                    left: `${Math.max(0, Math.min(100, progress * 100))}%`,
                  }}
                />
              </button>
              <p className="shrink-0 text-right font-mono text-[11.5px] text-[var(--text-3)] sm:w-[92px]">
                {formatTime(currentTime * 1000)} / {formatTime(duration * 1000)}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = (rateIndex + 1) % RATES.length;
                  setRateIndex(next);
                  if (audioRef.current) {
                    audioRef.current.playbackRate = RATES[next] ?? 1;
                  }
                }}
              >
                {rate}x
              </Button>
              {/* biome-ignore lint/a11y/useMediaCaption: Transcript segments are rendered directly below as the synchronized caption text. */}
              <audio
                ref={audioRef}
                src={`/api/library/files/${data.file.id}`}
                onLoadedMetadata={(event) => {
                  setDuration(event.currentTarget.duration);
                  if (pendingSeekSec.current !== null) {
                    event.currentTarget.currentTime = pendingSeekSec.current;
                    pendingSeekSec.current = null;
                  }
                }}
                onPause={() => setPlaying(false)}
                onPlay={() => {
                  setPlaying(true);
                  if (audioRef.current) audioRef.current.playbackRate = rate;
                }}
                onTimeUpdate={(event) =>
                  setMediaTimeSec(event.currentTarget.currentTime)
                }
              />
            </div>
          </div>
          <ol
            ref={segmentListRef}
            className="mx-auto max-h-[62dvh] max-w-3xl space-y-1 overflow-auto p-4"
          >
            {segments.map((segment, index) => (
              <li key={segment.id}>
                <button
                  type="button"
                  ref={(element) => {
                    if (element) segmentRefs.current.set(segment.id, element);
                    else segmentRefs.current.delete(segment.id);
                  }}
                  className={`grid min-h-[44px] w-full grid-cols-1 gap-0.5 rounded-md border-l-2 px-3 py-2 text-left transition hover:bg-[var(--surface-2)] sm:grid-cols-[56px_minmax(0,1fr)] sm:gap-3 ${
                    index === activeIndex
                      ? "border-l-primary bg-[var(--accent-soft)]"
                      : "border-l-transparent"
                  }`}
                  onClick={() => seek(segment.start_ms / 1000)}
                >
                  <span
                    className={`font-mono text-[11.5px] ${index === activeIndex ? "text-[var(--accent-text)]" : "text-[var(--text-3)]"}`}
                  >
                    {formatTime(segment.start_ms)}
                  </span>
                  <span className="min-w-0">
                    {segment.speaker ? (
                      <span className="mb-1 block font-mono text-[10px] uppercase text-[var(--text-4)]">
                        {segment.speaker}
                      </span>
                    ) : null}
                    <span className="font-serif text-[16.5px] leading-7 text-foreground">
                      {segment.text}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
