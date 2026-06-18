export type LibraryWorkspaceDialog = "workspace" | "note" | "folder" | "upload";

export type LibraryWorkspaceState = {
  activeDialog: LibraryWorkspaceDialog | null;
  selectedTagIds: Set<string>;
};

export type LibraryWorkspaceAction =
  | { type: "openDialog"; dialog: LibraryWorkspaceDialog }
  | {
      type: "setDialogOpen";
      dialog: LibraryWorkspaceDialog;
      open: boolean;
    }
  | { type: "toggleTag"; tagId: string }
  | { type: "clearTags" };

export function createLibraryWorkspaceState(): LibraryWorkspaceState {
  return { activeDialog: null, selectedTagIds: new Set() };
}

export function libraryWorkspaceReducer(
  state: LibraryWorkspaceState,
  action: LibraryWorkspaceAction,
): LibraryWorkspaceState {
  if (action.type === "openDialog") {
    return { ...state, activeDialog: action.dialog };
  }
  if (action.type === "setDialogOpen") {
    if (action.open) return { ...state, activeDialog: action.dialog };
    if (state.activeDialog !== action.dialog) return state;
    return { ...state, activeDialog: null };
  }
  if (action.type === "clearTags") {
    return { ...state, selectedTagIds: new Set() };
  }

  const selectedTagIds = new Set(state.selectedTagIds);
  if (selectedTagIds.has(action.tagId)) selectedTagIds.delete(action.tagId);
  else selectedTagIds.add(action.tagId);
  return { ...state, selectedTagIds };
}
