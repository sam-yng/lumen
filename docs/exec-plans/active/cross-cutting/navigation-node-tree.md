# Navigation Node Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## ⚠️ Implementation status / handoff (2026-06-18)

**Branch:** `navigation-node-tree` (committed + pushed; NOT merged).

**Done — Milestone 1 only (Tasks 1–3):**
- Migration `apps/web/supabase/migrations/20260618120000_library_nodes.sql` written + applied (`db reset`). `seed.sql` rewritten onto nodes.
- `database.types.ts` + `docs/generated/db-schema.md` regenerated.
- `src/server/services/library-nodes.ts` implemented; `__tests__/library-nodes.test.ts` 7/7; full service suite 176/176. `fake-supabase.ts` now returns inserted rows from `insert().select()`.

**🔴 `bun run check` is RED on this commit — intentionally.** The destructive
migration drops the `folders`/`documents`/`files` tables+types, so ~60 files
that still import `Tables<"folders"|"documents"|"files">` (services, the
`app/api/library/**` routes, App Router pages, library UI, tags, uploads,
workers, search, assistant, MCP) no longer typecheck. There is **no green
checkpoint until M2–M5 land**; the whole change goes green again only once every
consumer is retargeted to `library_nodes`. Do not "fix" the migration to make
check pass — finish the migration.

**Resume at Milestone 2, Task 4.** Recommended order to claw typecheck back to
green: M2 (API + routes) → M4 Task 9 (uploads/workers/recordings/transcripts) →
M5 (search/assistant/MCP) → M3 (library UI) → M4 Task 8 (tags) → M4 Task 10
(editor/transcript) → M6 (docs + browser happy-path). Run
`bun run typecheck` to enumerate the remaining broken files as a live worklist.

**Gotchas already handled (do not redo):**
- The plan's two `drop constraint if exists` names for the per-source unique
  constraints were wrong; corrected to the Postgres-truncated 63-char names
  (`..._document_id_chun_key`, `..._transcript_id_ch_key`), verified against the
  live DB. If you add a fresh migration, re-introspect names with
  `select conname from pg_constraint where conrelid = 'public.<table>'::regclass;`.
- `crypto.randomUUID()` is used for node IDs in the service (matches `folders.ts`).

---

**Goal:** Replace Lumen's `/library` folder/document/file navigation model with a root Library at `/`, workspace/page/file/audio `library_nodes`, Notion-style nesting, pinned container pages, desktop row selection, bulk actions, and compact multi-tag filtering.

**Architecture:** Add `library_nodes` as the single navigation/content tree, destructively reset existing library content per product-owner approval, and retarget routes, services, uploads, live sessions, search, assistant retrieval, MCP, workers, and UI components to node IDs. Recording/transcript rows remain domain tables attached to audio nodes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase migrations/RLS, TanStack Query, TipTap, pg-boss worker, Vitest + Testing Library + Playwright.

**Design Input:** [`docs/superpowers/specs/2026-06-18-navigation-node-tree-design.md`](../../../superpowers/specs/2026-06-18-navigation-node-tree-design.md)

---

## Global Constraints

- Read the relevant Next 16 docs before editing app routes:
  - `apps/web/node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
  - `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`
  - `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
- The migration may destructively wipe current folders, notes, files, recordings, transcripts, transcript segments, semantic chunks, and tag links. Do not preserve old content.
- Create a default workspace named `Imported workspace` for every existing user/profile after the wipe.
- Keep tags, but remove old links.
- Keep worker service-role queries explicitly scoped by `user_id`.
- Use TDD for behavior changes: write/adjust focused tests before production code.
- Run `bun run check` after every implementation patch.
- Run a browser happy path before declaring the plan complete.

## Milestone 1: Schema, Types, And Core Node Services

### Task 1: Add destructive node migration

**Files:**
- Create: `apps/web/supabase/migrations/20260618120000_library_nodes.sql`
- Regenerate: `apps/web/src/server/db/database.types.ts`
- Regenerate: `docs/generated/db-schema.md`

- [x] **Step 1: Write migration**

Create a migration that:

```sql
create type library_node_kind as enum ('workspace', 'page', 'file', 'audio');

delete from public.tag_links;
delete from public.semantic_search_chunks;
delete from public.transcript_segments;
delete from public.transcripts;
delete from public.recordings;
delete from public.files;
delete from public.documents;
delete from public.folders;

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
  updated_at timestamptz not null default now(),
  constraint library_nodes_id_user_id_key unique (id, user_id),
  constraint library_nodes_workspace_parent_check check (
    (kind = 'workspace' and parent_id is null)
    or (kind <> 'workspace' and workspace_id is not null)
  ),
  constraint library_nodes_file_metadata_check check (
    (kind in ('file', 'audio') and mime_type is not null and size_bytes is not null and storage_key is not null)
    or (kind not in ('file', 'audio') and mime_type is null and size_bytes is null and storage_key is null)
  )
);

alter table public.library_nodes
  add constraint library_nodes_workspace_id_fkey
  foreign key (workspace_id) references public.library_nodes (id) on delete cascade;

create unique index library_nodes_user_slug_key on public.library_nodes (user_id, slug);
create index library_nodes_user_id_idx on public.library_nodes (user_id);
create index library_nodes_workspace_id_idx on public.library_nodes (workspace_id);
create index library_nodes_parent_id_idx on public.library_nodes (parent_id);
create index library_nodes_content_tsv_idx on public.library_nodes using gin (content_tsv);
create trigger library_nodes_set_updated_at before update on public.library_nodes
  for each row execute function public.set_updated_at();

alter table public.library_nodes enable row level security;
create policy "library_nodes_select_own" on public.library_nodes for select using (auth.uid() = user_id);
create policy "library_nodes_insert_own" on public.library_nodes for insert with check (auth.uid() = user_id);
create policy "library_nodes_update_own" on public.library_nodes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "library_nodes_delete_own" on public.library_nodes for delete using (auth.uid() = user_id);
```

Then alter dependent tables and remove old navigation tables:

```sql
drop function if exists public.match_semantic_search_chunks(extensions.vector(384), text, uuid, integer);

alter table public.semantic_search_chunks drop constraint if exists semantic_search_chunks_one_source;
alter table public.semantic_search_chunks drop constraint if exists semantic_search_chunks_document_anchor_valid;
alter table public.semantic_search_chunks drop constraint if exists semantic_search_chunks_document_id_user_id_fkey;
alter table public.semantic_search_chunks drop constraint if exists semantic_search_chunks_transcript_id_user_id_fkey;
alter table public.semantic_search_chunks drop constraint if exists semantic_search_chunks_recording_id_user_id_fkey;
alter table public.semantic_search_chunks drop constraint if exists semantic_search_chunks_transcript_id_recording_id_user_id_fkey;
alter table public.semantic_search_chunks drop constraint if exists semantic_search_chunks_user_id_source_type_document_id_chunk_index_key;
alter table public.semantic_search_chunks drop constraint if exists semantic_search_chunks_user_id_source_type_transcript_id_chunk_index_key;
drop index if exists semantic_search_chunks_document_id_idx;

alter type semantic_search_source_type rename value 'document' to 'page';
alter table public.semantic_search_chunks rename column document_id to node_id;
alter table public.semantic_search_chunks
  add constraint semantic_search_chunks_one_source check (
    (
      source_type = 'page'
      and node_id is not null
      and transcript_id is null
      and recording_id is null
      and start_ms is null
      and end_ms is null
    ) or (
      source_type = 'transcript'
      and node_id is null
      and transcript_id is not null
      and recording_id is not null
      and start_ms is not null
      and end_ms is not null
      and end_ms >= start_ms
    )
  );
alter table public.semantic_search_chunks
  add constraint semantic_search_chunks_page_anchor_valid check (
    (
      source_type = 'page'
      and (
        (
          document_anchor_block_start is null
          and document_anchor_block_end is null
        )
        or (
          document_anchor_block_start is not null
          and document_anchor_block_end is not null
          and document_anchor_block_start >= 0
          and document_anchor_block_end >= document_anchor_block_start
        )
      )
    )
    or (
      source_type = 'transcript'
      and document_anchor_block_start is null
      and document_anchor_block_end is null
    )
  );
alter table public.semantic_search_chunks
  add constraint semantic_search_chunks_node_id_user_id_fkey
  foreign key (node_id, user_id) references public.library_nodes (id, user_id) on delete cascade;
alter table public.semantic_search_chunks
  add constraint semantic_search_chunks_transcript_id_user_id_fkey
  foreign key (transcript_id, user_id) references public.transcripts (id, user_id) on delete cascade;
alter table public.semantic_search_chunks
  add constraint semantic_search_chunks_recording_id_user_id_fkey
  foreign key (recording_id, user_id) references public.recordings (id, user_id) on delete cascade;
alter table public.semantic_search_chunks
  add constraint semantic_search_chunks_transcript_id_recording_id_user_id_fkey
  foreign key (transcript_id, recording_id, user_id) references public.transcripts (id, recording_id, user_id) on delete cascade;
create unique index semantic_search_chunks_user_page_chunk_key
  on public.semantic_search_chunks (user_id, source_type, node_id, chunk_index)
  where source_type = 'page';
create unique index semantic_search_chunks_user_transcript_chunk_key
  on public.semantic_search_chunks (user_id, source_type, transcript_id, chunk_index)
  where source_type = 'transcript';
create index semantic_search_chunks_node_id_idx
  on public.semantic_search_chunks (node_id)
  where node_id is not null;

alter table public.recordings drop constraint recordings_file_id_fkey;
alter table public.recordings rename column file_id to node_id;
alter table public.recordings
  add constraint recordings_node_id_fkey foreign key (node_id) references public.library_nodes (id) on delete cascade;
alter index recordings_file_id_idx rename to recordings_node_id_idx;

alter table public.tag_links add column node_id uuid references public.library_nodes (id) on delete cascade;
alter table public.tag_links drop constraint if exists tag_links_tag_id_target_type_target_id_key;
drop index if exists tag_links_target_idx;
alter table public.tag_links drop column target_type;
alter table public.tag_links drop column target_id;
alter table public.tag_links alter column node_id set not null;
create unique index tag_links_tag_id_node_id_key on public.tag_links (tag_id, node_id);
drop type tag_target_type;

with imported_workspaces as (
  select p.id as user_id, gen_random_uuid() as node_id
  from public.profiles p
)
insert into public.library_nodes (id, user_id, workspace_id, kind, title, slug)
select
  node_id,
  user_id,
  null,
  'workspace',
  'Imported workspace',
  'imported-workspace-' || substr(replace(node_id::text, '-', ''), 1, 8)
from imported_workspaces;

update public.library_nodes set workspace_id = id where kind = 'workspace' and workspace_id is null;
alter table public.library_nodes alter column workspace_id set not null;

create or replace function public.match_semantic_search_chunks(
  query_embedding extensions.vector(384),
  query_text text,
  match_user_id uuid,
  match_count integer default 8
)
returns table (
  id uuid,
  user_id uuid,
  source_type semantic_search_source_type,
  source jsonb,
  chunk_index integer,
  content text,
  similarity double precision,
  text_rank real
)
language sql
stable
set search_path = ''
as $$
  with query as (
    select websearch_to_tsquery('english', query_text) as text_query
  )
  select
    c.id,
    c.user_id,
    c.source_type,
    case c.source_type
      when 'page' then jsonb_strip_nulls(jsonb_build_object(
        'nodeId', c.node_id,
        'anchor', case
          when c.document_anchor_block_start is null then null
          else jsonb_build_object(
            'blockStart', c.document_anchor_block_start,
            'blockEnd', c.document_anchor_block_end
          )
        end
      ))
      when 'transcript' then jsonb_build_object(
        'transcriptId', c.transcript_id,
        'recordingId', c.recording_id,
        'startMs', c.start_ms,
        'endMs', c.end_ms
      )
      else jsonb_build_object()
    end as source,
    c.chunk_index,
    c.content,
    1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity,
    ts_rank_cd(c.content_tsv, q.text_query) as text_rank
  from public.semantic_search_chunks c
  cross join query q
  where c.user_id = match_user_id
    and (
      c.embedding operator(extensions.<=>) query_embedding < 0.85
      or c.content_tsv @@ q.text_query
    )
  order by
    (1 - (c.embedding operator(extensions.<=>) query_embedding)) desc,
    ts_rank_cd(c.content_tsv, q.text_query) desc,
    c.updated_at desc
  limit greatest(1, least(match_count, 20));
$$;

drop table public.documents;
drop table public.files;
drop table public.folders;
```

