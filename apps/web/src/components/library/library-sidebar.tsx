"use client";

import {
  ChevronRight,
  Clock,
  FileText,
  Folder,
  Library as LibraryIcon,
  LogOut,
  Plus,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ASSISTANT_ENABLED } from "@/lib/assistant-flags";
import type { Tables } from "@/server/db/database.types";
import type { LibraryNode } from "@/server/services/library-nodes";
import { canonicalNodePath } from "./library-paths";
import { TagPanel } from "./tag-panel";

type SignOutAction = () => Promise<void>;
type ChildrenByParent = Map<string | null, LibraryNode[]>;

function NodeTreeBranch({
  nodes,
  childrenByParent,
  selectedNodeId,
  parentId,
  depth = 0,
  ancestors = new Set<string>(),
}: {
  nodes: LibraryNode[];
  childrenByParent: ChildrenByParent;
  selectedNodeId: string | null;
  parentId: string | null;
  depth?: number;
  ancestors?: Set<string>;
}) {
  return (childrenByParent.get(parentId) ?? []).map((node) => {
    if (ancestors.has(node.id)) return null;
    const nextAncestors = new Set(ancestors).add(node.id);
    return (
      <div key={node.id}>
        <Link
          href={canonicalNodePath(nodes, node)}
          aria-current={selectedNodeId === node.id ? "page" : undefined}
          className={`group relative flex h-(--row-h) items-center gap-2 rounded-md pr-2 text-[13px] text-text-2 transition hover:bg-surface-2 hover:text-foreground ${
            selectedNodeId === node.id
              ? "bg-(--accent-soft) font-medium text-accent-text"
              : ""
          }`}
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          {selectedNodeId === node.id ? (
            <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-primary" />
          ) : null}
          <ChevronRight className="size-3.5 shrink-0 text-text-4" />
          {node.kind === "workspace" ? (
            <Folder className="size-4 shrink-0" />
          ) : (
            <FileText className="size-4 shrink-0" />
          )}
          <span className="truncate">{node.title}</span>
        </Link>
        <NodeTreeBranch
          nodes={nodes}
          childrenByParent={childrenByParent}
          selectedNodeId={selectedNodeId}
          parentId={node.id}
          depth={depth + 1}
          ancestors={nextAncestors}
        />
      </div>
    );
  });
}

function NodeTree({
  nodes,
  selectedNodeId,
}: {
  nodes: LibraryNode[];
  selectedNodeId: string | null;
}) {
  const childrenByParent = useMemo(() => {
    const map: ChildrenByParent = new Map();
    for (const node of nodes) {
      if (node.kind === "file" || node.kind === "audio") continue;
      const key = node.parent_id;
      map.set(key, [...(map.get(key) ?? []), node]);
    }
    for (const children of map.values()) {
      children.sort((a, b) => a.title.localeCompare(b.title));
    }
    return map;
  }, [nodes]);

  return (
    <NodeTreeBranch
      nodes={nodes}
      childrenByParent={childrenByParent}
      selectedNodeId={selectedNodeId}
      parentId={null}
    />
  );
}

export function LibrarySidebar({
  nodes,
  view = "library",
  tags,
  tagLinks,
  selectedTagIds,
  selectedNodeId,
  userEmail,
  signOutAction,
  onCreatePage,
  onFocusSearch,
  onToggleTag,
}: {
  nodes: LibraryNode[];
  view?: "library" | "recents";
  tags: Tables<"tags">[];
  tagLinks: Tables<"tag_links">[];
  selectedTagIds: ReadonlySet<string>;
  selectedNodeId: string | null;
  userEmail: string;
  signOutAction: SignOutAction;
  onCreatePage: () => void;
  onFocusSearch: () => void;
  onToggleTag: (tagId: string) => void;
}) {
  const pinned = nodes
    .filter((node) => node.is_pinned)
    .toSorted((a, b) => a.title.localeCompare(b.title));
  const navItem =
    "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px]";
  const navActive = "bg-(--accent-soft) font-medium text-accent-text";
  const navIdle = "text-text-2 hover:bg-surface-2";

  return (
    <aside className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface lg:border-r lg:border-border-soft">
      <div className="border-b border-border-soft p-4">
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
          <Button type="button" onClick={onCreatePage}>
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
        <nav className="mb-4 space-y-1" aria-label="Primary">
          <Link
            href="/"
            aria-current={view === "library" ? "page" : undefined}
            className={`${navItem} ${view === "library" ? navActive : navIdle}`}
          >
            <LibraryIcon className="size-4" />
            Library
          </Link>
          <Link
            href="/library/recents"
            aria-current={view === "recents" ? "page" : undefined}
            className={`${navItem} ${view === "recents" ? navActive : navIdle}`}
          >
            <Clock className="size-4" />
            Recents
          </Link>
          {ASSISTANT_ENABLED ? (
            <Link href="/assistant" className={`${navItem} ${navIdle}`}>
              <Sparkles className="size-4 text-accent-text" />
              Ask Lumen
            </Link>
          ) : (
            <span
              aria-disabled="true"
              title="Ask Lumen — enabling after launch"
              className={`${navItem} cursor-not-allowed text-text-2 opacity-60`}
            >
              <Sparkles className="size-4 text-accent-text" />
              Ask Lumen
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-(--accent-soft) px-1.5 py-px font-mono text-[10px] text-accent-text uppercase">
                <span className="size-[5px] rounded-full bg-accent" />
                soon
              </span>
            </span>
          )}
        </nav>

        {pinned.length > 0 ? (
          <section className="mb-4">
            <p className="mb-2 font-mono text-[11.5px] font-medium text-text-3 uppercase">
              Pinned
            </p>
            <nav className="space-y-1" aria-label="Pinned">
              {pinned.map((node) => (
                <Link
                  key={node.id}
                  href={canonicalNodePath(nodes, node)}
                  className={`${navItem} ${navIdle}`}
                >
                  {node.kind === "workspace" ? (
                    <Folder className="size-4" />
                  ) : (
                    <FileText className="size-4" />
                  )}
                  <span className="truncate">{node.title}</span>
                </Link>
              ))}
            </nav>
          </section>
        ) : null}

        <section className="mb-4">
          <p className="mb-2 font-mono text-[11.5px] font-medium text-text-3 uppercase">
            Library
          </p>
          <nav className="space-y-1" aria-label="Library tree">
            <NodeTree nodes={nodes} selectedNodeId={selectedNodeId} />
          </nav>
        </section>

        <TagPanel
          tags={tags}
          tagLinks={tagLinks}
          selectedTagIds={selectedTagIds}
          onToggleTag={onToggleTag}
        />
      </div>
      <div className="border-t border-border-soft p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-full bg-[linear-gradient(135deg,var(--accent),var(--busy))] text-sm font-semibold text-(--on-accent)">
            {userEmail.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">Workspace</p>
            <p className="truncate text-xs text-text-3">{userEmail}</p>
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
