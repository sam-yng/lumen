# Semantic Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

> **Status:** active
> **Version:** v2
> **Area:** semantic search
> **Created:** 2026-06-04
> **Activated:** 2026-06-04
> **Depends on:** `docs/exec-plans/active/v2-ai-mcp/index.md`
> **Supersedes:** `docs/exec-plans/queued/v2-ai-mcp/semantic-search.md`

**Goal:** Add local embeddings and pgvector-backed hybrid search so notes and
transcript chunks can be retrieved semantically without per-embedding API cost.

**Architecture:** Add one user-owned `semantic_search_chunks` table with
pgvector embeddings and source metadata for documents and transcripts. Keep CPU
embedding work behind a provider interface, run indexing through service-layer
functions that always scope by `user_id`, and extend the existing search service
to merge FTS, title/name, and semantic chunk hits into a single result list.

**Tech Stack:** Bun workspaces, Next.js 16 App Router, Supabase/Postgres RLS,
pgvector, TypeScript strict, Vitest, Biome, local CPU embeddings.

---

## Current Context

- Existing search lives in `apps/web/src/server/services/search.ts` and queries
  `documents.content_tsv`, `transcripts.full_text_tsv`, document titles, and
  file names.
- Service tests use `apps/web/src/server/services/__tests__/fake-supabase.ts`.
  Extend the fake only as much as needed for new service behavior.
- Transcript writes already happen through
  `apps/web/src/server/services/transcripts.ts`; worker code calls this with a
  service-role client and must keep every query scoped by `user_id`.
- Generated files are source-controlled but should be regenerated, not
  hand-authored: `apps/web/src/server/db/database.types.ts` and
  `docs/generated/db-schema.md`.
- This plan intentionally does not add MCP tools, in-app assistant UI, external
  embedding API calls, reranking, or citations beyond storing source metadata.

## File Structure

- Create `apps/web/supabase/migrations/20260604160000_semantic_search.sql` for
  pgvector, chunk table, RLS, indexes, and the RPC used by the service.
- Modify `apps/web/src/server/db/database.types.ts` by running
  `cd apps/web && bun run db:types`.
- Modify `docs/generated/db-schema.md` by running
  `cd apps/web && bun run docs:db-schema`.
- Create `apps/web/src/server/services/semantic-chunking.ts` for deterministic
  chunk splitting.
- Create `apps/web/src/server/services/embedding-provider.ts` for the provider
  interface and local CPU provider.
- Create `apps/web/src/server/services/semantic-index.ts` for indexing
  documents and transcripts into chunk rows.
- Modify `apps/web/src/server/services/context.ts` to expose the minimal
  Supabase RPC/upsert surface needed by semantic search.
- Modify `apps/web/src/server/services/search.ts` to request a query embedding,
  call the semantic RPC, and merge semantic hits with existing FTS hits.
- Modify `apps/web/src/server/services/transcripts.ts` to index transcripts
  after transcript writes complete.
- Modify the document write path once located, preserving existing service
  boundaries and user scoping.
- Test with focused Vitest files under
  `apps/web/src/server/services/__tests__/`.

## Task 1: Plan Promotion And Schema Foundation

**Files:**

- Create: `apps/web/supabase/migrations/20260604160000_semantic_search.sql`
- Modify: `apps/web/src/server/db/database.types.ts`
- Modify: `docs/generated/db-schema.md`
- Test: `apps/web/src/server/services/__tests__/search.test.ts`

- [ ] **Step 1: Add migration test intent**

  Before writing SQL, inspect the existing schema style in
  `apps/web/supabase/migrations/20260603030402_domain_schema.sql`. The new SQL
  must match the existing RLS pattern: direct `user_id` ownership and one policy
  per operation.

- [ ] **Step 2: Write the pgvector migration**

  Create `apps/web/supabase/migrations/20260604160000_semantic_search.sql` with:

  ```sql
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
    add constraint transcripts_id_recording_id_user_id_key
    unique (id, recording_id, user_id);

  create table public.semantic_search_chunks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    source_type semantic_search_source_type not null,
    document_id uuid,
    transcript_id uuid,
    recording_id uuid,
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
  ```