Use the current migration-defined names when dropping old tag-link structures:
`tag_links_tag_id_target_type_target_id_key` for the unique constraint and
`tag_links_target_idx` for the target lookup index. If a local database has a
different generated name, inspect it with `select conname from pg_constraint where
conrelid = 'public.tag_links'::regclass;` and update this migration before
running `db reset`.

- [x] **Step 2: Apply migration locally**

Run:

```bash
cd apps/web && bunx supabase db reset
```

Expected: migrations apply cleanly and create `library_nodes`.

- [x] **Step 3: Regenerate database types and schema docs**

> Note: the migration's two `drop constraint if exists` names for the original
> per-source unique constraints were corrected to the Postgres-truncated (63-char)
> identifiers (`..._document_id_chun_key`, `..._transcript_id_ch_key`) verified
> against the local DB. `seed.sql` was rewritten onto `library_nodes` + `tag_links.node_id`.

Run:

```bash
cd apps/web && bun run db:types && bun run docs:db-schema
```

Expected: `database.types.ts` includes `library_nodes`, `library_node_kind`, updated `recordings.node_id`, updated `tag_links.node_id`, and no `folders`, `documents`, or `files` tables.

### Task 2: Add core node service tests

**Files:**
- Create: `apps/web/src/server/services/library-nodes.ts`
- Test: `apps/web/src/server/services/__tests__/library-nodes.test.ts`
- Modify: `apps/web/src/server/services/__tests__/fake-supabase.ts` if the fake needs extra query behavior.

- [x] **Step 1: Write failing tests**

Cover:

```ts
it("creates a workspace with a stable readable slug", async () => {});
it("creates nested page nodes scoped to a workspace", async () => {});
it("rejects moving a node into itself or a descendant", async () => {});
it("bulk deletes selected nodes and descendants for the current user only", async () => {});
it("allows pinning workspaces and container pages only", async () => {});
it("returns a snapshot scoped to the current user", async () => {});
```

- [x] **Step 2: Verify RED**

Run:

```bash
bun run --filter @lumen/web test src/server/services/__tests__/library-nodes.test.ts
```

Expected: FAIL because `library-nodes.ts` is not implemented.

### Task 3: Implement core node services

**Files:**
- Modify: `apps/web/src/server/services/library-nodes.ts`

- [x] **Step 1: Implement service module**

Export:

```ts
export type LibraryNodeKind = Tables<"library_nodes">["kind"];
export type LibraryNode = Tables<"library_nodes">;

export async function getLibraryNodeSnapshot(ctx: ServiceContext) {}
export async function createWorkspaceNode(ctx: ServiceContext, input: { title: string }) {}
export async function createPageNode(ctx: ServiceContext, input: { title: string; parentId: string }) {}
export async function createFileNode(ctx: ServiceContext, input: { title: string; parentId: string; mimeType: string; sizeBytes: number; storageKey: string }) {}
export async function createAudioNode(ctx: ServiceContext, input: { title: string; parentId: string | null; workspaceId: string; mimeType: string; sizeBytes: number; storageKey: string }) {}
export async function updateLibraryNode(ctx: ServiceContext, input: { id: string; title?: string; parentId?: string | null; contentJson?: Json | null; isPinned?: boolean }) {}
export async function bulkMoveLibraryNodes(ctx: ServiceContext, input: { ids: string[]; parentId: string | null }) {}
export async function bulkDeleteLibraryNodes(ctx: ServiceContext, input: { ids: string[] }) {}
```

Required helpers:

- `slugFor(title, id)` returns lowercase words plus first 8 compact UUID chars.
- `assertNodeOwned(ctx, id)`.
- `assertParentCanContainChildren(parent)` rejects `file` and `audio`.
- `assertMoveAllowed(nodes, ids, parentId)`.
- `nodeHasChildren(nodes, id)` for pin eligibility.
- `extractTipTapText` for page content updates.

