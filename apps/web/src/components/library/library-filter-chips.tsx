"use client";

import type { Tables } from "@/server/db/database.types";

type TagRow = Tables<"tags">;

export function LibraryFilterChips({
  tags,
  selectedTagId,
  onSelectTag,
}: {
  tags: TagRow[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
}) {
  if (tags.length === 0) return null;

  const base =
    "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs transition-[background,border-color,color] duration-150 ease-[var(--ease)]";

  return (
    <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0 [&::-webkit-scrollbar]:hidden">
      <span className="mr-1 shrink-0 font-mono text-[11.5px] text-[var(--text-3)] uppercase">
        Filter
      </span>
      <button
        type="button"
        onClick={() => onSelectTag(null)}
        aria-pressed={selectedTagId === null}
        className={`${base} ${
          selectedTagId === null
            ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
            : "border-[var(--border-soft)] bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--border-strong)]"
        }`}
      >
        All
      </button>
      {tags.map((tag) => {
        const selected = selectedTagId === tag.id;
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onSelectTag(selected ? null : tag.id)}
            aria-pressed={selected}
            className={`${base} ${
              selected
                ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-foreground"
                : "border-[var(--border-soft)] bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--border-strong)]"
            }`}
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: tag.color ?? "#64748b" }}
            />
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}
