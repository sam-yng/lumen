# M5 — Search & Transcript Viewer Implementation Plan

> **For agentic workers:** Milestone-level plan. M5 adds full-text search across
> documents and transcripts plus a read-only transcript viewer. It does NOT add
> audio playback, in-transcript find, semantic/vector search, recordings into the
> unified library snapshot, or any new top-level route. M4 (uploads,
> recordings, worker, transcription) is being implemented in parallel; M5 must
> not collide with M4's library-snapshot work.

**Goal:** Let students find content across their notes and transcripts via
Postgres full-text search, and read a recording's transcript (ordered segments
with timestamps, speaker labels, and recording status) — all inside the existing
library workspace.

**Context — the data contract already exists.** The M1 schema migration already
shipped `recordings`, `transcripts`, `transcript_segments`, and the generated
tsvector columns `documents.content_tsv` and `transcripts.full_text_tsv`. M5
only *reads* these tables; M4 *populates* them. No migration is required for M5,
which also keeps it clear of Codex's in-flight M4 migration numbering.

**Architecture:** Two new framework-agnostic services
(`search`, `transcripts`) that take an authenticated `ServiceContext`
(user id + user-scoped Supabase client) and enforce per-user scoping, mirroring
M2/M3. Thin route handlers expose them at `/api/search` and
`/api/transcripts/:id`, reusing the existing `http.ts` helpers. The client adds
a search panel and a transcript viewer panel inside `LibraryWorkspace`, each with
its own TanStack Query key (`["search", q]`, `["transcript", id]`) so the
`["library"]` read model M4 is editing stays untouched.

**Tech Stack:** Next.js 16 App Router, React 19, TanStack Query, Supabase
user-scoped client (Postgres `websearch_to_tsquery` + `ts_rank` via
`.textSearch`, `ilike`), zod, Vitest, Tailwind v4 + shadcn/ui, lucide-react.

---

## Definition of done

- [ ] `search` service returns a unified, ranked `SearchResult[]` across document
      bodies, transcript bodies, document titles, and file names; FTS hits
      outrank ILIKE-only fallback hits; empty/whitespace query short-circuits to
      `[]`.
- [ ] `transcripts` service loads a transcript with ordered segments and parent
      recording status, scoped by `user_id`; returns null when not owned/missing.
- [ ] `ServiceQuery` interface and the test fake gain `textSearch` and `ilike`
      with no behavior change to existing services.
- [ ] `GET /api/search?q=` and `GET /api/transcripts/:id` validate input with
      zod, enforce auth (401), and map service errors cleanly (404 for missing
      transcript).
- [ ] The workspace shows a debounced search panel with a unified ranked result
      list; document results open the existing editor, transcript results open
      the viewer, file results select their folder.
- [ ] The transcript viewer renders status/duration/error, ordered segments with
      `[mm:ss]` timestamps and optional speaker labels, and search-term
      highlighting when opened from a transcript hit; pending/processing/failed
      and empty states are handled.
- [ ] Tests cover ranking/dedup/snippet helpers, the search service merge, and
      transcript loading/ordering/scoping.
- [ ] `bun run check` is green after each patch; manual browser happy path
      verifies search → open document result → open transcript result.
- [ ] Plan moves to `docs/exec-plans/completed/` with a short retrospective;
      pause for review at the milestone boundary.

---

## Design decisions

1. **Read against the existing schema; no migration.** The FTS columns and
   transcript tables exist from M1. M5 is a read-only milestone, so existing
   `*_select_own` RLS policies suffice and no schema change is needed. This also
   avoids migration-numbering collisions with M4.
2. **Service-layer composition for search (not a Postgres RPC).** `searchLibrary`
   fires four parallel scoped queries — documents `textSearch` on `content_tsv`,
   transcripts `textSearch` on `full_text_tsv`, documents `title` ILIKE, files
   `name` ILIKE — and merges/dedupes/ranks in pure TypeScript helpers. This keeps
   ranking logic unit-testable with the existing fake client and avoids a new DB
   function. Four queries is acceptable for a local single-user workspace.
3. **FTS outranks fallback.** Body FTS hits (with `ts_rank`) sort above
   title/file-name ILIKE-only hits, so exact short-name queries still surface
   without drowning real content matches.
4. **Separate services + query keys; do not touch the snapshot.** M5 adds its own
   routes and `["search"]` / `["transcript", id]` query keys and never modifies
   `getLibrarySnapshot` or the `["library"]` key, which M4 is actively editing.
   The only shared file is `library-workspace.tsx`, edited with a single
   surgical insertion (a panel discriminator).
5. **Read-only transcript viewer.** No audio playback (depends on M4's
   StorageProvider/signed URLs) and no in-transcript find box in M5. The viewer
   shows recording status so an in-progress/failed transcription is legible.
6. **Viewer entry point is search results (+ exported component).** M5's
   guaranteed way to open a transcript is clicking a transcript search hit. The
   `TranscriptViewer` is exported so M4 can later wire a "View transcript" button
   on recording rows — M5 does not build that button.
7. **In-workspace panels, no new route surface.** Consistent with the M3 decision
   to keep students oriented in their folder context; search and transcript
   panels share the editor's panel slot via an `activePanel` discriminator.

---

## File structure

- Create: `src/server/services/search.ts` — `searchLibrary`, `SearchResult`
  union, pure `rankResults`/`dedupe`/`buildSnippet` helpers.
- Create: `src/server/services/transcripts.ts` — `getTranscriptById`,
  `TranscriptDetail` type (transcript + recording + ordered segments).
