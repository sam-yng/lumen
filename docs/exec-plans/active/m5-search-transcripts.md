# M5 — Search & Transcript Viewer Implementation Plan

> **For agentic workers:** Milestone-level plan. REQUIRED SUB-SKILL: use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement the Tasks below task-by-task; steps
> use checkbox (`- [ ]`) syntax for tracking. Run `bun run check` green after
> every task (ensure node ≥ v22 is on PATH — see Task 0).
>
> M5 adds full-text search across documents and transcripts plus a read-only
> transcript viewer. It does NOT add audio playback, in-transcript find,
> semantic/vector search, recordings into the unified library snapshot, or any
> new top-level route. M4 (uploads, recordings, worker, transcription) is being
> implemented in parallel; M5 must not collide with M4's library-snapshot work.

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
user-scoped client (Postgres `websearch_to_tsquery` via `.textSearch` as the
match filter, `.ilike` for name fallback), zod, Vitest, Tailwind v4 + shadcn/ui,
lucide-react.

**Ranking note:** `ts_rank` ordering is not retrievable through the typed
`ServiceQuery` interface without a Postgres RPC (which Approach A rejected).
`.textSearch` is therefore used only as the *match filter* ("does this body match
the query?"); ranking happens in a pure, unit-tested TypeScript helper using
tiers — FTS-body hits (tier 0) rank above name/title-only ILIKE hits (tier 1),
with a recency tiebreak. User-facing behavior (bodies beat names) is unchanged.

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
3. **FTS outranks fallback (tier heuristic, not `ts_rank`).** Body FTS hits are
   tier 0 and sort above title/file-name ILIKE-only hits (tier 1), with a recency
   tiebreak, so exact short-name queries still surface without drowning real
   content matches. See the Ranking note above for why `ts_rank` is not used.
   A document matching both its body and its title appears once at tier 0.
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

## Tasks

> All `bun run check` / `git` commands assume node ≥ v22 on PATH. Each task ends
> green and is committed (conventional commits, ending with the
> `Co-Authored-By: Claude` trailer the repo uses).

### Task 0: Ensure a working toolchain

**Files:** none.

- [ ] **Step 1: Put a modern node on PATH for this shell**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
node --version   # expect v22.x (v13 crashes biome's launcher)
```

- [ ] **Step 2: Confirm the gate is green before changes**

Run: `bun run check`
Expected: biome clean, `tsc` clean, existing tests pass.

---

### Task 1: Shared test fake + `ServiceQuery` extension (refactor)

Extract the inline fake from `library.test.ts` into a shared module and add
`textSearch` (passthrough — tsvector matching is Postgres's job) and `ilike`
(real case-insensitive substring filter, so name-fallback narrowing is testable).
Also make the fake's `order` numeric-aware so `start_ms` sorts correctly.

**Files:**
- Modify: `src/server/services/context.ts`
- Create: `src/server/services/__tests__/fake-supabase.ts`
- Modify: `src/server/services/__tests__/library.test.ts`

- [ ] **Step 1: Add `textSearch`/`ilike` to the `ServiceQuery` interface**

In `src/server/services/context.ts`, add to the `ServiceQuery<Row>` type (after
`order(...)`):

```ts
  ilike(column: string, pattern: string): ServiceQuery<Row>;
  textSearch(
    column: string,
    query: string,
    options?: { type?: "plain" | "phrase" | "websearch"; config?: string },
  ): ServiceQuery<Row>;
```

- [ ] **Step 2: Create the shared fake**

Create `src/server/services/__tests__/fake-supabase.ts`:

```ts
import type {
  QueryResult,
  ServiceContext,
  ServiceQuery,
} from "@/server/services/context";

export type Row = Record<string, unknown>;

export const userId = "user-1";
export const otherUserId = "user-2";

export class FakeQuery implements ServiceQuery<Row> {
  private filters: Array<{ column: string; value: unknown }> = [];
  private ilikeFilters: Array<{ column: string; needle: string }> = [];
  private orderBy: string | null = null;
  private pendingUpdate: Row | null = null;
  private pendingDelete = false;

  constructor(
    private readonly rows: Row[],
    private readonly error: Error | null = null,
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  ilike(column: string, pattern: string) {
    this.ilikeFilters.push({
      column,
      needle: pattern.replace(/%/g, "").toLowerCase(),
    });
    return this;
  }

  textSearch() {
    // Tsvector matching happens in Postgres; the fake returns the seeded rows
    // and relies on eq()/ilike() for assertable filtering.
    return this;
  }

  order(column: string) {
    this.orderBy = column;
    return this;
  }

  update(values: Row) {
    this.pendingUpdate = values;
    return this;
  }

  insert(values: Row | Row[]) {
    const insertedRows = Array.isArray(values) ? values : [values];
    this.rows.push(...insertedRows);
    return this;
  }

  delete() {
    this.pendingDelete = true;
    return this;
  }

  async single() {
    const matchingRows = this.applyFilters(this.rows);
    if (this.pendingUpdate) {
      for (const row of matchingRows) Object.assign(row, this.pendingUpdate);
    }
    if (this.pendingDelete) this.deleteMatchingRows(matchingRows);
    const data = matchingRows[0] ?? null;
    return { data, error: this.error };
  }

  async maybeSingle() {
    return this.single();
  }

  // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are awaitable; the fake mirrors that contract.
  then<TResult1 = QueryResult<Row>, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult<Row>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({
      data: this.applyFilters(this.rows),
      error: this.error,
    }).then(onfulfilled, onrejected);
  }

  private applyFilters(rows: Row[]) {
    let result = rows
      .filter((row) =>
        this.filters.every((filter) => row[filter.column] === filter.value),
      )
      .filter((row) =>
        this.ilikeFilters.every((filter) =>
          String(row[filter.column] ?? "")
            .toLowerCase()
            .includes(filter.needle),
        ),
      );

    if (this.orderBy) {
      const column = this.orderBy;
      result = [...result].sort((a, b) => {
        const av = a[column];
        const bv = b[column];
        if (typeof av === "number" && typeof bv === "number") return av - bv;
        return String(av).localeCompare(String(bv));
      });
    }

    return result;
  }

  private deleteMatchingRows(rowsToDelete: Row[]) {
    for (const row of rowsToDelete) {
      const index = this.rows.indexOf(row);
      if (index >= 0) this.rows.splice(index, 1);
    }
  }
}

export class FakeSupabase {
  readonly tables: Record<string, Row[]>;

  constructor(tables: Record<string, Row[]>) {
    this.tables = tables;
  }

  from<TableRow extends Record<string, unknown>>(
    table: string,
  ): ServiceQuery<TableRow> {
    return new FakeQuery(
      this.tables[table] ?? [],
    ) as unknown as ServiceQuery<TableRow>;
  }
}

export function createContext(tables: Record<string, Row[]>): ServiceContext {
  return { userId, supabase: new FakeSupabase(tables) };
}
```

- [ ] **Step 3: Make `library.test.ts` import the shared fake**

In `src/server/services/__tests__/library.test.ts`, delete the inline
`FakeQuery`, `FakeSupabase`, `userId`, `otherUserId`, `createContext`, and the
local `type Row` definitions, and replace them with:

```ts
import {
  createContext,
  otherUserId,
  userId,
} from "@/server/services/__tests__/fake-supabase";
```

Keep the rest of the file unchanged.

- [ ] **Step 4: Verify the refactor is behavior-preserving**

Run: `bun run check`
Expected: all existing library tests still pass; biome + tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/context.ts src/server/services/__tests__/
git commit -m "refactor(m5): share supabase test fake, add textSearch/ilike

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Search ranking helpers (TDD)

Pure, DB-free ranking/snippet logic — the heart of search quality.

**Files:**
- Create: `src/server/services/search.ts`
- Create: `src/server/services/__tests__/search.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/services/__tests__/search.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildSnippet, rankResults } from "@/server/services/search";

