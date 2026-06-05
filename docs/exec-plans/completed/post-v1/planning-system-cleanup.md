# v2 Planning System Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `docs/exec-plans/` from v1 milestone-first planning to lifecycle-first planning, then seed the queued v2 AI/MCP planning group.

**Architecture:** Keep `docs/PLANS.md` as the single planning index. Use lifecycle folders (`queued/`, `active/`, `completed/`, `archive/`) while preserving completed v1 plan filenames as history. Add v2 as a queued grouped initiative with scoped child plans, not as one monolithic milestone.

**Tech Stack:** Markdown docs, existing `docs/exec-plans/` conventions, Node one-off docs link check, Bun workspace `bun run check`.

---

## Source Material

- Approved spec: [docs/superpowers/specs/2026-06-04-v2-planning-exec-plans-design.md](../../../superpowers/specs/2026-06-04-v2-planning-exec-plans-design.md)
- External roadmap handoff: `/Users/samy/Downloads/files/study-app-roadmap-v2-v4.md`
- Current index: `docs/PLANS.md`
- Agent map: `AGENTS.md`
- Existing active group: `docs/exec-plans/active/prod-readiness/index.md`

## File Structure

- Create: `docs/exec-plans/archive/.gitkeep` - preserves the empty archive lifecycle folder in git.
- Create: `docs/exec-plans/queued/v2-ai-mcp/index.md` - grouped v2 overview and sequencing.
- Create: `docs/exec-plans/queued/v2-ai-mcp/semantic-search.md` - queued plan stub for local embeddings, pgvector, chunking, and hybrid search.
- Create: `docs/exec-plans/queued/v2-ai-mcp/mcp-server-auth.md` - queued plan stub for MCP server transport, auth, tools/resources/prompts, and isolation tests.
- Create: `docs/exec-plans/queued/v2-ai-mcp/in-app-assistant.md` - queued plan stub for the in-app MCP client and Claude assistant surface.
- Modify: `docs/PLANS.md` - replace stale milestone-only index with lifecycle index after queued files exist.
- Modify: `AGENTS.md` - update planning map and working rule wording from "milestone" to lifecycle/grouped plans.

## Task 1: Create Lifecycle Archive Folder

**Files:**
- Create: `docs/exec-plans/archive/.gitkeep`

- [ ] **Step 1: Add the archive placeholder**

Create `docs/exec-plans/archive/.gitkeep` with this content:

```text
Preserves the archive lifecycle folder for superseded planning material.
```

- [ ] **Step 2: Verify lifecycle folder shape**

Run:

```bash
find docs/exec-plans -maxdepth 2 -type d -print | sort
```

Expected output includes:

```text
docs/exec-plans
docs/exec-plans/active
docs/exec-plans/active/prod-readiness
docs/exec-plans/archive
docs/exec-plans/completed
```

- [ ] **Step 3: Run the check gate**

Run:

```bash
bun run check
```

Expected: Biome succeeds, Turbo typecheck/test succeeds.

- [ ] **Step 4: Commit**

Run:

```bash
git add docs/exec-plans/archive/.gitkeep
git commit -m "docs(plans): add archive lifecycle folder"
```

## Task 2: Seed The Queued v2 AI/MCP Planning Group

**Files:**
- Create: `docs/exec-plans/queued/v2-ai-mcp/index.md`
- Create: `docs/exec-plans/queued/v2-ai-mcp/semantic-search.md`
- Create: `docs/exec-plans/queued/v2-ai-mcp/mcp-server-auth.md`
- Create: `docs/exec-plans/queued/v2-ai-mcp/in-app-assistant.md`

- [ ] **Step 1: Create `docs/exec-plans/queued/v2-ai-mcp/index.md`**

Create the file with:

```markdown
# v2 AI & MCP Planning Group

> **Status:** queued
> **Version:** v2
> **Area:** AI/MCP, semantic search, assistant
> **Created:** 2026-06-04
> **Depends on:** `docs/exec-plans/completed/pre-v2-cleanup.md`
> **Supersedes:** none

## Goal

Turn the Lumen vault into something an agent can reason over and act on, then
expose the same capabilities through a real MCP server usable in-app and by
external MCP hosts.

## Source Material

- Roadmap handoff: `/Users/samy/Downloads/files/study-app-roadmap-v2-v4.md`
- Architecture seams: `ARCHITECTURE.md`
- Security model: `docs/SECURITY.md`
- v1 service layer: `apps/web/src/server/services/`
- Worker seam: `apps/web/worker/`

## Child Plans

Implement these as separate plans so each can ship and be reviewed on its own:

1. `semantic-search.md` - pgvector, local embeddings,
   chunking, hybrid search, and worker indexing.
2. `mcp-server-auth.md` - TypeScript MCP server,
   Streamable HTTP transport, Supabase JWT validation, OAuth 2.1 posture, and
   user isolation tests.
3. `in-app-assistant.md` - MCP client, Claude agent loop,
   chat panel, tool-call UX, and demo docs.

## Sequencing

1. Semantic search first: the assistant and MCP tools need retrieval that can
   cite documents and transcript chunks.
2. MCP server second: wrap the v1 service layer and semantic search as MCP
   resources, tools, and prompts without adding business logic to the adapter.
3. In-app assistant third: call the same MCP server from the product UI so the
   internal assistant and external hosts exercise the same contract.

## Non-Negotiables

- The MCP server is a thin adapter over existing services.
- Every tool/resource call is scoped to the authenticated Supabase user.
- Worker/service-role paths must scope every query by `user_id`.
- Embeddings are local/free to run; do not add a per-embedding API cost.
- v2 does not include realtime transcription, diarization, collaboration, or
  production deployment hardening beyond what each child plan explicitly needs.

## Promotion Rule

Move a child plan from `queued/` to `active/` only when implementation begins.
Update `docs/PLANS.md` in the same change so the index remains trustworthy.
```

- [ ] **Step 2: Create `docs/exec-plans/queued/v2-ai-mcp/semantic-search.md`**

Create the file with:

```markdown
# Semantic Search Plan

> **Status:** queued
> **Version:** v2
> **Area:** semantic search
> **Created:** 2026-06-04
> **Depends on:** `docs/exec-plans/queued/v2-ai-mcp/index.md`
> **Supersedes:** none

## Goal

Add local embeddings and pgvector-backed hybrid search so notes and transcript
chunks can be retrieved semantically without per-embedding API cost.

## Scope

- Add a pgvector migration under `apps/web/supabase/migrations/`.
- Regenerate `apps/web/src/server/db/database.types.ts`.
- Regenerate `docs/generated/db-schema.md`.
- Define chunking for document text and transcript segments.
- Add a local embedding provider behind a small interface, likely in the worker
  path so CPU work stays out of request handlers.
- Store vectors in user-owned tables or rows that can be queried only through
  user-scoped services.
- Extend the existing search service with hybrid FTS plus vector retrieval.
- Add tests for ranking, chunk ownership, and cross-user isolation.

## Out Of Scope

- MCP tools and resources.
- In-app assistant UI.
- External AI model calls for embeddings.
- Realtime transcription, diarization, reranking, and citations beyond storing
  enough source metadata for later citation work.

## Verification Gate

- `bun run check`
- `cd apps/web && bun run docs:db-schema`
- Service tests proving user A cannot retrieve user B chunks.
- Manual search smoke test in the browser after implementation.
```

- [ ] **Step 3: Create `docs/exec-plans/queued/v2-ai-mcp/mcp-server-auth.md`**

Create the file with:

```markdown
# MCP Server And Auth Plan

> **Status:** queued
> **Version:** v2
> **Area:** MCP, auth, external integration
> **Created:** 2026-06-04
> **Depends on:** `docs/exec-plans/queued/v2-ai-mcp/semantic-search.md`
> **Supersedes:** none

## Goal

Expose Lumen through a TypeScript MCP server over Streamable HTTP, using
Supabase Auth to scope every tool, resource, and prompt to the current user.

## Scope

- Add an MCP server package or app-local server entrypoint consistent with the
  monorepo structure.
- Use the TypeScript MCP SDK and Streamable HTTP transport.
- Validate Supabase JWTs for incoming MCP requests.
- Document the OAuth 2.1 posture and any host-specific connection steps.
- Expose tools such as `search_notes`, `get_document`, `get_transcript`,
  `create_note`, `summarize_recording`, `make_flashcards`, and `list_by_tag`.
- Expose resources for documents and transcripts.
- Expose prompts for study workflows.
- Route all business operations through `apps/web/src/server/services/`.
- Add isolation tests that prove user A cannot access user B data through MCP.
- Update `docs/SECURITY.md` with the auth and tenant-isolation model.

## Out Of Scope

- Reimplementing service-layer business logic inside the MCP adapter.
- In-app chat UI.
- Realtime collaboration.
- Public unauthenticated MCP access.

## Verification Gate

- `bun run check`
- MCP handler/unit tests for auth failure, user scoping, and tool schemas.
- Manual connection notes for at least one external MCP host.
```

- [ ] **Step 4: Create `docs/exec-plans/queued/v2-ai-mcp/in-app-assistant.md`**

Create the file with:

