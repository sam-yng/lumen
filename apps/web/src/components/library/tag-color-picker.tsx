"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
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
  // Mirror the controlled value internally so the hidden form field reflects a
  // click even when the parent has not yet re-rendered with the new value.
  const [selected, setSelected] = useState(value);
  useEffect(() => setSelected(value), [value]);

  function choose(next: string) {
    setSelected(next);
    onChange(next);
  }

  return (
    <fieldset className="flex items-center gap-2" aria-label="Tag color">
      <input type="hidden" name={name} value={selected} readOnly />
      {TAG_COLOR_PRESETS.map((preset) => {
        const isSelected = preset.value === selected;
        return (
          <label
            key={preset.value}
            title={preset.label}
            className={cn(
              "grid size-8 cursor-pointer place-items-center rounded-md border border-[var(--border-soft)]",
              isSelected &&
                "border-[var(--accent-line)] ring-3 ring-[var(--accent-soft)]",
            )}
            style={{ backgroundColor: preset.value }}
          >
            <input
              type="radio"
              name={`${name}-picker`}
              value={preset.label}
              checked={isSelected}
              aria-label={preset.label}
              className="sr-only"
              onChange={() => choose(preset.value)}
            />
            {isSelected ? <Check className="size-4 text-white" /> : null}
          </label>
        );
      })}
    </fieldset>
  );
}
