"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SearchPanel } from "@/components/search/search-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LibraryNode } from "@/server/services/library-nodes";
import { LibraryActions } from "./library-actions";
import {
  createPage,
  createWorkspace,
  fetchLibrarySnapshot,
  libraryQueryKey,
} from "./library-api";
import { LibraryContent } from "./library-content";
import { TextInputDialog } from "./library-dialogs";
import { LibraryFilterChips } from "./library-filter-chips";
import { canonicalNodePath, nodePath } from "./library-paths";
import { LibraryShell } from "./library-shell";
import { LibrarySidebar } from "./library-sidebar";
import { filterNodesBySelectedTags } from "./library-tags";
import { NoteRoute } from "./note-route";
import { TranscriptRoute } from "./transcript-route";

type SignOutAction = () => Promise<void>;

export function LibraryWorkspace({
  signOutAction,
  userEmail,
  workspaceSlug,
  nodeSlug,
}: {
  signOutAction: SignOutAction;
  userEmail: string;
  workspaceSlug?: string;
  nodeSlug?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [pageDialogOpen, setPageDialogOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    () => new Set(),
  );
  const { data, error, isLoading } = useQuery({
    queryKey: libraryQueryKey,
    queryFn: fetchLibrarySnapshot,
  });

  const createWorkspaceMutation = useMutation({
    mutationFn: createWorkspace,
    onSuccess: async (node) => {
      await queryClient.invalidateQueries({ queryKey: libraryQueryKey });
      router.push(`/${node.slug}`);
    },
  });
  const createPageMutation = useMutation({
    mutationFn: createPage,
    onSuccess: async (node) => {
      await queryClient.invalidateQueries({ queryKey: libraryQueryKey });
      if (data) router.push(canonicalNodePath(data.nodes, node));
    },
  });

  if (isLoading) {
    return (
      <div className="grid min-h-96 flex-1 place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="grid min-h-96 flex-1 place-items-center text-sm text-destructive">
        {error instanceof Error ? error.message : "Could not load library."}
      </div>
    );
  }

  const { nodes, tags = [], tagLinks = [] } = data;
  const filteredNodes = filterNodesBySelectedTags(
    nodes,
    tagLinks,
    selectedTagIds,
  );
  const toggleTag = (tagId: string) => {
    setSelectedTagIds((current) => {
      const next = new Set(current);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };
  const workspace = workspaceSlug
    ? nodes.find(
        (node) => node.kind === "workspace" && node.slug === workspaceSlug,
      )
    : null;
  const selectedNode = nodeSlug
    ? (nodes.find(
        (node) => node.slug === nodeSlug && node.workspace_id === workspace?.id,
      ) ?? null)
    : workspace;
  const selectedContainer =
    selectedNode?.kind === "workspace" || selectedNode?.kind === "page"
      ? selectedNode
      : null;
  const parentContainer = selectedNode?.parent_id
    ? (nodes.find((node) => node.id === selectedNode.parent_id) ?? null)
    : null;
  const pageParent = selectedContainer ?? parentContainer ?? workspace;
  const atRoot = workspaceSlug === undefined;
  const hasWorkspace = nodes.some((node) => node.kind === "workspace");
  const firstRun = workspaceSlug === undefined && !hasWorkspace;
  const crumbs = nodePath(nodes, selectedNode?.id ?? null);
  const openNode = (node: LibraryNode) =>
    router.push(canonicalNodePath(nodes, node));
  const openNodeById = (id: string) => {
    const node = nodes.find((candidate) => candidate.id === id);
    if (node) openNode(node);
  };

  const topBar = (
    <div className="flex min-h-[var(--topbar-h)] w-full min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2 text-[13px] text-[var(--text-3)]">
        <button
          type="button"
          className="shrink-0 hover:text-foreground"
          onClick={() => router.push("/")}
        >
          Library
        </button>
        {crumbs.map((crumb) => (
          <span key={crumb.id} className="flex min-w-0 items-center gap-2">
            <ChevronRight className="size-4 shrink-0" />
            <button
              type="button"
              onClick={() => openNode(crumb)}
              className="truncate hover:text-foreground"
              aria-current={crumb.id === selectedNode?.id ? "page" : undefined}
            >
              {crumb.title}
            </button>
          </span>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Search"
        onClick={() => searchInputRef.current?.focus()}
      >
        <span className="sr-only">Search</span>
        <Search className="size-4" />
      </Button>
    </div>
  );

  return (
    <LibraryShell
      sidebar={
        <LibrarySidebar
          nodes={nodes}
          tags={tags}
          tagLinks={tagLinks}
          selectedTagIds={selectedTagIds}
          selectedNodeId={selectedNode?.id ?? null}
          userEmail={userEmail}
          signOutAction={signOutAction}
          onCreatePage={() =>
            pageParent ? setPageDialogOpen(true) : setWorkspaceDialogOpen(true)
          }
          onFocusSearch={() => searchInputRef.current?.focus()}
          onToggleTag={toggleTag}
        />
      }
      topBar={topBar}
    >
      <div className="mb-5">
        <h2 className="text-2xl font-semibold">
          {selectedNode?.title ?? "Library"}
        </h2>
        <p className="font-mono text-[11.5px] text-[var(--text-3)]">
          {nodes.length} {nodes.length === 1 ? "node" : "nodes"}
        </p>
      </div>

      <SearchPanel
        inputRef={searchInputRef}
        onOpenDocument={openNodeById}
        onOpenTranscript={() => undefined}
        onSelectFile={openNodeById}
      />

      <div className="space-y-5">
        <LibraryFilterChips
          tags={tags}
          selectedTagIds={selectedTagIds}
          onToggleTag={toggleTag}
          onClearTags={() => setSelectedTagIds(new Set())}
        />
        {atRoot || selectedContainer ? (
          <LibraryActions
            atRoot={atRoot}
            onCreateWorkspace={() => setWorkspaceDialogOpen(true)}
            onCreatePage={() => setPageDialogOpen(true)}
          />
        ) : null}
        {selectedNode?.kind === "page" ? (
          <>
            <NoteRoute nodeId={selectedNode.id} />
            <LibraryContent
              nodes={filteredNodes}
              parentId={selectedNode.id}
              atRoot={false}
              onOpen={openNodeById}
            />
          </>
        ) : selectedNode?.kind === "audio" ? (
          <TranscriptRoute nodeId={selectedNode.id} />
        ) : (
          <LibraryContent
            nodes={filteredNodes}
            parentId={selectedNode?.id ?? null}
            atRoot={atRoot}
            onOpen={openNodeById}
          />
        )}
      </div>

      <TextInputDialog
        open={workspaceDialogOpen}
        onOpenChange={setWorkspaceDialogOpen}
        title="Create a workspace"
        label="Workspace name"
        placeholder="Workspace name"
        submitLabel="Create workspace"
        onSubmit={(title) => createWorkspaceMutation.mutate({ title })}
      />
      <TextInputDialog
        open={pageDialogOpen}
        onOpenChange={setPageDialogOpen}
        title="Create a page"
        label="Page title"
        placeholder="Untitled page"
        submitLabel="Create page"
        onSubmit={(title) => {
          if (pageParent) {
            createPageMutation.mutate({
              title,
              parentId: pageParent.id,
            });
          }
        }}
      />

      <Dialog open={firstRun}>
        <DialogContent
          aria-describedby={undefined}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogTitle className="text-sm font-semibold">
            Create a workspace
          </DialogTitle>
          <form
            className="mt-3 space-y-4"
            action={(formData) => {
              const title = String(formData.get("title") ?? "").trim();
              if (title) createWorkspaceMutation.mutate({ title });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="first-workspace-name">Workspace name</Label>
              <Input
                id="first-workspace-name"
                name="title"
                placeholder="My workspace"
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                size="sm"
                disabled={createWorkspaceMutation.isPending}
              >
                Create workspace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </LibraryShell>
  );
}
