# M1 — Schema & RLS Implementation Plan

> **For agentic workers:** Milestone-level plan. M1 is pure database work — one
> migration, generated types, a seed, and RLS verification. No app/UI code (that
> begins M2). The gate is `bun run check` green; RLS is verified manually against
> the local DB (kept out of CI, which stays DB-free).

**Goal:** Create every v1 domain table from brief §4 with `user_id` ownership and
Row-Level Security on **every** table, plus indexes (including GIN full-text),
`updated_at` triggers, generated types, a dev seed, and a regenerated schema doc.

**Architecture:** One migration adds all eight domain tables following the
canonical pattern `profiles` established in M0 (own-row RLS via `auth.uid()`).
Tables without a direct `user_id` (`transcript_segments`, `tag_links`) enforce
ownership through a join to their parent. Full-text search (M5) is prepared now
via stored generated `tsvector` columns + GIN indexes.

**Tech Stack:** Supabase Postgres, SQL migrations, `supabase gen types`, pgcrypto
(seed password hashing).

---

## Definition of done

- [ ] Migration creates all 8 tables; `bunx supabase db reset` applies cleanly.
- [ ] **RLS enabled + policies on every table** (verified: user A cannot read/write user B's rows).
- [ ] GIN full-text indexes on `documents` and `transcripts`; supporting btree indexes present.
- [ ] `bun run db:types` + `bun run docs:db-schema` regenerated; `bun run check` green.
- [ ] `supabase/seed.sql` seeds a demo user + sample data; survives `db reset`.
- [ ] Plan → `completed/` with retro; pause for review.

---

## Design decisions (confirm at review)

1. **Enums vs check constraints:** use Postgres **enum types** (`file_kind`,
   `recording_status`, `tag_target_type`) — they generate clean TS union types.
   Trade-off: adding a value later needs `alter type`. Acceptable for fixed v1 sets.
2. **No `user_id` on `transcript_segments` / `tag_links`** — follows brief §4
   exactly. Ownership/RLS via parent join (`transcripts` / `tags`). The worker
   (M4) still scopes inserts by `user_id` via the parent it just created.
3. **Stored generated `tsvector` columns** (`content_tsv`, `full_text_tsv`) +
   GIN — idiomatic Postgres FTS; M5 search queries them directly.
4. **Seed creates a demo auth user** (`demo@lumen.test` / `demo12345`) so dev and
   the M6 e2e have a deterministic login. Local-only; never runs in prod.
5. **`content_json` is `jsonb`** (TipTap doc), `content_text` is the derived
   plain text (populated by the editor in M3; nullable until then).

---

## File structure

- Create: `supabase/migrations/<ts>_domain_schema.sql` (all tables/RLS/indexes/triggers).
- Create: `supabase/seed.sql` (demo user + sample rows).
- Regenerate: `src/server/db/database.types.ts`, `docs/generated/db-schema.md`.

---

## Phase 1 — Domain migration

- [ ] **1.1** Create the migration: `bunx supabase migration new domain_schema`.
- [ ] **1.2** Fill it with the SQL below (enums → tables → indexes → triggers → RLS).

```sql
-- Enums
create type file_kind as enum ('audio', 'other');
create type recording_status as enum ('pending', 'processing', 'done', 'failed');
create type tag_target_type as enum ('document', 'file', 'recording');

-- Shared updated_at trigger
create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- folders (self-referential nesting)
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

-- documents (TipTap JSON + derived text + FTS)
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

-- files (Supabase Storage objects)
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

-- recordings (one per audio file; transcription job state)
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

-- transcripts (one per recording; FTS)
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

-- transcript_segments (owned via transcripts; speaker reserved for diarization)
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

-- tags
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text,
  unique (user_id, name)
);
create index tags_user_id_idx on public.tags (user_id);

-- tag_links (owned via tags)
create table public.tag_links (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.tags (id) on delete cascade,
  target_type tag_target_type not null,
  target_id uuid not null,
  unique (tag_id, target_type, target_id)
);
create index tag_links_target_idx on public.tag_links (target_type, target_id);

-- ============ RLS ============
alter table public.folders enable row level security;
alter table public.documents enable row level security;
alter table public.files enable row level security;
alter table public.recordings enable row level security;
alter table public.transcripts enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.tags enable row level security;
alter table public.tag_links enable row level security;

-- Own-row tables: one policy per operation keyed on auth.uid() = user_id.
-- (Repeat this block for folders, documents, files, recordings, transcripts, tags.)
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

-- Join-owned tables: ownership via parent.
create policy "transcript_segments_select_own" on public.transcript_segments for select
  using (exists (select 1 from public.transcripts t where t.id = transcript_id and t.user_id = auth.uid()));
create policy "transcript_segments_insert_own" on public.transcript_segments for insert
  with check (exists (select 1 from public.transcripts t where t.id = transcript_id and t.user_id = auth.uid()));
create policy "transcript_segments_update_own" on public.transcript_segments for update
  using (exists (select 1 from public.transcripts t where t.id = transcript_id and t.user_id = auth.uid()));
create policy "transcript_segments_delete_own" on public.transcript_segments for delete
  using (exists (select 1 from public.transcripts t where t.id = transcript_id and t.user_id = auth.uid()));

create policy "tag_links_select_own" on public.tag_links for select
  using (exists (select 1 from public.tags g where g.id = tag_id and g.user_id = auth.uid()));
create policy "tag_links_insert_own" on public.tag_links for insert
  with check (exists (select 1 from public.tags g where g.id = tag_id and g.user_id = auth.uid()));
create policy "tag_links_update_own" on public.tag_links for update
  using (exists (select 1 from public.tags g where g.id = tag_id and g.user_id = auth.uid()));
create policy "tag_links_delete_own" on public.tag_links for delete
  using (exists (select 1 from public.tags g where g.id = tag_id and g.user_id = auth.uid()));
```

- [ ] **1.3** `bunx supabase db reset` — applies init + domain migration cleanly.

## Phase 2 — Types + schema doc

- [ ] **2.1** `bun run db:types` → regenerates `database.types.ts` (now includes 8 tables + enums).
- [ ] **2.2** `bun run docs:db-schema` → `db-schema.md` lists all 9 tables (profiles + 8).
  - If the generator misses enum-typed columns or generated columns, fix the
    generator (it is non-generated source) and re-run; commit the fix separately.
- [ ] **2.3** `bun run check` green. Commit: `feat(m1): domain schema + RLS on every table`.

## Phase 3 — Seed

- [ ] **3.1** Write `supabase/seed.sql`: insert a confirmed demo auth user with a
  bcrypt password via `crypt('demo12345', gen_salt('bf'))`, then sample folders,
  a document, a tag — all owned by that user. Idempotent (guard on fixed UUIDs /
  `on conflict do nothing`).
- [ ] **3.2** `bunx supabase db reset` re-applies migrations **and** seed; verify
  the demo rows exist (psql) and that login as `demo@lumen.test` works in the app.
- [ ] **3.3** Commit: `feat(m1): dev seed (demo user + sample library)`.

## Phase 4 — RLS verification (manual, DB-only)

- [ ] **4.1** Create a second user; via two RLS-scoped sessions (or `set local
  role authenticated` + `request.jwt.claims`), assert: user A sees only A's rows;
  inserting a row with another user's `user_id` is rejected; `transcript_segments`
  and `tag_links` are invisible across users via the parent join.
- [ ] **4.2** Record the verification commands + results in the retro.

## Phase 5 — Close

- [ ] **5.1** DoD recheck; `bun run check` green; docs-sanity-check clean (db-schema not drifted).
- [ ] **5.2** Move plan → `completed/` with retrospective; update `PLANS.md`.
- [ ] **5.3** PAUSE for human review before M2.

---

## Self-review (against brief §4)

**Table coverage:** folders, documents, files, recordings, transcripts,
transcript_segments, tags, tag_links — all 8 present with the brief's columns.
`profiles` (M0) remains. ✅

**Ownership + RLS:** every table has RLS enabled and policies. Direct `user_id`
on the six owning tables; join-based on the two child tables. Matches brief
"RLS policies for every table." ✅

**Indexes:** GIN FTS on `documents.content_tsv` and `transcripts.full_text_tsv`
(brief asks GIN tsvector over `content_text` / `full_text` — implemented via
stored generated columns). Btree indexes on every FK + `recordings.status`.
Unique constraints: `tags (user_id, name)`, `tag_links (tag_id, target_type,
target_id)`. ✅

**Type consistency:** enum names (`file_kind`, `recording_status`,
`tag_target_type`) used consistently in column defs and will surface as TS unions
in `database.types.ts`. `content_json` `jsonb`, `content_text` `text` nullable
(populated in M3). ✅

**db-schema generator risk:** the M0 generator parses `create table` bodies; the
`tsvector ... generated always as (...) stored` column spans a parenthesised
expression — the depth-aware column splitter should handle it, but **Phase 2.2
explicitly verifies** and fixes the generator if a column is dropped or
mis-split. Enum type columns parse as normal `name type` lines. ✅

**Seam check:** no app/service code in M1 (correct — services begin M2). The
schema is shaped so M2 services and the M4 worker scope by `user_id` directly.
No FTS query logic yet (M5) — only the indexes/columns are prepared. ✅

**Gate/CI:** RLS verification is manual psql against the local DB and is **not**
added to Vitest, keeping CI DB-free per the M0 backpressure decision.
