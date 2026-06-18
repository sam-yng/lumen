"use client";

import type { Tables } from "@/server/db/database.types";

type TagRow = Tables<"tags">;

export function LibraryFilterChips({
  tags,
  selectedTagIds,
  onToggleTag,
  onClearTags,
}: {
  tags: TagRow[];
  selectedTagIds: ReadonlySet<string>;
  onToggleTag: (tagId: string) => void;
  onClearTags: () => void;
}) {
  if (tags.length === 0) return null;

  const base =
    "relative inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs transition-[background,border-color,color] duration-150 ease-[var(--ease)] pointer-coarse:before:absolute pointer-coarse:before:-inset-1.5 pointer-coarse:before:content-['']";

  return (
    <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0 [&::-webkit-scrollbar]:hidden">
      <span className="mr-1 shrink-0 font-mono text-[11.5px] text-[var(--text-3)] uppercase">
        Filter
      </span>
      <button
        type="button"
        onClick={onClearTags}
        aria-pressed={selectedTagIds.size === 0}
        className={`${base} ${
          selectedTagIds.size === 0
            ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
            : "border-[var(--border-soft)] bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--border-strong)]"
        }`}
      >
        All
      </button>
      {tags.map((tag) => {
        const selected = selectedTagIds.has(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onToggleTag(tag.id)}
            aria-pressed={selected}
            className={`${base} ${
              selected
                ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
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
