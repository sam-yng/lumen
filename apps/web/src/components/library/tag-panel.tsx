"use client";

import { Pencil, Tag, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Tables } from "@/server/db/database.types";
import { createTag, deleteTag, updateTag } from "./library-api";
import { ConfirmDialog, TextInputDialog } from "./library-dialogs";
import { useLibraryMutation } from "./library-hooks";
import { TAG_COLOR_PRESETS, TagColorPicker } from "./tag-color-picker";

type TagRow = Tables<"tags">;

function TagControls({ tag }: { tag: TagRow }) {
  const rename = useLibraryMutation(updateTag);
  const remove = useLibraryMutation(deleteTag);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        title={`Rename ${tag.name}`}
        className="absolute right-8 hidden group-hover:inline-flex group-focus-within:inline-flex"
        data-drawer-stay
        onClick={() => setRenameOpen(true)}
      >
        <span className="sr-only">Rename {tag.name}</span>
        <Pencil className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        title={`Delete ${tag.name}`}
        className="absolute right-1 hidden group-hover:inline-flex group-focus-within:inline-flex"
        data-drawer-stay
        onClick={() => setDeleteOpen(true)}
      >
        <span className="sr-only">Delete {tag.name}</span>
        <Trash2 className="size-4" />
      </Button>
      <TextInputDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title={`Rename ${tag.name}`}
        placeholder="Tag name"
        defaultValue={tag.name}
        submitLabel="Rename"
        onSubmit={(name) => rename.mutate({ id: tag.id, name })}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${tag.name}?`}
        description="The tag is removed from every linked node."
        confirmLabel="Delete"
        onConfirm={() => remove.mutate(tag.id)}
      />
    </>
  );
}

export function TagPanel({
  tags,
  tagLinks,
  selectedTagIds,
  onToggleTag,
}: {
  tags: TagRow[];
  tagLinks: Tables<"tag_links">[];
  selectedTagIds: ReadonlySet<string>;
  onToggleTag: (tagId: string) => void;
}) {
  const create = useLibraryMutation(createTag);
  const [color, setColor] = useState<string>(TAG_COLOR_PRESETS[0].value);

  return (
    <section className="space-y-3 border-t border-border-soft pt-4">
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
        data-drawer-stay
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const formData = new FormData(form);
          const name = String(formData.get("name") ?? "");
          const nextColor = String(formData.get("color") ?? "");
          if (!name.trim()) return;
          create.mutate({ name, color: nextColor || null });
          form.reset();
          setColor(TAG_COLOR_PRESETS[0].value);
        }}
      >
        <TagColorPicker name="color" value={color} onChange={setColor} />
        <div className="flex min-w-0 flex-1 gap-2">
          <Input
            name="name"
            placeholder="Tag name"
            aria-label="Tag name"
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="outline" title="Create tag">
            <span className="sr-only">Create tag</span>
            <Tag className="size-4" />
          </Button>
        </div>
      </form>
      <div className="space-y-1">
        {tags.map((tag) => (
          <div
            key={tag.id}
            className="group relative flex min-w-0 items-center"
          >
            <button
              type="button"
              aria-label={`Filter by ${tag.name}`}
              aria-pressed={selectedTagIds.has(tag.id)}
              onClick={() => onToggleTag(tag.id)}
              className={`grid h-8 w-full min-w-0 justify-between grid-cols-[auto_minmax(0,1fr)_2rem] items-center gap-2 rounded-md px-2 text-left text-[13px] transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-soft) ${
                selectedTagIds.has(tag.id)
                  ? "bg-(--accent-soft) text-accent-text"
                  : "text-text-2"
              }`}
            >
              <span
                className="font-mono text-sm font-medium"
                style={{ color: tag.color ?? "var(--text-3)" }}
              >
                #
              </span>
              <span className="truncate">{tag.name}</span>
              <span className="ml-auto text-xs tabular-nums text-text-4 group-hover:hidden group-focus-within:hidden">
                {tagLinks.filter((link) => link.tag_id === tag.id).length}
              </span>
            </button>
            <TagControls tag={tag} />
          </div>
        ))}
      </div>
    </section>
  );
}
