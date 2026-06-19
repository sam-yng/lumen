"use client";

import { FileText } from "lucide-react";
import type { LibraryNode } from "@/server/services/library-nodes";
import { ItemRow } from "./library-item-row";
import { isNoteNode } from "./library-node-ui";

function byMostRecentlyUpdated(a: LibraryNode, b: LibraryNode) {
  return (
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() ||
    a.title.localeCompare(b.title)
  );
}

export function LibraryRecentsContent({
  nodes,
  onOpen,
}: {
  nodes: LibraryNode[];
  onOpen: (nodeId: string) => void;
}) {
  const notes = nodes
    .filter((node) => isNoteNode(node, nodes))
    .toSorted(byMostRecentlyUpdated);

  if (notes.length === 0) {
    return (
      <div className="grid min-h-80 place-items-center rounded-md border border-dashed border-border-strong bg-surface p-8 text-center">
        <div className="max-w-sm">
          <div className="mx-auto grid size-12 place-items-center rounded-lg bg-(--accent-soft) text-accent-text">
            <FileText className="size-5" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No recent notes yet</h3>
          <p className="mt-1 text-sm text-text-3">
            Notes appear here after they are created or edited.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section>
      <h3 className="mb-2 font-mono text-[11.5px] font-medium text-text-3 uppercase">
        Recently updated notes
      </h3>
      <ul
        aria-label="Recently updated notes"
        className="rounded-md border border-border-soft bg-surface px-3"
      >
        {notes.map((node, index) => (
          <ItemRow
            key={node.id}
            node={node}
            nodes={nodes}
            isSelected={false}
            selectionIndex={index}
            onSelect={() => undefined}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </section>
  );
}
