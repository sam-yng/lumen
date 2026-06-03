# Library & notes

The student's nested library: folders, documents (TipTap notes), files, and
tags. Built across M2 (library + tagging) and M3 (editor).

## v1 behaviour

- **Folder tree:** create / rename / delete / move; arbitrary nesting; sidebar.
- **Documents:** create / rename / delete note records and place them in folders
  in M2. TipTap editing, autosave, JSON content, and derived plain-text search
  fields land in M3.
- **Files:** create / rename / delete **metadata-only** file records in M2
  (`name`, `mime_type`, `size_bytes`, `kind`, `folder_id`, `storage_key`). Actual
  binary upload, Supabase Storage, audio recording rows, and transcription queue
  integration land in M4.
- **Tags:** create / rename / delete tags; assign / remove tags on documents and
  files in M2; filter the library by tag. Recording tags become visible once M4
  creates recordings.

## M2 shape

- The library reads through one unified snapshot: folders, documents, files,
  tags, and tag links.
- Mutations stay resource-specific so the later MCP layer can expose small,
  predictable service methods.
- Folder moves reject cycles before the database update.
- Deleting a folder follows the schema: child folders cascade; documents/files
  are detached to the root via `on delete set null`.

Status: M2 implemented; M3 editor and M4 upload/transcription remain pending.
