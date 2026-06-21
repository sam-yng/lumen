import {
  File as FileIcon,
  FileText,
  Folder,
  Globe,
  type LucideIcon,
  Mic,
} from "lucide-react";
import type { LibraryNode } from "@/server/services/library-nodes";

const FOLDER_NODE_TYPE = "lumen-folder";

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

export type LibraryNodeDisplayKind =
  | "workspace"
  | "folder"
  | "file"
  | "importedFile"
  | "audio";

// The DB `kind` enum has four values; the UI presents five "types" by splitting
// page nodes into folders (containers) and files (authored notes) and treating
// uploaded `file` nodes as imported files.
function libraryNodeDisplayKind(
  node: LibraryNode,
  nodes: LibraryNode[],
): LibraryNodeDisplayKind {
  if (node.kind === "workspace") return "workspace";
  if (node.kind === "audio") return "audio";
  if (node.kind === "file") return "importedFile";
  return isFolderNode(node, nodes) ? "folder" : "file";
}

const DISPLAY_KIND_LABELS: Record<LibraryNodeDisplayKind, string> = {
  workspace: "Workspace",
  folder: "Folder",
  file: "File",
  importedFile: "Imported File",
  audio: "Audio",
};

const DISPLAY_KIND_ICONS: Record<LibraryNodeDisplayKind, LucideIcon> = {
  workspace: Globe,
  folder: Folder,
  file: FileIcon,
  importedFile: FileText,
  audio: Mic,
};

export function nodeMetaLabel(node: LibraryNode, nodes: LibraryNode[]) {
  return DISPLAY_KIND_LABELS[libraryNodeDisplayKind(node, nodes)];
}

export function libraryNodeIcon(node: LibraryNode, nodes: LibraryNode[]) {
  return DISPLAY_KIND_ICONS[libraryNodeDisplayKind(node, nodes)];
}
