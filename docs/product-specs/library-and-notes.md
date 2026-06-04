# Library & notes

The student's nested library: folders, documents (TipTap notes), files, and
tags. Built across M2 (library + tagging) and M3 (editor).

## v1 behaviour

- **Folder tree:** create / rename / delete / move; arbitrary nesting; sidebar.
- **Documents:** create / rename / delete note records and place them in folders
  in M2. TipTap editing, autosave, JSON content, and derived plain-text search
  fields land in M3.
- **Files:** create / rename / delete file records. M4 uploads bytes to private
  Supabase Storage, stores the real `storage_key`, and keeps rename/move/delete
  metadata operations resource-specific.
- **Audio recordings:** uploading audio or saving a browser recording creates a
  `recordings` row, enqueues local CPU transcription, shows status in the
  library, and opens an in-workspace transcript viewer.
- **Tags:** create / rename / delete tags; assign / remove tags on documents and
  files; filter the library by tag.

## Routes (pre-v2 cleanup)

The workspace is route-backed instead of a single split-pane screen:

- `/library` — folder tree, notes, files, tag filter, and create actions.
- `/library/notes/[id]` — full-page note editor with a "Back to library" link.
- `/library/transcripts/[recordingId]` — full-page transcript viewer.
- `/library/tags` — tag management (same workspace, Tags view focused).

`/` redirects to `/library`, and authenticated `/login` and `/signup` visits
redirect to `/library`. Opening a note or transcript navigates (App Router
push) rather than rendering a side pane.

**Disabled in v1 (visible but inert):** the sidebar **Recents** entry (ships in
a later release) and **Ask Lumen** (ships in v2). Both carry an explanatory
`title` and are not clickable.

**Sign-up confirmation:** new accounts confirm via a six-digit email OTP. See
[SECURITY.md](../SECURITY.md) for the production email/SMTP requirement.

## M2 shape

- The library reads through one unified snapshot: folders, documents, files,
  tags, and tag links.
- Mutations stay resource-specific so the later MCP layer can expose small,
  predictable service methods.
- Folder moves reject cycles before the database update.
- Deleting a folder follows the schema: child folders cascade; documents/files
  are detached to the root via `on delete set null`.

Status: M2 implemented.

## M3 shape

- Selecting **Open** on a document opens an in-workspace TipTap editor panel.
- The editor persists TipTap JSON to `documents.content_json`.
- Autosave runs after content changes and writes through the authenticated
  document service/route path.
- `documents.content_text` is derived server-side from the submitted TipTap JSON
  so M5 full-text search has deterministic plain text.
- Existing seeded documents with only `content_text` initialize as a simple
  TipTap paragraph.

## M4 shape

- `POST /api/library/uploads` accepts `multipart/form-data`, writes the object to
  `library-files`, creates the `files` row, and creates/enqueues a `recordings`
  row for audio.
- The transcription worker uses pg-boss and `nodejs-whisper` locally. It writes
  `transcripts.full_text`, ordered `transcript_segments`, and recording status.
- The workspace shows recording status, retry for failed recordings, and a real
  audio player with clickable transcript segments.

Status: M4 implemented; M5 full-text search is implemented in
[search-and-transcripts.md](search-and-transcripts.md).