- [ ] **Step 3: Add the semantic match RPC**

  In the same migration, add a stable, RLS-respecting RPC:

  ```sql
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
      1 - (c.embedding <=> query_embedding) as similarity,
      ts_rank_cd(c.content_tsv, websearch_to_tsquery('english', query_text)) as text_rank
    from public.semantic_search_chunks c
    where c.user_id = match_user_id
      and (
        c.embedding <=> query_embedding < 0.85
        or c.content_tsv @@ websearch_to_tsquery('english', query_text)
      )
    order by
      (1 - (c.embedding <=> query_embedding)) desc,
      ts_rank_cd(c.content_tsv, websearch_to_tsquery('english', query_text)) desc,
      c.updated_at desc
    limit greatest(1, least(match_count, 20));
  $$;
  ```

  Do not mark the function `security definer`; callers should still be subject
  to RLS, and the explicit `match_user_id` predicate supports service-role
  worker paths that bypass RLS.

- [ ] **Step 4: Regenerate schema artifacts**

  Run:

  ```bash
  cd apps/web && bun run db:types
  cd apps/web && bun run docs:db-schema
  ```

  Expected: `database.types.ts` includes `semantic_search_chunks`,
  `semantic_search_source_type`, and `match_semantic_search_chunks` with a
  non-null `source` JSON return field; `docs/generated/db-schema.md` includes
  `semantic_search_chunks` with RLS enabled and four ownership policies.

- [ ] **Step 5: Run the gate**

  Run from the repo root:

  ```bash
  bun run check
  ```

  Expected: Biome, typecheck, and Vitest pass.

## Task 2: Chunking And Embedding Provider

**Files:**

- Create: `apps/web/src/server/services/semantic-chunking.ts`
- Create: `apps/web/src/server/services/embedding-provider.ts`
- Test: `apps/web/src/server/services/__tests__/semantic-chunking.test.ts`
- Test: `apps/web/src/server/services/__tests__/embedding-provider.test.ts`

- [ ] **Step 1: Write chunking tests first**

  Cover document and transcript chunk behavior:

  - Empty or whitespace text returns `[]`.
  - Document chunks keep `sourceType: "document"` and monotonically increasing
    `chunkIndex`.
  - Transcript chunks preserve start/end millisecond bounds for grouped
    segments.
  - Long text splits near 900 characters with about 150 characters of overlap.

- [ ] **Step 2: Implement chunking**

  `semantic-chunking.ts` must export:

  ```ts
  export type DocumentChunkInput = {
    documentId: string;
    text: string | null;
  };

  export type TranscriptSegmentChunkInput = {
    transcriptId: string;
    recordingId: string;
    startMs: number;
    endMs: number;
    text: string;
  };

  export type SearchChunk =
    | {
        sourceType: "document";
        documentId: string;
        transcriptId: null;
        recordingId: null;
        startMs: null;
        endMs: null;
        chunkIndex: number;
        content: string;
      }
    | {
        sourceType: "transcript";
        documentId: null;
        transcriptId: string;
        recordingId: string;
        startMs: number;
        endMs: number;
        chunkIndex: number;
        content: string;
      };

  export function chunkDocument(input: DocumentChunkInput): SearchChunk[];
  export function chunkTranscript(
    input: TranscriptSegmentChunkInput[],
  ): SearchChunk[];
  ```

  Normalize whitespace with `text.replace(/\s+/g, " ").trim()`. Use constants
  `MAX_CHUNK_CHARS = 900` and `CHUNK_OVERLAP_CHARS = 150`. Transcript chunks
  should group ordered segments until the next segment would exceed
  `MAX_CHUNK_CHARS`, then start a new chunk.

- [ ] **Step 3: Write provider tests first**

  Cover:

  - The deterministic test provider returns a vector for each input text.
  - The vector dimension is 384.
  - Empty text is rejected before embedding.

- [ ] **Step 4: Implement provider interface**

  `embedding-provider.ts` must export:

  ```ts
  export const EMBEDDING_DIMENSIONS = 384;

  export type EmbeddingProvider = {
    embed(texts: string[]): Promise<number[][]>;
  };

  export class DeterministicEmbeddingProvider implements EmbeddingProvider {
    embed(texts: string[]): Promise<number[][]>;
  }

  export function assertEmbedding(vector: number[]): number[];
  ```

  The deterministic provider is for tests and local smoke paths only. It should
  tokenize text into lowercase words, hash tokens into a 384-dimensional vector,
  L2-normalize it, and throw when any text is blank. This keeps v2 local and
  free while the provider seam remains ready for a model-backed CPU provider.

