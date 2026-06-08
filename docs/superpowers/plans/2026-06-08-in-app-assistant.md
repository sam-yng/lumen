# In-App Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an authenticated in-app chat assistant that reasons over the user's vault through the existing MCP tool contract, powered by the user's own Claude API key.

**Architecture:** A server-side agent loop (`@anthropic-ai/sdk`, `claude-opus-4-8`, adaptive thinking) connects to the in-process MCP server (`buildMcpServer`) over an in-memory transport, so the in-app assistant and external MCP hosts exercise one tool contract. The user's key is stored per-user in Supabase Vault behind `SECURITY DEFINER` RPC functions scoped by `auth.uid()`, decrypted server-side only inside the loop.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase (Postgres/Vault/RLS), `@modelcontextprotocol/sdk` (already a dep), `@anthropic-ai/sdk` (new), Vitest, React 19 + TanStack Query + shadcn/ui.

Reference spec: `docs/superpowers/specs/2026-06-08-in-app-assistant-design.md`.

---

## File Structure

- `apps/web/supabase/migrations/<ts>_assistant_credentials.sql` — table, RLS, Vault RPC functions.
- `apps/web/supabase/config.toml` — enable `[db.vault]`.
- `apps/web/src/server/services/ai-credentials.ts` — save/has/get/delete key via RPC.
- `apps/web/src/server/services/__tests__/ai-credentials.test.ts`
- `apps/web/src/server/services/assistant.ts` — MCP bridge + Anthropic agent loop.
- `apps/web/src/server/services/__tests__/assistant.test.ts`
- `apps/web/src/server/config/env.ts` — (no new server secret; no change unless noted).
- `apps/web/src/app/api/assistant/route.ts` — POST handler.
- `apps/web/src/app/api/assistant/__tests__/route.test.ts`
- `apps/web/src/app/(app)/settings/page.tsx` + `settings-key-form.tsx` — key management UI.
- `apps/web/src/app/api/assistant/key/route.ts` — GET (has key) / PUT (save) / DELETE.
- `apps/web/src/components/assistant/assistant-panel.tsx` + `use-assistant.ts` — chat UI + states.
- `apps/web/src/components/assistant/__tests__/assistant-panel.test.tsx`
- `apps/web/src/app/(app)/layout.tsx` — mount the panel toggle.
- `docs/product-specs/in-app-assistant.md` — demo + parity doc.

---

## Task 1: Database — credentials table + Vault RPC functions

**Files:**
- Create: `apps/web/supabase/migrations/<timestamp>_assistant_credentials.sql`
- Modify: `apps/web/supabase/config.toml` (enable `[db.vault]`)
- Regenerate: `apps/web/src/server/db/database.types.ts`, `docs/generated/db-schema.md`

- [ ] **Step 1: Enable Vault in local config**

In `apps/web/supabase/config.toml`, find the commented `# [db.vault]` line and add an enabled block beneath it:

```toml
[db.vault]
```

(The Vault extension ships with Supabase; this records that the project uses it.)

- [ ] **Step 2: Create the migration**

Generate a timestamp with `date -u +%Y%m%d%H%M%S`. Create `apps/web/supabase/migrations/<timestamp>_assistant_credentials.sql`:

```sql
-- In-app assistant: per-user Claude API key storage.
--
-- The raw key never lands in a plain column. It lives in Supabase Vault;
-- this table holds only the Vault secret id. All access goes through
-- SECURITY DEFINER functions scoped to auth.uid(), so a user can only ever
-- touch their own key. Service-role/worker paths never read this.

create extension if not exists supabase_vault with schema vault cascade;

create table public.user_ai_credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  vault_secret_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_ai_credentials enable row level security;

create policy "own credentials"
  on public.user_ai_credentials
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Save (insert or replace) the caller's Claude API key.
create or replace function public.set_ai_api_key(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select vault_secret_id into v_existing
  from public.user_ai_credentials where user_id = v_uid;

  if v_existing is null then
    insert into public.user_ai_credentials (user_id, vault_secret_id)
    values (v_uid, vault.create_secret(p_key, 'claude_api_key_' || v_uid::text));
  else
    perform vault.update_secret(v_existing, p_key);
    update public.user_ai_credentials
      set updated_at = now() where user_id = v_uid;
  end if;
end;
$$;

-- Return the caller's decrypted Claude API key, or null if unset.
create or replace function public.get_ai_api_key()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_secret_id uuid;
  v_key text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select vault_secret_id into v_secret_id
  from public.user_ai_credentials where user_id = v_uid;
  if v_secret_id is null then
    return null;
  end if;

  select decrypted_secret into v_key
  from vault.decrypted_secrets where id = v_secret_id;
  return v_key;
end;
$$;

-- Delete the caller's key (row + Vault secret).
create or replace function public.delete_ai_api_key()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_secret_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select vault_secret_id into v_secret_id
  from public.user_ai_credentials where user_id = v_uid;
  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
    delete from public.user_ai_credentials where user_id = v_uid;
  end if;
end;
$$;

revoke all on function public.set_ai_api_key(text) from public, anon;
revoke all on function public.get_ai_api_key() from public, anon;
revoke all on function public.delete_ai_api_key() from public, anon;
grant execute on function public.set_ai_api_key(text) to authenticated;
grant execute on function public.get_ai_api_key() to authenticated;
grant execute on function public.delete_ai_api_key() to authenticated;
```

