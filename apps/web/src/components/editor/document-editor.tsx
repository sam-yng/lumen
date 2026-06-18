"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { Content, Editor } from "@tiptap/core";
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
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

function useDocumentAutosave({
  documentId,
  editor,
  queryClient,
  saveState,
  setError,
  setSaveState,
}: {
  documentId: string;
  editor: Editor | null;
  queryClient: ReturnType<typeof useQueryClient>;
  saveState: SaveState;
  setError: (error: string | null) => void;
  setSaveState: (state: SaveState) => void;
}) {
  useLayoutEffect(() => {
    if (!editor || saveState !== "dirty") return;

    const timeout = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        await updateDocument({
          id: documentId,
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
  }, [documentId, editor, queryClient, saveState, setError, setSaveState]);
}

function useCitationBlockMarker({
  citationBlockIndex,
  editor,
  editorShellRef,
}: {
  citationBlockIndex: number | null;
  editor: Editor | null;
  editorShellRef: React.RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
    if (!editor) return;

    function markCitationBlock() {
      const editorRoot = editorShellRef.current?.querySelector(".lumen-editor");
      const blockElements = Array.from(editorRoot?.children ?? []).filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
      );

      if (blockElements.length === 0) return false;

      for (const [blockIndex, element] of blockElements.entries()) {
        element.dataset.citationBlock = String(blockIndex);
        element.classList.remove("l-citation-block-active");
      }

      if (citationBlockIndex === null) return;

      const target = blockElements[citationBlockIndex];
      if (!target) return;

      target.classList.add("l-citation-block-active");
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      return true;
    }

    markCitationBlock();
    const frame = window.requestAnimationFrame(markCitationBlock);
    const timeout = window.setTimeout(markCitationBlock, 100);
    const interval = window.setInterval(() => {
      if (markCitationBlock()) window.clearInterval(interval);
    }, 100);
    const intervalStop = window.setTimeout(
      () => window.clearInterval(interval),
      2_000,
    );

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      window.clearTimeout(intervalStop);
    };
  }, [citationBlockIndex, editor, editorShellRef]);
}

function saveStatusLabel(saveState: SaveState) {
  if (saveState === "dirty") return "Unsaved changes";
  if (saveState === "saving") return "Saving...";
  if (saveState === "saved") return "Saved";
  if (saveState === "error") return "Save failed";
  return "Ready";
}

function saveStatusTone(saveState: SaveState) {
  if (saveState === "dirty") return "bg-[var(--warn)]";
  if (saveState === "saving") return "bg-[var(--warn)] animate-pulse";
  if (saveState === "error") return "bg-[var(--danger)]";
  if (saveState === "saved") return "bg-[var(--ok)]";
  return "bg-[var(--text-4)]";
}

function DocumentHeader({
  saveState,
  title,
}: {
  saveState: SaveState;
  title: string;
}) {
  const status = saveStatusLabel(saveState);
  const statusTone = saveStatusTone(saveState);

  return (
    <div className="flex min-h-[var(--topbar-h)] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] px-4 py-3">
      <div className="min-w-0">
        <p className="font-mono text-[11.5px] text-[var(--text-3)]">
          Library / note
        </p>
        <h3 className="truncate text-[16px] font-semibold">{title}</h3>
      </div>
      <div className="inline-flex items-center gap-2 font-mono text-[11.5px] text-[var(--text-3)]">
        <span className={`size-2 rounded-full ${statusTone}`} />
        <span className="hidden sm:inline">{status}</span>
        <span className="sr-only">{status}</span>
      </div>
    </div>
  );
}

function EditorToolbar({
  editor,
  onOpenLinkDialog,
}: {
  editor: Editor;
  onOpenLinkDialog: () => void;
}) {
  return (
    <div className="z-10 flex min-h-[40px] shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--border-soft)] bg-[var(--surface)] px-3 whitespace-nowrap [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-center sm:overflow-visible sm:whitespace-normal">
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
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
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
        onClick={onOpenLinkDialog}
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
  );
}

function CitationBlockStyle({
  anchorScopeId,
  citationBlockIndex,
}: {
  anchorScopeId: string;
  citationBlockIndex: number | null;
}) {
  if (citationBlockIndex === null) return null;

  return (
    <style>{`
      #${anchorScopeId} .lumen-editor > :nth-child(${citationBlockIndex + 1}) {
        border-radius: var(--r);
        background: var(--accent-soft);
        box-shadow: 0 0 0 6px var(--accent-soft);
      }
    `}</style>
  );
}

