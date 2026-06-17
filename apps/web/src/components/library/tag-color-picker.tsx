"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const TAG_COLOR_PRESETS = [
  { label: "Green", value: "#22c55e" },
  { label: "Blue", value: "#38bdf8" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Red", value: "#ef4444" },
  { label: "Violet", value: "#a78bfa" },
] as const;

export function TagColorPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  // Mirror the controlled value internally so the field reflects a change even
  // when the parent has not yet re-rendered with the new value.
  const [selected, setSelected] = useState(value);
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => setSelected(value), [value]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !pickerRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function choose(next: string) {
    setSelected(next);
    setOpen(false);
    onChange(next);
  }

  return (
    <div ref={pickerRef} className="relative shrink-0">
      <input type="hidden" name={name} value={selected} />
      <button
        type="button"
        aria-label="Tag color"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex size-8 shrink-0 touch-manipulation items-center justify-center rounded-md border border-[var(--border-soft)] bg-[var(--canvas)] p-1 transition-[border-color,box-shadow,transform] duration-150 ease-[var(--ease)] outline-none focus-visible:border-[var(--accent-line)] focus-visible:ring-3 focus-visible:ring-[var(--accent-soft)] active:translate-y-px"
      >
        <span
          aria-hidden
          className="size-5 shrink-0 rounded-md border border-[var(--border-soft)]"
          style={{ backgroundColor: selected }}
        />
      </button>
      {open ? (
        <div
          data-testid="tag-color-options"
          className="absolute top-full left-0 z-20 mt-1 grid w-max grid-cols-5 gap-1 rounded-md border border-[var(--border)] bg-[var(--canvas)] p-1 shadow-[var(--shadow-pop)]"
        >
          {TAG_COLOR_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              aria-label={`Use ${preset.label} tag color`}
              aria-pressed={selected === preset.value}
              title={preset.label}
              onClick={() => choose(preset.value)}
              className={cn(
                "flex size-8 shrink-0 touch-manipulation items-center justify-center rounded-md border border-[var(--border-soft)] bg-[var(--canvas)] p-1 transition-[border-color,box-shadow,transform] duration-150 ease-[var(--ease)] outline-none focus-visible:border-[var(--accent-line)] focus-visible:ring-3 focus-visible:ring-[var(--accent-soft)] active:translate-y-px",
                selected === preset.value &&
                  "border-[var(--border-strong)] ring-2 ring-[var(--accent-soft)]",
              )}
            >
              <span
                aria-hidden
                className="size-5 shrink-0 rounded-md border border-[var(--border-soft)]"
                style={{ backgroundColor: preset.value }}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