- [ ] **Step 5: Run focused tests and gate**

  Run:

  ```bash
  cd apps/web && bun run test -- src/server/services/__tests__/semantic-chunking.test.ts src/server/services/__tests__/embedding-provider.test.ts
  bun run check
  ```

  Expected: focused tests pass, then the root gate passes.

## Task 3: Semantic Indexing Service

**Files:**

- Create: `apps/web/src/server/services/semantic-index.ts`
- Modify: `apps/web/src/server/services/context.ts`
- Modify: `apps/web/src/server/services/__tests__/fake-supabase.ts`
- Test: `apps/web/src/server/services/__tests__/semantic-index.test.ts`

- [ ] **Step 1: Write indexing tests first**

  Tests must prove:

  - Indexing a document deletes only chunks where
    `user_id = ctx.userId`, `source_type = "document"`, and
    `document_id = input.document.id`, then inserts fresh chunks.
  - Indexing a transcript deletes only chunks where
    `user_id = ctx.userId`, `source_type = "transcript"`, and
    `transcript_id = input.transcript.id`, then inserts fresh chunks.
  - User A cannot delete or replace User B chunks with the same source ids.
  - Blank source text deletes existing chunks and inserts none.

- [ ] **Step 2: Extend service context minimally**

  Add `upsert()` and `rpc()` only if implementation needs them. Prefer
  `delete().eq(...).insert(...)` because it matches the current fake and makes
  user-scoped deletes easy to assert.

- [ ] **Step 3: Implement indexing functions**

  `semantic-index.ts` must export:

  ```ts
  export async function indexDocumentSearchChunks(
    ctx: ServiceContext,
    input: { document: Tables<"documents">; provider: EmbeddingProvider },
  ): Promise<void>;

  export async function indexTranscriptSearchChunks(
    ctx: ServiceContext,
    input: {
      transcript: Tables<"transcripts">;
      segments: Tables<"transcript_segments">[];
      provider: EmbeddingProvider;
    },
  ): Promise<void>;
  ```

  Both functions must call the chunking helpers, embed all chunk contents in one
  provider call, assert vector dimensions, delete existing chunks with explicit
  `user_id = ctx.userId`, and insert rows with `user_id: ctx.userId`.

- [ ] **Step 4: Run focused tests and gate**

  Run:

  ```bash
  cd apps/web && bun run test -- src/server/services/__tests__/semantic-index.test.ts
  bun run check
  ```

  Expected: focused tests pass, then the root gate passes.

## Task 4: Hybrid Search Service

**Files:**

- Modify: `apps/web/src/server/services/search.ts`
- Modify: `apps/web/src/server/services/context.ts`
- Modify: `apps/web/src/server/services/__tests__/fake-supabase.ts`
- Test: `apps/web/src/server/services/__tests__/search.test.ts`

- [ ] **Step 1: Write search tests first**

  Add tests proving:

  - Semantic document chunks return document results with a semantic snippet and
    rank above title/file-only tier 1 hits.
  - Semantic transcript chunks return transcript results with `recordingId`.
  - Existing FTS body/title/file tests keep passing.
  - The semantic RPC receives `match_user_id: ctx.userId`, so cross-user chunks
    seeded in the fake do not appear.

- [ ] **Step 2: Extend search inputs and result ranking**

  Add a semantic tier between FTS body hits and title/file-only hits. Keep the
  public result union compatible with the UI by returning existing
  `kind: "document" | "transcript" | "file"` shapes. It is acceptable to add
  optional fields such as `match: "fts" | "semantic"`.

- [ ] **Step 3: Implement RPC-backed semantic retrieval**

  `searchLibrary()` should accept an optional provider parameter:

  ```ts
  export async function searchLibrary(
    ctx: ServiceContext,
    rawQuery: string,
    options?: { embeddingProvider?: EmbeddingProvider },
  ): Promise<SearchResult[]>;
  ```

  When a provider exists, embed the trimmed query and call
  `match_semantic_search_chunks` with `{ query_embedding, query_text: query,
  match_user_id: ctx.userId, match_count: 8 }`. If no provider is supplied, keep
  the current FTS-only behavior so request handlers do not do CPU work by
  default.

- [ ] **Step 4: Run focused tests and gate**

  Run:

  ```bash
  cd apps/web && bun run test -- src/server/services/__tests__/search.test.ts
  bun run check
  ```

  Expected: focused tests pass, then the root gate passes.

