"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useReducer, useRef, useState } from "react";
import { SearchPanel } from "@/components/search/search-panel";
import type { LibraryNode } from "@/server/services/library-nodes";
import { LibraryActions } from "./library-actions";
import {
  createPage,
  createWorkspace,
  fetchLibrarySnapshot,
  libraryQueryKey,
  setTagForNodes,
  uploadFile,
} from "./library-api";
import { LibraryContent } from "./library-content";
import { LibraryFilterChips } from "./library-filter-chips";
import { isFolderNode, isNoteNode } from "./library-node-ui";
import { canonicalNodePath, nodePath } from "./library-paths";
import { LibraryShell } from "./library-shell";
import { LibrarySidebar } from "./library-sidebar";
import { filterNodesBySelectedTags, tagsByNodeId } from "./library-tags";
import { LibraryWorkspaceDialogs } from "./library-workspace-dialogs";
import {
  createLibraryWorkspaceState,
  libraryWorkspaceReducer,
} from "./library-workspace-state";
import { LibraryWorkspaceTopBar } from "./library-workspace-top-bar";
import { PdfViewerDialog } from "./pdf-viewer-dialog";

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
  const [{ activeDialog, selectedTagIds }, dispatch] = useReducer(
    libraryWorkspaceReducer,
    undefined,
    createLibraryWorkspaceState,
  );
  const [pdfNode, setPdfNode] = useState<LibraryNode | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const { data, error, isLoading } = useQuery({
    queryKey: libraryQueryKey,
    queryFn: fetchLibrarySnapshot,
  });
  const { nodes = [], tags = [], tagLinks = [], recordings = [] } = data ?? {};
  const tagAssignments = useMemo(
    () => tagsByNodeId(tags, tagLinks),
    [tags, tagLinks],
  );
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
  const tagMutation = useMutation({
    mutationFn: setTagForNodes,
    onSettled: async () => {
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
  const recentNotes = filteredNodes
    .filter((node) => isNoteNode(node, nodes))
    .toSorted(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() ||
        a.title.localeCompare(b.title),
    );
  const toggleTag = (tagId: string) => dispatch({ type: "toggleTag", tagId });
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
    if (node.kind === "file") {
      if (node.mime_type === "application/pdf") {
        setPdfNode(node);
      } else {
        // Legacy non-PDF imported files: open the streamed content directly.
        window.open(`/api/library/nodes/${node.id}/content`, "_blank");
      }
      return;
    }
    router.push(canonicalNodePath(nodes, node));
  };
  const openNodeById = (id: string) => {
    const node = nodes.find((candidate) => candidate.id === id);
    if (node) openNode(node);
  };

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
            dispatch({
              type: "openDialog",
              dialog: pageParent ? "note" : "workspace",
            })
          }
          onFocusSearch={() => searchInputRef.current?.focus()}
          onToggleTag={toggleTag}
        />
      }
      topBar={
        <LibraryWorkspaceTopBar
          canRecord={pageParent !== null}
          crumbs={crumbs}
          isRecentsView={isRecentsView}
          onFocusSearch={() => searchInputRef.current?.focus()}
          onOpenLibrary={() => router.push("/")}
          onOpenNode={openNode}
          onRecord={(file) => {
            if (pageParent) {
              uploadMutation.mutate({ file, parentId: pageParent.id });
            }
          }}
          selectedNodeId={selectedNode?.id ?? null}
        />
      }
    >
      <div className="mb-5">
        <h2 className="text-2xl font-semibold">
          {isRecentsView ? "Recents" : (selectedNode?.title ?? "Library")}
        </h2>
        <p className="font-mono text-[11.5px] text-text-3">
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
        <LibraryContent
          nodes={nodes}
          orderedNodes={recentNotes}
          parentId={null}
          atRoot={atRoot}
          selectedIds={selectedNodeIds}
          tags={tags}
          tagLinks={tagLinks}
          tagAssignments={tagAssignments}
          tagMutationPending={tagMutation.isPending}
          tagMutationError={tagMutation.error}
          emptyState={
            <div className="grid min-h-80 place-items-center rounded-md border border-dashed border-border-strong bg-surface p-8 text-center">
              <div className="max-w-sm">
                <div className="mx-auto grid size-12 place-items-center rounded-lg bg-(--accent-soft) text-accent-text">
                  <FileText className="size-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">
                  No recent notes yet
                </h3>
                <p className="mt-1 text-sm text-text-3">
                  Notes appear here after they are created or edited.
                </p>
              </div>
            </div>
          }
          onSelectedIdsChange={setSelectedNodeIds}
          onSetTag={(tagId, linked) =>
            tagMutation.mutate({
              tagId,
              nodeIds: [...selectedNodeIds],
              linked,
            })
          }
          onOpen={openNodeById}
        />
      ) : (
        <div className="space-y-5">
          <LibraryFilterChips
            tags={tags}
            selectedTagIds={selectedTagIds}
            onToggleTag={toggleTag}
            onClearTags={() => dispatch({ type: "clearTags" })}
          />
          {atRoot || selectedContainer ? (
            <LibraryActions
              atRoot={atRoot}
              onCreateWorkspace={() =>
                dispatch({ type: "openDialog", dialog: "workspace" })
              }
              onCreateNote={() =>
                dispatch({ type: "openDialog", dialog: "note" })
              }
              onCreateFolder={() =>
                dispatch({ type: "openDialog", dialog: "folder" })
              }
              onUpload={() =>
                dispatch({ type: "openDialog", dialog: "upload" })
              }
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
            selectedIds={selectedNodeIds}
            tags={tags}
            tagLinks={tagLinks}
            tagAssignments={tagAssignments}
            tagMutationPending={tagMutation.isPending}
            tagMutationError={tagMutation.error}
            onSelectedIdsChange={setSelectedNodeIds}
            onSetTag={(tagId, linked) =>
              tagMutation.mutate({
                tagId,
                nodeIds: [...selectedNodeIds],
                linked,
              })
            }
            onOpen={openNodeById}
          />
        </div>
      )}

      <LibraryWorkspaceDialogs
        activeDialog={activeDialog}
        createWorkspacePending={createWorkspaceMutation.isPending}
        firstRun={firstRun}
        onCreateFolder={(title) => {
          if (pageParent) {
            createPageMutation.mutate({
              title,
              parentId: pageParent.id,
              role: "folder",
            });
          }
        }}
        onCreateNote={(title) => {
          if (pageParent) {
            createPageMutation.mutate({
              title,
              parentId: pageParent.id,
              role: "note",
            });
          }
        }}
        onCreateWorkspace={(title) => createWorkspaceMutation.mutate({ title })}
        onDialogOpenChange={(dialog, open) =>
          dispatch({ type: "setDialogOpen", dialog, open })
        }
        onUpload={(file) => {
          if (pageParent) {
            uploadMutation.mutate({ file, parentId: pageParent.id });
          }
        }}
      />

      <PdfViewerDialog
        open={pdfNode !== null}
        onOpenChange={(open) => {
          if (!open) setPdfNode(null);
        }}
        src={pdfNode ? `/api/library/nodes/${pdfNode.id}/content` : null}
        title={pdfNode?.title ?? "PDF"}
      />
    </LibraryShell>
  );
}
