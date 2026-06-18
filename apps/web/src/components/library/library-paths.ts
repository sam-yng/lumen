import type { LibraryNode } from "@/server/services/library-nodes";

/** Ancestor chain root-to-node for breadcrumbs. Cycles are truncated safely. */
export function nodePath(nodes: LibraryNode[], nodeId: string | null) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const path: LibraryNode[] = [];
  const visited = new Set<string>();
  let current = nodeId ? byId.get(nodeId) : undefined;

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }

  return path;
}

export function canonicalNodePath(nodes: LibraryNode[], node: LibraryNode) {
  if (node.kind === "workspace") return `/${node.slug}`;
  const workspace = nodes.find(
    (candidate) =>
      candidate.id === node.workspace_id && candidate.kind === "workspace",
  );
  return workspace ? `/${workspace.slug}/${node.slug}` : "/";
}