- [ ] **Step 3: Apply the migration and confirm it's clean**

Run: `cd apps/web && bunx supabase db reset`
Expected: all migrations apply with no error; final line reports success.

- [ ] **Step 4: Regenerate types + schema doc**

Run: `cd apps/web && bun run db:types && bun run docs:db-schema`
Expected: `database.types.ts` now includes `user_ai_credentials` and the three functions; `docs/generated/db-schema.md` updates. Do not hand-edit either.

- [ ] **Step 5: Commit**

```bash
git add apps/web/supabase/migrations apps/web/supabase/config.toml apps/web/src/server/db/database.types.ts docs/generated/db-schema.md
git commit -m "feat(db): per-user Claude API key storage via Supabase Vault"
```

---

## Task 2: `ai-credentials` service

**Files:**
- Create: `apps/web/src/server/services/ai-credentials.ts`
- Test: `apps/web/src/server/services/__tests__/ai-credentials.test.ts`

The service calls the RPC functions through `ctx.supabase.rpc`. The fake supabase logs rpc calls and returns `rpcRows[fn]`; for scalar-returning functions the fake returns rows, and the service reads `data[0]`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { createContext } from "@/server/services/__tests__/fake-supabase";
import {
  deleteApiKey,
  getDecryptedApiKey,
  hasApiKey,
  saveApiKey,
} from "@/server/services/ai-credentials";

