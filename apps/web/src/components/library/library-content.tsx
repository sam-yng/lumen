"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";
import type { MouseEvent } from "react";
import { useMemo, useRef, useState } from "react";
import type { LibraryNode } from "@/server/services/library-nodes";
import { bulkDeleteNodes, bulkMoveNodes, libraryQueryKey } from "./library-api";
import { ConfirmDialog, SelectDialog } from "./library-dialogs";
import { LibraryItemActions } from "./library-item-actions";
import { ItemRow } from "./library-item-row";

export function LibraryContent({
  nodes,
  parentId,
  atRoot,
  onOpen,
}: {
  nodes: LibraryNode[];
  parentId: string | null;
  atRoot: boolean;
  onOpen: (nodeId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const anchorIndex = useRef<number | null>(null);

  const visibleNodes = useMemo(
    () =>
      nodes
        .filter((node) =>
          atRoot
            ? node.kind === "workspace" && node.parent_id === null
            : node.parent_id === parentId,
        )
        .toSorted((a, b) => a.title.localeCompare(b.title)),
    [atRoot, nodes, parentId],
  );
  const destinationNodes = nodes
    .filter(
      (node) =>
        (node.kind === "workspace" || node.kind === "page") &&
        !selectedIds.has(node.id),
    )
    .toSorted((a, b) => a.title.localeCompare(b.title));
  const selected = [...selectedIds];

  const moveMutation = useMutation({
    mutationFn: bulkMoveNodes,
    onSuccess: async () => {
      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: libraryQueryKey });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: bulkDeleteNodes,
    onSuccess: async () => {
      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: libraryQueryKey });
    },
    onSettled: () => setIsDeleting(false),
  });

  function handleSelect(event: MouseEvent, nodeId: string) {
    if (isDeleting) return;
    const index = visibleNodes.findIndex((node) => node.id === nodeId);
    if (index < 0) return;

    if (event.shiftKey && anchorIndex.current !== null) {
      const start = Math.min(anchorIndex.current, index);
      const end = Math.max(anchorIndex.current, index);
      setSelectedIds(
        new Set(visibleNodes.slice(start, end + 1).map((node) => node.id)),
      );
      return;
    }

    anchorIndex.current = index;
    if (event.ctrlKey || event.metaKey) {
      setSelectedIds((current) => {
        const next = new Set(current);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return next;
      });
      return;
    }

    setSelectedIds(new Set([nodeId]));
  }

  const error = moveMutation.error ?? deleteMutation.error;

  return (
    <div className="relative space-y-4" aria-busy={isDeleting}>
      {visibleNodes.length > 0 ? (
        <ul
          aria-label="Library nodes"
          className="rounded-md border border-[var(--border-soft)] bg-[var(--surface)] px-3"
        >
          {visibleNodes.map((node, index) => (
            <ItemRow
              key={node.id}
              node={node}
              nodes={nodes}
              isSelected={selectedIds.has(node.id)}
              selectionIndex={index}
              disabled={isDeleting}
              onSelect={handleSelect}
              onOpen={(nodeId) => {
                if (!isDeleting) onOpen(nodeId);
              }}
            />
          ))}
        </ul>
      ) : (
        <div className="grid min-h-80 place-items-center rounded-md border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-8 text-center">
          <div className="max-w-sm">
            <div className="mx-auto grid size-12 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
              <FileText className="size-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Nothing here yet</h3>
            <p className="mt-1 text-sm text-[var(--text-3)]">
              Create a note, folder, or file to start building this workspace.
            </p>
          </div>
        </div>
      )}

      <LibraryItemActions
        selectedCount={selectedIds.size}
        isBusy={isDeleting || moveMutation.isPending}
        onMove={() => {
          if (selectedIds.size > 0) setMoveOpen(true);
        }}
        onDelete={() => {
          if (selectedIds.size > 0) setDeleteOpen(true);
        }}
        onClear={() => {
          anchorIndex.current = null;
          setSelectedIds(new Set());
        }}
      />

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Library action failed."}
        </p>
      ) : null}

      {isDeleting ? (
        <div className="absolute inset-0 z-20 grid place-items-center rounded-md bg-background/70 backdrop-blur-[1px]">
          <output
            aria-label="Deleting selected nodes"
            className="flex items-center gap-2 rounded-md border bg-[var(--surface)] px-3 py-2 text-sm shadow-[var(--shadow-pop)]"
          >
            <Loader2 className="size-4 animate-spin" />
            Deleting selected nodes…
          </output>
        </div>
      ) : null}

      <SelectDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        title={`Move ${selectedIds.size} selected`}
        label="Destination"
        options={destinationNodes.map((node) => ({
          value: node.id,
          label: node.title,
        }))}
        defaultValue={destinationNodes[0]?.id ?? ""}
        submitLabel="Move selected"
        onSubmit={(parentId) => {
          if (parentId) moveMutation.mutate({ ids: selected, parentId });
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${selectedIds.size} selected?`}
        description="Selected nodes and all of their descendants will be permanently deleted."
        confirmLabel="Delete selected"
        onConfirm={() => {
          setIsDeleting(true);
          deleteMutation.mutate({ ids: selected });
        }}
      />
    </div>
  );
}
