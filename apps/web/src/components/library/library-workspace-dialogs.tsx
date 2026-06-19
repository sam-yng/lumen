import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUploadPicker } from "./file-upload-picker";
import { TextInputDialog } from "./library-dialogs";
import type { LibraryWorkspaceDialog } from "./library-workspace-state";

export function LibraryWorkspaceDialogs({
  activeDialog,
  createWorkspacePending,
  firstRun,
  onCreateFolder,
  onCreateNote,
  onCreateWorkspace,
  onDialogOpenChange,
  onUpload,
}: {
  activeDialog: LibraryWorkspaceDialog | null;
  createWorkspacePending: boolean;
  firstRun: boolean;
  onCreateFolder: (title: string) => void;
  onCreateNote: (title: string) => void;
  onCreateWorkspace: (title: string) => void;
  onDialogOpenChange: (dialog: LibraryWorkspaceDialog, open: boolean) => void;
  onUpload: (file: File) => void;
}) {
  return (
    <>
      <TextInputDialog
        open={activeDialog === "workspace"}
        onOpenChange={(open) => onDialogOpenChange("workspace", open)}
        title="Create a workspace"
        label="Workspace name"
        placeholder="Workspace name"
        submitLabel="Create workspace"
        onSubmit={onCreateWorkspace}
      />
      <TextInputDialog
        open={activeDialog === "note"}
        onOpenChange={(open) => onDialogOpenChange("note", open)}
        title="New note"
        label="Note title"
        placeholder="Untitled note"
        submitLabel="Create note"
        onSubmit={onCreateNote}
      />
      <TextInputDialog
        open={activeDialog === "folder"}
        onOpenChange={(open) => onDialogOpenChange("folder", open)}
        title="New folder"
        label="Folder name"
        placeholder="Folder name"
        submitLabel="Create folder"
        onSubmit={onCreateFolder}
      />
      <Dialog
        open={activeDialog === "upload"}
        onOpenChange={(open) => onDialogOpenChange("upload", open)}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogTitle className="text-sm font-semibold">
            Upload a file
          </DialogTitle>
          <form
            className="mt-3 space-y-4"
            action={(formData) => {
              const file = formData.get("file");
              if (!(file instanceof File) || file.size === 0) return;
              onUpload(file);
              onDialogOpenChange("upload", false);
            }}
          >
            <FileUploadPicker name="file" />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" size="sm">
                Upload
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={firstRun}>
        <DialogContent
          aria-describedby={undefined}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogTitle className="text-sm font-semibold">
            Create a workspace
          </DialogTitle>
          <form
            className="mt-3 space-y-4"
            action={(formData) => {
              const title = String(formData.get("title") ?? "").trim();
              if (title) onCreateWorkspace(title);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="first-workspace-name">Workspace name</Label>
              <Input
                id="first-workspace-name"
                name="title"
                placeholder="My workspace"
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" size="sm" disabled={createWorkspacePending}>
                Create workspace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
