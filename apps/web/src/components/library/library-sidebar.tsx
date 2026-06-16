"use client";

import {
  ChevronRight,
  Clock,
  Folder,
  FolderPlus,
  Library as LibraryIcon,
  LogOut,
  Plus,
  Search,
  Settings,
  Sparkles,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ASSISTANT_ENABLED } from "@/lib/assistant-flags";
import type { Tables } from "@/server/db/database.types";
import { TagPanel } from "./tag-panel";

type FolderRow = Tables<"folders">;
type TagRow = Tables<"tags">;
type SignOutAction = () => Promise<void>;

function FolderTree({
  folders,
  selectedFolderId,
  onSelect,
}: {
  folders: FolderRow[];
  selectedFolderId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, FolderRow[]>();
    for (const folder of folders) {
      const key = folder.parent_id;
      map.set(key, [...(map.get(key) ?? []), folder]);
    }
    for (const children of map.values()) {
      children.sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [folders]);

  function renderFolders(parentId: string | null, depth = 0) {
    return (childrenByParent.get(parentId) ?? []).map((folder) => (
      <div key={folder.id}>
        <button
          type="button"
          onClick={() => onSelect(folder.id)}
          className={`group relative flex h-[var(--row-h)] w-full items-center gap-2 rounded-md pr-2 text-left text-[13px] text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-foreground ${
            selectedFolderId === folder.id
              ? "bg-[var(--accent-soft)] font-medium text-[var(--accent-text)]"
              : ""
          }`}
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          {selectedFolderId === folder.id ? (
            <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-primary" />
          ) : null}
          <ChevronRight className="size-3.5 shrink-0 text-[var(--text-4)]" />
          <Folder className="size-4 shrink-0" />
          <span className="truncate">{folder.name}</span>
        </button>
        {renderFolders(folder.id, depth + 1)}
      </div>
    ));
  }

  return (
    <nav className="space-y-1">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`group relative flex h-[var(--row-h)] w-full items-center gap-2 rounded-md px-2 text-left text-[13px] text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-foreground ${
          selectedFolderId === null
            ? "bg-[var(--accent-soft)] font-medium text-[var(--accent-text)]"
            : ""
        }`}
      >
        {selectedFolderId === null ? (
          <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-primary" />
        ) : null}
        <LibraryIcon className="size-4 shrink-0" />
        <span className="truncate">Library</span>
      </button>
      {renderFolders(null)}
    </nav>
  );
}

export function LibrarySidebar({
  view,
  folders,
  selectedFolderId,
  tags,
  selectedTagId,
  userEmail,
  signOutAction,
  onSelectFolder,
  onSelectTag,
  onCreateNote,
  onCreateFolder,
  onFocusSearch,
}: {
  view: "library" | "tags";
  folders: FolderRow[];
  selectedFolderId: string | null;
  tags: TagRow[];
  selectedTagId: string | null;
  userEmail: string;
  signOutAction: SignOutAction;
  onSelectFolder: (folderId: string | null) => void;
  onSelectTag: (tagId: string | null) => void;
  onCreateNote: () => void;
  onCreateFolder: () => void;
  onFocusSearch: () => void;
}) {
  const navItem =
    "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px]";
  const navActive =
    "bg-[var(--accent-soft)] font-medium text-[var(--accent-text)]";
  const navIdle = "text-[var(--text-2)] hover:bg-[var(--surface-2)]";

  return (
    <aside className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--surface)] lg:border-r lg:border-[var(--border-soft)]">
      <div className="border-b border-[var(--border-soft)] p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="inline-flex items-center gap-2">
            <span className="size-[11px] rounded-full bg-primary shadow-[0_0_24px_var(--accent-glow)]" />
            <h1 className="font-semibold">Lumen</h1>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" title="Settings">
            <Settings className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Button type="button" onClick={onCreateNote}>
            <Plus className="size-4" />
            New note
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Search"
            onClick={onFocusSearch}
          >
            <Search className="size-4" />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <nav className="mb-4 space-y-1">
          <Link
            href="/library"
            aria-current={view === "library" ? "page" : undefined}
            className={`${navItem} ${view === "library" ? navActive : navIdle}`}
          >
            <LibraryIcon className="size-4" />
            Library
          </Link>
          <span
            aria-disabled="true"
            title="Recents ship in a later release"
            className={`${navItem} cursor-not-allowed text-[var(--text-2)] opacity-50`}
          >
            <Clock className="size-4" />
            Recents
          </span>
          <Link
            href="/library/tags"
            aria-current={view === "tags" ? "page" : undefined}
            className={`${navItem} ${view === "tags" ? navActive : navIdle}`}
          >
            <Tag className="size-4" />
            Tags
          </Link>
          {ASSISTANT_ENABLED ? (
            <Link href="/assistant" className={`${navItem} ${navIdle}`}>
              <Sparkles className="size-4 text-[var(--accent-text)]" />
              Ask Lumen
            </Link>
          ) : (
            <span
              aria-disabled="true"
              title="Ask Lumen — enabling after launch"
              className={`${navItem} cursor-not-allowed text-[var(--text-2)] opacity-60`}
            >
              <Sparkles className="size-4 text-[var(--accent-text)]" />
              Ask Lumen
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-1.5 py-px font-mono text-[10px] tracking-wide text-[var(--accent-text)] uppercase">
                <span className="size-[5px] rounded-full bg-[var(--accent)]" />
                soon
              </span>
            </span>
          )}
        </nav>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-mono text-[11.5px] font-medium text-[var(--text-3)] uppercase">
            Library
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="New folder"
            onClick={onCreateFolder}
          >
            <span className="sr-only">New folder</span>
            <FolderPlus className="size-3.5" />
          </Button>
        </div>
        <FolderTree
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelect={onSelectFolder}
        />
        <TagPanel
          tags={tags}
          selectedTagId={selectedTagId}
          onSelectTag={onSelectTag}
        />
      </div>
      <div className="border-t border-[var(--border-soft)] p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-full bg-[linear-gradient(135deg,var(--accent),var(--busy))] text-sm font-semibold text-[var(--on-accent)]">
            {userEmail.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">Workspace</p>
            <p className="truncate text-xs text-[var(--text-3)]">{userEmail}</p>
          </div>
          <form action={signOutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              title="Log out"
            >
              <span className="sr-only">Log out</span>
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}
