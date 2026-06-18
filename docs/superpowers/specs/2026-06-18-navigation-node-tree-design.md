# Navigation node tree redesign - design spec

> **Status:** design input for
> [`exec-plans/queued/cross-cutting/navigation-node-tree.md`](../../exec-plans/queued/cross-cutting/navigation-node-tree.md).
> Date: 2026-06-18.

## Problem

The current app treats navigation folders, rich-text notes, uploaded files, and
audio recordings as separate concepts: `folders` own hierarchy, `documents` and
`files` point at folders, and routes live under `/library`. That model no longer
matches the intended product direction. Lumen should feel closer to Notion: the
Library is the authenticated root, workspaces live inside Library, and nested
page-like nodes define the hierarchy rather than a separate folder table.

The sidebar also needs desktop-file-browser interactions: visible selected and
hover row states, double-click to open, multi-select bulk move/delete, pinned
container pages, and compact multi-tag filtering.

## Binding Decisions

These decisions were approved by the product owner on 2026-06-18:

1. **Full node-tree migration.** Workspaces, folder/page containers, rich-text
   notes, uploaded files, and audio recordings all become `library_nodes`.
   Recording/transcript details remain separate domain rows attached to audio
   nodes.
2. **Destructive current-content migration is allowed.** The product owner is
   the only current user and approved wiping existing folders, notes, files,
   recordings, transcripts, transcript segments, semantic chunks, and tag links.
   Tags themselves may remain.
3. **Default migrated workspace name.** The migration creates one workspace node
   named `Imported workspace` for each existing profile/user that does not
   already have a workspace after the wipe.
4. **Readable stable URLs.** Slugs are human-readable with an ID suffix, e.g.
   `/biology-101-a1b2c3` and `/biology-101-a1b2c3/lecture-4-d9e8f7`.
5. **Route shape.** `/` is Library. `/{workspaceSlug}` opens the workspace root.
   `/{workspaceSlug}/{nodeSlug}` opens any descendant node regardless of depth.
   Breadcrumbs show the real tree path even though URLs do not include every
   ancestor.
6. **First-run behavior.** A signed-in user with no workspace nodes sees a
   blocking `Create workspace` prompt at `/`.
7. **Pages can nest.** Page-like nodes can have content and children. Files and
   audio are leaf nodes.
8. **Pinned semantics.** Only workspace/container pages can be pinned. Files,
   audio, and plain leaf notes cannot be pinned.
9. **Tag filter semantics.** Multiple selected tags use OR behavior: show nodes
   matching any selected tag. Clicking a selected tag deselects it; `All` clears
   all selected tags.
10. **Selection semantics.** Main-list rows use a desktop selection model:
    single click selects one row, Ctrl/Cmd-click toggles, Shift-click selects a
    range, and double-click opens.
11. **Delete loading state.** After delete confirmation, workspace contents
    enter a busy/loading state and disable duplicate destructive requests until
    the mutation settles.

## Data Model

Add a single navigation/content table:

```sql
create type library_node_kind as enum ('workspace', 'page', 'file', 'audio');

create table public.library_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid,
  parent_id uuid references public.library_nodes (id) on delete cascade,
  kind library_node_kind not null,
  title text not null,
  slug text not null,
  content_json jsonb,
  content_text text,
  content_tsv tsvector generated always as
    (to_tsvector('english', coalesce(content_text, ''))) stored,
  mime_type text,
  size_bytes bigint,
  storage_key text,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

The implementation may adjust exact constraint syntax, but these invariants are
binding:

- `workspace` nodes have `parent_id = null` and `workspace_id = id`.
- Non-workspace nodes have a non-null `workspace_id` pointing at their workspace
  root.
- `page` nodes may have `content_json`/`content_text` and may have children.
- `file` and `audio` nodes are leaves.
- File metadata fields are populated only for `file` and `audio` nodes.
- `slug` is unique per user and is generated from `title` plus a stable ID
  suffix.
- `is_pinned` can be true only for workspaces and page nodes that act as
  containers; server code enforces this.
- RLS follows the existing own-row pattern: every row has `user_id`, and all
  policies key on `auth.uid() = user_id`.
- The old `folders`, `documents`, and `files` navigation/content tables are
  removed by the migration. The final schema must not keep parallel navigation
  tables behind `library_nodes`.

Recording/transcript tables remain because they model transcription state and
derived transcript data, not navigation. `recordings` should reference
`library_nodes(id)` for audio nodes instead of `files(id)`.

Semantic search chunks should reference page nodes and audio/transcript records
where they currently reference `documents`, `recordings`, and `transcripts`.
Generated database types and generated schema docs must be regenerated.

## Migration Policy

The migration is intentionally destructive for current library content:

- Delete `tag_links`.
- Delete `semantic_search_chunks`.
- Delete `transcript_segments`, `transcripts`, and `recordings`.
- Drop storage-backed `files`, `documents`, and `folders` after dependent
  foreign keys have been retargeted or removed.
- Create `library_nodes`.
- Create one `Imported workspace` workspace node for each existing profile/user
  with no workspace node.

Because existing stored objects are not important in the current environment,
the implementation does not need to preserve Supabase Storage objects created by
old file rows. Future production migrations must not reuse this destructive
policy without a new product decision.

## Routes

Protected app routes change to:

- `/` - Library root.
- `/{workspaceSlug}` - workspace root.
- `/{workspaceSlug}/{nodeSlug}` - any descendant node.

Legacy routes should redirect or be removed where safe:

- `/library` redirects to `/`.
- `/library/recents` redirects to the new recents surface if retained.
- `/library/notes/:id` resolves the node for that legacy note only if a
  compatibility mapping exists; with the destructive migration, this can
  redirect to `/`.
- `/library/transcripts/:recordingId` should redirect to the audio node route if
  the recording exists.
- `/library/live` becomes a node-aware route or query-driven modal under the
  current workspace.

`proxy.ts` redirects authenticated users away from auth routes to `/`, not
`/library`.

## Library Layout

The global application shell still has:

- Brand/settings/new-note/search controls.
- Top nav rows for Library, Recents, and Ask Lumen.
- A Pinned section above the Library tree.
- A Library section containing workspace nodes and nested page/container nodes.
- Tags below the tree.
- User/account controls at the bottom.

At `/`, the main panel presents the universal Library. If workspaces exist, it
shows workspace rows and normal actions. If none exist, it opens the blocking
workspace creation dialog.

At `/{workspaceSlug}`, the main panel shows the workspace contents. At
`/{workspaceSlug}/{nodeSlug}`, the panel opens the node:

- Page nodes render the editor and can also expose child contents.
- File nodes render metadata/open/download affordances as available.
- Audio nodes render recording/transcript state and transcript viewer links.

Breadcrumbs are built from the actual `parent_id` chain and are clickable. The
URL does not include every ancestor, so moving a node updates breadcrumbs but
does not break the canonical node URL.

## Row Selection And Bulk Actions

`library-item-row.tsx` gets explicit hover and selected states:

- Hover uses a subtle surface tint.
- Selected uses a stronger tint, visible outline/border, and a check affordance.
- Single click selects one row.
- Ctrl/Cmd-click toggles a row.
- Shift-click selects a contiguous range.
- Double-click opens the row.

Add `library-item-actions.tsx`:

- Appears when `selectedNodeIds.length > 0`.
- Shows `N selected`.
- Provides Move, Delete, and Clear actions.
- Move validates server-side that nodes cannot move into themselves or
  descendants.
- Delete opens one confirmation dialog for all selected nodes.

After delete confirmation:

- The workspace content panel enters a busy state.
- Row selection, open, move, and delete controls are disabled.
- A subtle overlay/skeleton/loading indicator communicates progress.
- On success, selection clears and the snapshot refreshes.
- On failure, the busy state clears and the existing error toast/dialog pattern
  reports the error.

## Pinned

Pinned is persisted on `library_nodes.is_pinned`.

The service layer allows pinning:

- Workspace nodes.
- Page nodes with children or otherwise classified as container pages.

The service layer rejects pinning:

- File nodes.
- Audio nodes.
- Plain leaf pages.

The sidebar Pinned section appears above Library and links to canonical node
routes. Pinned rows are references to nodes, not duplicate records.

## Tags

Tags remain user-owned rows. `tag_links` should target `library_node` instead of
polymorphic `document | file | recording` targets.

Sidebar tag presentation changes:

- Compact rows with a hash icon/color marker on the left.
- Right-aligned count of linked nodes.
- Trash icon appears on hover/focus in place of the count.
- Existing create/rename/delete dialogs remain and use the current Dialog,
  ConfirmDialog, and TextInputDialog primitives.

Filter behavior:

- Filter state holds a set of selected tag IDs.
- Clicking a selected tag deselects it.
- `All` clears the set.
- Multiple selected tags show nodes linked to any selected tag.

## Services And APIs

Introduce node-oriented service functions:

- `getLibrarySnapshot(ctx)` returns nodes, recordings, transcripts, tags, tag
  links, and derived counts used by the sidebar and list views.
- `createWorkspaceNode(ctx, { title })`
- `createPageNode(ctx, { title, parentId, workspaceId })`
- `createFileNode(ctx, file metadata...)`
- `createAudioNode(ctx, audio metadata...)`
- `updateLibraryNode(ctx, { id, title?, parentId?, contentJson?, isPinned? })`
- `bulkMoveLibraryNodes(ctx, { ids, parentId })`
- `bulkDeleteLibraryNodes(ctx, { ids })`
- `linkTagToNode(ctx, { tagId, nodeId })`
- `unlinkTag(ctx, { linkId })`

Existing folder/document/file APIs should be removed or replaced with
node-oriented APIs. The finished implementation should not leave compatibility
wrappers as the primary code path. Recording/transcript APIs stay but use audio
node IDs where they currently use file IDs.

Uploads and live sessions create file/audio nodes directly. The transcription
worker keeps service-role access but every cross-user read/write remains scoped
by `user_id`.

Search, semantic indexing, grounded retrieval, assistant tools, and MCP tools
must read page nodes where they currently read `documents`, and audio nodes
where they currently hydrate file names for transcripts.

## Testing And Verification

Service tests:

- Workspace/page/file/audio node creation.
- Nested page paths and breadcrumbs.
- Invalid moves into self/descendant.
- Bulk delete of selected nodes and descendants.
- Pin eligibility.
- Tag link ownership and multi-tag OR filtering.
- User scoping for all node reads/writes.

Component tests:

- `/` renders Library and first-run modal when no workspaces exist.
- Workspace route opens by workspace slug.
- Node route opens by descendant node slug.
- Sidebar shows Pinned above Library.
- Row hover/selected classes are present.
- Single/Ctrl/Cmd/Shift selection behavior.
- Double-click opens without single-click opening.
- Bulk action bar appears and clears.
- Delete confirmation triggers content loading state.
- Tags render compact rows with hover delete affordance.
- Multi-tag filters can select/deselect multiple tags.

Verification:

- Run focused Vitest suites for services, library components, routes, search,
  assistant retrieval, MCP, uploads/live sessions, and workers as they are
  touched.
- Run `bun run check`.
- Run a browser happy path: first-run workspace creation, nested page creation,
  node navigation, multiple row selection, bulk delete loading state, pin a
  container page, multi-tag OR filter.

## Docs

Update all docs that describe the old navigation model:

- `ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/generated/db-schema.md`
- relevant product/frontend docs that mention folders/documents/files as
  separate navigation concepts
- `docs/PLANS.md`

The exec plan must remain under `docs/exec-plans/queued/cross-cutting/` until an
agent starts implementation and promotes it to active.
