-- Navigation node tree.
--
-- Replaces the folders/documents/files navigation model with a single
-- library_nodes tree (workspace | page | file | audio). Per the product
-- owner's 2026-06-18 approval (see
-- docs/superpowers/specs/2026-06-18-navigation-node-tree-design.md), this
-- migration is intentionally DESTRUCTIVE of current library content: all
-- folders, notes, files, recordings, transcripts, segments, semantic chunks,
-- and tag links are wiped. Tags themselves are kept. A single
-- "Imported workspace" node is created for every existing profile.
--
-- Future production migrations MUST NOT reuse this destructive policy without
-- a new product decision.

create type library_node_kind as enum ('workspace', 'page', 'file', 'audio');

-- ============ Wipe dependent content (FK-safe order) ============
delete from public.tag_links;
delete from public.semantic_search_chunks;
delete from public.transcript_segments;
delete from public.transcripts;
delete from public.recordings;
delete from public.files;
delete from public.documents;
delete from public.folders;

-- ============ library_nodes: the single navigation/content tree ============
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

-- ============ Retarget semantic_search_chunks: document -> page node ============
drop function if exists public.match_semantic_search_chunks(extensions.vector(384), text, uuid, integer);

alter table public.semantic_search_chunks drop constraint if exists semantic_search_chunks_one_source;
alter table public.semantic_search_chunks drop constraint if exists semantic_search_chunks_document_anchor_valid;
alter table public.semantic_search_chunks drop constraint if exists semantic_search_chunks_document_id_user_id_fkey;
alter table public.semantic_search_chunks drop constraint if exists semantic_search_chunks_transcript_id_user_id_fkey;
alter table public.semantic_search_chunks drop constraint if exists semantic_search_chunks_recording_id_user_id_fkey;
alter table public.semantic_search_chunks drop constraint if exists semantic_search_chunks_transcript_id_recording_id_user_id_fkey;
-- Names below are the Postgres-truncated (63-char) identifiers of the original
-- UNIQUE (user_id, source_type, {document,transcript}_id, chunk_index) constraints.
alter table public.semantic_search_chunks drop constraint if exists semantic_search_chunks_user_id_source_type_document_id_chun_key;
alter table public.semantic_search_chunks drop constraint if exists semantic_search_chunks_user_id_source_type_transcript_id_ch_key;
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

-- ============ Retarget recordings: files(id) -> library_nodes(id) ============
alter table public.recordings drop constraint recordings_file_id_fkey;
alter table public.recordings rename column file_id to node_id;
alter table public.recordings
  add constraint recordings_node_id_fkey foreign key (node_id) references public.library_nodes (id) on delete cascade;
alter index recordings_file_id_idx rename to recordings_node_id_idx;

-- ============ Retarget tag_links: polymorphic target -> library_nodes(id) ============
alter table public.tag_links add column node_id uuid references public.library_nodes (id) on delete cascade;
alter table public.tag_links drop constraint if exists tag_links_tag_id_target_type_target_id_key;
drop index if exists tag_links_target_idx;
alter table public.tag_links drop column target_type;
alter table public.tag_links drop column target_id;
alter table public.tag_links alter column node_id set not null;
create unique index tag_links_tag_id_node_id_key on public.tag_links (tag_id, node_id);
drop type tag_target_type;

-- ============ Seed one "Imported workspace" per existing profile ============
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

-- ============ Recreate hybrid match function over page/transcript chunks ============
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

-- ============ Drop the old navigation/content tables ============
drop table public.documents;
drop table public.files;
drop table public.folders;
