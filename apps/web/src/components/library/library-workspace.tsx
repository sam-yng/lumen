"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2, Plus, Search, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SearchPanel } from "@/components/search/search-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileUploadPicker } from "./file-upload-picker";
import { LibraryActions } from "./library-actions";
import {
  createDocument,
  createFolder,
  fetchLibrarySnapshot,
  libraryQueryKey,
  uploadFile,
} from "./library-api";
import { LibraryContent } from "./library-content";
import { TextInputDialog } from "./library-dialogs";
import { useLibraryMutation } from "./library-hooks";
import { folderName } from "./library-paths";
import { LibraryShell } from "./library-shell";
import { LibrarySidebar } from "./library-sidebar";

type SignOutAction = () => Promise<void>;

export function LibraryWorkspace({
  signOutAction,
  userEmail,
  view = "library",
}: {
  signOutAction: SignOutAction;
  userEmail: string;
  view?: "library" | "tags";
}) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const createNoteMutation = useLibraryMutation(createDocument);
  const createFolderMutation = useLibraryMutation(createFolder);
  const uploadMutation = useLibraryMutation(uploadFile);

  const { data, error, isLoading } = useQuery({
    queryKey: libraryQueryKey,
    queryFn: fetchLibrarySnapshot,
  });

  const openDocument = (documentId: string) =>
    router.push(`/library/notes/${documentId}`);
  const openRecording = (recordingId: string) =>
    router.push(`/library/transcripts/${recordingId}`);
  const focusSearch = () => searchInputRef.current?.focus();

  if (isLoading) {
    return (
      <div className="grid min-h-96 flex-1 place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="grid min-h-96 flex-1 place-items-center text-sm text-destructive">
        {error instanceof Error ? error.message : "Could not load library."}
      </div>
    );
  }

  const snapshot = data;
  const selectedTagName = selectedTagId
    ? snapshot.tags.find((tag) => tag.id === selectedTagId)?.name
    : null;

  const topBar = (
    <div className="sticky top-0 z-20 flex min-h-[52px] items-center justify-between gap-3 border-b border-[var(--border-soft)] bg-background/95 px-4 backdrop-blur lg:px-6">
      <div className="flex min-w-0 items-center gap-2 text-[13px] text-[var(--text-3)]">
        <button
          type="button"
          className="truncate hover:text-foreground"
          onClick={() => setSelectedFolderId(null)}
        >
          Library
        </button>
        {selectedFolderId ? (
          <>
            <ChevronRight className="size-4 shrink-0" />
            <span className="truncate text-foreground">
              {folderName(snapshot, selectedFolderId)}
            </span>
          </>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Search"
          onClick={focusSearch}
        >
          <span className="sr-only">Search</span>
          <Search className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setUploadOpen(true)}
        >
          <Upload className="size-4" />
          <span className="hidden sm:inline">Upload</span>
        </Button>
        <Button type="button" size="sm" onClick={() => setNewNoteOpen(true)}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">New note</span>
        </Button>
      </div>
    </div>
  );

  return (
    <LibraryShell
      sidebar={
        <LibrarySidebar
          view={view}
          folders={snapshot.folders}
          selectedFolderId={selectedFolderId}
          tags={snapshot.tags}
          selectedTagId={selectedTagId}
          userEmail={userEmail}
          signOutAction={signOutAction}
          onSelectFolder={setSelectedFolderId}
          onSelectTag={setSelectedTagId}
          onCreateNote={() => setNewNoteOpen(true)}
          onCreateFolder={() => setNewFolderOpen(true)}
          onFocusSearch={focusSearch}
        />
      }
      topBar={topBar}
    >
      <div className="mb-5">
        <h2 className="text-2xl font-semibold">
          {folderName(snapshot, selectedFolderId)}
        </h2>
        <p className="font-mono text-[11.5px] text-[var(--text-3)]">
          {selectedTagName
            ? `Filtered by ${selectedTagName}`
            : `${snapshot.folders.length + snapshot.documents.length + snapshot.files.length} items`}
        </p>
      </div>
      <SearchPanel
        inputRef={searchInputRef}
        onOpenDocument={openDocument}
        onOpenTranscript={openRecording}
        onSelectFile={(_fileId, folderId) => {
          setSelectedFolderId(folderId);
          setSelectedTagId(null);
        }}
      />
      <div className="space-y-5">
        <LibraryActions
          onCreateNote={() => setNewNoteOpen(true)}
          onCreateFolder={() => setNewFolderOpen(true)}
          onUpload={() => setUploadOpen(true)}
          onRecordSave={(file) =>
            uploadMutation.mutate({ file, folderId: selectedFolderId })
          }
        />
        <LibraryContent
          snapshot={snapshot}
          selectedFolderId={selectedFolderId}
          selectedTagId={selectedTagId}
          onSelectFolder={setSelectedFolderId}
          onOpenDocument={openDocument}
          onOpenRecording={openRecording}
        />
      </div>

      <TextInputDialog
        open={newNoteOpen}
        onOpenChange={setNewNoteOpen}
        title="New note"
        label="Note title"
        placeholder="Untitled note"
        submitLabel="Create note"
        onSubmit={(title) =>
          createNoteMutation.mutate({ title, folderId: selectedFolderId })
        }
      />
      <TextInputDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        title="New folder"
        label="Folder name"
        placeholder="Folder name"
        submitLabel="Create folder"
        onSubmit={(name) =>
          createFolderMutation.mutate({ name, parentId: selectedFolderId })
        }
      />
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogTitle className="text-sm font-semibold">
            Upload a file
          </DialogTitle>
          <form
            className="mt-3 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const upload = formData.get("file");
              if (!(upload instanceof globalThis.File) || upload.size === 0) {
                return;
              }
              uploadMutation.mutate({
                file: upload,
                folderId: selectedFolderId,
              });
              setUploadOpen(false);
            }}
          >
            <FileUploadPicker name="file" />
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" size="sm">
                Upload
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </LibraryShell>
  );
}
