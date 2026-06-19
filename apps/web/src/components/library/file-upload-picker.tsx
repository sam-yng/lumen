"use client";

import { Trash2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// Mirror of the server-side gate in `uploads.ts` (UX hint only; the server is
// authoritative). Only PDFs and audio files may be uploaded.
const ACCEPT = "application/pdf,audio/*";

function isAllowedFile(file: File) {
  const type = file.type.toLowerCase();
  return type === "application/pdf" || type.startsWith("audio/");
}

export function FileUploadPicker({ name }: { name: string }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function clear() {
    setSelectedFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleChange(file: File | null) {
    if (!file) {
      clear();
      return;
    }
    if (!isAllowedFile(file)) {
      setSelectedFile(null);
      setError("Only PDF and audio files can be uploaded.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setError(null);
    setSelectedFile(file);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={inputId}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border-soft bg-surface-2 px-3 text-[13px] text-text-2 transition hover:border-border-strong hover:text-foreground"
        >
          <Upload className="size-4" />
          Choose file
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          name={name}
          accept={ACCEPT}
          aria-label="Choose file"
          className="sr-only"
          onChange={(event) =>
            handleChange(event.currentTarget.files?.[0] ?? null)
          }
        />
        {selectedFile ? (
          <span className="inline-flex items-center gap-2 text-[13px] text-text-2">
            <span className="max-w-[200px] truncate">{selectedFile.name}</span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={clear}
              title="Remove selected file"
            >
              <span className="sr-only">Remove selected file</span>
              <Trash2 className="size-4" />
            </Button>
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="text-[12px] text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-[11.5px] text-text-3">PDF or audio files only.</p>
      )}
    </div>
  );
}
