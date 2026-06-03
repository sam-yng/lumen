"use client";

import { Mic, Square } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function RecordAudioForm({ onSave }: { onSave: (file: File) => void }) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);

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
  }

  function stop() {
    recorderRef.current?.stop();
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
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