function EditorMeta({
  updated,
  wordCount,
}: {
  updated: string;
  wordCount: number;
}) {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="l-chip border-dashed text-[var(--text-3)]">Tag</span>
      </div>
      <p className="mb-6 font-mono text-[11.5px] text-[var(--text-3)]">
        Updated {updated} · {wordCount} words · in Library
      </p>
    </>
  );
}

function LinkDialog({
  fieldId,
  href,
  open,
  onHrefChange,
  onOpenChange,
  onSubmit,
}: {
  fieldId: string;
  href: string;
  open: boolean;
  onHrefChange: (href: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="text-sm font-semibold">Link</DialogTitle>
        <form
          className="mt-3 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={fieldId}>Link URL</Label>
            <Input
              id={fieldId}
              value={href}
              placeholder="https://"
              onChange={(event) => onHrefChange(event.target.value)}
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
  );
}

function useEditorLinkDialog(editor: Editor | null) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  const fieldId = useId();

  function openDialog() {
    const current = editor?.getAttributes("link").href as string | undefined;
    setHref(current ?? "https://");
    setOpen(true);
  }

  function applyLink() {
    const nextHref = href.trim();
    if (nextHref === "") {
      editor?.chain().focus().unsetLink().run();
    } else {
      editor?.chain().focus().setLink({ href: nextHref }).run();
    }
    setOpen(false);
  }

  return { applyLink, fieldId, href, open, openDialog, setHref, setOpen };
}

function useDocumentEditorState({
  citationBlockIndex,
  document,
}: {
  citationBlockIndex: number | null;
  document: DocumentRow;
}) {
  const queryClient = useQueryClient();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const editorShellRef = useRef<HTMLDivElement | null>(null);
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

  useDocumentAutosave({
    documentId: document.id,
    editor,
    queryClient,
    saveState,
    setError,
    setSaveState,
  });
  useCitationBlockMarker({ citationBlockIndex, editor, editorShellRef });

  const linkDialog = useEditorLinkDialog(editor);
  const anchorScopeId = `note-anchor-${linkDialog.fieldId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const updated = document.updated_at
    ? new Date(document.updated_at).toLocaleDateString()
    : "Not saved";
  const wordCount =
    editor?.getText().trim().split(/\s+/).filter(Boolean).length ?? 0;

  return {
    anchorScopeId,
    editor,
    editorShellRef,
    error,
    linkDialog,
    saveState,
    updated,
    wordCount,
  };
}

export function DocumentEditor({
  document,
  citationBlockIndex = null,
}: {
  document: DocumentRow;
  citationBlockIndex?: number | null;
}) {
  const {
    anchorScopeId,
    editor,
    editorShellRef,
    error,
    linkDialog,
    saveState,
    updated,
    wordCount,
  } = useDocumentEditorState({ citationBlockIndex, document });

  if (!editor) {
    return (
      <section className="rounded-md border p-4 text-sm text-muted-foreground">
        Loading editor...
      </section>
    );
  }

  return (
    <section
      data-testid="document-editor-shell"
      className="flex h-[calc(100dvh-var(--topbar-h)-2rem)] min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-[var(--border-soft)] bg-[var(--surface)] lg:h-[calc(100dvh-var(--topbar-h)-3rem)]"
    >
      <DocumentHeader saveState={saveState} title={document.title} />
      <EditorToolbar editor={editor} onOpenLinkDialog={linkDialog.openDialog} />

      <div
        data-testid="document-editor-scroll"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div
          id={anchorScopeId}
          ref={editorShellRef}
          data-citation-block-target={citationBlockIndex ?? undefined}
          className="mx-auto max-w-[700px] px-4 py-6 sm:px-5 sm:py-8"
        >
          <CitationBlockStyle
            anchorScopeId={anchorScopeId}
            citationBlockIndex={citationBlockIndex}
          />
          <EditorMeta updated={updated} wordCount={wordCount} />
          <EditorContent editor={editor} />
          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        </div>
      </div>

      <LinkDialog
        fieldId={linkDialog.fieldId}
        href={linkDialog.href}
        open={linkDialog.open}
        onHrefChange={linkDialog.setHref}
        onOpenChange={linkDialog.setOpen}
        onSubmit={linkDialog.applyLink}
      />
    </section>
  );
}