describe("ai-credentials", () => {
  it("saveApiKey calls set_ai_api_key with the key", async () => {
    const ctx = createContext({});
    await saveApiKey(ctx, "sk-ant-123");
    const supabase = ctx.supabase as unknown as { rpcLog: { fn: string; args: Record<string, unknown> }[] };
    expect(supabase.rpcLog).toEqual([{ fn: "set_ai_api_key", args: { p_key: "sk-ant-123" } }]);
  });

  it("hasApiKey is true only when a row exists", async () => {
    const withKey = createContext({ user_ai_credentials: [{ user_id: "user-1", vault_secret_id: "s1" }] });
    const without = createContext({ user_ai_credentials: [] });
    expect(await hasApiKey(withKey)).toBe(true);
    expect(await hasApiKey(without)).toBe(false);
  });

  it("hasApiKey is scoped to the user", async () => {
    const ctx = createContext({ user_ai_credentials: [{ user_id: "user-2", vault_secret_id: "s9" }] });
    expect(await hasApiKey(ctx)).toBe(false);
  });

  it("getDecryptedApiKey returns the key from get_ai_api_key", async () => {
    const ctx = createContext({}, { get_ai_api_key: [{ get_ai_api_key: "sk-ant-xyz" }] });
    expect(await getDecryptedApiKey(ctx)).toBe("sk-ant-xyz");
  });

  it("getDecryptedApiKey returns null when unset", async () => {
    const ctx = createContext({}, { get_ai_api_key: [] });
    expect(await getDecryptedApiKey(ctx)).toBeNull();
  });

  it("deleteApiKey calls delete_ai_api_key", async () => {
    const ctx = createContext({});
    await deleteApiKey(ctx);
    const supabase = ctx.supabase as unknown as { rpcLog: { fn: string }[] };
    expect(supabase.rpcLog.at(-1)?.fn).toBe("delete_ai_api_key");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun run test src/server/services/__tests__/ai-credentials.test.ts`
Expected: FAIL — `ai-credentials` module not found.

- [ ] **Step 3: Implement the service**

```typescript
import type { ServiceContext } from "@/server/services/context";

/** Save (insert or replace) the caller's Claude API key in Vault. */
export async function saveApiKey(ctx: ServiceContext, key: string): Promise<void> {
  const { error } = await ctx.supabase.rpc("set_ai_api_key", { p_key: key });
  if (error) throw new Error(`Could not save API key: ${error.message}`);
}

/** Whether the caller has a key set. Never returns key material. */
export async function hasApiKey(ctx: ServiceContext): Promise<boolean> {
  const { data, error } = await ctx.supabase
    .from<{ user_id: string }>("user_ai_credentials")
    .select("user_id")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) throw new Error(`Could not check API key: ${error.message}`);
  return data !== null;
}

/** Server-only: decrypt and return the caller's key, or null if unset. */
export async function getDecryptedApiKey(ctx: ServiceContext): Promise<string | null> {
  const { data, error } = await ctx.supabase.rpc<{ get_ai_api_key: string | null }>(
    "get_ai_api_key",
    {},
  );
  if (error) throw new Error(`Could not load API key: ${error.message}`);
  return data[0]?.get_ai_api_key ?? null;
}

/** Delete the caller's key (row + Vault secret). */
export async function deleteApiKey(ctx: ServiceContext): Promise<void> {
  const { error } = await ctx.supabase.rpc("delete_ai_api_key", {});
  if (error) throw new Error(`Could not delete API key: ${error.message}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun run test src/server/services/__tests__/ai-credentials.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/services/ai-credentials.ts apps/web/src/server/services/__tests__/ai-credentials.test.ts
git commit -m "feat(services): ai-credentials read/write via Vault RPCs"
```

---

## Task 3: Assistant service — MCP tool bridge

Convert the in-process MCP server's tools into Anthropic tool definitions and dispatch tool calls back through an in-memory MCP client. This is the parity seam.

**Files:**
- Create: `apps/web/src/server/services/assistant.ts`
- Test: `apps/web/src/server/services/__tests__/assistant.test.ts`

- [ ] **Step 1: Write the failing test for the bridge**

```typescript
import { describe, expect, it } from "vitest";
import { createContext } from "@/server/services/__tests__/fake-supabase";
import { connectMcpBridge } from "@/server/services/assistant";

describe("connectMcpBridge", () => {
  it("lists the MCP tools as Anthropic tool defs", async () => {
    const ctx = createContext({ documents: [], folders: [] });
    const bridge = await connectMcpBridge(ctx);
    try {
      const names = bridge.tools.map((t) => t.name).sort();
      expect(names).toContain("search_notes");
      expect(names).toContain("create_note");
      for (const tool of bridge.tools) {
        expect(tool.input_schema.type).toBe("object");
      }
    } finally {
      await bridge.close();
    }
  });

  it("dispatches a tool call through MCP and returns text", async () => {
    const ctx = createContext({ documents: [], folders: [] });
    const bridge = await connectMcpBridge(ctx);
    try {
      const result = await bridge.callTool("create_note", { title: "Hello", folderId: null });
      expect(result).toContain("Hello");
    } finally {
      await bridge.close();
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && bun run test src/server/services/__tests__/assistant.test.ts`
Expected: FAIL — `connectMcpBridge` not exported.

- [ ] **Step 3: Implement the bridge**

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildMcpServer } from "@/server/mcp/server";
import type { ServiceContext } from "@/server/services/context";

export type AnthropicToolDef = {
  name: string;
  description: string;
  input_schema: { type: "object"; properties?: Record<string, unknown>; required?: string[] };
};

export type McpBridge = {
  tools: AnthropicToolDef[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<string>;
  close: () => Promise<void>;
};

/** Connect an in-memory MCP client to the same server external hosts use. */
export async function connectMcpBridge(ctx: ServiceContext): Promise<McpBridge> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = buildMcpServer(ctx);
  const client = new Client({ name: "lumen-in-app", version: "2.0.0" });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const listed = await client.listTools();
  const tools: AnthropicToolDef[] = listed.tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    input_schema: (tool.inputSchema as AnthropicToolDef["input_schema"]) ?? { type: "object" },
  }));

  return {
    tools,
    async callTool(name, args) {
      const result = await client.callTool({ name, arguments: args });
      const blocks = Array.isArray(result.content) ? result.content : [];
      const text = blocks
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      if (result.isError) throw new Error(text || `Tool ${name} failed`);
      return text;
    },
    async close() {
      await client.close();
      await server.close();
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/web && bun run test src/server/services/__tests__/assistant.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/services/assistant.ts apps/web/src/server/services/__tests__/assistant.test.ts
git commit -m "feat(assistant): in-memory MCP bridge for tool parity"
```

---

## Task 4: Assistant service — agent loop

Add the Anthropic tool-use loop on top of the bridge. The Anthropic client is injected so tests stay deterministic; production builds it from the user's key.

**Files:**
- Modify: `apps/web/src/server/services/assistant.ts`
- Test: `apps/web/src/server/services/__tests__/assistant.test.ts`

- [ ] **Step 1: Write the failing tests for the loop**

Append to `assistant.test.ts`:

```typescript
import { runAssistant, type AnthropicLike } from "@/server/services/assistant";

function fakeAnthropic(scripted: Array<{
  stop_reason: string;
  content: Array<Record<string, unknown>>;
}>): AnthropicLike {
  let i = 0;
  return {
    messages: {
      async create() {
        const next = scripted[i] ?? scripted[scripted.length - 1];
        i += 1;
        return next as never;
      },
    },
  };
}

describe("runAssistant", () => {
  it("returns the final text with no tool calls", async () => {
    const ctx = createContext({ documents: [], folders: [] });
    const anthropic = fakeAnthropic([
      { stop_reason: "end_turn", content: [{ type: "text", text: "Hi there." }] },
    ]);
    const result = await runAssistant(ctx, {
      anthropic,
      messages: [{ role: "user", content: "hello" }],
    });
    expect(result.message).toBe("Hi there.");
    expect(result.toolCalls).toEqual([]);
  });

  it("executes a tool call then returns the follow-up answer", async () => {
    const ctx = createContext({ documents: [], folders: [] });
    const anthropic = fakeAnthropic([
      {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "create_note", input: { title: "Note", folderId: null } }],
      },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Created the note." }] },
    ]);
    const result = await runAssistant(ctx, {
      anthropic,
      messages: [{ role: "user", content: "make a note called Note" }],
    });
    expect(result.message).toBe("Created the note.");
    expect(result.toolCalls).toEqual([{ name: "create_note", ok: true }]);
  });

  it("stops at the iteration cap", async () => {
    const ctx = createContext({ documents: [], folders: [] });
    const anthropic = fakeAnthropic([
      {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t", name: "search_notes", input: { query: "x" } }],
      },
    ]);
    const result = await runAssistant(ctx, {
      anthropic,
      messages: [{ role: "user", content: "loop" }],
      maxIterations: 2,
    });
    expect(result.stoppedAtCap).toBe(true);
    expect(result.toolCalls.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `cd apps/web && bun run test src/server/services/__tests__/assistant.test.ts`
Expected: FAIL — `runAssistant` / `AnthropicLike` not exported.

- [ ] **Step 3: Implement the loop**

Append to `assistant.ts`:

```typescript
export const ASSISTANT_MODEL = "claude-opus-4-8";
const DEFAULT_MAX_ITERATIONS = 8;

const SYSTEM_PROMPT = [
  "You are Lumen's study assistant. You help the user reason over their own",
  "notes, transcripts, and documents using the provided tools.",
  "Only act on what the tools return. When you generate or summarize content,",
  "remind the user to verify it. Be concise.",
].join(" ");

export type AnthropicLike = {
  messages: {
    create(params: Record<string, unknown>): Promise<{
      stop_reason: string;
      content: Array<Record<string, unknown>>;
    }>;
  };
};

export type AssistantMessage = { role: "user" | "assistant"; content: unknown };
export type ToolCallTrace = { name: string; ok: boolean };
export type AssistantResult = {
  message: string;
  toolCalls: ToolCallTrace[];
  stoppedAtCap: boolean;
};

export async function runAssistant(
  ctx: ServiceContext,
  input: {
    anthropic: AnthropicLike;
    messages: AssistantMessage[];
    maxIterations?: number;
  },
): Promise<AssistantResult> {
  const maxIterations = input.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const bridge = await connectMcpBridge(ctx);
  const toolCalls: ToolCallTrace[] = [];
  const messages: AssistantMessage[] = [...input.messages];

  try {
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const response = await input.anthropic.messages.create({
        model: ASSISTANT_MODEL,
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        system: SYSTEM_PROMPT,
        tools: bridge.tools,
        messages,
      });

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason !== "tool_use") {
        return { message: extractText(response.content), toolCalls, stoppedAtCap: false };
      }

      const toolUses = response.content.filter(
        (block): block is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
          block.type === "tool_use",
      );

      const results: unknown[] = [];
      for (const use of toolUses) {
        try {
          const text = await bridge.callTool(use.name, use.input);
          toolCalls.push({ name: use.name, ok: true });
          results.push({ type: "tool_result", tool_use_id: use.id, content: text });
        } catch (error) {
          toolCalls.push({ name: use.name, ok: false });
          results.push({
            type: "tool_result",
            tool_use_id: use.id,
            content: error instanceof Error ? error.message : "Tool failed.",
            is_error: true,
          });
        }
      }
      messages.push({ role: "user", content: results });
    }

    return { message: "", toolCalls, stoppedAtCap: true };
  } finally {
    await bridge.close();
  }
}

function extractText(content: Array<Record<string, unknown>>): string {
  return content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
```

- [ ] **Step 4: Run to verify all assistant tests pass**

Run: `cd apps/web && bun run test src/server/services/__tests__/assistant.test.ts`
Expected: PASS (5 tests total).

- [ ] **Step 5: Add `@anthropic-ai/sdk` and the production client factory**

Run: `cd apps/web && bun add @anthropic-ai/sdk`

Append to `assistant.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";

/** Build a production Anthropic client bound to the user's key. */
export function anthropicForKey(apiKey: string): AnthropicLike {
  return new Anthropic({ apiKey }) as unknown as AnthropicLike;
}
```

- [ ] **Step 6: Run the focused tests again and the gate**

Run: `cd apps/web && bun run test src/server/services/__tests__/assistant.test.ts`
Expected: PASS.
Run: `bun run check` (from repo root)
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/server/services/assistant.ts apps/web/src/server/services/__tests__/assistant.test.ts apps/web/package.json apps/web/../../bun.lock
git commit -m "feat(assistant): Claude agent loop over MCP tool contract"
```

---

## Task 5: Key management route + service errors

**Files:**
- Create: `apps/web/src/app/api/assistant/key/route.ts`
- Test: `apps/web/src/app/api/assistant/__tests__/key-route.test.ts`

The handlers reuse `getRouteServiceContext`, `unauthorizedResponse`, `parseJsonBody` from `@/app/api/library/http`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/library/http", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/library/http")>(
    "@/app/api/library/http",
  );
  return { ...actual, getRouteServiceContext: vi.fn() };
});
vi.mock("@/server/services/ai-credentials", () => ({
  hasApiKey: vi.fn(),
  saveApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
}));

import { getRouteServiceContext } from "@/app/api/library/http";
import { hasApiKey, saveApiKey } from "@/server/services/ai-credentials";
import { GET, PUT } from "@/app/api/assistant/key/route";

const ctx = { userId: "user-1", supabase: {} } as never;

describe("assistant key route", () => {
  it("GET returns 401 when unauthenticated", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET reports whether a key is set", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(ctx);
    vi.mocked(hasApiKey).mockResolvedValue(true);
    const res = await GET();
    expect(await res.json()).toEqual({ hasKey: true });
  });

  it("PUT rejects an empty key", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(ctx);
    const res = await PUT(new Request("http://x/api/assistant/key", {
      method: "PUT",
      body: JSON.stringify({ key: "" }),
    }));
    expect(res.status).toBe(400);
  });

  it("PUT saves a valid key", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(ctx);
    vi.mocked(saveApiKey).mockResolvedValue();
    const res = await PUT(new Request("http://x/api/assistant/key", {
      method: "PUT",
      body: JSON.stringify({ key: "sk-ant-abc" }),
    }));
    expect(res.status).toBe(200);
    expect(saveApiKey).toHaveBeenCalledWith(ctx, "sk-ant-abc");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && bun run test src/app/api/assistant/__tests__/key-route.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Implement the route**

```typescript
import { z } from "zod";
import {
  getRouteServiceContext,
  parseJsonBody,
  serviceErrorResponse,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { deleteApiKey, hasApiKey, saveApiKey } from "@/server/services/ai-credentials";

const keySchema = z.object({ key: z.string().trim().min(1).max(200) });

export async function GET() {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();
  try {
    return Response.json({ hasKey: await hasApiKey(ctx) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();
  const parsed = await parseJsonBody(request, keySchema);
  if (!parsed.ok) return parsed.response;
  try {
    await saveApiKey(ctx, parsed.data.key);
    return Response.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function DELETE() {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();
  try {
    await deleteApiKey(ctx);
    return Response.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/web && bun run test src/app/api/assistant/__tests__/key-route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/assistant
git commit -m "feat(api): assistant key management route"
```

---

## Task 6: Assistant chat route

**Files:**
- Create: `apps/web/src/app/api/assistant/route.ts`
- Test: `apps/web/src/app/api/assistant/__tests__/route.test.ts`

Returns a typed `no_api_key` state (HTTP 200 with a discriminator) so the UI can route to settings without treating it as an error.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/library/http", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/library/http")>(
    "@/app/api/library/http",
  );
  return { ...actual, getRouteServiceContext: vi.fn() };
});
vi.mock("@/server/services/ai-credentials", () => ({ getDecryptedApiKey: vi.fn() }));
vi.mock("@/server/services/assistant", () => ({
  runAssistant: vi.fn(),
  anthropicForKey: vi.fn(() => ({})),
}));

import { getRouteServiceContext } from "@/app/api/library/http";
import { getDecryptedApiKey } from "@/server/services/ai-credentials";
import { runAssistant } from "@/server/services/assistant";
import { POST } from "@/app/api/assistant/route";

const ctx = { userId: "user-1", supabase: {} } as never;
function req(body: unknown) {
  return new Request("http://x/api/assistant", { method: "POST", body: JSON.stringify(body) });
}

describe("assistant route", () => {
  it("401 when unauthenticated", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(null);
    expect((await POST(req({ messages: [] }))).status).toBe(401);
  });

  it("returns no_api_key when the user has no key", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(ctx);
    vi.mocked(getDecryptedApiKey).mockResolvedValue(null);
    const res = await POST(req({ messages: [{ role: "user", content: "hi" }] }));
    expect(await res.json()).toEqual({ state: "no_api_key" });
  });

  it("runs the assistant and returns the answer", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(ctx);
    vi.mocked(getDecryptedApiKey).mockResolvedValue("sk-ant-1");
    vi.mocked(runAssistant).mockResolvedValue({ message: "done", toolCalls: [], stoppedAtCap: false });
    const res = await POST(req({ messages: [{ role: "user", content: "hi" }] }));
    expect(await res.json()).toEqual({ state: "ok", message: "done", toolCalls: [], stoppedAtCap: false });
  });

  it("maps an invalid key to invalid_key", async () => {
    vi.mocked(getRouteServiceContext).mockResolvedValue(ctx);
    vi.mocked(getDecryptedApiKey).mockResolvedValue("sk-bad");
    vi.mocked(runAssistant).mockRejectedValue(Object.assign(new Error("auth"), { status: 401 }));
    const res = await POST(req({ messages: [{ role: "user", content: "hi" }] }));
    expect(await res.json()).toEqual({ state: "invalid_key" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && bun run test src/app/api/assistant/__tests__/route.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Implement the route**

```typescript
import { z } from "zod";
import {
  getRouteServiceContext,
  parseJsonBody,
  unauthorizedResponse,
} from "@/app/api/library/http";
import { getDecryptedApiKey } from "@/server/services/ai-credentials";
import {
  anthropicForKey,
  runAssistant,
  type AssistantMessage,
} from "@/server/services/assistant";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.unknown(),
      }),
    )
    .min(1)
    .max(50),
});

function statusOf(error: unknown): number | undefined {
  return typeof error === "object" && error !== null && "status" in error
    ? (error as { status?: number }).status
    : undefined;
}

export async function POST(request: Request) {
  const ctx = await getRouteServiceContext();
  if (!ctx) return unauthorizedResponse();

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const apiKey = await getDecryptedApiKey(ctx);
  if (!apiKey) return Response.json({ state: "no_api_key" });

  try {
    const result = await runAssistant(ctx, {
      anthropic: anthropicForKey(apiKey),
      messages: parsed.data.messages as AssistantMessage[],
    });
    return Response.json({ state: "ok", ...result });
  } catch (error) {
    const status = statusOf(error);
    if (status === 401 || status === 403) return Response.json({ state: "invalid_key" });
    if (status === 429) return Response.json({ state: "rate_limited" });
    console.error("Assistant run failed", error);
    return Response.json({ state: "error" });
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/web && bun run test src/app/api/assistant/__tests__/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/assistant/route.ts apps/web/src/app/api/assistant/__tests__/route.test.ts
git commit -m "feat(api): assistant chat route with BYO-key states"
```

---

## Task 7: Settings — key management UI

**Files:**
- Create: `apps/web/src/app/(app)/settings/page.tsx`
- Create: `apps/web/src/app/(app)/settings/settings-key-form.tsx`

- [ ] **Step 1: Implement the server page**

`page.tsx` resolves the current key state server-side and passes it to the client form:

```tsx
import { getRouteServiceContext } from "@/app/api/library/http";
import { hasApiKey } from "@/server/services/ai-credentials";
import { SettingsKeyForm } from "@/app/(app)/settings/settings-key-form";

export default async function SettingsPage() {
  const ctx = await getRouteServiceContext();
  const keySet = ctx ? await hasApiKey(ctx) : false;

  return (
    <div className="mx-auto w-full max-w-xl p-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className="mt-8">
        <h2 className="text-lg font-medium">Claude API key</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The assistant uses your own Anthropic API key. Inference is billed to
          your account. Your key is encrypted at rest and never shown again.
        </p>
        <SettingsKeyForm initialKeySet={keySet} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Implement the client form**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SettingsKeyForm({ initialKeySet }: { initialKeySet: boolean }) {
  const [keySet, setKeySet] = useState(initialKeySet);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setStatus("saving");
    const res = await fetch("/api/assistant/key", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: value }),
    });
    if (res.ok) {
      setKeySet(true);
      setValue("");
      setStatus("saved");
    } else {
      setStatus("error");
    }
  }

  async function remove() {
    await fetch("/api/assistant/key", { method: "DELETE" });
    setKeySet(false);
    setStatus("idle");
  }

  return (
    <div className="mt-4 space-y-3">
      {keySet ? (
        <p className="text-sm text-emerald-600">A key is set.</p>
      ) : (
        <p className="text-sm text-amber-600">No key set — the assistant is disabled.</p>
      )}
      <Input
        type="password"
        placeholder="sk-ant-..."
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoComplete="off"
      />
      <div className="flex gap-2">
        <Button onClick={save} disabled={value.trim().length === 0 || status === "saving"}>
          {keySet ? "Replace key" : "Save key"}
        </Button>
        {keySet ? (
          <Button variant="outline" onClick={remove}>
            Remove
          </Button>
        ) : null}
      </div>
      {status === "saved" ? <p className="text-sm text-muted-foreground">Saved.</p> : null}
      {status === "error" ? <p className="text-sm text-destructive">Could not save the key.</p> : null}
    </div>
  );
}
```

- [ ] **Step 3: Confirm the shadcn `Input` component exists**

Run: `ls apps/web/src/components/ui/input.tsx apps/web/src/components/ui/button.tsx`
Expected: both exist. If `input.tsx` is missing, run `cd apps/web && bunx shadcn@latest add input` before continuing.

- [ ] **Step 4: Build to confirm the routes compile**

Run: `cd apps/web && bun run build`
Expected: build succeeds; `/settings` appears in the route list.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(app\)/settings
git commit -m "feat(ui): settings page for Claude API key"
```

---

## Task 8: Assistant chat panel

**Files:**
- Create: `apps/web/src/components/assistant/use-assistant.ts`
- Create: `apps/web/src/components/assistant/assistant-panel.tsx`
- Test: `apps/web/src/components/assistant/__tests__/assistant-panel.test.tsx`
- Modify: `apps/web/src/app/(app)/layout.tsx`

- [ ] **Step 1: Write the failing component test**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantPanel } from "@/components/assistant/assistant-panel";

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AssistantPanel />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("AssistantPanel", () => {
  it("shows the empty state initially", () => {
    renderPanel();
    expect(screen.getByText(/ask about your notes/i)).toBeInTheDocument();
  });

  it("renders the answer after a successful run", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ state: "ok", message: "Here you go.", toolCalls: [], stoppedAtCap: false })),
    );
    renderPanel();
    fireEvent.change(screen.getByPlaceholderText(/ask/i), { target: { value: "hi" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(screen.getByText("Here you go.")).toBeInTheDocument());
  });

  it("prompts to add a key on no_api_key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ state: "no_api_key" })),
    );
    renderPanel();
    fireEvent.change(screen.getByPlaceholderText(/ask/i), { target: { value: "hi" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(screen.getByText(/add your claude api key/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && bun run test src/components/assistant/__tests__/assistant-panel.test.tsx`
Expected: FAIL — `AssistantPanel` not found.

- [ ] **Step 3: Implement the hook**

`use-assistant.ts`:

```typescript
"use client";

import { useMutation } from "@tanstack/react-query";

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type AssistantResponse =
  | { state: "ok"; message: string; toolCalls: { name: string; ok: boolean }[]; stoppedAtCap: boolean }
  | { state: "no_api_key" }
  | { state: "invalid_key" }
  | { state: "rate_limited" }
  | { state: "error" };

export function useAssistant() {
  return useMutation<AssistantResponse, Error, ChatTurn[]>({
    mutationFn: async (messages) => {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      if (res.status === 401) throw new Error("Please sign in again.");
      return (await res.json()) as AssistantResponse;
    },
  });
}
```

- [ ] **Step 4: Implement the panel**

`assistant-panel.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type ChatTurn, useAssistant } from "@/components/assistant/use-assistant";

export function AssistantPanel() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const assistant = useAssistant();

  function send() {
    const text = draft.trim();
    if (text.length === 0) return;
    const next: ChatTurn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setDraft("");
    assistant.mutate(next, {
      onSuccess: (response) => {
        if (response.state === "ok") {
          setTurns((current) => [...current, { role: "assistant", content: response.message }]);
        }
      },
    });
  }

  const result = assistant.data;

  return (
    <div className="flex h-full w-80 flex-col border-l bg-card p-4">
      <h2 className="text-sm font-semibold">Assistant</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Answers may be wrong — verify against your notes.
      </p>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto text-sm">
        {turns.length === 0 ? (
          <p className="text-muted-foreground">Ask about your notes, transcripts, or documents.</p>
        ) : (
          turns.map((turn, index) => (
            <p key={index} className={turn.role === "user" ? "font-medium" : ""}>
              {turn.content}
            </p>
          ))
        )}

        {assistant.isPending ? <p className="text-muted-foreground">Thinking…</p> : null}

        {result?.state === "ok" && result.toolCalls.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Used: {result.toolCalls.map((call) => `${call.name}${call.ok ? "" : " (failed)"}`).join(", ")}
          </p>
        ) : null}

        {result?.state === "no_api_key" ? (
          <p className="text-amber-600">
            <Link href="/settings" className="underline">Add your Claude API key</Link> to enable the assistant.
          </p>
        ) : null}
        {result?.state === "invalid_key" ? (
          <p className="text-destructive">
            Your key was rejected. <Link href="/settings" className="underline">Update it</Link>.
          </p>
        ) : null}
        {result?.state === "rate_limited" ? (
          <p className="text-destructive">Rate limited by Anthropic. Try again shortly.</p>
        ) : null}
        {result?.state === "error" ? (
          <p className="text-destructive">Something went wrong. Try again.</p>
        ) : null}
      </div>

      <div className="mt-3 flex gap-2">
        <Input
          placeholder="Ask…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") send();
          }}
        />
        <Button onClick={send} disabled={assistant.isPending}>Send</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run to verify the component tests pass**

Run: `cd apps/web && bun run test src/components/assistant/__tests__/assistant-panel.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Mount the panel in the app shell**

Modify `apps/web/src/app/(app)/layout.tsx` to render the panel beside the children. Replace the return statement:

```tsx
  return (
    <main className="flex min-h-dvh bg-background">
      <div className="flex-1">{children}</div>
      <AssistantPanel />
    </main>
  );
```

Add the import at the top of the file:

```tsx
import { AssistantPanel } from "@/components/assistant/assistant-panel";
```

- [ ] **Step 7: Run the gate**

Run: `bun run check` (repo root)
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/assistant apps/web/src/app/\(app\)/layout.tsx
git commit -m "feat(ui): in-app assistant chat panel"
```

---

## Task 9: Demo doc + manual verification

**Files:**
- Create: `docs/product-specs/in-app-assistant.md`
- Modify: `docs/product-specs/index.md` (add the entry)

- [ ] **Step 1: Write the product spec / demo doc**

Create `docs/product-specs/in-app-assistant.md`:

```markdown
# In-app assistant

An authenticated chat panel that reasons over the user's vault using the same
MCP tool contract exposed to external hosts. Users provide their own Claude API
key (Settings → Claude API key); inference is billed to their Anthropic account.

## How it works

- The agent loop runs server-side (`server/services/assistant.ts`) on
  `claude-opus-4-8` with adaptive thinking.
- Tools come from the in-process MCP server via an in-memory transport, so the
  in-app assistant and external MCP hosts exercise one contract — no duplicated
  tool logic.
- The key is stored per-user in Supabase Vault behind `SECURITY DEFINER` RPCs
  scoped by `auth.uid()`, decrypted server-side only inside the loop.

## Demo: in-app vs external host parity

1. In the app, open Settings, paste a Claude API key, save.
2. In the assistant panel, ask "summarize my most recent transcript" and
   "create a note titled Recap". Observe the tool trace (`get_transcript`,
   `create_note`).
3. Point an external MCP host (bearer-JWT) at `/api/mcp` and call the same
   `get_transcript` / `create_note` tools. The results match — one contract.

## Limits (current)

- No streaming; the answer arrives as one message with a tool trace.
- One key per user; no team/shared keys, metering, or model selection.
```

- [ ] **Step 2: Add the index entry**

In `docs/product-specs/index.md`, add under the existing list:

```markdown
- [in-app-assistant.md](in-app-assistant.md) — BYO-key chat assistant over the
  MCP tool contract.
```

- [ ] **Step 3: Manual happy-path verification (browser)**

Start local services and the dev server:

Run: `cd apps/web && bunx supabase start && bun run dev`

Then, in a browser at `http://localhost:3000`:
1. Sign in. Go to `/settings`, paste a real Claude API key, save. Expect "A key is set."
2. Open the assistant panel. Ask a question over an existing note. Expect a thinking state, then an answer with a tool trace.
3. Ask it to create a note. Confirm the note appears in the library.
4. Ask it to make flashcards from a transcript. Confirm a note is created.
5. Remove the key in Settings. Ask again. Expect the "Add your Claude API key" state.
6. Re-add an invalid key (e.g. `sk-ant-bad`). Ask again. Expect the "key was rejected" state.

- [ ] **Step 4: Final gate**

Run: `bun run check` (repo root)
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add docs/product-specs/in-app-assistant.md docs/product-specs/index.md
git commit -m "docs: in-app assistant product spec + demo"
```

- [ ] **Step 6: Promote the exec plan**

Move `docs/exec-plans/queued/v2/in-app-assistant.md` to
`docs/exec-plans/completed/v2/in-app-assistant.md`, add a short retrospective +
verification note at the top, and update `docs/PLANS.md` and
`docs/exec-plans/active/v2/index.md` (mark 3 of 3 children shipped). Commit:

```bash
git add docs/exec-plans docs/PLANS.md
git commit -m "docs: promote in-app assistant plan to completed"
```

---

## Self-Review Notes

- **Spec coverage:** key storage (Task 1–2), agent loop over MCP contract (Task 3–4), key route + chat route with BYO states (Task 5–6), settings UI (Task 7), chat panel + states (Task 8), tests throughout, demo doc (Task 9). All spec sections map to a task.
- **Parity non-negotiable:** Task 3 routes every tool call through `buildMcpServer` — no business logic added to the assistant.
- **Security:** raw key only in Vault; `get_ai_api_key` is `SECURITY DEFINER` + `auth.uid()`-scoped; functions revoked from `anon`/`public`.
- **Naming consistency:** `connectMcpBridge`, `runAssistant`, `anthropicForKey`, `getDecryptedApiKey`, `hasApiKey`, `saveApiKey`, `deleteApiKey`, response `state` discriminator (`ok`/`no_api_key`/`invalid_key`/`rate_limited`/`error`) are used identically across service, routes, and UI.
