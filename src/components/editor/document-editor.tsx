"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { Content } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Italic,
  LinkIcon,
  List,
  ListChecks,
  Save,
  TableIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  libraryQueryKey,
  updateDocument,
} from "@/components/library/library-api";
import { Button } from "@/components/ui/button";
import type { Json, Tables } from "@/server/db/database.types";

type DocumentRow = Tables<"documents">;
type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

function emptyDocument(): Content {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [] }],
  };
}

function documentFromText(text: string | null): Content {
  if (!text) return emptyDocument();
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}

function initialContent(document: DocumentRow): Content {
  return (document.content_json ??
    documentFromText(document.content_text)) as Content;
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      title={label}
    >
      <span className="sr-only">{label}</span>
      {children}
    </Button>
  );
}

export function DocumentEditor({ document }: { document: DocumentRow }) {
  const queryClient = useQueryClient();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const content = useMemo(() => initialContent(document), [document]);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start taking notes...",
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          "min-h-72 rounded-md border bg-background px-4 py-3 text-sm leading-7 outline-none prose prose-sm max-w-none",
      },
    },
    onUpdate: () => {
      setSaveState("dirty");
      setError(null);
    },
  });

  useEffect(() => {
    if (!editor || saveState !== "dirty") return;

    const timeout = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        await updateDocument({
          id: document.id,
          contentJson: editor.getJSON() as Json,
        });
        await queryClient.invalidateQueries({ queryKey: libraryQueryKey });
        setSaveState("saved");
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Could not save document.",
        );
        setSaveState("error");
      }
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [document.id, editor, queryClient, saveState]);

  if (!editor) {
    return (
      <section className="rounded-md border p-4 text-sm text-muted-foreground">
        Loading editor...
      </section>
    );
  }

  function setLink() {
    const current = editor?.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link URL", current ?? "https://");
    if (href === null) return;
    if (href.trim() === "") {
      editor?.chain().focus().unsetLink().run();
      return;
    }
    editor?.chain().focus().setLink({ href }).run();
  }

  const status =
    saveState === "dirty"
      ? "Unsaved changes"
      : saveState === "saving"
        ? "Saving..."
        : saveState === "saved"
          ? "Saved"
          : saveState === "error"
            ? "Save failed"
            : "Ready";

  return (
    <section className="space-y-3 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{document.title}</h3>
          <p className="text-xs text-muted-foreground">
            Rich-text note with autosave
          </p>
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Save className="size-4" />
          {status}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Task list"
          active={editor.isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <ListChecks className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Link"
          active={editor.isActive("link")}
          onClick={setLink}
        >
          <LinkIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Insert table"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          <TableIcon className="size-4" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
