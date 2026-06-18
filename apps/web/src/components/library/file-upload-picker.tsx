"use client";

import { Trash2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function FileUploadPicker({ name }: { name: string }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function clear() {
    setSelectedFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        htmlFor={inputId}
        className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text-2)] transition hover:border-[var(--border-strong)] hover:text-foreground"
      >
        <Upload className="size-4" />
        Choose file
      </label>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        name={name}
        aria-label="Choose file"
        className="sr-only"
        onChange={(event) =>
          setSelectedFile(event.currentTarget.files?.[0] ?? null)
        }
      />
      {selectedFile ? (
        <span className="inline-flex items-center gap-2 text-[13px] text-[var(--text-2)]">
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
  );
}
