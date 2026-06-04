<!-- GENERATED from apps/web/supabase/migrations/ by apps/web/scripts/gen-db-schema.ts — do not edit. -->
<!-- Regenerate with `bun run docs:db-schema`. -->

# Database schema

## Tables

### documents

RLS: enabled

| Column | Definition |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `user_id` | uuid not null references auth.users (id) on delete cascade |
| `folder_id` | uuid references public.folders (id) on delete set null |
| `title` | text not null default 'Untitled' |
| `content_json` | jsonb |
| `content_text` | text |
| `content_tsv` | tsvector generated always as (to_tsvector('english', coalesce(content_text, ''))) stored |
| `created_at` | timestamptz not null default now() |
| `updated_at` | timestamptz not null default now() |

Policies: `documents_select_own`, `documents_insert_own`, `documents_update_own`, `documents_delete_own`

### files

RLS: enabled

| Column | Definition |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `user_id` | uuid not null references auth.users (id) on delete cascade |
| `folder_id` | uuid references public.folders (id) on delete set null |
| `name` | text not null |
| `mime_type` | text not null |
| `size_bytes` | bigint not null |
| `storage_key` | text not null |
| `kind` | file_kind not null default 'other' |
| `created_at` | timestamptz not null default now() |

Policies: `files_select_own`, `files_insert_own`, `files_update_own`, `files_delete_own`

### folders

RLS: enabled

| Column | Definition |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `user_id` | uuid not null references auth.users (id) on delete cascade |
| `name` | text not null |
| `parent_id` | uuid references public.folders (id) on delete cascade |
| `created_at` | timestamptz not null default now() |
| `updated_at` | timestamptz not null default now() |

Policies: `folders_select_own`, `folders_insert_own`, `folders_update_own`, `folders_delete_own`

### profiles

RLS: enabled

| Column | Definition |
| --- | --- |
| `id` | uuid primary key references auth.users (id) on delete cascade |
| `display_name` | text |
| `created_at` | timestamptz not null default now() |
| `updated_at` | timestamptz not null default now() |

Policies: `profiles_select_own`, `profiles_insert_own`, `profiles_update_own`

### recordings

RLS: enabled

| Column | Definition |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `user_id` | uuid not null references auth.users (id) on delete cascade |
| `file_id` | uuid not null references public.files (id) on delete cascade |
| `status` | recording_status not null default 'pending' |
| `duration_sec` | integer |
| `error` | text |
| `created_at` | timestamptz not null default now() |

Policies: `recordings_select_own`, `recordings_insert_own`, `recordings_update_own`, `recordings_delete_own`

### semantic_search_chunks

RLS: enabled

| Column | Definition |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `user_id` | uuid not null references auth.users (id) on delete cascade |
| `source_type` | semantic_search_source_type not null |
| `document_id` | uuid |
| `transcript_id` | uuid |
| `recording_id` | uuid |
| `start_ms` | integer |
| `end_ms` | integer |
| `chunk_index` | integer not null |
| `content` | text not null |
| `content_tsv` | tsvector generated always as (to_tsvector('english', coalesce(content, ''))) stored |
| `embedding` | vector(384) not null |
| `created_at` | timestamptz not null default now() |
| `updated_at` | timestamptz not null default now() |

Policies: `semantic_search_chunks_select_own`, `semantic_search_chunks_insert_own`, `semantic_search_chunks_update_own`, `semantic_search_chunks_delete_own`

### tag_links

RLS: enabled

| Column | Definition |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `tag_id` | uuid not null references public.tags (id) on delete cascade |
| `target_type` | tag_target_type not null |
| `target_id` | uuid not null |

Policies: `tag_links_select_own`, `tag_links_insert_own`, `tag_links_update_own`, `tag_links_delete_own`

### tags

RLS: enabled

| Column | Definition |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `user_id` | uuid not null references auth.users (id) on delete cascade |
| `name` | text not null |
| `color` | text |

Policies: `tags_select_own`, `tags_insert_own`, `tags_update_own`, `tags_delete_own`

### transcript_segments

RLS: enabled

| Column | Definition |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `transcript_id` | uuid not null references public.transcripts (id) on delete cascade |
| `start_ms` | integer not null |
| `end_ms` | integer not null |
| `text` | text not null |
| `speaker` | text |

Policies: `transcript_segments_select_own`, `transcript_segments_insert_own`, `transcript_segments_update_own`, `transcript_segments_delete_own`

### transcripts

RLS: enabled

| Column | Definition |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `user_id` | uuid not null references auth.users (id) on delete cascade |
| `recording_id` | uuid not null references public.recordings (id) on delete cascade |
| `full_text` | text not null default '' |
| `language` | text |
| `full_text_tsv` | tsvector generated always as (to_tsvector('english', coalesce(full_text, ''))) stored |
| `created_at` | timestamptz not null default now() |

Policies: `transcripts_select_own`, `transcripts_insert_own`, `transcripts_update_own`, `transcripts_delete_own`