- [x] **Step 2: Verify GREEN**

> Done: 7/7 `library-nodes.test.ts` pass; full service suite 176/176 green
> (fake-supabase gained inserted-row return semantics for `insert().select()`).

Run:

```bash
bun run --filter @lumen/web test src/server/services/__tests__/library-nodes.test.ts
```

Expected: PASS.

## Milestone 2: API And Route Re-rooting

### Task 4: Replace library API with node endpoints

**Files:**
- Modify: `apps/web/src/app/api/library/route.ts`
- Create: `apps/web/src/app/api/library/nodes/route.ts`
- Create: `apps/web/src/app/api/library/nodes/[id]/route.ts`
- Create: `apps/web/src/app/api/library/nodes/bulk-move/route.ts`
- Create: `apps/web/src/app/api/library/nodes/bulk-delete/route.ts`
- Create: `apps/web/src/app/api/library/__tests__/nodes-route.test.ts`
- Modify: `apps/web/src/components/library/library-api.ts`

- [ ] **Step 1: Write route tests**

Add `apps/web/src/app/api/library/__tests__/nodes-route.test.ts` with tests
for create/update/bulk move/bulk delete request validation and service error
responses. Follow the route-handler test style used by
`apps/web/src/app/api/assistant/__tests__/route.test.ts`.

- [ ] **Step 2: Implement routes**

Use zod request schemas:

```ts
const createNodeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("workspace"), title: z.string().min(1) }),
  z.object({ kind: z.literal("page"), title: z.string().min(1), parentId: uuidSchema }),
]);

const updateNodeSchema = z.object({
  title: z.string().min(1).optional(),
  parentId: nullableUuidSchema.optional(),
  contentJson: z.unknown().optional(),
  isPinned: z.boolean().optional(),
});
```

Keep file/audio creation inside upload/live-session routes so raw file metadata is not hand-posted by the UI.

- [ ] **Step 3: Update client API helpers**

Expose:

```ts
export function fetchLibrarySnapshot() {}
export function createWorkspace(input: { title: string }) {}
export function createPage(input: { title: string; parentId: string }) {}
export function updateNode(input: { id: string; title?: string; parentId?: string | null; contentJson?: Json | null; isPinned?: boolean }) {}
export function bulkMoveNodes(input: { ids: string[]; parentId: string | null }) {}
export function bulkDeleteNodes(input: { ids: string[] }) {}
```

Remove old folder/document/file helpers after consumers are updated.

### Task 5: Re-root App Router pages

**Files:**
- Read before editing: Next docs listed in Global Constraints.
- Modify: `apps/web/src/app/(app)/page.tsx`
- Create: `apps/web/src/app/(app)/[workspaceSlug]/page.tsx`
- Create: `apps/web/src/app/(app)/[workspaceSlug]/[nodeSlug]/page.tsx`
- Modify/delete legacy pages under `apps/web/src/app/(app)/library/**`
- Modify: `apps/web/src/proxy.ts`
- Modify: `apps/web/src/__tests__/proxy.test.ts`

- [ ] **Step 1: Write failing route/proxy tests**

Assert authenticated auth-page redirect target is `/`, `/library` redirects to `/`, and workspace/node pages pass slugs to route components.

- [ ] **Step 2: Implement pages and redirects**

`page.tsx` renders root Library. Dynamic pages render the same workspace shell with selected workspace/node resolved client-side or server-side through node snapshot services.

Legacy pages:

```ts
import { redirect } from "next/navigation";

export default function LegacyLibraryPage() {
  redirect("/");
}
```

- [ ] **Step 3: Verify focused tests**

Run:

```bash
bun run --filter @lumen/web test src/__tests__/proxy.test.ts
```

Expected: PASS.

## Milestone 3: Library UI, First Run, Selection, Bulk Actions

### Task 6: Refactor workspace shell to nodes

**Files:**
- Modify: `apps/web/src/components/library/library-workspace.tsx`
- Modify: `apps/web/src/components/library/library-content.tsx`
- Modify: `apps/web/src/components/library/library-sidebar.tsx`
- Modify: `apps/web/src/components/library/library-paths.ts`
- Modify tests under `apps/web/src/components/library/__tests__/`

