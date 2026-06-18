import { describe, expect, it } from "vitest";
import {
  createLibraryWorkspaceState,
  libraryWorkspaceReducer,
} from "@/components/library/library-workspace-state";

describe("libraryWorkspaceReducer", () => {
  it("keeps at most one workspace dialog open", () => {
    const initial = createLibraryWorkspaceState();
    const withNote = libraryWorkspaceReducer(initial, {
      type: "openDialog",
      dialog: "note",
    });
    const withUpload = libraryWorkspaceReducer(withNote, {
      type: "openDialog",
      dialog: "upload",
    });

    expect(withNote.activeDialog).toBe("note");
    expect(withUpload.activeDialog).toBe("upload");
    expect(
      libraryWorkspaceReducer(withUpload, {
        type: "setDialogOpen",
        dialog: "upload",
        open: false,
      }).activeDialog,
    ).toBeNull();
  });

  it("does not close a newer dialog from a stale close callback", () => {
    const withFolder = libraryWorkspaceReducer(
      {
        activeDialog: "note",
        selectedTagIds: new Set<string>(),
      },
      { type: "openDialog", dialog: "folder" },
    );

    expect(
      libraryWorkspaceReducer(withFolder, {
        type: "setDialogOpen",
        dialog: "note",
        open: false,
      }).activeDialog,
    ).toBe("folder");
  });

  it("toggles and clears selected tags without mutating prior state", () => {
    const initial = createLibraryWorkspaceState();
    const selected = libraryWorkspaceReducer(initial, {
      type: "toggleTag",
      tagId: "tag-1",
    });
    const deselected = libraryWorkspaceReducer(selected, {
      type: "toggleTag",
      tagId: "tag-1",
    });
    const cleared = libraryWorkspaceReducer(
      {
        activeDialog: null,
        selectedTagIds: new Set(["tag-1", "tag-2"]),
      },
      { type: "clearTags" },
    );

    expect(initial.selectedTagIds).toEqual(new Set());
    expect(selected.selectedTagIds).toEqual(new Set(["tag-1"]));
    expect(deselected.selectedTagIds).toEqual(new Set());
    expect(cleared.selectedTagIds).toEqual(new Set());
  });
});