```markdown
# In-App Assistant Plan

> **Status:** queued
> **Version:** v2
> **Area:** assistant, MCP client, product UI
> **Created:** 2026-06-04
> **Depends on:** `docs/exec-plans/queued/v2-ai-mcp/mcp-server-auth.md`
> **Supersedes:** none

## Goal

Add an in-app assistant that uses Claude plus the same MCP server exposed to
external hosts, so the product UI and external integrations exercise one tool
contract.

## Scope

- Add an authenticated chat panel in the app shell.
- Build an MCP client path for the app to call the Lumen MCP server.
- Add a Claude agent loop with strict tool-use boundaries.
- Support initial workflows: summarize a lecture, answer questions over the
  vault, generate notes, and make flashcards.
- Show tool-call progress, empty states, failures, and retry affordances.
- Keep prompts and UX copy clear that generated content should be checked.
- Add tests for assistant request routing, disabled/error states, and core UI
  interactions.
- Document the demo flow that shows in-app assistant and external MCP host
  parity.

## Out Of Scope

- New business logic outside the service layer or MCP server.
- Streaming/live transcription.
- Multi-user collaboration.
- Paid embedding APIs.

## Verification Gate

- `bun run check`
- Focused component tests for assistant UI states.
- Manual browser happy path: ask over existing notes/transcripts, create a note,
  generate flashcards, and recover from a tool failure.
```

- [ ] **Step 5: Run the check gate**

Run:

```bash
bun run check
```

Expected: Biome succeeds, Turbo typecheck/test succeeds.

- [ ] **Step 6: Commit**

Run:

```bash
git add docs/exec-plans/queued/v2-ai-mcp
git commit -m "docs(plans): queue v2 ai mcp planning"
```

## Task 3: Refresh The Planning Index And Agent Map

**Files:**
- Modify: `docs/PLANS.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Replace `docs/PLANS.md`**

Replace the full file with:

```markdown
# Plans

Execution plans live under `exec-plans/`. The folder is organized
by lifecycle, not by release number, because post-MVP work can overlap across
product, production, AI/MCP, retrieval, and docs.

## Lifecycle

- **`queued/`** - approved or drafted plans that are not yet
  being implemented.
- **`active/`** - in-flight work. Grouped initiatives may
  use an `index.md` plus child plans.
- **`completed/`** - shipped plans with retrospectives
  and verification notes.
- **`archive/`** - superseded plans or historical planning
  material that should not guide current implementation.
- **`tech-debt-tracker.md`** - known shortcuts
  and follow-ups that cut across statuses and versions.

## Queued

- **v2 AI & MCP**
  - `exec-plans/queued/v2-ai-mcp/index.md`
  - `exec-plans/queued/v2-ai-mcp/semantic-search.md`
  - `exec-plans/queued/v2-ai-mcp/mcp-server-auth.md`
  - `exec-plans/queued/v2-ai-mcp/in-app-assistant.md`

## Active

- **Production readiness**
  - `exec-plans/active/prod-readiness/index.md`
  - `exec-plans/active/prod-readiness/prod-env-and-deploy.md`
  - `exec-plans/active/prod-readiness/prod-auth.md`
  - `exec-plans/active/prod-readiness/prod-sentry.md`
  - `exec-plans/active/prod-readiness/prod-legal-pages.md`
- **Planning system cleanup**
  - `exec-plans/active/planning-system-cleanup.md`

## Completed

### v1 completed milestones

- `exec-plans/completed/m0-harness-and-scaffold.md`
- `exec-plans/completed/m1-schema-and-rls.md`
- `exec-plans/completed/m2-library.md`
- `exec-plans/completed/m3-editor.md`
- `exec-plans/completed/m4-transcription.md`
- `exec-plans/completed/m5-search-transcripts.md`
- `exec-plans/completed/m6-harden-and-document.md`

### Post-v1 cleanup and foundation

- `exec-plans/completed/design-implementation-pass.md`
- `exec-plans/completed/monorepo-migration.md`
- `exec-plans/completed/pre-v2-cleanup.md`

## Archive

No archived plans yet.
```

- [ ] **Step 2: Update the planning docs bullet in `AGENTS.md`**

Replace:

```markdown
- `docs/PLANS.md` — milestone exec-plans (active/completed).
```

with:

```markdown
- `docs/PLANS.md` — lifecycle exec-plans (queued/active/completed/archive).
```

- [ ] **Step 3: Update the first working rule in `AGENTS.md`**

Replace:

```markdown
1. Write a milestone plan to `docs/exec-plans/active/`, self-review, then build.
```

with:

```markdown
1. Write an exec plan to `docs/exec-plans/queued/` or `docs/exec-plans/active/`, self-review, then build.
```

- [ ] **Step 4: Run the check gate**

Run:

```bash
bun run check
```

Expected: Biome succeeds, Turbo typecheck/test succeeds.

- [ ] **Step 5: Commit**

Run:

```bash
git add AGENTS.md docs/PLANS.md
git commit -m "docs(plans): refresh lifecycle planning index"
```

## Task 4: Verify Planning Links And Close The Cleanup

**Files:**
- Modify: `docs/exec-plans/active/planning-system-cleanup.md`

- [ ] **Step 1: Run Markdown link verification**

Run this read-only check from the repo root:

```bash
node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const root = process.cwd();
function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".turbo", ".git"].includes(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && p.endsWith(".md")) out.push(p);
  }
  return out;
}
const files = ["AGENTS.md", "ARCHITECTURE.md", "README.md"]
  .filter((f) => fs.existsSync(path.join(root, f)))
  .map((f) => path.join(root, f))
  .concat(walk(path.join(root, "docs")));
