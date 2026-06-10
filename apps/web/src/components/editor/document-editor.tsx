"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { Content } from "@tiptap/core";
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
  TableIcon,
} from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import {
  libraryQueryKey,
  updateDocument,
} from "@/components/library/library-api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      variant={active ? "default" : "ghost"}
      size="icon-sm"
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
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const linkFieldId = useId();
  const content = useMemo(() => initialContent(document), [document]);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          autolink: true,
        },
      }),
      Placeholder.configure({
        placeholder: "Start taking notes...",
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
        class: "lumen-editor min-h-[460px] outline-none",
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

  function openLinkDialog() {
    const current = editor?.getAttributes("link").href as string | undefined;
    setLinkHref(current ?? "https://");
    setLinkDialogOpen(true);
  }

  function applyLink() {
    const href = linkHref.trim();
    if (href === "") {
      editor?.chain().focus().unsetLink().run();
    } else {
      editor?.chain().focus().setLink({ href }).run();
    }
    setLinkDialogOpen(false);
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
  const statusTone =
    saveState === "dirty"
      ? "bg-[var(--warn)]"
      : saveState === "saving"
        ? "bg-[var(--warn)] animate-pulse"
        : saveState === "error"
          ? "bg-[var(--danger)]"
          : saveState === "saved"
            ? "bg-[var(--ok)]"
            : "bg-[var(--text-4)]";
  const wordCount = editor.getText().trim().split(/\s+/).filter(Boolean).length;
  const updated = document.updated_at
    ? new Date(document.updated_at).toLocaleDateString()
    : "Not saved";

  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-[var(--border-soft)] bg-[var(--surface)]">
      <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] px-4">
        <div className="min-w-0">
          <p className="font-mono text-[11.5px] text-[var(--text-3)]">
            Library / note
          </p>
          <h3 className="truncate text-[17px] font-semibold">
            {document.title}
          </h3>
        </div>
        <div className="inline-flex items-center gap-2 font-mono text-[11.5px] text-[var(--text-3)]">
          <span className={`size-2 rounded-full ${statusTone}`} />
          <span className="hidden sm:inline">{status}</span>
          <span className="sr-only">{status}</span>
        </div>
      </div>

      <div className="sticky top-0 z-10 flex min-h-[42px] items-center gap-1 overflow-x-auto border-b border-[var(--border-soft)] bg-[var(--surface)] px-3 whitespace-nowrap [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-center sm:overflow-visible sm:whitespace-normal">
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
        <span className="mx-1 h-5 w-px bg-[var(--border-soft)]" />
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
        <span className="mx-1 h-5 w-px bg-[var(--border-soft)]" />
        <ToolbarButton
          label="Link"
          active={editor.isActive("link")}
          onClick={openLinkDialog}
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

      <div className="mx-auto max-w-[700px] px-4 py-6 sm:px-5 sm:py-8">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="l-chip border-dashed text-[var(--text-3)]">Tag</span>
        </div>
        <p className="mb-6 font-mono text-[11.5px] text-[var(--text-3)]">
          Updated {updated} · {wordCount} words · in Library
        </p>
        <EditorContent editor={editor} />
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </div>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogTitle className="text-sm font-semibold">Link</DialogTitle>
          <form
            className="mt-3 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              applyLink();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor={linkFieldId}>Link URL</Label>
              <Input
                id={linkFieldId}
                value={linkHref}
                placeholder="https://"
                onChange={(event) => setLinkHref(event.target.value)}
                autoFocus
              />
              <p className="text-[12px] text-[var(--text-3)]">
                Leave empty to remove the link.
              </p>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" size="sm">
                Apply
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
