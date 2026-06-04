-- M1 domain schema.
--
-- All v1 domain tables (brief §4) with user_id ownership and Row-Level Security
-- on every table, following the canonical pattern established by `profiles`
-- (M0). Tables without a direct user_id (transcript_segments, tag_links) enforce
-- ownership through a join to their parent. Full-text search (M5) is prepared
-- via stored generated tsvector columns + GIN indexes.

-- ============ Enums ============
create type file_kind as enum ('audio', 'other');
create type recording_status as enum ('pending', 'processing', 'done', 'failed');
create type tag_target_type as enum ('document', 'file', 'recording');

-- ============ Shared updated_at trigger ============
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============ folders (self-referential nesting) ============
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  parent_id uuid references public.folders (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index folders_user_id_idx on public.folders (user_id);
create index folders_parent_id_idx on public.folders (parent_id);
create trigger folders_set_updated_at before update on public.folders
  for each row execute function public.set_updated_at();

-- ============ documents (TipTap JSON + derived text + FTS) ============
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  title text not null default 'Untitled',
  content_json jsonb,
  content_text text,
  content_tsv tsvector generated always as
    (to_tsvector('english', coalesce(content_text, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_user_id_idx on public.documents (user_id);
create index documents_folder_id_idx on public.documents (folder_id);
create index documents_content_tsv_idx on public.documents using gin (content_tsv);
create trigger documents_set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- ============ files (Supabase Storage objects) ============
create table public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  storage_key text not null,
  kind file_kind not null default 'other',
  created_at timestamptz not null default now()
);
create index files_user_id_idx on public.files (user_id);
create index files_folder_id_idx on public.files (folder_id);

-- ============ recordings (one per audio file; transcription job state) ============
create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_id uuid not null references public.files (id) on delete cascade,
  status recording_status not null default 'pending',
  duration_sec integer,
  error text,
  created_at timestamptz not null default now()
);
create index recordings_user_id_idx on public.recordings (user_id);
create index recordings_file_id_idx on public.recordings (file_id);
create index recordings_status_idx on public.recordings (status);

-- ============ transcripts (one per recording; FTS) ============
create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recording_id uuid not null references public.recordings (id) on delete cascade,
  full_text text not null default '',
  language text,
  full_text_tsv tsvector generated always as
    (to_tsvector('english', coalesce(full_text, ''))) stored,
  created_at timestamptz not null default now()
);
create index transcripts_user_id_idx on public.transcripts (user_id);
create index transcripts_recording_id_idx on public.transcripts (recording_id);
create index transcripts_full_text_tsv_idx on public.transcripts using gin (full_text_tsv);

-- ============ transcript_segments (owned via transcripts; speaker reserved) ============
create table public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.transcripts (id) on delete cascade,
  start_ms integer not null,
  end_ms integer not null,
  text text not null,
  speaker text
);
create index transcript_segments_transcript_id_idx
  on public.transcript_segments (transcript_id);
create index transcript_segments_start_ms_idx
  on public.transcript_segments (transcript_id, start_ms);

-- ============ tags ============
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text,
  unique (user_id, name)
);
create index tags_user_id_idx on public.tags (user_id);

-- ============ tag_links (owned via tags) ============
create table public.tag_links (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.tags (id) on delete cascade,
  target_type tag_target_type not null,
  target_id uuid not null,
  unique (tag_id, target_type, target_id)
);
create index tag_links_target_idx on public.tag_links (target_type, target_id);

-- ============================ RLS ============================
alter table public.folders enable row level security;
alter table public.documents enable row level security;
alter table public.files enable row level security;
alter table public.recordings enable row level security;
alter table public.transcripts enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.tags enable row level security;
alter table public.tag_links enable row level security;

-- Own-row tables: one policy per operation, keyed on auth.uid() = user_id.
create policy "folders_select_own" on public.folders for select using (auth.uid() = user_id);
create policy "folders_insert_own" on public.folders for insert with check (auth.uid() = user_id);
create policy "folders_update_own" on public.folders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "folders_delete_own" on public.folders for delete using (auth.uid() = user_id);

create policy "documents_select_own" on public.documents for select using (auth.uid() = user_id);
create policy "documents_insert_own" on public.documents for insert with check (auth.uid() = user_id);
create policy "documents_update_own" on public.documents for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "documents_delete_own" on public.documents for delete using (auth.uid() = user_id);

create policy "files_select_own" on public.files for select using (auth.uid() = user_id);
create policy "files_insert_own" on public.files for insert with check (auth.uid() = user_id);
create policy "files_update_own" on public.files for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "files_delete_own" on public.files for delete using (auth.uid() = user_id);

create policy "recordings_select_own" on public.recordings for select using (auth.uid() = user_id);
create policy "recordings_insert_own" on public.recordings for insert with check (auth.uid() = user_id);
create policy "recordings_update_own" on public.recordings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recordings_delete_own" on public.recordings for delete using (auth.uid() = user_id);

create policy "transcripts_select_own" on public.transcripts for select using (auth.uid() = user_id);
create policy "transcripts_insert_own" on public.transcripts for insert with check (auth.uid() = user_id);
create policy "transcripts_update_own" on public.transcripts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transcripts_delete_own" on public.transcripts for delete using (auth.uid() = user_id);

create policy "tags_select_own" on public.tags for select using (auth.uid() = user_id);
create policy "tags_insert_own" on public.tags for insert with check (auth.uid() = user_id);
create policy "tags_update_own" on public.tags for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tags_delete_own" on public.tags for delete using (auth.uid() = user_id);

-- Join-owned tables: ownership via parent row.
create policy "transcript_segments_select_own" on public.transcript_segments for select
  using (exists (select 1 from public.transcripts t where t.id = transcript_id and t.user_id = auth.uid()));
create policy "transcript_segments_insert_own" on public.transcript_segments for insert
  with check (exists (select 1 from public.transcripts t where t.id = transcript_id and t.user_id = auth.uid()));
create policy "transcript_segments_update_own" on public.transcript_segments for update
  using (exists (select 1 from public.transcripts t where t.id = transcript_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.transcripts t where t.id = transcript_id and t.user_id = auth.uid()));
create policy "transcript_segments_delete_own" on public.transcript_segments for delete
  using (exists (select 1 from public.transcripts t where t.id = transcript_id and t.user_id = auth.uid()));

create policy "tag_links_select_own" on public.tag_links for select
  using (exists (select 1 from public.tags g where g.id = tag_id and g.user_id = auth.uid()));
create policy "tag_links_insert_own" on public.tag_links for insert
  with check (exists (select 1 from public.tags g where g.id = tag_id and g.user_id = auth.uid()));
create policy "tag_links_update_own" on public.tag_links for update
  using (exists (select 1 from public.tags g where g.id = tag_id and g.user_id = auth.uid()))
  with check (exists (select 1 from public.tags g where g.id = tag_id and g.user_id = auth.uid()));
create policy "tag_links_delete_own" on public.tag_links for delete
  using (exists (select 1 from public.tags g where g.id = tag_id and g.user_id = auth.uid()));
