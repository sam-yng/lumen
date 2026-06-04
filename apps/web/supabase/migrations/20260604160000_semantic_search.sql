-- v2 semantic search foundation.
--
-- Chunks are directly user-owned because the worker can run with the service
-- role and bypass RLS. Service-role paths must still scope every operation by
-- user_id.

create extension if not exists vector with schema extensions;

create type semantic_search_source_type as enum ('document', 'transcript');

alter table public.documents
  add constraint documents_id_user_id_key unique (id, user_id);
alter table public.recordings
  add constraint recordings_id_user_id_key unique (id, user_id);
alter table public.transcripts
  add constraint transcripts_id_user_id_key unique (id, user_id);
alter table public.transcripts
  add constraint transcripts_id_recording_id_user_id_key unique (id, recording_id, user_id);

create table public.semantic_search_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_type semantic_search_source_type not null,
  document_id uuid references public.documents (id) on delete cascade,
  transcript_id uuid references public.transcripts (id) on delete cascade,
  recording_id uuid references public.recordings (id) on delete cascade,
  start_ms integer,
  end_ms integer,
  chunk_index integer not null,
  content text not null,
  content_tsv tsvector generated always as
    (to_tsvector('english', coalesce(content, ''))) stored,
  embedding vector(384) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint semantic_search_chunks_one_source check (
    (
      source_type = 'document'
      and document_id is not null
      and transcript_id is null
      and recording_id is null
      and start_ms is null
      and end_ms is null
    ) or (
      source_type = 'transcript'
      and document_id is null
      and transcript_id is not null
      and recording_id is not null
      and start_ms is not null
      and end_ms is not null
      and end_ms >= start_ms
    )
  ),
  foreign key (document_id, user_id)
    references public.documents (id, user_id) on delete cascade,
  foreign key (transcript_id, user_id)
    references public.transcripts (id, user_id) on delete cascade,
  foreign key (recording_id, user_id)
    references public.recordings (id, user_id) on delete cascade,
  foreign key (transcript_id, recording_id, user_id)
    references public.transcripts (id, recording_id, user_id) on delete cascade,
  unique (user_id, source_type, document_id, chunk_index),
  unique (user_id, source_type, transcript_id, chunk_index)
);

create index semantic_search_chunks_user_id_idx
  on public.semantic_search_chunks (user_id);
create index semantic_search_chunks_document_id_idx
  on public.semantic_search_chunks (document_id)
  where document_id is not null;
create index semantic_search_chunks_transcript_id_idx
  on public.semantic_search_chunks (transcript_id)
  where transcript_id is not null;
create index semantic_search_chunks_content_tsv_idx
  on public.semantic_search_chunks using gin (content_tsv);
create index semantic_search_chunks_embedding_idx
  on public.semantic_search_chunks using hnsw (embedding vector_cosine_ops);
create trigger semantic_search_chunks_set_updated_at before update
  on public.semantic_search_chunks
  for each row execute function public.set_updated_at();

alter table public.semantic_search_chunks enable row level security;

create policy "semantic_search_chunks_select_own"
  on public.semantic_search_chunks for select
  using (auth.uid() = user_id);
create policy "semantic_search_chunks_insert_own"
  on public.semantic_search_chunks for insert
  with check (auth.uid() = user_id);
create policy "semantic_search_chunks_update_own"
  on public.semantic_search_chunks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "semantic_search_chunks_delete_own"
  on public.semantic_search_chunks for delete
  using (auth.uid() = user_id);

create function public.match_semantic_search_chunks(
  query_embedding vector(384),
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
  select
    c.id,
    c.user_id,
    c.source_type,
    case c.source_type
      when 'document' then jsonb_build_object('documentId', c.document_id)
      when 'transcript' then jsonb_build_object(
        'transcriptId', c.transcript_id,
        'recordingId', c.recording_id,
        'startMs', c.start_ms,
        'endMs', c.end_ms
      )
    end as source,
    c.chunk_index,
    c.content,
    1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity,
    ts_rank_cd(c.content_tsv, websearch_to_tsquery('english', query_text)) as text_rank
  from public.semantic_search_chunks c
  where c.user_id = match_user_id
    and (
      c.embedding operator(extensions.<=>) query_embedding < 0.85
      or c.content_tsv @@ websearch_to_tsquery('english', query_text)
    )
  order by
    (1 - (c.embedding operator(extensions.<=>) query_embedding)) desc,
    ts_rank_cd(c.content_tsv, websearch_to_tsquery('english', query_text)) desc,
    c.updated_at desc
  limit greatest(1, least(match_count, 20));
$$;