const broken = [];
for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const re = /(?<!!)\[[^\]]+\]\(([^)]+)\)/g;
    let match;
    while ((match = re.exec(lines[i]))) {
      const raw = match[1].trim();
      if (!raw || /^(https?:|mailto:|tel:|#)/.test(raw)) continue;
      const withoutAnchor = raw.split("#")[0];
      if (!withoutAnchor) continue;
      const resolved = path.resolve(path.dirname(file), withoutAnchor);
      const exists =
        fs.existsSync(resolved) ||
        fs.existsSync(path.join(resolved, "index.md")) ||
        fs.existsSync(path.join(resolved, "README.md"));
      if (!exists) {
        broken.push({
          file: path.relative(root, file),
          line: i + 1,
          link: raw,
          resolved: path.relative(root, resolved),
        });
      }
    }
  }
}
if (broken.length > 0) {
  console.error(JSON.stringify(broken, null, 2));
  process.exit(1);
}
console.log(`Checked ${files.length} Markdown files; no broken internal links.`);
NODE
```

Expected output:

```text
Checked 35 Markdown files; no broken internal links.
```

The exact file count may be higher if additional docs land before execution, but the command must report no broken internal links.

- [ ] **Step 2: Verify generated schema remains unchanged**

Run:

```bash
(cd apps/web && bun run docs:db-schema)
git diff --exit-code docs/generated/db-schema.md
```

Expected: generator succeeds and `git diff --exit-code` exits 0.

- [ ] **Step 3: Run the check gate**

Run:

```bash
bun run check
```

Expected: Biome succeeds, Turbo typecheck/test succeeds.

- [ ] **Step 4: Add the retrospective to this plan**

Append this section to `docs/exec-plans/active/planning-system-cleanup.md`:

```markdown
## Retrospective

Completed 2026-06-04. The planning tree now uses lifecycle folders, `docs/PLANS.md`
links active and queued grouped initiatives, and v2 AI/MCP planning starts as a
queued group with separate semantic-search, MCP-server/auth, and in-app
assistant child plans. Completed v1 milestone files were preserved under their
existing names.

Verification: Markdown internal link check passed, `docs/generated/db-schema.md`
matched migrations after regeneration, and `bun run check` was green.
```

- [ ] **Step 5: Move this plan to completed**

Run:

```bash
git mv docs/exec-plans/active/planning-system-cleanup.md docs/exec-plans/completed/planning-system-cleanup.md
```

- [ ] **Step 6: Update `docs/PLANS.md` after moving this plan**

In `docs/PLANS.md`, remove this active entry:

```markdown
- **Planning system cleanup**
  - `exec-plans/active/planning-system-cleanup.md`
```

Add this bullet under "Post-v1 cleanup and foundation":

```markdown
- `exec-plans/completed/planning-system-cleanup.md`
```

- [ ] **Step 7: Run final verification**

Run:

```bash
bun run check
```

Expected: Biome succeeds, Turbo typecheck/test succeeds.

- [ ] **Step 8: Commit**

Run:

```bash
git add docs/PLANS.md docs/exec-plans/completed/planning-system-cleanup.md
git commit -m "docs(plans): complete planning system cleanup"
```

## Plan Self-Review

- **Spec coverage:** Lifecycle folders are covered by Task 1, v2 queued group
  by Task 2, `docs/PLANS.md` by Task 3, agent-facing instructions by Task 3,
  and verification/closeout by Task 4.
- **Placeholder scan:** No step uses unresolved placeholder language or
  unspecified docs content. New Markdown files have exact content.
- **Type/path consistency:** Current monorepo paths use `apps/web/` in new v2
  docs. Existing active production-readiness files are linked but not renamed
  or rewritten.
- **Scope check:** The plan is docs-only. It does not implement pgvector,
  embeddings, MCP server code, assistant UI, auth changes, or production
  readiness child plans.

## Retrospective

Completed 2026-06-04. The planning tree now uses lifecycle folders, `docs/PLANS.md`
links active and queued grouped initiatives, and v2 AI/MCP planning starts as a
queued group with separate semantic-search, MCP-server/auth, and in-app
assistant child plans. Completed v1 milestone files were preserved under their
existing names.

Verification: Markdown internal link check passed, `docs/generated/db-schema.md`
matched migrations after regeneration, and `bun run check` was green.
