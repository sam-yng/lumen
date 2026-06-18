import type { LibraryNodeSnapshot } from "@/server/services/library-nodes";
import { isNoteNode } from "./library-node-ui";

type LibraryNodeRouteResolution =
  | { kind: "render" }
  | { kind: "redirect"; href: string };

export function resolveLibraryNodeRoute(
  snapshot: LibraryNodeSnapshot,
  workspaceSlug: string,
  nodeSlug: string,
): LibraryNodeRouteResolution {
  const workspace = snapshot.nodes.find(
    (node) => node.kind === "workspace" && node.slug === workspaceSlug,
  );
  const node = snapshot.nodes.find(
    (candidate) =>
      candidate.slug === nodeSlug && candidate.workspace_id === workspace?.id,
  );

  if (!node) return { kind: "render" };
  if (isNoteNode(node, snapshot.nodes)) {
    return { kind: "redirect", href: `/library/notes/${node.id}` };
  }
  if (node.kind === "audio") {
    const recording = snapshot.recordings.find(
      (candidate) => candidate.node_id === node.id,
    );
    if (recording) {
      return {
        kind: "redirect",
        href: `/library/transcripts/${recording.id}`,
      };
    }
  }
  return { kind: "render" };
}
