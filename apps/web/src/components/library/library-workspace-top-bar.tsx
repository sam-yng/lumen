import { ChevronRight, Search } from "lucide-react";
import { RecordAudioForm } from "@/components/transcripts/record-audio-form";
import { Button } from "@/components/ui/button";
import type { LibraryNode } from "@/server/services/library-nodes";

export function LibraryWorkspaceTopBar({
  canRecord,
  crumbs,
  isRecentsView,
  onFocusSearch,
  onOpenLibrary,
  onOpenNode,
  onRecord,
  selectedNodeId,
}: {
  canRecord: boolean;
  crumbs: LibraryNode[];
  isRecentsView: boolean;
  onFocusSearch: () => void;
  onOpenLibrary: () => void;
  onOpenNode: (node: LibraryNode) => void;
  onRecord: (file: File) => void;
  selectedNodeId: string | null;
}) {
  return (
    <div className="flex min-h-[var(--topbar-h)] w-full min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2 text-[13px] text-[var(--text-3)]">
        {isRecentsView ? (
          <span className="truncate text-foreground">Recents</span>
        ) : (
          <>
            <button
              type="button"
              className="shrink-0 hover:text-foreground"
              onClick={onOpenLibrary}
            >
              Library
            </button>
            {crumbs.map((crumb) => (
              <span key={crumb.id} className="flex min-w-0 items-center gap-2">
                <ChevronRight className="size-4 shrink-0" />
                <button
                  type="button"
                  onClick={() => onOpenNode(crumb)}
                  className="truncate hover:text-foreground"
                  aria-current={
                    crumb.id === selectedNodeId ? "page" : undefined
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
        {canRecord ? <RecordAudioForm onSave={onRecord} /> : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Search"
          onClick={onFocusSearch}
        >
          <span className="sr-only">Search</span>
          <Search className="size-4" />
        </Button>
      </div>
    </div>
  );
}
