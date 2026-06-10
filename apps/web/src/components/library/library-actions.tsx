"use client";

import { FolderPlus, Plus, Radio, Upload } from "lucide-react";
import { RecordAudioForm } from "@/components/transcripts/record-audio-form";
import { Button } from "@/components/ui/button";

export function LibraryActions({
  onCreateNote,
  onCreateFolder,
  onUpload,
  onRecordSave,
  onStartLiveSession,
}: {
  onCreateNote: () => void;
  onCreateFolder: () => void;
  onUpload: () => void;
  onRecordSave: (file: File) => void;
  onStartLiveSession: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-soft)] pb-4">
      <Button type="button" size="sm" onClick={onCreateNote}>
        <Plus className="size-4" />
        New note
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onCreateFolder}
      >
        <FolderPlus className="size-4" />
        New folder
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onUpload}>
        <Upload className="size-4" />
        Upload
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onStartLiveSession}
      >
        <Radio className="size-4" />
        Live session
      </Button>
      <RecordAudioForm onSave={onRecordSave} />
    </div>
  );
}
