"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SearchPanel } from "@/components/search/search-panel";
import { RecordAudioForm } from "@/components/transcripts/record-audio-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
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
import { LibraryFilterChips } from "./library-filter-chips";
import { useLibraryMutation } from "./library-hooks";
import { folderName, folderPath } from "./library-paths";
import { LibraryRecentsContent } from "./library-recents-content";
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
  view?: "library" | "tags" | "recents";
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
  const selectFolder = (folderId: string | null) => {
    setSelectedFolderId(folderId);
    setSelectedTagId(null);
    if (view === "recents") router.push("/library");
  };

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
  const isRecentsView = view === "recents";

  const crumbs = folderPath(snapshot, selectedFolderId);

  const topBar = (
    <div className="flex min-h-[var(--topbar-h)] w-full min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2 text-[13px] text-[var(--text-3)]">
        {isRecentsView ? (
          <span className="truncate text-foreground">Recents</span>
        ) : (
          <>
            <button
              type="button"
              className="relative shrink-0 truncate hover:text-foreground pointer-coarse:before:absolute pointer-coarse:before:-inset-2.5 pointer-coarse:before:content-['']"
              onClick={() => selectFolder(null)}
            >
              Library
            </button>
            {crumbs.length > 2 ? (
              <span
                className="flex shrink-0 items-center gap-2 sm:hidden"
                aria-hidden="true"
              >
                <ChevronRight className="size-4 shrink-0" />…
              </span>
            ) : null}
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              const isParent = index === crumbs.length - 2;
              return (
                <span
                  key={crumb.id}
                  className={`${
                    isLast || isParent ? "flex" : "hidden sm:flex"
                  } min-w-0 items-center gap-2`}
                >
                  <ChevronRight className="size-4 shrink-0" />
                  <button
                    type="button"
                    onClick={() => selectFolder(crumb.id)}
                    className={`relative truncate pointer-coarse:before:absolute pointer-coarse:before:-inset-2.5 pointer-coarse:before:content-[''] ${
                      isLast ? "text-foreground" : "hover:text-foreground"
                    }`}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {crumb.name}
                  </button>
                </span>
              );
            })}
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <RecordAudioForm
          onSave={(file) =>
            uploadMutation.mutate({ file, folderId: selectedFolderId })
          }
        />
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
      </div>
    </div>
  );

  const pageTitle = isRecentsView
    ? "Recents"
    : folderName(snapshot, selectedFolderId);
  const pageMeta = isRecentsView
    ? `${snapshot.documents.length} notes`
    : selectedTagName
      ? `Filtered by ${selectedTagName}`
      : `${snapshot.folders.length + snapshot.documents.length + snapshot.files.length} items`;

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
          onSelectFolder={selectFolder}
          onSelectTag={setSelectedTagId}
          onCreateNote={() => setNewNoteOpen(true)}
          onCreateFolder={() => setNewFolderOpen(true)}
          onFocusSearch={focusSearch}
        />
      }
      topBar={topBar}
    >
      <div className="mb-5">
        <h2 className="text-2xl font-semibold">{pageTitle}</h2>
        <p className="font-mono text-[11.5px] text-[var(--text-3)]">
          {pageMeta}
        </p>
        {!isRecentsView ? (
          <div className="mt-3">
            <LibraryFilterChips
              tags={snapshot.tags}
              selectedTagId={selectedTagId}
              onSelectTag={setSelectedTagId}
            />
          </div>
        ) : null}
      </div>
      <SearchPanel
        inputRef={searchInputRef}
        onOpenDocument={openDocument}
        onOpenTranscript={openRecording}
        onSelectFile={(_fileId, folderId) => {
          selectFolder(folderId);
        }}
      />
      {isRecentsView ? (
        <LibraryRecentsContent
          snapshot={snapshot}
          onOpenDocument={openDocument}
        />
      ) : (
        <div className="space-y-5">
          <LibraryActions
            onCreateNote={() => setNewNoteOpen(true)}
            onCreateFolder={() => setNewFolderOpen(true)}
            onUpload={() => setUploadOpen(true)}
            onStartLiveSession={() =>
              router.push(
                selectedFolderId
                  ? `/library/live?folderId=${selectedFolderId}`
                  : "/library/live",
              )
            }
          />
          <LibraryContent
            snapshot={snapshot}
            selectedFolderId={selectedFolderId}
            selectedTagId={selectedTagId}
            onSelectFolder={selectFolder}
            onOpenDocument={openDocument}
            onOpenRecording={openRecording}
          />
        </div>
      )}

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
    </LibraryShell>
  );
}
