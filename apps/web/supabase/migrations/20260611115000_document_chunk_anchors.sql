-- v4 m1 document paragraph anchors for semantic chunks.

alter table public.semantic_search_chunks
  add column document_anchor_block_start integer,
  add column document_anchor_block_end integer,
  add constraint semantic_search_chunks_document_anchor_valid check (
    (
      source_type = 'document'
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
      when 'document' then jsonb_strip_nulls(jsonb_build_object(
        'documentId', c.document_id,
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
