"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, Mic, Square, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  appendLiveSegments,
  cancelLiveSession,
  finalizeLiveSession,
  libraryQueryKey,
  startLiveSession,
} from "@/components/library/library-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AsrStatus } from "@/lib/transcription/asr-protocol";
import { startPcmCapture } from "@/lib/transcription/pcm-capture";
import type {
  StreamingSegment,
  StreamingTranscriptionSession,
} from "@/lib/transcription/streaming-provider";
import { TransformersStreamingTranscriptionProvider } from "@/lib/transcription/transformers-streaming-provider";

type Phase = "idle" | "starting" | "recording" | "saving" | "error";

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function formatTime(milliseconds: number) {
  return formatElapsed(Math.floor(milliseconds / 1000));
}

function defaultSessionName() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `Live session ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function statusLabel(status: AsrStatus | null) {
  if (!status) return "Preparing transcription model…";
  if (status.state === "loading") {
    return status.progress !== null
      ? `Loading transcription model… ${Math.round(status.progress)}%`
      : "Loading transcription model…";
  }
  return status.device === "webgpu"
    ? "Transcribing on-device (GPU)"
    : "Transcribing on-device (CPU)";
}

export function LiveSessionCapture({ folderId }: { folderId: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("idle");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [asrWarning, setAsrWarning] = useState<string | null>(null);
  const [asrStatus, setAsrStatus] = useState<AsrStatus | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [finals, setFinals] = useState<StreamingSegment[]>([]);
  const [interim, setInterim] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const captureRef = useRef<{ stop(): Promise<void> } | null>(null);
  const asrSessionRef = useRef<StreamingTranscriptionSession | null>(null);
  const recordingIdRef = useRef<string | null>(null);
  const pendingRef = useRef<StreamingSegment[]>([]);
  const drainingRef = useRef<Promise<void> | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (phase !== "recording") return;
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== "recording" && phase !== "saving") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: finals/interim drive the scroll position, not the effect body.
  useEffect(() => {
    const container = transcriptRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [finals, interim]);

  function drainSegments(): Promise<void> {
    drainingRef.current ??= (async () => {
      try {
        const recordingId = recordingIdRef.current;
        if (!recordingId) return;
        while (pendingRef.current.length > 0) {
          const batch = pendingRef.current.splice(0, 50);
          try {
            await appendLiveSegments({
              recordingId,
              segments: batch.map((segment) => ({
                startMs: Math.round(segment.startMs),
                endMs: Math.round(segment.endMs),
                text: segment.text,
              })),
            });
          } catch (cause) {
            pendingRef.current.unshift(...batch);
            throw cause;
          }
        }
      } finally {
        drainingRef.current = null;
      }
    })();
    return drainingRef.current;
  }

  function teardownMedia() {
    void captureRef.current?.stop().catch(() => {});
    captureRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
  }

  async function start() {
    setError(null);
    setAsrWarning(null);
    setPhase("starting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(
        "Microphone access was denied. Allow microphone access in your browser and try again.",
      );
      setPhase("error");
      return;
    }
    streamRef.current = stream;

    try {
      const session = await startLiveSession({
        name: name.trim() || defaultSessionName(),
        folderId,
      });
      recordingIdRef.current = session.recording.id;

      recorderChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recorderChunksRef.current.push(event.data);
      };
      recorder.start(1000);

      const provider = new TransformersStreamingTranscriptionProvider({
        onStatus: setAsrStatus,
      });
      const asrSession = await provider.startSession({
        onEvent: (event) => {
          if (event.kind === "interim") {
            setInterim(event.segment.text);
            return;
          }
          setInterim(null);
          setFinals((previous) => [...previous, event.segment]);
          pendingRef.current.push(event.segment);
          drainSegments().catch(() => {
            // Retried by the next drain; surfaced if the final drain fails.
          });
        },
        onError: (cause) => {
          setAsrWarning(
            `Live transcription stopped (${cause.message}). Audio is still being recorded and will be saved.`,
          );
        },
      });
      asrSessionRef.current = asrSession;

      captureRef.current = await startPcmCapture(stream, (samples) => {
        asrSession.pushAudio(samples);
      });

      setElapsed(0);
      setFinals([]);
      setInterim(null);
      setPhase("recording");
    } catch (cause) {
      teardownMedia();
      const recordingId = recordingIdRef.current;
      recordingIdRef.current = null;
      if (recordingId) {
        cancelLiveSession(recordingId).catch(() => {});
      }
      setError(
        cause instanceof Error ? cause.message : "Could not start the session.",
      );
      setPhase("error");
    }
  }

  async function stopAndSave() {
    const recordingId = recordingIdRef.current;
    if (!recordingId) return;
    setPhase("saving");

    try {
      await captureRef.current?.stop().catch(() => {});
      captureRef.current = null;

      const recorder = recorderRef.current;
      const audioBlob = await new Promise<Blob>((resolve, reject) => {
        if (!recorder || recorder.state === "inactive") {
          resolve(new Blob(recorderChunksRef.current, { type: "audio/webm" }));
          return;
        }
        recorder.onstop = () => {
          resolve(
            new Blob(recorderChunksRef.current, {
              type: recorder.mimeType || "audio/webm",
            }),
          );
        };
        recorder.onerror = () => reject(new Error("Recording failed."));
        recorder.stop();
      });

      for (const track of streamRef.current?.getTracks() ?? []) track.stop();
      streamRef.current = null;

      // Flush the ASR tail, then make sure every final segment reached the server.
      await asrSessionRef.current?.finish();
      asrSessionRef.current = null;
      await drainSegments();

      const result = await finalizeLiveSession({
        recordingId,
        audio: audioBlob,
        language: "en",
      });

      recordingIdRef.current = null;
      await queryClient.invalidateQueries({ queryKey: libraryQueryKey });
      router.push(`/library/transcripts/${result.recording.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save the live session.",
      );
      setPhase("error");
    }
  }

  async function discard() {
    const recordingId = recordingIdRef.current;
    asrSessionRef.current?.abort();
    asrSessionRef.current = null;
    teardownMedia();
    recordingIdRef.current = null;
    pendingRef.current = [];
    if (recordingId) {
      await cancelLiveSession(recordingId).catch(() => {});
      await queryClient.invalidateQueries({ queryKey: libraryQueryKey });
    }
    router.push("/library");
  }

  if (phase === "idle" || phase === "error") {
    return (
      <section className="mx-auto max-w-2xl space-y-4 rounded-md border border-[var(--border-soft)] bg-[var(--surface)] p-6">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md border border-[var(--danger-soft)] bg-[var(--danger-soft)] text-[var(--danger)]">
            <Mic className="size-5" />
          </div>
          <div>
            <h3 className="text-[19px] font-semibold">Live session</h3>
            <p className="font-mono text-[11.5px] text-[var(--text-3)]">
              transcribed on-device while you record · nothing but text leaves
              your machine until you save
            </p>
          </div>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-[var(--danger-soft)] bg-[var(--danger-soft)] p-3 text-[13px] text-[var(--danger)]">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label
            htmlFor="live-session-name"
            className="text-[13px] font-medium"
          >
            Session name
          </label>
          <Input
            id="live-session-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Live session (named automatically if left blank)"
            maxLength={200}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => void start()}>
            <Mic className="size-4" />
            Start recording
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/library")}
          >
            Cancel
          </Button>
        </div>
      </section>
    );
  }

  if (phase === "starting") {
    return (
      <section className="mx-auto grid min-h-60 max-w-2xl place-items-center rounded-md border border-[var(--border-soft)] bg-[var(--surface)] p-6">
        <div className="space-y-3 text-center">
          <Loader2 className="mx-auto size-6 animate-spin text-[var(--busy)]" />
          <p className="text-sm">Starting live session…</p>
          <p className="font-mono text-[11.5px] text-[var(--text-3)]">
            {statusLabel(asrStatus)}
          </p>
        </div>
      </section>
    );
  }

  const saving = phase === "saving";

  return (
    <section className="mx-auto max-w-3xl overflow-hidden rounded-md border border-[var(--border-soft)] bg-[var(--surface)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[var(--danger-soft)] text-[var(--danger)]">
            <Mic className={`size-5 ${saving ? "" : "animate-pulse"}`} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[17px] font-semibold">
              {name.trim() || "Live session"}
            </h3>
            <p className="font-mono text-[11.5px] text-[var(--text-3)]">
              {statusLabel(asrStatus)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="l-badge bg-[var(--danger-soft)] text-[var(--danger)]">
            {saving ? "saving" : "recording"}
          </span>
          <span className="w-12 font-mono text-[13px] text-[var(--text-2)]">
            {formatElapsed(elapsed)}
          </span>
          <Button
            type="button"
            onClick={() => void stopAndSave()}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Square className="size-4" />
            )}
            {saving ? "Saving…" : "Stop & save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            title="Discard session"
            onClick={() => void discard()}
            disabled={saving}
          >
            <span className="sr-only">Discard session</span>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </header>

      {asrWarning ? (
        <div className="flex items-start gap-2 border-b border-[var(--border-soft)] bg-[var(--warn-soft)] p-3 text-[13px] text-[var(--warn)]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{asrWarning}</span>
        </div>
      ) : null}

      <div
        ref={transcriptRef}
        className="max-h-[58dvh] min-h-60 space-y-1 overflow-auto p-4"
      >
        {finals.length === 0 && !interim ? (
          <p className="grid min-h-48 place-items-center text-center font-mono text-[11.5px] text-[var(--text-3)]">
            Listening… transcript appears here as you speak.
          </p>
        ) : (
          <>
            {finals.map((segment) => (
              <div
                key={`${segment.startMs}-${segment.endMs}`}
                className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-md px-3 py-2"
              >
                <span className="font-mono text-[11.5px] text-[var(--text-3)]">
                  {formatTime(segment.startMs)}
                </span>
                <span className="font-serif text-[16.5px] leading-7 text-foreground">
                  {segment.text}
                </span>
              </div>
            ))}
            {interim ? (
              <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-md px-3 py-2">
                <span className="font-mono text-[11.5px] text-[var(--text-4)]">
                  …
                </span>
                <span className="font-serif text-[16.5px] italic leading-7 text-[var(--text-3)]">
                  {interim}
                </span>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