- [ ] **Step 1: Write failing component tests**

Cover:

```ts
it("opens a blocking workspace dialog at root when no workspaces exist", async () => {});
it("renders workspace nodes in the Library section", async () => {});
it("renders pinned container nodes above Library", async () => {});
it("builds breadcrumbs from parent links", async () => {});
```

- [ ] **Step 2: Implement node snapshot rendering**

Replace `selectedFolderId` with selected workspace/node IDs derived from route slugs. Render children by `parent_id`. Root `/` renders workspace nodes. Workspace route renders children of the workspace node.

- [ ] **Step 3: Implement first-run modal**

Use the existing Dialog primitives. The modal is blocking while there are no workspace nodes:

```tsx
<Dialog open={snapshot.nodes.every((node) => node.kind !== "workspace")}>
  <DialogContent>
    <DialogTitle>Create a workspace</DialogTitle>
    ...
  </DialogContent>
</Dialog>
```

On submit, call `createWorkspace({ title })` and navigate to `/${workspace.slug}`.

### Task 7: Add selected row behavior and bulk action bar

**Files:**
- Modify: `apps/web/src/components/library/library-item-row.tsx`
- Create: `apps/web/src/components/library/library-item-actions.tsx`
- Modify: `apps/web/src/components/library/library-content.tsx`
- Test: `apps/web/src/components/library/__tests__/library-item-row.test.tsx`
- Test: `apps/web/src/components/library/__tests__/library-content.test.tsx`

- [ ] **Step 1: Write failing selection tests**

Test single click, Ctrl/Cmd toggle, Shift range, and double-click open.

- [ ] **Step 2: Implement selected/hover row state**

`ItemRow` props:

```ts
isSelected: boolean;
selectionIndex: number;
onSelect: (event: React.MouseEvent, nodeId: string) => void;
onOpen: (nodeId: string) => void;
```

Use `onClick` for selection and `onDoubleClick` for open. Add classes for selected state and hover state.

- [ ] **Step 3: Implement bulk action bar**

`LibraryItemActions` props:

```ts
selectedCount: number;
isBusy: boolean;
onMove: () => void;
onDelete: () => void;
onClear: () => void;
```

Show Move, Delete, Clear. Disable while busy.

- [ ] **Step 4: Implement delete loading state**

In `LibraryContent`, set `isDeleting` before confirming the bulk delete mutation. While true, render a loading overlay and disable row interactions.

## Milestone 4: Tags, Uploads, Live Sessions, Editor, Transcript

### Task 8: Retarget tags to nodes and compact tag UI

**Files:**
- Modify: `apps/web/src/server/services/tags.ts`
- Modify: `apps/web/src/app/api/library/tag-links/route.ts`
- Modify: `apps/web/src/app/api/library/tag-links/[id]/route.ts`
- Modify: `apps/web/src/components/library/tag-panel.tsx`
- Modify: `apps/web/src/components/library/library-filter-chips.tsx`
- Modify: `apps/web/src/components/library/library-tags.ts`
- Test: `apps/web/src/server/services/__tests__/tags-read.test.ts`
- Test: `apps/web/src/components/library/__tests__/library-sidebar.test.tsx`

- [ ] **Step 1: Write failing tag tests**

Assert tag links target node IDs, multiple selected tags use OR semantics, selected tag click deselects, and hover/focus shows delete action in the right count slot.

- [ ] **Step 2: Implement service/API changes**

Replace polymorphic target validation with `library_nodes` ownership validation.

- [ ] **Step 3: Implement compact tag rows**

Render `#`, tag name, count, and hover/focus trash button replacing the count.

### Task 9: Update uploads, live sessions, recordings, and transcripts

**Files:**
- Modify: `apps/web/src/server/services/uploads.ts`
- Modify: `apps/web/src/server/services/files.ts` or remove if obsolete
- Modify: `apps/web/src/server/services/live-sessions.ts`
- Modify: `apps/web/src/server/services/recordings.ts`
- Modify: `apps/web/src/server/services/transcripts.ts`
- Modify: `apps/web/worker/transcription-worker.ts`
- Modify: `apps/web/worker/speaker-label-worker.ts`
- Modify: worker tests under `apps/web/worker/__tests__/`
- Modify service tests under `apps/web/src/server/services/__tests__/`

