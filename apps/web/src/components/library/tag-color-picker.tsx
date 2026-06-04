"use client";

import { useEffect, useState } from "react";

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
  useEffect(() => setSelected(value), [value]);

  function choose(next: string) {
    setSelected(next);
    onChange(next);
  }

  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="size-5 shrink-0 rounded-md border border-[var(--border-soft)]"
        style={{ backgroundColor: selected }}
      />
      <select
        name={name}
        value={selected}
        aria-label="Tag color"
        onChange={(event) => choose(event.target.value)}
        className="h-8 rounded-md border border-input bg-[var(--surface-2)] px-2 text-[13px] text-foreground outline-none focus-visible:border-[var(--accent-line)] focus-visible:ring-3 focus-visible:ring-[var(--accent-soft)]"
      >
        {TAG_COLOR_PRESETS.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
      </select>
    </div>
  );
}
