# MCP Server & Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose Lumen as a Supabase-authenticated MCP server (Streamable HTTP) that is a thin adapter over the v1 service layer.

**Architecture:** App-local Next.js route handler at `apps/web/src/app/api/mcp/route.ts` using the SDK's `WebStandardStreamableHTTPServerTransport` in stateless mode. A bearer Supabase JWT is validated and turned into a `ServiceContext { userId, supabase }` whose anon-key client runs every query under the user's RLS. Tools/resources/prompts are thin wrappers that call existing services; generation stays host-side via prompts (no LLM in the server).

**Tech Stack:** Next.js 16, Bun, TypeScript strict, `@modelcontextprotocol/sdk` ^1.29.0, `@supabase/ssr`, zod, Vitest.

**Design:** [docs/superpowers/specs/2026-06-05-v2-mcp-server-auth-design.md](../specs/2026-06-05-v2-mcp-server-auth-design.md)

---

## Conventions for every task

- Run `cd apps/web && bun run test <path>` for a single Vitest file; `bun run check` from repo root before each commit.
- Tests live beside code under `__tests__/`, mirroring the existing service tests.
- Service wrappers must add NO business logic; they only adapt args/results.
- Commit after each task with a conventional-commit message.

---

### Task 1: Confirm the MCP SDK dependency

**Files:**
- Modify: `apps/web/package.json` (already contains `@modelcontextprotocol/sdk`)

- [ ] **Step 1: Verify the dependency resolves**

Run: `cd apps/web && bun pm ls | grep modelcontextprotocol`
Expected: `@modelcontextprotocol/sdk@1.29.0` (or newer 1.x).

- [ ] **Step 2: Verify the Web-standard transport import works**

Create a scratch check (delete after):

```ts
// apps/web/scratch-mcp-check.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
console.log(typeof McpServer, typeof WebStandardStreamableHTTPServerTransport);
```

Run: `cd apps/web && bunx tsc --noEmit scratch-mcp-check.ts && rm apps/web/scratch-mcp-check.ts`
Expected: no type errors. Then delete the scratch file.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json bun.lock
git commit -m "build(web): add @modelcontextprotocol/sdk for MCP server"
```

---

### Task 2: `createTokenSupabase` — bearer-bound Supabase client

**Files:**
- Modify: `apps/web/src/server/db/client.ts`
- Test: `apps/web/src/server/db/__tests__/client.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/server/db/__tests__/client.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/config/env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "anon-key",
  }),
}));

