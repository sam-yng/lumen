"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SearchPanel } from "@/components/search/search-panel";
import { RecordAudioForm } from "@/components/transcripts/record-audio-form";
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
import type { LibraryNode } from "@/server/services/library-nodes";
import { FileUploadPicker } from "./file-upload-picker";
import { LibraryActions } from "./library-actions";
import {
  createPage,
  createWorkspace,
  fetchLibrarySnapshot,
  libraryQueryKey,
  uploadFile,
} from "./library-api";
import { LibraryContent } from "./library-content";
import { TextInputDialog } from "./library-dialogs";
import { LibraryFilterChips } from "./library-filter-chips";
import { isFolderNode, isNoteNode } from "./library-node-ui";
import { canonicalNodePath, nodePath } from "./library-paths";
import { LibraryRecentsContent } from "./library-recents-content";
import { LibraryShell } from "./library-shell";
import { LibrarySidebar } from "./library-sidebar";
import { filterNodesBySelectedTags } from "./library-tags";

type SignOutAction = () => Promise<void>;

export function LibraryWorkspace({
  signOutAction,
  userEmail,
  workspaceSlug,
  nodeSlug,
  view = "library",
}: {
  signOutAction: SignOutAction;
  userEmail: string;
  workspaceSlug?: string;
  nodeSlug?: string;
  view?: "library" | "recents";
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    () => new Set(),
  );
  const { data, error, isLoading } = useQuery({
    queryKey: libraryQueryKey,
    queryFn: fetchLibrarySnapshot,
  });
  const { nodes = [], tags = [], tagLinks = [], recordings = [] } = data ?? {};
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
  const selectedNodeIsContainer =
    selectedNode?.kind === "workspace" ||
    (selectedNode ? isFolderNode(selectedNode, nodes) : false);
  const selectedContainer = selectedNodeIsContainer ? selectedNode : null;
  const parentContainer = selectedNode?.parent_id
    ? (nodes.find((node) => node.id === selectedNode.parent_id) ?? null)
    : null;
  const pageParent = selectedContainer ?? parentContainer ?? workspace;
  const selectedRecording =
    selectedNode?.kind === "audio"
      ? (recordings.find(
          (recording) => recording.node_id === selectedNode.id,
        ) ?? null)
      : null;

  useEffect(() => {
    if (!selectedNode) return;
    if (isNoteNode(selectedNode, nodes)) {
      router.push(`/library/notes/${selectedNode.id}`);
      return;
    }
    if (selectedRecording) {
      router.push(`/library/transcripts/${selectedRecording.id}`);
    }
  }, [nodes, router, selectedNode, selectedRecording]);

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
      if (node.kind === "page" && !isFolderNode(node, [node])) {
        router.push(`/library/notes/${node.id}`);
      } else if (data) {
        router.push(canonicalNodePath(data.nodes, node));
      }
    },
  });
  const uploadMutation = useMutation({
    mutationFn: uploadFile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: libraryQueryKey });
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
  const atRoot = workspaceSlug === undefined;
  const isRecentsView = view === "recents";
  const hasWorkspace = nodes.some((node) => node.kind === "workspace");
  const firstRun =
    !isRecentsView && workspaceSlug === undefined && !hasWorkspace;
  const crumbs = nodePath(nodes, selectedNode?.id ?? null);
  const openNode = (node: LibraryNode) => {
    if (isNoteNode(node, nodes)) {
      router.push(`/library/notes/${node.id}`);
      return;
    }
    if (node.kind === "audio") {
      const recording = recordings.find((item) => item.node_id === node.id);
      if (recording) router.push(`/library/transcripts/${recording.id}`);
      return;
    }
    router.push(canonicalNodePath(nodes, node));
  };
  const openNodeById = (id: string) => {
    const node = nodes.find((candidate) => candidate.id === id);
    if (node) openNode(node);
  };

  const topBar = (
    <div className="flex min-h-[var(--topbar-h)] w-full min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2 text-[13px] text-[var(--text-3)]">
        {isRecentsView ? (
          <span className="truncate text-foreground">Recents</span>
        ) : (
          <>
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
                  aria-current={
                    crumb.id === selectedNode?.id ? "page" : undefined
                  }
                >
                  {crumb.title}
                </button>
              </span>
            ))}
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {pageParent ? (
          <RecordAudioForm
            onSave={(file) =>
              uploadMutation.mutate({ file, parentId: pageParent.id })
            }
          />
        ) : null}
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
    </div>
  );

  return (
    <LibraryShell
      sidebar={
        <LibrarySidebar
          nodes={nodes}
          view={isRecentsView ? "recents" : "library"}
          tags={tags}
          tagLinks={tagLinks}
          selectedTagIds={selectedTagIds}
          selectedNodeId={selectedNode?.id ?? null}
          userEmail={userEmail}
          signOutAction={signOutAction}
          onCreatePage={() =>
            pageParent ? setNoteDialogOpen(true) : setWorkspaceDialogOpen(true)
          }
          onFocusSearch={() => searchInputRef.current?.focus()}
          onToggleTag={toggleTag}
        />
      }
      topBar={topBar}
    >
      <div className="mb-5">
        <h2 className="text-2xl font-semibold">
          {isRecentsView ? "Recents" : (selectedNode?.title ?? "Library")}
        </h2>
        <p className="font-mono text-[11.5px] text-[var(--text-3)]">
          {isRecentsView
            ? `${nodes.filter((node) => isNoteNode(node, nodes)).length} notes`
            : `${nodes.length} ${nodes.length === 1 ? "item" : "items"}`}
        </p>
      </div>

      <SearchPanel
        inputRef={searchInputRef}
        onOpenDocument={openNodeById}
        onOpenTranscript={() => undefined}
        onSelectFile={openNodeById}
      />

      {isRecentsView ? (
        <LibraryRecentsContent nodes={filteredNodes} onOpen={openNodeById} />
      ) : (
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
              onCreateNote={() => setNoteDialogOpen(true)}
              onCreateFolder={() => setFolderDialogOpen(true)}
              onUpload={() => setUploadOpen(true)}
              onStartLiveSession={() => {
                if (!pageParent) return;
                router.push(
                  `/library/live?workspaceId=${pageParent.workspace_id}&parentId=${pageParent.id}`,
                );
              }}
            />
          ) : null}
          <LibraryContent
            nodes={filteredNodes}
            parentId={selectedNode?.id ?? null}
            atRoot={atRoot}
            onOpen={openNodeById}
          />
        </div>
      )}

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
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        title="New note"
        label="Note title"
        placeholder="Untitled note"
        submitLabel="Create note"
        onSubmit={(title) => {
          if (pageParent) {
            createPageMutation.mutate({
              title,
              parentId: pageParent.id,
              role: "note",
            });
          }
        }}
      />
      <TextInputDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        title="New folder"
        label="Folder name"
        placeholder="Folder name"
        submitLabel="Create folder"
        onSubmit={(title) => {
          if (pageParent) {
            createPageMutation.mutate({
              title,
              parentId: pageParent.id,
              role: "folder",
            });
          }
        }}
      />
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle className="text-sm font-semibold">
            Upload a file
          </DialogTitle>
          <form
            className="mt-3 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!pageParent) return;
              const formData = new FormData(event.currentTarget);
              const file = formData.get("file");
              if (!(file instanceof File) || file.size === 0) return;
              uploadMutation.mutate({ file, parentId: pageParent.id });
              setUploadOpen(false);
            }}
          >
            <FileUploadPicker name="file" />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" size="sm">
                Upload
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