- [ ] **Step 1: Write failing service/worker tests**

Assert uploads create `file` or `audio` nodes, recordings reference `node_id`, transcript detail hydrates audio node title/storage key, and worker queries include `user_id` filters.

- [ ] **Step 2: Implement services**

Replace file row creation with `createFileNode`/`createAudioNode`. Update enqueue payload to carry `nodeId` and `storageKey`.

- [ ] **Step 3: Update workers**

Workers load audio nodes from `library_nodes` by `node_id` and `user_id`, then continue the existing storage/transcription flow.

### Task 10: Update editor and transcript routes

**Files:**
- Modify: `apps/web/src/components/library/note-route.tsx`
- Modify: `apps/web/src/components/library/transcript-route.tsx`
- Modify: `apps/web/src/components/editor/document-editor.tsx`
- Modify tests for editor/transcript components.

- [ ] **Step 1: Write failing route component tests**

Assert page nodes render editor content and audio nodes render transcript viewer data.

- [ ] **Step 2: Implement node-based components**

Keep component filenames unchanged in this milestone. `DocumentEditor` should
consume a page `library_nodes` row instead of `documents`.

## Milestone 5: Search, Assistant, MCP, Semantic Index

### Task 11: Retarget search and semantic indexing

**Files:**
- Modify: `apps/web/src/server/services/search.ts`
- Modify: `apps/web/src/server/services/semantic-index.ts`
- Modify: `apps/web/src/server/services/grounded-retrieval.ts`
- Modify: tests under `apps/web/src/server/services/__tests__/`

- [ ] **Step 1: Write failing search/index tests**

Assert page nodes are indexed and found where documents were previously indexed/found; transcript search hydrates audio node names.

- [ ] **Step 2: Implement node-based indexing**

Replace document table reads with `library_nodes` reads filtered to `kind = 'page'`. Keep transcript indexing tied to transcripts/recordings.

### Task 12: Update assistant and MCP tools/resources

**Files:**
- Modify: `apps/web/src/server/services/assistant.ts`
- Modify: `apps/web/src/server/mcp/tools.ts`
- Modify: `apps/web/src/server/mcp/resources.ts`
- Modify: MCP and assistant tests.

- [ ] **Step 1: Write failing MCP/assistant tests**

Assert document/list/read tools operate on page nodes and return stable node routes.

- [ ] **Step 2: Implement tool updates**

Keep external MCP tool names stable for this pass. Update tool descriptions and
response copy to say "pages/notes" rather than old documents when the schema
type leaks into user-facing text.

## Milestone 6: Docs, Verification, And Handoff

### Task 13: Update docs

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `docs/SECURITY.md`
- Modify: `docs/FRONTEND.md`
- Modify: `docs/DESIGN.md` if it references folder/document navigation.
- Modify: `docs/generated/db-schema.md`
- Modify: `docs/PLANS.md` when promoting lifecycle.

- [ ] **Step 1: Replace old navigation model references**

Document `library_nodes`, destructive current-dev migration approval, route shape, RLS model, worker service-role caveat, and pinned/tag behavior.

### Task 14: Full verification

- [ ] **Step 1: Run full gate**

Run:

```bash
bun run check
```

Expected: PASS.

- [ ] **Step 2: Run browser happy path**

Run the app locally:

```bash
cd apps/web && bun run dev
```

Manual/browser checks:

- Sign in and land at `/`.
- If no workspace exists, blocking `Create workspace` dialog appears.
- Create a workspace and land on `/{workspaceSlug}`.
- Create nested page nodes.
- Open nodes with double-click.
- Select multiple rows with Ctrl/Cmd and Shift.
- Confirm bulk delete and observe loading/busy state.
- Pin a container page and verify it appears in Pinned.
- Create tags and select multiple filters; OR semantics are visible.
- Upload or record audio if local dependencies allow.

- [ ] **Step 3: Record verification**

Append observed focused tests, `bun run check`, and browser verification results to this plan before moving it to `completed`.