const createClient = vi.fn(() => ({ auth: {} }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

describe("createTokenSupabase", () => {
  it("binds the bearer token via the Authorization header and anon key", async () => {
    const { createTokenSupabase } = await import("@/server/db/client");
    createTokenSupabase("jwt-123");

    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
      {
        global: { headers: { Authorization: "Bearer jwt-123" } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd apps/web && bun run test src/server/db/__tests__/client.test.ts`
Expected: FAIL — `createTokenSupabase` is not exported.

- [ ] **Step 3: Implement**

Add to `apps/web/src/server/db/client.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
```

```ts
/**
 * Bearer-token-bound client for non-cookie callers (the MCP server).
 *
 * Uses the PUBLISHABLE (anon) key plus the caller's Supabase JWT, so every
 * query runs under that user's RLS policies — the same guarantee as the
 * cookie clients, with NO service-role key and NO manual user_id scoping.
 */
export function createTokenSupabase(accessToken: string) {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    getPublicEnv();

  return createClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
```

Add `@supabase/supabase-js` if not already present: `cd apps/web && bun add @supabase/supabase-js` (it is a transitive dep of `@supabase/ssr`; add it as a direct dep for the explicit import).

- [ ] **Step 4: Run it, verify it passes**

Run: `cd apps/web && bun run test src/server/db/__tests__/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/db/client.ts apps/web/src/server/db/__tests__/client.test.ts apps/web/package.json bun.lock
git commit -m "feat(web): add bearer-token Supabase client for MCP"
```

---

### Task 3: `getMcpServiceContext` — bearer auth → ServiceContext

**Files:**
- Create: `apps/web/src/server/mcp/auth.ts`
- Test: `apps/web/src/server/mcp/__tests__/auth.test.ts`

The function is injectable for testing: it takes an optional `resolveUser` that defaults to the real Supabase validation, so tests never need a live Supabase.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/server/mcp/__tests__/auth.test.ts
import { describe, expect, it, vi } from "vitest";
import { getMcpServiceContext } from "@/server/mcp/auth";

function req(headers: Record<string, string> = {}) {
  return new Request("https://x/api/mcp", { method: "POST", headers });
}

describe("getMcpServiceContext", () => {
  it("returns null when the Authorization header is missing", async () => {
    const ctx = await getMcpServiceContext(req(), { resolveUser: vi.fn() });
    expect(ctx).toBeNull();
  });

  it("returns null when the scheme is not Bearer", async () => {
    const resolveUser = vi.fn();
    const ctx = await getMcpServiceContext(req({ Authorization: "Basic abc" }), {
      resolveUser,
    });
    expect(ctx).toBeNull();
    expect(resolveUser).not.toHaveBeenCalled();
  });

  it("returns null when the token does not resolve to a user", async () => {
    const ctx = await getMcpServiceContext(
      req({ Authorization: "Bearer bad" }),
      { resolveUser: async () => null },
    );
    expect(ctx).toBeNull();
  });

  it("builds a ServiceContext for a valid token", async () => {
    const supabase = { from: vi.fn() } as never;
    const ctx = await getMcpServiceContext(
      req({ Authorization: "Bearer good" }),
      { resolveUser: async () => ({ userId: "user-1", supabase }) },
    );
    expect(ctx).toEqual({ userId: "user-1", supabase });
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd apps/web && bun run test src/server/mcp/__tests__/auth.test.ts`
Expected: FAIL — module `@/server/mcp/auth` does not exist.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/server/mcp/auth.ts
import { createTokenSupabase } from "@/server/db/client";
import type {
  ServiceContext,
  ServiceSupabaseClient,
} from "@/server/services/context";

type ResolvedUser = { userId: string; supabase: ServiceSupabaseClient } | null;

/** Validate a bearer token against Supabase and bind a user-scoped client. */
async function resolveUserFromToken(token: string): Promise<ResolvedUser> {
  const supabase = createTokenSupabase(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return null;
  return {
    userId: user.id,
    supabase: supabase as unknown as ServiceSupabaseClient,
  };
}

function extractBearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function getMcpServiceContext(
  request: Request,
  deps: { resolveUser?: (token: string) => Promise<ResolvedUser> } = {},
): Promise<ServiceContext | null> {
  const token = extractBearer(request);
  if (!token) return null;

  const resolveUser = deps.resolveUser ?? resolveUserFromToken;
  const resolved = await resolveUser(token);
  if (!resolved) return null;

  return { userId: resolved.userId, supabase: resolved.supabase };
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd apps/web && bun run test src/server/mcp/__tests__/auth.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/mcp/auth.ts apps/web/src/server/mcp/__tests__/auth.test.ts
git commit -m "feat(web): MCP bearer-token auth -> ServiceContext"
```

---

### Task 4: Thin read services — `getDocumentDetail`, `listDocumentsByTag`

The MCP tools need a single-document read and a by-tag listing; neither exists. Add them to the existing services (not the adapter).

**Files:**
- Modify: `apps/web/src/server/services/documents.ts`
- Modify: `apps/web/src/server/services/tags.ts`
- Test: `apps/web/src/server/services/__tests__/documents-read.test.ts`
- Test: `apps/web/src/server/services/__tests__/tags-read.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/src/server/services/__tests__/documents-read.test.ts
import { describe, expect, it } from "vitest";
import { createContext } from "@/server/services/__tests__/fake-supabase";
import { getDocumentDetail } from "@/server/services/documents";

const doc = {
  id: "d1",
  user_id: "user-1",
  folder_id: null,
  title: "Bio",
  content_json: null,
  content_text: "cells",
  content_tsv: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("getDocumentDetail", () => {
  it("returns an owned document", async () => {
    const ctx = createContext({ documents: [{ ...doc }] });
    const result = await getDocumentDetail(ctx, { id: "d1" });
    expect(result.title).toBe("Bio");
  });

  it("throws not_found for another user's document", async () => {
    const ctx = createContext({
      documents: [{ ...doc, id: "d2", user_id: "user-2" }],
    });
    await expect(getDocumentDetail(ctx, { id: "d2" })).rejects.toThrow(
      "Document not found.",
    );
  });
});
```

```ts
// apps/web/src/server/services/__tests__/tags-read.test.ts
import { describe, expect, it } from "vitest";
import { createContext } from "@/server/services/__tests__/fake-supabase";
import { listDocumentsByTag } from "@/server/services/tags";

const docRow = (over: Record<string, unknown>) => ({
  id: "d1",
  user_id: "user-1",
  folder_id: null,
  title: "Bio",
  content_json: null,
  content_text: "cells",
  content_tsv: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...over,
});

describe("listDocumentsByTag", () => {
  it("returns owned documents linked to the tag", async () => {
    const ctx = createContext({
      tags: [{ id: "t1", user_id: "user-1", name: "exam", color: null }],
      tag_links: [
        {
          id: "l1",
          user_id: "user-1",
          tag_id: "t1",
          target_type: "document",
          target_id: "d1",
        },
      ],
      documents: [docRow({ id: "d1" })],
    });
    const docs = await listDocumentsByTag(ctx, { tagId: "t1" });
    expect(docs.map((d) => d.id)).toEqual(["d1"]);
  });

  it("throws not_found for another user's tag", async () => {
    const ctx = createContext({
      tags: [{ id: "t2", user_id: "user-2", name: "x", color: null }],
    });
    await expect(listDocumentsByTag(ctx, { tagId: "t2" })).rejects.toThrow(
      "Tag not found.",
    );
  });
});
```

- [ ] **Step 2: Run them, verify they fail**

Run: `cd apps/web && bun run test src/server/services/__tests__/documents-read.test.ts src/server/services/__tests__/tags-read.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement**

Append to `apps/web/src/server/services/documents.ts`:

```ts
export async function getDocumentDetail(
  ctx: ServiceContext,
  input: { id: string },
) {
  const { data, error } = await ctx.supabase
    .from<Document>("documents")
    .select("*")
    .eq("id", input.id)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  assertNoDatabaseError(error, "Could not load document");
  assertFound(data, "Document not found.");
  return data;
}
```

Append to `apps/web/src/server/services/tags.ts`:

```ts
type Document = Tables<"documents">;

export async function listDocumentsByTag(
  ctx: ServiceContext,
  input: { tagId: string },
): Promise<Document[]> {
  await assertTagOwned(ctx, input.tagId);

  const { data: links, error } = await ctx.supabase
    .from<TagLink>("tag_links")
    .select("*")
    .eq("tag_id", input.tagId)
    .eq("user_id", ctx.userId);

  assertNoDatabaseError(error, "Could not load tag links");

  const documentIds = links
    .filter((link) => link.target_type === "document")
    .map((link) => link.target_id);

  const documents = await Promise.all(
    documentIds.map(async (id) => {
      const { data } = await ctx.supabase
        .from<Document>("documents")
        .select("*")
        .eq("id", id)
        .eq("user_id", ctx.userId)
        .maybeSingle();
      return data;
    }),
  );

  return documents.filter((doc): doc is Document => doc !== null);
}
```

- [ ] **Step 4: Run them, verify they pass**

Run: `cd apps/web && bun run test src/server/services/__tests__/documents-read.test.ts src/server/services/__tests__/tags-read.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/services/documents.ts apps/web/src/server/services/tags.ts apps/web/src/server/services/__tests__/documents-read.test.ts apps/web/src/server/services/__tests__/tags-read.test.ts
git commit -m "feat(web): add getDocumentDetail and listDocumentsByTag reads"
```

---

### Task 5: MCP tools (pure runners + registration)

Each tool is a pure async runner `(ctx, args) => Promise<CallToolResult>`, unit-testable with the fake context. A `registerMcpTools(server, ctx)` wires them into an `McpServer`.

**Files:**
- Create: `apps/web/src/server/mcp/tools.ts`
- Test: `apps/web/src/server/mcp/__tests__/tools.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/server/mcp/__tests__/tools.test.ts
import { describe, expect, it } from "vitest";
import { createContext } from "@/server/services/__tests__/fake-supabase";
import {
  runCreateNote,
  runGetDocument,
  runSearchNotes,
} from "@/server/mcp/tools";

const doc = {
  id: "d1",
  user_id: "user-1",
  folder_id: null,
  title: "Bio",
  content_json: null,
  content_text: "the cell",
  content_tsv: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("runGetDocument", () => {
  it("returns the document title in text content", async () => {
    const ctx = createContext({ documents: [{ ...doc }] });
    const result = await runGetDocument(ctx, { id: "d1" });
    expect(result.content[0]).toMatchObject({ type: "text" });
    expect(String(result.content[0].text)).toContain("Bio");
  });

  it("reports not-found as an error result, not a throw", async () => {
    const ctx = createContext({ documents: [] });
    const result = await runGetDocument(ctx, { id: "missing" });
    expect(result.isError).toBe(true);
    expect(String(result.content[0].text)).toContain("not found");
  });
});

describe("runSearchNotes", () => {
  it("returns structured search results", async () => {
    const ctx = createContext({
      documents: [{ ...doc }],
      transcripts: [],
      files: [],
    });
    const result = await runSearchNotes(ctx, { query: "cell" });
    expect(result.content[0].type).toBe("text");
  });
});

describe("runCreateNote", () => {
  it("creates a document and returns its id", async () => {
    const ctx = createContext({ documents: [], folders: [] });
    const result = await runCreateNote(ctx, { title: "New", folderId: null });
    expect(String(result.content[0].text)).toContain("New");
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd apps/web && bun run test src/server/mcp/__tests__/tools.test.ts`
Expected: FAIL — module `@/server/mcp/tools` does not exist.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/server/mcp/tools.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  createDocument,
  getDocumentDetail,
} from "@/server/services/documents";
import type { ServiceContext } from "@/server/services/context";
import { ServiceError } from "@/server/services/errors";
import { searchLibrary } from "@/server/services/search";
import { listDocumentsByTag } from "@/server/services/tags";
import { getTranscriptDetail } from "@/server/services/transcripts";

function ok(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function fail(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Wrap a runner so ServiceError surfaces as an MCP error result, not a throw. */
async function guard(run: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message);
    throw error;
  }
}

export function runSearchNotes(ctx: ServiceContext, args: { query: string }) {
  return guard(async () => ok(await searchLibrary(ctx, args.query)));
}

export function runGetDocument(ctx: ServiceContext, args: { id: string }) {
  return guard(async () => ok(await getDocumentDetail(ctx, { id: args.id })));
}

export function runGetTranscript(
  ctx: ServiceContext,
  args: { recordingId: string },
) {
  return guard(async () =>
    ok(await getTranscriptDetail(ctx, { recordingId: args.recordingId })),
  );
}

export function runCreateNote(
  ctx: ServiceContext,
  args: { title: string; folderId: string | null },
) {
  return guard(async () =>
    ok(await createDocument(ctx, { title: args.title, folderId: args.folderId })),
  );
}

export function runListByTag(ctx: ServiceContext, args: { tagId: string }) {
  return guard(async () => ok(await listDocumentsByTag(ctx, { tagId: args.tagId })));
}

export function registerMcpTools(server: McpServer, ctx: ServiceContext) {
  server.registerTool(
    "search_notes",
    {
      title: "Search notes",
      description: "Full-text search across documents, transcripts, and files.",
      inputSchema: { query: z.string().min(1).max(200) },
    },
    (args) => runSearchNotes(ctx, args),
  );

  server.registerTool(
    "get_document",
    {
      title: "Get document",
      description: "Fetch a single document by id.",
      inputSchema: { id: z.string().uuid() },
    },
    (args) => runGetDocument(ctx, args),
  );

  server.registerTool(
    "get_transcript",
    {
      title: "Get transcript",
      description: "Fetch a recording's transcript and segments.",
      inputSchema: { recordingId: z.string().uuid() },
    },
    (args) => runGetTranscript(ctx, args),
  );

  server.registerTool(
    "create_note",
    {
      title: "Create note",
      description: "Create a new document, optionally inside a folder.",
      inputSchema: {
        title: z.string().min(1).max(200),
        folderId: z.string().uuid().nullable(),
      },
    },
    (args) => runCreateNote(ctx, args),
  );

  server.registerTool(
    "list_by_tag",
    {
      title: "List documents by tag",
      description: "List documents linked to a tag.",
      inputSchema: { tagId: z.string().uuid() },
    },
    (args) => runListByTag(ctx, args),
  );
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd apps/web && bun run test src/server/mcp/__tests__/tools.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/mcp/tools.ts apps/web/src/server/mcp/__tests__/tools.test.ts
git commit -m "feat(web): MCP tools wrapping the service layer"
```

---

### Task 6: MCP resources (documents + transcripts)

**Files:**
- Create: `apps/web/src/server/mcp/resources.ts`
- Test: `apps/web/src/server/mcp/__tests__/resources.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/server/mcp/__tests__/resources.test.ts
import { describe, expect, it } from "vitest";
import { createContext } from "@/server/services/__tests__/fake-supabase";
import { readDocumentResource } from "@/server/mcp/resources";

const doc = {
  id: "d1",
  user_id: "user-1",
  folder_id: null,
  title: "Bio",
  content_json: null,
  content_text: "cells",
  content_tsv: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("readDocumentResource", () => {
  it("returns document contents for an owned id", async () => {
    const ctx = createContext({ documents: [{ ...doc }] });
    const result = await readDocumentResource(ctx, "d1");
    expect(result.contents[0].text).toContain("Bio");
    expect(result.contents[0].uri).toBe("lumen://document/d1");
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd apps/web && bun run test src/server/mcp/__tests__/resources.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/server/mcp/resources.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServiceContext } from "@/server/services/context";
import { getDocumentDetail } from "@/server/services/documents";
import { getTranscriptDetail } from "@/server/services/transcripts";

export async function readDocumentResource(
  ctx: ServiceContext,
  id: string,
): Promise<ReadResourceResult> {
  const doc = await getDocumentDetail(ctx, { id });
  return {
    contents: [
      {
        uri: `lumen://document/${id}`,
        mimeType: "application/json",
        text: JSON.stringify(doc, null, 2),
      },
    ],
  };
}

export async function readTranscriptResource(
  ctx: ServiceContext,
  recordingId: string,
): Promise<ReadResourceResult> {
  const detail = await getTranscriptDetail(ctx, { recordingId });
  return {
    contents: [
      {
        uri: `lumen://transcript/${recordingId}`,
        mimeType: "application/json",
        text: JSON.stringify(detail, null, 2),
      },
    ],
  };
}

export function registerMcpResources(server: McpServer, ctx: ServiceContext) {
  server.registerResource(
    "document",
    new ResourceTemplate("lumen://document/{id}", { list: undefined }),
    { title: "Document", description: "A Lumen document by id." },
    (_uri, variables) => readDocumentResource(ctx, String(variables.id)),
  );

  server.registerResource(
    "transcript",
    new ResourceTemplate("lumen://transcript/{recordingId}", {
      list: undefined,
    }),
    { title: "Transcript", description: "A recording transcript by id." },
    (_uri, variables) =>
      readTranscriptResource(ctx, String(variables.recordingId)),
  );
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd apps/web && bun run test src/server/mcp/__tests__/resources.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/mcp/resources.ts apps/web/src/server/mcp/__tests__/resources.test.ts
git commit -m "feat(web): MCP document and transcript resources"
```

---

### Task 7: MCP prompts (study workflows)

Prompts inject fetched content; the host LLM generates. No LLM call in the server.

**Files:**
- Create: `apps/web/src/server/mcp/prompts.ts`
- Test: `apps/web/src/server/mcp/__tests__/prompts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/server/mcp/__tests__/prompts.test.ts
import { describe, expect, it } from "vitest";
import { createContext } from "@/server/services/__tests__/fake-supabase";
import { buildSummarizeRecordingPrompt } from "@/server/mcp/prompts";

describe("buildSummarizeRecordingPrompt", () => {
  it("injects transcript text and a summarize instruction", async () => {
    const ctx = createContext({
      recordings: [
        { id: "r1", user_id: "user-1", file_id: "f1", created_at: "2026-01-01T00:00:00Z" },
      ],
      files: [
        { id: "f1", user_id: "user-1", name: "lecture.mp3", folder_id: null, mime_type: "audio/mpeg", size_bytes: 1, storage_key: "k", kind: "audio", created_at: "2026-01-01T00:00:00Z" },
      ],
      transcripts: [
        { id: "t1", user_id: "user-1", recording_id: "r1", created_at: "2026-01-01T00:00:00Z" },
      ],
      transcript_segments: [
        { id: "s1", transcript_id: "t1", start_ms: 0, end_ms: 1000, text: "Mitochondria are organelles.", speaker: null },
      ],
    });

    const result = await buildSummarizeRecordingPrompt(ctx, { recordingId: "r1" });
    const text = String(result.messages[0].content.text);
    expect(text).toContain("Mitochondria are organelles.");
    expect(text.toLowerCase()).toContain("summarize");
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd apps/web && bun run test src/server/mcp/__tests__/prompts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/server/mcp/prompts.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { ServiceContext } from "@/server/services/context";
import { getTranscriptDetail } from "@/server/services/transcripts";

function userMessage(text: string): GetPromptResult {
  return { messages: [{ role: "user", content: { type: "text", text } }] };
}

function transcriptText(
  segments: { text: string }[],
): string {
  return segments.map((segment) => segment.text).join(" ");
}

export async function buildSummarizeRecordingPrompt(
  ctx: ServiceContext,
  args: { recordingId: string },
): Promise<GetPromptResult> {
  const { segments } = await getTranscriptDetail(ctx, {
    recordingId: args.recordingId,
  });
  const body = transcriptText(segments);
  return userMessage(
    `Summarize the following lecture transcript into concise study notes with key points and definitions.\n\nTranscript:\n${body}`,
  );
}

export async function buildMakeFlashcardsPrompt(
  ctx: ServiceContext,
  args: { recordingId: string },
): Promise<GetPromptResult> {
  const { segments } = await getTranscriptDetail(ctx, {
    recordingId: args.recordingId,
  });
  const body = transcriptText(segments);
  return userMessage(
    `Create question-and-answer flashcards from the following transcript. Return each card as "Q: ... / A: ...".\n\nTranscript:\n${body}`,
  );
}

export function registerMcpPrompts(server: McpServer, ctx: ServiceContext) {
  server.registerPrompt(
    "summarize-recording",
    {
      title: "Summarize recording",
      description: "Summarize a recording transcript into study notes.",
      argsSchema: { recordingId: z.string().uuid() },
    },
    (args) => buildSummarizeRecordingPrompt(ctx, args),
  );

  server.registerPrompt(
    "make-flashcards",
    {
      title: "Make flashcards",
      description: "Generate Q&A flashcards from a recording transcript.",
      argsSchema: { recordingId: z.string().uuid() },
    },
    (args) => buildMakeFlashcardsPrompt(ctx, args),
  );
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd apps/web && bun run test src/server/mcp/__tests__/prompts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/mcp/prompts.ts apps/web/src/server/mcp/__tests__/prompts.test.ts
git commit -m "feat(web): MCP study-workflow prompts"
```

---

### Task 8: Assemble the MCP server

**Files:**
- Create: `apps/web/src/server/mcp/server.ts`
- Test: `apps/web/src/server/mcp/__tests__/server.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/server/mcp/__tests__/server.test.ts
import { describe, expect, it } from "vitest";
import { createContext } from "@/server/services/__tests__/fake-supabase";
import { buildMcpServer } from "@/server/mcp/server";

describe("buildMcpServer", () => {
  it("registers the expected tools", async () => {
    const ctx = createContext({});
    const server = buildMcpServer(ctx);
    // McpServer exposes the underlying low-level server; assert tool names.
    const names = Object.keys(
      (server as unknown as { _registeredTools: Record<string, unknown> })
        ._registeredTools,
    );
    expect(names.sort()).toEqual(
      ["create_note", "get_document", "get_transcript", "list_by_tag", "search_notes"].sort(),
    );
  });
});
```

> Note: `_registeredTools` is an internal SDK field used only for this assertion. If a future SDK version renames it, assert against `server.listTools()` over a connected in-memory transport instead.

- [ ] **Step 2: Run it, verify it fails**

Run: `cd apps/web && bun run test src/server/mcp/__tests__/server.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/server/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "@/server/services/context";
import { registerMcpPrompts } from "@/server/mcp/prompts";
import { registerMcpResources } from "@/server/mcp/resources";
import { registerMcpTools } from "@/server/mcp/tools";

export function buildMcpServer(ctx: ServiceContext): McpServer {
  const server = new McpServer({ name: "lumen", version: "2.0.0" });
  registerMcpTools(server, ctx);
  registerMcpResources(server, ctx);
  registerMcpPrompts(server, ctx);
  return server;
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd apps/web && bun run test src/server/mcp/__tests__/server.test.ts`
Expected: PASS. If the internal field assertion fails due to an SDK change, switch to the `listTools()` approach noted above.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/mcp/server.ts apps/web/src/server/mcp/__tests__/server.test.ts
git commit -m "feat(web): assemble the Lumen MCP server"
```

---

### Task 9: Route handler (stateless Streamable HTTP)

**Files:**
- Create: `apps/web/src/app/api/mcp/route.ts`

- [ ] **Step 1: Implement the handler**

```ts
// apps/web/src/app/api/mcp/route.ts
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getMcpServiceContext } from "@/server/mcp/auth";
import { buildMcpServer } from "@/server/mcp/server";

export async function POST(request: Request): Promise<Response> {
  const ctx = await getMcpServiceContext(request);
  if (!ctx) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const server = buildMcpServer(ctx);
  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless: no session persistence — fits Vercel function execution.
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `cd apps/web && bunx tsc --noEmit && cd ../.. && bun run lint`
Expected: no errors. (No unit test for the route; it is exercised by the manual connection check in Task 11.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/mcp/route.ts
git commit -m "feat(web): MCP Streamable HTTP route handler"
```

---

### Task 10: Cross-user isolation tests (security-critical)

Prove that a context for user A never returns user B's data through the tool layer. Uses the fake context with both users' rows seeded; services filter by `user_id` exactly as RLS does in production.

**Files:**
- Test: `apps/web/src/server/mcp/__tests__/isolation.test.ts`

- [ ] **Step 1: Write the test**

```ts
// apps/web/src/server/mcp/__tests__/isolation.test.ts
import { describe, expect, it } from "vitest";
import {
  otherUserId,
  userId,
} from "@/server/services/__tests__/fake-supabase";
import { FakeSupabase } from "@/server/services/__tests__/fake-supabase";
import type { ServiceContext } from "@/server/services/context";
import { runGetDocument, runListByTag } from "@/server/mcp/tools";

function contextFor(id: string, tables: Record<string, Record<string, unknown>[]>): ServiceContext {
  return { userId: id, supabase: new FakeSupabase(tables) };
}

const userBDocument = {
  id: "doc-b",
  user_id: otherUserId,
  folder_id: null,
  title: "User B secret",
  content_json: null,
  content_text: "secret",
  content_tsv: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("MCP tenant isolation", () => {
  it("user A cannot read user B's document via get_document", async () => {
    const ctx = contextFor(userId, { documents: [{ ...userBDocument }] });
    const result = await runGetDocument(ctx, { id: "doc-b" });
    expect(result.isError).toBe(true);
    expect(String(result.content[0].text)).toContain("not found");
  });

  it("user A cannot list user B's tag via list_by_tag", async () => {
    const ctx = contextFor(userId, {
      tags: [{ id: "tag-b", user_id: otherUserId, name: "b", color: null }],
      tag_links: [],
      documents: [{ ...userBDocument }],
    });
    const result = await runListByTag(ctx, { tagId: "tag-b" });
    expect(result.isError).toBe(true);
    expect(String(result.content[0].text)).toContain("not found");
  });
});
```

- [ ] **Step 2: Run it, verify it passes**

Run: `cd apps/web && bun run test src/server/mcp/__tests__/isolation.test.ts`
Expected: PASS (2 tests) — both cross-user accesses are denied.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/server/mcp/__tests__/isolation.test.ts
git commit -m "test(web): MCP cross-user tenant isolation"
```

---

### Task 11: Security docs + manual connection notes + gate

**Files:**
- Modify: `docs/SECURITY.md`
- Create: `docs/references/mcp-connect.md`

- [ ] **Step 1: Document the MCP auth + isolation model**

Add a section to `docs/SECURITY.md`:

```markdown
## MCP server auth and tenant isolation

The MCP server (`apps/web/src/app/api/mcp/route.ts`) authenticates external
hosts with a **bearer Supabase JWT** (not the cookie session the web app uses).
`getMcpServiceContext` validates the token with `supabase.auth.getUser(token)`
and builds a `ServiceContext` whose Supabase client carries that JWT against the
**publishable (anon) key**. Every tool, resource, and prompt query therefore runs
under the user's **RLS policies** — the same guarantee as the web app, with no
service-role key and no manual `user_id` scoping. A missing or invalid token is
rejected with 401 before any service runs. Cross-user isolation is covered by
`apps/web/src/server/mcp/__tests__/isolation.test.ts`.
```

- [ ] **Step 2: Write the manual connection notes**

Create `docs/references/mcp-connect.md` with: the endpoint (`POST /api/mcp`), how to obtain a Supabase access token (from an authenticated session), and an example host config:

```markdown
# Connecting an MCP host to Lumen

Endpoint: `POST {APP_URL}/api/mcp` (Streamable HTTP, stateless).
Auth: `Authorization: Bearer <supabase-access-token>`.

Obtain a token from an authenticated browser session (Supabase
`getSession().access_token`) or the Supabase CLI for a test user.

Example (generic MCP host config):

​```json
{
  "mcpServers": {
    "lumen": {
      "url": "https://<app-url>/api/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
​```

Verify with an `initialize` request followed by `tools/list`; you should see
search_notes, get_document, get_transcript, create_note, list_by_tag.
```

- [ ] **Step 3: Run the full gate**

Run: `bun run check`
Expected: green (Biome + typecheck + all tests, including the new MCP suites).

- [ ] **Step 4: Manual connection check**

Run the dev server (`cd apps/web && bun run dev`), obtain a test user's access token, and issue an `initialize` + `tools/list` against `POST http://localhost:3000/api/mcp` with the bearer header. Confirm the five tools list and that an unauthenticated request returns 401.

- [ ] **Step 5: Commit**

```bash
git add docs/SECURITY.md docs/references/mcp-connect.md
git commit -m "docs(security): MCP auth model and host connection notes"
```

---

## Promotion bookkeeping (do at task start)

When implementation begins, honor the Promotion Rule:

- [ ] Move `docs/exec-plans/queued/v2/mcp-server-auth.md` → `docs/exec-plans/active/v2/mcp-server-auth.md` (create the `active/v2/` bucket).
- [ ] Update `docs/PLANS.md`: move the entry from Queued to Active.
- [ ] Commit: `docs(plans): promote mcp-server-auth to active`.

---

## Self-Review

**Spec coverage:** server placement ✓ (Task 9), stateless transport ✓ (Task 9), bearer JWT validation ✓ (Tasks 2–3), RLS isolation ✓ (Tasks 3, 10), tools search_notes/get_document/get_transcript/create_note/list_by_tag ✓ (Tasks 4–5), document/transcript resources ✓ (Task 6), summarize/flashcard prompts ✓ (Task 7), SECURITY.md ✓ (Task 11), manual host notes ✓ (Task 11), `bun run check` gate ✓ (Task 11). FTS-backed search (no semantic dep) ✓ (Task 5 uses `searchLibrary`).

**Placeholder scan:** none — every code step contains complete content.

**Type consistency:** `ServiceContext { userId, supabase }` used uniformly; runners typed `(ctx, args) => Promise<CallToolResult>`; `getDocumentDetail({ id })`, `getTranscriptDetail({ recordingId })`, `listDocumentsByTag({ tagId })`, `createDocument({ title, folderId })` signatures match across tools, resources, prompts, and their defining tasks.

**Known risk:** Task 8's `_registeredTools` is an SDK-internal field; mitigation noted inline (fall back to `listTools()` over an in-memory transport). Task 1 verifies the SDK import surface before any of this is built.
