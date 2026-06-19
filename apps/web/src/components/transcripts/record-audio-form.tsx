"use client";

import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export function RecordAudioForm({ onSave }: { onSave: (file: File) => void }) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!recording) return;
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => window.clearInterval(interval);
  }, [recording]);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      for (const track of stream.getTracks()) track.stop();
      const type = recorder.mimeType || "audio/webm";
      const file = new File(chunksRef.current, `recording-${Date.now()}.webm`, {
        type,
      });
      onSave(file);
      setRecording(false);
    };
    recorder.start();
    setRecording(true);
    setElapsed(0);
  }

  function stop() {
    recorderRef.current?.stop();
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-border-soft bg-surface-2">
      <span
        className={`grid size-8 place-items-center rounded-md ${
          recording
            ? "bg-(--danger-soft) text-danger"
            : "bg-surface-3 text-text-3"
        }`}
      >
        <Mic className={`size-4 ${recording ? "animate-pulse" : ""}`} />
      </span>
      <span className="w-12 font-mono text-[11.5px] text-text-3">
        {formatElapsed(elapsed)}
      </span>
      <Button
        type="button"
        variant={recording ? "ghost" : "outline"}
        size="icon-sm"
        onClick={() => void start()}
        disabled={recording}
        title="Start recording"
      >
        <span className="sr-only">Start recording</span>
        <Mic className="size-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={stop}
        disabled={!recording}
        title="Stop and save recording"
      >
        <span className="sr-only">Stop and save recording</span>
        <Square className="size-4" />
      </Button>
    </div>
  );
}