## Task 5: Indexing Integration

**Files:**

- Modify: `apps/web/src/server/services/transcripts.ts`
- Modify: document write service path located during implementation
- Modify: `apps/web/worker/transcription-worker.ts` only if dependency
  injection is needed for worker-owned provider creation
- Test: `apps/web/src/server/services/__tests__/library.test.ts`
- Test: `apps/web/worker/__tests__/transcription-worker.test.ts`

- [ ] **Step 1: Locate document write path**

  Use `rg -n "documents|content_text|content_json" apps/web/src` to find where
  documents are created and updated. Keep changes inside existing service or
  server-action boundaries.

- [ ] **Step 2: Write integration tests first**

  Tests must prove:

  - Updating document text refreshes semantic chunks for that document and
    `ctx.userId`.
  - Writing a transcript refreshes semantic chunks after transcript segments are
    inserted.
  - Worker/service-role paths still scope all chunk deletes/inserts by
    `user_id`.

- [ ] **Step 3: Wire indexing after writes**

  After document writes and transcript writes succeed, call the indexing
  service with a provider passed through dependency injection. Do not block
  existing tests on a heavyweight model download; use the deterministic provider
  in tests and a no-op/default-free path where existing callers have not opted
  into indexing yet.

- [ ] **Step 4: Run focused tests and gate**

  Run:

  ```bash
  cd apps/web && bun run test -- src/server/services/__tests__/library.test.ts worker/__tests__/transcription-worker.test.ts
  bun run check
  ```

  Expected: focused tests pass, then the root gate passes.

## Task 6: Manual Smoke And Milestone Notes

**Files:**

- Modify: `docs/product-specs/search-and-transcripts.md`
- Modify: `docs/SECURITY.md`
- Modify: `docs/exec-plans/active/v2-ai-mcp/semantic-search.md`

- [x] **Step 1: Document semantic-search behavior**

  Update product/security docs with:

  - Semantic search is backed by user-owned chunks in
    `semantic_search_chunks`.
  - Worker/service-role indexing must scope deletes/inserts by `user_id`.
  - Search remains FTS-only unless a local embedding provider is supplied to the
    service.

- [x] **Step 2: Run generated docs**

  Run:

  ```bash
  cd apps/web && bun run docs:db-schema
  ```

- [x] **Step 3: Run final gate**

  Run:

  ```bash
  bun run check
  ```

- [x] **Step 4: Manual search smoke test**

  Start the app and smoke test the current search happy path in a browser:

  ```bash
  cd apps/web && bun run dev
  ```

  Open `http://localhost:3000`, sign in with the local test user, create or open
  a note, search for visible note text, and verify the result opens the note.
  If semantic indexing is opt-in at this milestone, note that the manual browser
  path verifies the existing user-facing search path remains intact.

## Verification Gate

- `bun run check`
- `cd apps/web && bun run docs:db-schema`
- Service tests proving user A cannot retrieve user B chunks.
- Manual search smoke test in the browser after implementation.

## Implementation Notes

- Task 1 added `semantic_search_chunks`, pgvector, owner-enforcing composite
  foreign keys, RLS policies, and `match_semantic_search_chunks`.
- Task 2 added deterministic chunking plus the local/free embedding provider
  seam used in tests and smoke paths.
- Task 3 added user-scoped semantic chunk replacement services for documents
  and transcripts.
- Task 4 added optional hybrid retrieval to `searchLibrary`; route handlers
  remain FTS-only unless a provider is supplied.
- Task 5 wired optional indexing provider injection through document writes,
  transcript writes, and the transcription worker dependency object. Existing
  callers remain default-free.
- Task 6 verification: `cd apps/web && bun run docs:db-schema` regenerated the
  schema reference, `bun run check` passed with 81 tests, and a browser smoke
  created a note, found it through library search, and opened the result back
  into the note editor.

## Self-Review

- Spec coverage: the tasks cover pgvector migration, generated schema artifacts,
  chunking, local/free embedding seam, user-owned chunk storage, hybrid search,
  tests for ranking and cross-user isolation, and manual browser smoke.
- Placeholder scan: no step defers unspecified work with TODO/TBD language.
- Type consistency: task signatures use `sourceType` in TypeScript and
  `source_type` in SQL rows; embedding dimensions are consistently 384.
