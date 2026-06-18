import type { Content } from "@tiptap/core";
import type { LibraryNode } from "@/server/services/library-nodes";

export const FOLDER_NODE_TYPE = "lumen-folder";

export function folderNodeContent() {
  return { type: FOLDER_NODE_TYPE } as const;
}

export function emptyNoteContent(): Content {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [] }],
  };
}

function isFolderContent(value: unknown) {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === FOLDER_NODE_TYPE
  );
}

export function isFolderNode(node: LibraryNode, nodes: LibraryNode[]) {
  if (node.kind !== "page") return false;
  return (
    isFolderContent(node.content_json) ||
    nodes.some((candidate) => candidate.parent_id === node.id)
  );
}

export function isNoteNode(node: LibraryNode, nodes: LibraryNode[]) {
  return node.kind === "page" && !isFolderNode(node, nodes);
}

export function nodeMetaLabel(node: LibraryNode, nodes: LibraryNode[]) {
  if (node.kind === "workspace") return "Workspace";
  if (node.kind === "page")
    return isFolderNode(node, nodes) ? "Folder" : "Note";
  if (node.kind === "audio") return "Audio";
  return "File";
}