- Modify: `src/server/services/context.ts` — add `textSearch` and `ilike` to the
  `ServiceQuery` interface.
- Create: `src/server/services/__tests__/search.test.ts` — ranking/dedup/snippet
  and merge coverage.
- Create: `src/server/services/__tests__/transcripts.test.ts` — ordering, status
  passthrough, ownership/null coverage.
- Refactor: extract the inline `FakeQuery`/context helper from
  `src/server/services/__tests__/library.test.ts` into a shared
  `src/server/services/__tests__/fake-supabase.ts`, then add `textSearch`/`ilike`
  support there; update `library.test.ts` to import it (no behavior change).
- Create: `src/app/api/search/route.ts` — `GET /api/search?q=`.
- Create: `src/app/api/transcripts/[id]/route.ts` — `GET /api/transcripts/:id`.
- Create: `src/components/search/search-api.ts` — fetchers + query keys.
- Create: `src/components/search/search-panel.tsx` — debounced search UI + result
  list.
- Create: `src/components/transcript/transcript-viewer.tsx` — read-only viewer.
- Modify: `src/components/library/library-workspace.tsx` — single insertion:
  `activePanel` discriminator, mount `SearchPanel`, route results to editor /
  viewer.
- Create: `docs/product-specs/search-and-transcripts.md` — M5 behavior; link it
  in `docs/product-specs/index.md`.
- Modify: `docs/FRONTEND.md` — search panel + transcript viewer conventions and
  query keys.
- Modify: `docs/PLANS.md` — mark M5 active, then move to completed on close.

---

## Implementation phases

### Phase 1 — Search service (TDD)

- [ ] Write failing tests for `rankResults` (FTS > fallback), `dedupe` (a doc
      matching body and title appears once), `buildSnippet`, empty-query
      short-circuit, and a service-level merge over canned rows.
- [ ] Extract the inline `FakeQuery`/context helper from `library.test.ts` into
      a shared `__tests__/fake-supabase.ts`; add `textSearch`/`ilike` to it and
      to the `ServiceQuery` interface; update `library.test.ts` to import it.
- [ ] Implement `search.ts` (four scoped parallel queries + pure merge helpers).
- [ ] Run `bun run check`; keep it green.

### Phase 2 — Transcript service (TDD)

- [ ] Write failing tests for segment ordering by `start_ms`, recording
      status/error passthrough, and null on unowned/missing transcript.
- [ ] Implement `transcripts.ts` (`getTranscriptById` → transcript + recording +
      ordered segments), scoped by `user_id`.
- [ ] Run `bun run check`; keep it green.

### Phase 3 — Route handlers

- [ ] `GET /api/search?q=` — zod-validate `q`, auth-guard, call `searchLibrary`,
      map errors; empty query → `{ results: [] }`.
- [ ] `GET /api/transcripts/:id` — zod-validate uuid, auth-guard, call
      `getTranscriptById`, 404 on null.
- [ ] Run `bun run check`; keep it green.

### Phase 4 — Client UI

- [ ] `search-api.ts` fetchers + query keys (`["search", q]`,
      `["transcript", id]`).
- [ ] `SearchPanel`: debounced input, `useQuery` enabled when non-empty, ranked
      result list with per-kind icons, snippet + term highlight, loading/empty/
      no-result states.
- [ ] `TranscriptViewer`: `useQuery` by id, status badge/duration/error, ordered
      segments with `[mm:ss]` timestamps + speaker labels, term highlight,
      pending/processing/failed/empty states.
- [ ] Integrate into `LibraryWorkspace` with an `activePanel` discriminator
      (`editor | transcript | none`); document results reuse the existing
      open-document handler.
- [ ] Run `bun run check`; keep it green.

### Phase 5 — Docs, manual happy path, closeout

- [ ] Add `docs/product-specs/search-and-transcripts.md` and link it in the
      product-specs index; update `docs/FRONTEND.md`.
- [ ] Run `bun run check`.
- [ ] Start `bun run dev` and manually verify with the demo user: enter a query,
      see document and transcript hits ranked, open a document result (editor),
      open a transcript result (viewer shows ordered segments + status). If no
      transcripts exist yet (M4 not merged), verify document/file search and the
      viewer's pending/empty states with a seeded or hand-inserted transcript row.
- [ ] Move this plan to `docs/exec-plans/completed/m5-search-transcripts.md` with
      a short retrospective.
- [ ] Commit with a conventional M5 message.
- [ ] Pause for review.

---

## Self-review

- **Scope check:** M5 only reads. No audio playback, in-transcript find,
  semantic search, snapshot changes, or new routes — those stay out by design.
- **Architecture check:** New services take the authenticated context and stay
  framework-agnostic (v2 MCP can expose them unchanged). Routes stay thin.
- **Security check:** Every query is `user_id`-scoped through the cookie-bound
  user client; RLS `*_select_own` policies enforce isolation. No service-role use
  (that is the M4 worker's concern).
- **Concurrency check:** Zero edits to `getLibrarySnapshot`/`library.ts`; only
  `library-workspace.tsx` is shared with M4 and is touched with one insertion to
  minimize merge conflict.
- **Testing check:** Pure ranking/dedup/snippet logic and transcript ordering/
  scoping are covered at the service layer before UI work.
- **Docs check:** Product spec, frontend conventions, and the plan are updated in
  the same change as the code.

---

## Retrospective

_(Added when the milestone closes.)_