function doc(over: Record<string, unknown> = {}) {
  return {
    id: "d1",
    user_id: "user-1",
    folder_id: null,
    title: "Biology notes",
    content_json: null,
    content_text: "The mitochondria is the powerhouse of the cell.",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("buildSnippet", () => {
  it("windows around the first query term", () => {
    const snippet = buildSnippet(
      "alpha beta gamma mitochondria delta epsilon",
      "mitochondria",
    );
    expect(snippet).toContain("mitochondria");
  });

  it("falls back to the head when the term is absent", () => {
    expect(buildSnippet("short text", "absent")).toBe("short text");
  });

  it("returns empty string for empty source", () => {
    expect(buildSnippet(null, "x")).toBe("");
  });
});

describe("rankResults", () => {
  it("ranks body hits (tier 0) above name-only hits (tier 1)", () => {
    const results = rankResults({
      query: "cell",
      documentBodyHits: [doc({ id: "body" })],
      transcriptHits: [],
      documentTitleHits: [],
      fileNameHits: [
        {
          id: "f1",
          user_id: "user-1",
          folder_id: null,
          name: "cell-diagram.png",
          mime_type: "image/png",
          size_bytes: 1,
          storage_key: "k",
          kind: "other",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
    expect(results.map((r) => r.kind)).toEqual(["document", "file"]);
    expect(results[0].tier).toBe(0);
    expect(results[1].tier).toBe(1);
  });

  it("dedupes a document matching both body and title into one tier-0 hit", () => {
    const results = rankResults({
      query: "biology",
      documentBodyHits: [doc({ id: "same" })],
      transcriptHits: [],
      documentTitleHits: [doc({ id: "same" })],
      fileNameHits: [],
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ kind: "document", id: "same", tier: 0 });
  });

  it("includes transcript hits at tier 0 with a snippet", () => {
    const results = rankResults({
      query: "lecture",
      documentBodyHits: [],
      transcriptHits: [
        {
          id: "t1",
          user_id: "user-1",
          recording_id: "r1",
          full_text: "today's lecture covers cells",
          language: "en",
          created_at: "2026-01-02T00:00:00Z",
        },
      ],
      documentTitleHits: [],
      fileNameHits: [],
    });
    expect(results[0]).toMatchObject({
      kind: "transcript",
      recordingId: "r1",
      tier: 0,
    });
    expect(results[0].snippet).toContain("lecture");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx vitest run src/server/services/__tests__/search.test.ts`
Expected: FAIL — `buildSnippet`/`rankResults` not exported.

- [ ] **Step 3: Implement the helpers**

Create `src/server/services/search.ts`:

```ts
import type { Tables } from "@/server/db/database.types";

export type DocumentSearchResult = {
  kind: "document";
  id: string;
  title: string;
  folderId: string | null;
  snippet: string;
  tier: 0 | 1;
};

export type TranscriptSearchResult = {
  kind: "transcript";
  id: string;
  recordingId: string;
  snippet: string;
  tier: 0;
};

export type FileSearchResult = {
  kind: "file";
  id: string;
  name: string;
  folderId: string | null;
  tier: 1;
};

export type SearchResult =
  | DocumentSearchResult
  | TranscriptSearchResult
  | FileSearchResult;

export type SearchInputs = {
  query: string;
  documentBodyHits: Tables<"documents">[];
  transcriptHits: Tables<"transcripts">[];
  documentTitleHits: Tables<"documents">[];
  fileNameHits: Tables<"files">[];
};

const SNIPPET_RADIUS = 80;
const SNIPPET_FALLBACK_LENGTH = 160;

export function buildSnippet(text: string | null, query: string): string {
  const source = (text ?? "").trim();
  if (source.length === 0) return "";
  const term = query.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const index = term ? source.toLowerCase().indexOf(term) : -1;
  if (index === -1) {
    return source.length > SNIPPET_FALLBACK_LENGTH
      ? `${source.slice(0, SNIPPET_FALLBACK_LENGTH)}…`
      : source;
  }
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(source.length, index + term.length + SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${source.slice(start, end)}${
    end < source.length ? "…" : ""
  }`;
}

export function rankResults(inputs: SearchInputs): SearchResult[] {
  const { query } = inputs;

  const docById = new Map<string, { row: Tables<"documents">; tier: 0 | 1 }>();
  for (const row of inputs.documentTitleHits) docById.set(row.id, { row, tier: 1 });
  for (const row of inputs.documentBodyHits) docById.set(row.id, { row, tier: 0 });

  const documents = [...docById.values()].map(({ row, tier }) => ({
    ts: row.updated_at,
    result: {
      kind: "document" as const,
      id: row.id,
      title: row.title,
      folderId: row.folder_id,
      snippet: tier === 0 ? buildSnippet(row.content_text, query) : "",
      tier,
    } satisfies DocumentSearchResult,
  }));

  const transcripts = inputs.transcriptHits.map((row) => ({
    ts: row.created_at,
    result: {
      kind: "transcript" as const,
      id: row.id,
      recordingId: row.recording_id,
      snippet: buildSnippet(row.full_text, query),
      tier: 0 as const,
    } satisfies TranscriptSearchResult,
  }));

  const files = inputs.fileNameHits.map((row) => ({
    ts: row.created_at,
    result: {
      kind: "file" as const,
      id: row.id,
      name: row.name,
      folderId: row.folder_id,
      tier: 1 as const,
    } satisfies FileSearchResult,
  }));

  return [...documents, ...transcripts, ...files]
    .sort((a, b) =>
      a.result.tier !== b.result.tier
        ? a.result.tier - b.result.tier
        : b.ts.localeCompare(a.ts),
    )
    .map((entry) => entry.result);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run src/server/services/__tests__/search.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/search.ts src/server/services/__tests__/search.test.ts
git commit -m "feat(m5): search ranking + snippet helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `searchLibrary` service (TDD)

Composes four scoped queries and feeds `rankResults`. `.textSearch` is the match
filter; `.eq("user_id", …)` enforces scoping (RLS is the real boundary at
runtime).

**Files:**
- Modify: `src/server/services/search.ts`
- Modify: `src/server/services/__tests__/search.test.ts`

- [ ] **Step 1: Add the failing service test**

First update the imports at the **top** of
`src/server/services/__tests__/search.test.ts` so biome's import ordering stays
clean — replace the existing search import with these three lines:

```ts
import { describe, expect, it } from "vitest";
import { createContext, userId } from "@/server/services/__tests__/fake-supabase";
import {
  buildSnippet,
  rankResults,
  searchLibrary,
} from "@/server/services/search";
```

Then append this `describe` block to the end of the file:

```ts
describe("searchLibrary", () => {
  it("returns [] for an empty or whitespace query", async () => {
    const ctx = createContext({ documents: [doc()] });
    expect(await searchLibrary(ctx, "   ")).toEqual([]);
  });

  it("scopes results to the current user and includes each kind", async () => {
    const ctx = createContext({
      documents: [
        doc({ id: "mine", user_id: userId }),
        doc({ id: "theirs", user_id: "user-2" }),
      ],
      transcripts: [
        {
          id: "t1",
          user_id: userId,
          recording_id: "r1",
          full_text: "lecture about cells",
          language: "en",
          created_at: "2026-01-02T00:00:00Z",
        },
      ],
      files: [
        {
          id: "f1",
          user_id: userId,
          folder_id: null,
          name: "cell.png",
          mime_type: "image/png",
          size_bytes: 1,
          storage_key: "k",
          kind: "other",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });

    const results = await searchLibrary(ctx, "cell");
    const ids = results.map((r) => r.id);
    expect(ids).toContain("mine");
    expect(ids).not.toContain("theirs");
    expect(results.some((r) => r.kind === "transcript")).toBe(true);
    expect(results.some((r) => r.kind === "file")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx vitest run src/server/services/__tests__/search.test.ts`
Expected: FAIL — `searchLibrary` not exported.

- [ ] **Step 3: Implement `searchLibrary`**

Add to the top of `src/server/services/search.ts` (imports) and bottom (function):

```ts
import type { ServiceContext } from "@/server/services/context";
import { assertNoDatabaseError } from "@/server/services/errors";
```

```ts
export async function searchLibrary(
  ctx: ServiceContext,
  rawQuery: string,
): Promise<SearchResult[]> {
  const query = rawQuery.trim();
  if (query.length === 0) return [];
  const pattern = `%${query}%`;

  const [documentBody, transcripts, documentTitle, files] = await Promise.all([
    ctx.supabase
      .from<Tables<"documents">>("documents")
      .select("*")
      .eq("user_id", ctx.userId)
      .textSearch("content_tsv", query, { type: "websearch" }),
    ctx.supabase
      .from<Tables<"transcripts">>("transcripts")
      .select("*")
      .eq("user_id", ctx.userId)
      .textSearch("full_text_tsv", query, { type: "websearch" }),
    ctx.supabase
      .from<Tables<"documents">>("documents")
      .select("*")
      .eq("user_id", ctx.userId)
      .ilike("title", pattern),
    ctx.supabase
      .from<Tables<"files">>("files")
      .select("*")
      .eq("user_id", ctx.userId)
      .ilike("name", pattern),
  ]);

  assertNoDatabaseError(documentBody.error, "Could not search documents");
  assertNoDatabaseError(transcripts.error, "Could not search transcripts");
  assertNoDatabaseError(documentTitle.error, "Could not search document titles");
  assertNoDatabaseError(files.error, "Could not search files");

  return rankResults({
    query,
    documentBodyHits: documentBody.data,
    transcriptHits: transcripts.data,
    documentTitleHits: documentTitle.data,
    fileNameHits: files.data,
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun run check`
Expected: PASS (all tests), biome + tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/search.ts src/server/services/__tests__/search.test.ts
git commit -m "feat(m5): searchLibrary composes scoped FTS + name queries

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `transcripts` service (TDD)

**Files:**
- Create: `src/server/services/transcripts.ts`
- Create: `src/server/services/__tests__/transcripts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/services/__tests__/transcripts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  createContext,
  userId,
} from "@/server/services/__tests__/fake-supabase";
import { getTranscriptById } from "@/server/services/transcripts";

function tables() {
  return {
    transcripts: [
      {
        id: "t1",
        user_id: userId,
        recording_id: "r1",
        full_text: "hello world",
        language: "en",
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    recordings: [
      {
        id: "r1",
        user_id: userId,
        file_id: "f1",
        status: "done",
        duration_sec: 42,
        error: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    transcript_segments: [
      { id: "s2", transcript_id: "t1", start_ms: 1000, end_ms: 2000, text: "second", speaker: null },
      { id: "s1", transcript_id: "t1", start_ms: 0, end_ms: 900, text: "first", speaker: "A" },
    ],
  };
}

describe("getTranscriptById", () => {
  it("returns the transcript, recording, and segments ordered by start_ms", async () => {
    const detail = await getTranscriptById(createContext(tables()), "t1");
    expect(detail).not.toBeNull();
    expect(detail?.recording?.status).toBe("done");
    expect(detail?.segments.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("returns null when the transcript belongs to another user", async () => {
    const other = tables();
    other.transcripts[0].user_id = "user-2";
    expect(await getTranscriptById(createContext(other), "t1")).toBeNull();
  });

  it("returns null when the transcript does not exist", async () => {
    expect(await getTranscriptById(createContext(tables()), "missing")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx vitest run src/server/services/__tests__/transcripts.test.ts`
Expected: FAIL — `getTranscriptById` not exported.

- [ ] **Step 3: Implement the service**

Create `src/server/services/transcripts.ts`:

```ts
import type { Tables } from "@/server/db/database.types";
import type { ServiceContext } from "@/server/services/context";
import { assertNoDatabaseError } from "@/server/services/errors";

export type TranscriptDetail = {
  transcript: Tables<"transcripts">;
  recording: Tables<"recordings"> | null;
  segments: Tables<"transcript_segments">[];
};

export async function getTranscriptById(
  ctx: ServiceContext,
  id: string,
): Promise<TranscriptDetail | null> {
  const { data: transcript, error: transcriptError } = await ctx.supabase
    .from<Tables<"transcripts">>("transcripts")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("id", id)
    .maybeSingle();
  assertNoDatabaseError(transcriptError, "Could not load transcript");
  if (!transcript) return null;

  const [recordingResult, segmentsResult] = await Promise.all([
    ctx.supabase
      .from<Tables<"recordings">>("recordings")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("id", transcript.recording_id)
      .maybeSingle(),
    ctx.supabase
      .from<Tables<"transcript_segments">>("transcript_segments")
      .select("*")
      .eq("transcript_id", transcript.id)
      .order("start_ms"),
  ]);
  assertNoDatabaseError(recordingResult.error, "Could not load recording");
  assertNoDatabaseError(segmentsResult.error, "Could not load segments");

  return {
    transcript,
    recording: recordingResult.data ?? null,
    segments: segmentsResult.data,
  };
}
```

> Note: `transcript_segments` has no `user_id` column; ownership is enforced by
> RLS through its parent transcript (and we already verified the transcript is
> owned). Scoping by `transcript_id` is therefore correct and safe.

- [ ] **Step 4: Run to verify it passes**

Run: `bun run check`
Expected: PASS, biome + tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/transcripts.ts src/server/services/__tests__/transcripts.test.ts
git commit -m "feat(m5): transcript detail service with ordered segments

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `GET /api/search` route

**Files:**
- Create: `src/app/api/search/route.ts`

- [ ] **Step 1: Create the route handler**

```ts
import { z } from "zod";
import {
  getRouteServiceContext,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { searchLibrary } from "@/server/services/search";

const querySchema = z.string().trim().min(1).max(200);

export async function GET(request: Request) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const raw = new URL(request.url).searchParams.get("q") ?? "";
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) return Response.json({ results: [] });

  try {
    return Response.json({ results: await searchLibrary(ctx, parsed.data) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
```

- [ ] **Step 2: Verify it typechecks (route handlers have no unit tests in this repo)**

Run: `bun run check`
Expected: biome + tsc clean, tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/search/route.ts
git commit -m "feat(m5): GET /api/search route

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: `GET /api/transcripts/[id]` route

**Files:**
- Create: `src/app/api/transcripts/[id]/route.ts`

- [ ] **Step 1: Create the route handler**

```ts
import { z } from "zod";
import {
  getRouteServiceContext,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { getTranscriptById } from "@/server/services/transcripts";

const idSchema = z.string().uuid();
type IdRouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: IdRouteContext) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await context.params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return Response.json({ error: "Invalid transcript id." }, { status: 400 });
  }

  try {
    const detail = await getTranscriptById(ctx, parsed.data);
    if (!detail) {
      return Response.json(
        { error: "Transcript not found.", code: "not_found" },
        { status: 404 },
      );
    }
    return Response.json(detail);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
```

- [ ] **Step 2: Verify**

Run: `bun run check`
Expected: biome + tsc clean, tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/transcripts/
git commit -m "feat(m5): GET /api/transcripts/:id route

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Client fetchers + query keys + highlight helper

**Files:**
- Create: `src/components/search/search-api.ts`
- Create: `src/components/search/highlight.tsx`

- [ ] **Step 1: Create `search-api.ts`**

```ts
import type { SearchResult } from "@/server/services/search";
import type { TranscriptDetail } from "@/server/services/transcripts";

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "Request failed.");
  }
  return (await response.json()) as T;
}

export const searchQueryKey = (query: string) => ["search", query] as const;
export const transcriptQueryKey = (id: string) => ["transcript", id] as const;

export function fetchSearch(query: string) {
  return requestJson<{ results: SearchResult[] }>(
    `/api/search?q=${encodeURIComponent(query)}`,
  );
}

export function fetchTranscript(id: string) {
  return requestJson<TranscriptDetail>(`/api/transcripts/${id}`);
}
```

- [ ] **Step 2: Create `highlight.tsx` (shared by panel + viewer, DRY)**

```tsx
import type { ReactNode } from "react";

export function highlightMatch(text: string, query?: string): ReactNode {
  const term = query?.trim().split(/\s+/)[0];
  if (!term) return text;
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-500/40">
        {text.slice(index, index + term.length)}
      </mark>
      {text.slice(index + term.length)}
    </>
  );
}
```

- [ ] **Step 3: Verify + commit**

Run: `bun run check`

```bash
git add src/components/search/search-api.ts src/components/search/highlight.tsx
git commit -m "feat(m5): search client fetchers, query keys, highlight helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: `SearchPanel` component

**Files:**
- Create: `src/components/search/search-panel.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import {
  FileAudio,
  File as FileIcon,
  FileText,
  Loader2,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import type { SearchResult } from "@/server/services/search";
import { highlightMatch } from "./highlight";
import { fetchSearch, searchQueryKey } from "./search-api";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

type SearchPanelProps = {
  onOpenDocument: (documentId: string) => void;
  onOpenTranscript: (transcriptId: string, query: string) => void;
  onSelectFile: (fileId: string, folderId: string | null) => void;
};

export function SearchPanel({
  onOpenDocument,
  onOpenTranscript,
  onSelectFile,
}: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 250);

  const { data, isFetching } = useQuery({
    queryKey: searchQueryKey(debouncedQuery),
    queryFn: () => fetchSearch(debouncedQuery),
    enabled: debouncedQuery.length > 0,
  });

  const results = data?.results ?? [];

  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="relative">
        <Search
          className="absolute top-2.5 left-2 size-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          aria-label="Search notes and transcripts"
          className="pl-8"
          placeholder="Search notes and transcripts…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {debouncedQuery.length > 0 && (
        <div className="rounded-md border">
          {isFetching && results.length === 0 ? (
            <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No results.</p>
          ) : (
            <ul className="divide-y">
              {results.map((result) => (
                <li key={`${result.kind}-${result.id}`}>
                  <SearchResultRow
                    result={result}
                    query={debouncedQuery}
                    onOpenDocument={onOpenDocument}
                    onOpenTranscript={onOpenTranscript}
                    onSelectFile={onSelectFile}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SearchResultRow({
  result,
  query,
  onOpenDocument,
  onOpenTranscript,
  onSelectFile,
}: {
  result: SearchResult;
  query: string;
} & Pick<
  SearchPanelProps,
  "onOpenDocument" | "onOpenTranscript" | "onSelectFile"
>) {
  const rowClass =
    "flex w-full items-start gap-2 p-3 text-left hover:bg-muted";

  if (result.kind === "document") {
    return (
      <button
        type="button"
        className={rowClass}
        onClick={() => onOpenDocument(result.id)}
      >
        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">
            {highlightMatch(result.title, query)}
          </span>
          {result.snippet && (
            <span className="text-xs text-muted-foreground">
              {highlightMatch(result.snippet, query)}
            </span>
          )}
        </span>
      </button>
    );
  }

  if (result.kind === "transcript") {
    return (
      <button
        type="button"
        className={rowClass}
        onClick={() => onOpenTranscript(result.id, query)}
      >
        <FileAudio className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium">Transcript</span>
          <span className="text-xs text-muted-foreground">
            {highlightMatch(result.snippet, query)}
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={rowClass}
      onClick={() => onSelectFile(result.id, result.folderId)}
    >
      <FileIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate text-sm font-medium">
        {highlightMatch(result.name, query)}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `bun run check`

```bash
git add src/components/search/search-panel.tsx
git commit -m "feat(m5): search panel UI

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: `TranscriptViewer` component

**Files:**
- Create: `src/components/transcript/transcript-viewer.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { highlightMatch } from "@/components/search/highlight";
import {
  fetchTranscript,
  transcriptQueryKey,
} from "@/components/search/search-api";
import type { Tables } from "@/server/db/database.types";

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<Tables<"recordings">["status"], string> = {
  pending: "Transcription pending",
  processing: "Transcription in progress",
  done: "Transcribed",
  failed: "Transcription failed",
};

type TranscriptViewerProps = {
  transcriptId: string;
  highlightQuery?: string;
  onClose: () => void;
};

export function TranscriptViewer({
  transcriptId,
  highlightQuery,
  onClose,
}: TranscriptViewerProps) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: transcriptQueryKey(transcriptId),
    queryFn: () => fetchTranscript(transcriptId),
  });

  if (isPending) {
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Loading transcript…
      </p>
    );
  }

  if (isError) {
    return (
      <p className="p-4 text-sm text-destructive">
        {error instanceof Error ? error.message : "Could not load transcript."}
      </p>
    );
  }

  const status = data.recording?.status ?? "pending";

  return (
    <section className="flex flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-medium">{STATUS_LABEL[status]}</span>
          {data.recording?.duration_sec != null && (
            <span className="text-xs text-muted-foreground">
              Duration {formatTimestamp(data.recording.duration_sec * 1000)}
            </span>
          )}
        </div>
        <button
          type="button"
          className="text-sm text-muted-foreground hover:underline"
          onClick={onClose}
        >
          Close
        </button>
      </header>

      {status === "failed" && data.recording?.error && (
        <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {data.recording.error}
        </p>
      )}

      {data.segments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {status === "done" ? "No transcript text." : "Transcript not ready yet."}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {data.segments.map((segment) => (
            <li key={segment.id} className="flex gap-3 text-sm">
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                [{formatTimestamp(segment.start_ms)}]
              </span>
              <span>
                {segment.speaker && (
                  <span className="mr-1 font-medium">{segment.speaker}:</span>
                )}
                {highlightMatch(segment.text, highlightQuery)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `bun run check`

```bash
git add src/components/transcript/transcript-viewer.tsx
git commit -m "feat(m5): read-only transcript viewer

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Wire panels into `LibraryWorkspace`

One surgical change to the only file shared with M4. Introduce an `activePanel`
discriminator replacing `selectedDocumentId`.

**Files:**
- Modify: `src/components/library/library-workspace.tsx`

- [ ] **Step 1: Add imports**

After the existing `DocumentEditor` import (line ~15), add:

```ts
import { SearchPanel } from "@/components/search/search-panel";
import { TranscriptViewer } from "@/components/transcript/transcript-viewer";
```

- [ ] **Step 2: Add the panel type**

After the existing `type TargetType = …` alias (line ~44), add:

```ts
type ActivePanel =
  | { kind: "none" }
  | { kind: "document"; documentId: string }
  | { kind: "transcript"; transcriptId: string; query?: string };
```

- [ ] **Step 3: Replace the document-id state**

Replace:

```ts
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  );
```

with:

```ts
  const [activePanel, setActivePanel] = useState<ActivePanel>({ kind: "none" });
```

- [ ] **Step 4: Replace the selected-document derivation**

Replace:

```ts
  const selectedDocument =
    data.documents.find((document) => document.id === selectedDocumentId) ??
    null;
```

with:

```ts
  const selectedDocument =
    activePanel.kind === "document"
      ? (data.documents.find((d) => d.id === activePanel.documentId) ?? null)
      : null;
```

- [ ] **Step 5: Mount `SearchPanel` in the sidebar**

In the `<aside>`, immediately after the `<div className="mb-4">…</div>` title
block (before `<FolderTree …/>`), insert:

```tsx
        <SearchPanel
          onOpenDocument={(documentId) =>
            setActivePanel({ kind: "document", documentId })
          }
          onOpenTranscript={(transcriptId, query) =>
            setActivePanel({ kind: "transcript", transcriptId, query })
          }
          onSelectFile={(_fileId, folderId) => {
            setSelectedFolderId(folderId);
            setSelectedTagId(null);
            setActivePanel({ kind: "none" });
          }}
        />
```

- [ ] **Step 6: Route the list "Open" action through the panel**

Replace `onOpenDocument={setSelectedDocumentId}` (in the `<LibraryContent>` render)
with:

```tsx
              onOpenDocument={(documentId) =>
                setActivePanel({ kind: "document", documentId })
              }
```

- [ ] **Step 7: Swap the panel container + add the viewer**

Replace the closing portion that renders the editor:

```tsx
        <div
          className={
            selectedDocument
              ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]"
              : ""
          }
        >
          <div>
            <CreateForms selectedFolderId={selectedFolderId} />
            <LibraryContent
              snapshot={data}
              selectedFolderId={selectedFolderId}
              selectedTagId={selectedTagId}
              onOpenDocument={setSelectedDocumentId}
            />
          </div>
          {selectedDocument && (
            <DocumentEditor
              key={selectedDocument.id}
              document={selectedDocument}
            />
          )}
        </div>
```

with:

```tsx
        <div
          className={
            activePanel.kind !== "none"
              ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]"
              : ""
          }
        >
          <div>
            <CreateForms selectedFolderId={selectedFolderId} />
            <LibraryContent
              snapshot={data}
              selectedFolderId={selectedFolderId}
              selectedTagId={selectedTagId}
              onOpenDocument={(documentId) =>
                setActivePanel({ kind: "document", documentId })
              }
            />
          </div>
          {selectedDocument && (
            <DocumentEditor
              key={selectedDocument.id}
              document={selectedDocument}
            />
          )}
          {activePanel.kind === "transcript" && (
            <TranscriptViewer
              key={activePanel.transcriptId}
              transcriptId={activePanel.transcriptId}
              highlightQuery={activePanel.query}
              onClose={() => setActivePanel({ kind: "none" })}
            />
          )}
        </div>
```

- [ ] **Step 8: Verify + commit**

Run: `bun run check`
Expected: biome + tsc clean, tests pass.

```bash
git add src/components/library/library-workspace.tsx
git commit -m "feat(m5): mount search + transcript panels in workspace

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: Docs, manual happy path, closeout

**Files:**
- Create: `docs/product-specs/search-and-transcripts.md`
- Modify: `docs/product-specs/index.md`
- Modify: `docs/FRONTEND.md`
- Modify: `docs/PLANS.md` (move plan to completed)

- [ ] **Step 1: Write the product spec**

Create `docs/product-specs/search-and-transcripts.md`:

```markdown
# Search & transcripts

Full-text search across notes and transcripts, plus a read-only transcript
viewer. Built in M5; reads the M1 schema (no migration).

## v1 behaviour

- **Search:** a debounced search box in the workspace sidebar queries
  `/api/search`. Postgres `websearch_to_tsquery` matches document bodies
  (`content_tsv`) and transcript bodies (`full_text_tsv`); ILIKE matches document
  titles and file names as a fallback. Results are one unified list: body (FTS)
  hits rank above name-only hits, recency breaks ties.
- **Result actions:** document → opens the editor; transcript → opens the viewer;
  file → selects its folder.
- **Transcript viewer:** read-only. Shows recording status
  (pending/processing/done/failed), duration, and any error, then ordered
  segments with `[mm:ss]` timestamps and speaker labels. Search terms are
  highlighted when opened from a transcript hit.

## Out of scope (M5)

Audio playback, in-transcript find, semantic/vector search, search⇄tag
intersection, recordings in the unified library snapshot. The `TranscriptViewer`
is exported so M4 can later add a "View transcript" button on recording rows.

Status: M5 implemented.
```

- [ ] **Step 2: Link it from the product-specs index**

In `docs/product-specs/index.md`, add under the existing bullet:

```markdown
- [search-and-transcripts.md](search-and-transcripts.md) — full-text search and
  the read-only transcript viewer (M5).
```

- [ ] **Step 3: Document the frontend conventions**

Append to `docs/FRONTEND.md`:

```markdown
## Search & transcripts (M5)

- `SearchPanel` (sidebar) queries `/api/search` with TanStack Query key
  `["search", q]`, debounced 250ms, enabled only for non-empty queries. It owns
  its own key and never touches `["library"]`.
- `TranscriptViewer` reads `/api/transcripts/:id` with key `["transcript", id]`;
  read-only, shows recording status + ordered segments.
- The workspace uses an `activePanel` discriminator (`none | document |
  transcript`) so the editor and transcript viewer share one panel slot.
- Match highlighting lives in `components/search/highlight.tsx` (shared).

Status: M5 search + transcript viewer conventions captured.
```

- [ ] **Step 4: Run the gate**

Run: `bun run check`
Expected: green.

- [ ] **Step 5: Manual happy path**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
bunx supabase status   # ensure local stack is up (else: bunx supabase start)
bun run dev
```

Sign in as the demo user. Verify:
1. Typing a query that matches a note body shows a ranked document hit; clicking
   opens the editor.
2. A query matching a file name shows a file hit below body hits.
3. Open a transcript hit → viewer shows status + ordered segments with
   timestamps. If M4 has not merged (no transcripts), insert one row manually to
   exercise the viewer, e.g. in `bunx supabase` SQL:

```sql
-- replace <uid> with the demo user's auth uid
insert into files (id, user_id, folder_id, name, mime_type, size_bytes, storage_key, kind)
  values ('00000000-0000-0000-0000-0000000000f1','<uid>',null,'lecture.m4a','audio/mp4',1,'k','audio');
insert into recordings (id, user_id, file_id, status, duration_sec)
  values ('00000000-0000-0000-0000-0000000000r1','<uid>','00000000-0000-0000-0000-0000000000f1','done',95);
insert into transcripts (id, user_id, recording_id, full_text, language)
  values ('00000000-0000-0000-0000-0000000000t1','<uid>','00000000-0000-0000-0000-0000000000r1','intro to cell biology lecture','en');
insert into transcript_segments (transcript_id, start_ms, end_ms, text, speaker) values
  ('00000000-0000-0000-0000-0000000000t1',0,3000,'Welcome to the lecture.','A'),
  ('00000000-0000-0000-0000-0000000000t1',3000,6000,'Today: cell biology.','A');
```

   Then search `lecture`, open the transcript hit, confirm segments render in
   order with highlight, and that searching `cell` also returns the transcript.

- [ ] **Step 6: Close out the milestone**

```bash
git mv docs/exec-plans/active/m5-search-transcripts.md \
  docs/exec-plans/completed/m5-search-transcripts.md
```

Edit `docs/PLANS.md`: remove the active bullet and add under `completed/`:

```markdown
  - [m5-search-transcripts.md](exec-plans/completed/m5-search-transcripts.md)
```

Fill in the Retrospective section of the moved plan.

- [ ] **Step 7: Final gate + commit**

Run: `bun run check`

```bash
git add docs/
git commit -m "docs(m5): search + transcript spec, close milestone

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 8: Pause for human review at the milestone boundary.**

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
