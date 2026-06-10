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
        variant="outline"
        size="sm"
        title={`Rename ${tag.name}`}
        data-drawer-stay
        onClick={() => setRenameOpen(true)}
      >
        <span className="sr-only">Rename {tag.name}</span>
        <Pencil className="size-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        title={`Delete ${tag.name}`}
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
        label="Tag name"
        defaultValue={tag.name}
        submitLabel="Rename"
        onSubmit={(name) => rename.mutate({ id: tag.id, name })}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${tag.name}?`}
        description="The tag is removed from every note and file."
        confirmLabel="Delete"
        onConfirm={() => remove.mutate(tag.id)}
      />
    </>
  );
}

export function TagPanel({
  tags,
  selectedTagId,
  onSelectTag,
}: {
  tags: TagRow[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
}) {
  const create = useLibraryMutation(createTag);
  const [color, setColor] = useState<string>(TAG_COLOR_PRESETS[0].value);

  return (
    <section className="space-y-3 border-t border-[var(--border-soft)] pt-4">
      <form
        className="space-y-2"
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
        <div className="flex gap-2">
          <Input name="name" placeholder="Tag name" aria-label="Tag name" />
          <Button type="submit" variant="outline" title="Create tag">
            <span className="sr-only">Create tag</span>
            <Tag className="size-4" />
          </Button>
        </div>
        <TagColorPicker name="color" value={color} onChange={setColor} />
      </form>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={selectedTagId === null ? "default" : "outline"}
          size="sm"
          onClick={() => onSelectTag(null)}
        >
          All
        </Button>
        {tags.map((tag) => (
          <div key={tag.id} className="inline-flex items-center gap-1">
            <Button
              type="button"
              variant={selectedTagId === tag.id ? "default" : "outline"}
              size="sm"
              onClick={() => onSelectTag(tag.id)}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: tag.color ?? "#64748b" }}
              />
              {tag.name}
            </Button>
            <TagControls tag={tag} />
          </div>
        ))}
      </div>
    </section>
  );
}
