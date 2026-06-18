# Architecture

Lumen is a multi-tenant study workspace: nested workspaces and pages, rich-text
notes, file and audio uploads, local CPU transcription, transcript viewing,
tagging, and full-text search. Navigation and content live in a single
`library_nodes` tree (see Data model). This document covers the high-level
system and — importantly — the seams that let the v2+ AI/MCP layer drop in
without a rewrite.

## Stack

- **Runtime/tooling:** Bun workspaces + Turborepo.
- **Framework:** Next.js 16 (App Router, `apps/web/src/`) + React 19 +
  TypeScript strict.
  - Note: Next 16 renamed the `middleware` convention to **`proxy`** — see
    `apps/web/src/proxy.ts`.
- **Backend:** Supabase — Postgres + Auth + Storage + Row-Level Security, run
  locally via the Supabase CLI (Docker). Schema lives in SQL migrations under
  `apps/web/supabase/migrations/`; types are generated, never hand-edited.
- **Lint/format:** Biome at the workspace root. **Typecheck/tests:** Turbo runs
  package tasks (`tsc --noEmit`, Vitest). See [BACKPRESSURE.md](BACKPRESSURE.md).
- **UI:** Tailwind v4 + shadcn/ui, with shared CSS tokens in `packages/ui`.
  **Client data:** TanStack Query.
- **Validation:** zod (all API input + env config).
- **Editor (M3):** TipTap. **Queue/worker (M4):** pg-boss + a separate worker
  process running `nodejs-whisper`.

## Layers

```
apps/web/src/app/ (routes, UI) -> apps/web/src/server/services/* -> Supabase (RLS)
              ^                              ^
       thin route handlers              authenticated context
       + server actions                 (user_id + user-scoped client)
```

- **`apps/web/src/app/`** — App Router routes, Server Components, server
  actions, Route Handlers. Kept thin: validate input (zod), call a service.
- **`apps/web/src/server/services/*`** *(introduced in M2)* —
  framework-agnostic domain operations. Each takes an **authenticated context**
  (the user's id + a user-scoped Supabase client) and enforces per-user scoping.
  They must be callable outside an HTTP request.
- **`apps/web/src/server/db/`** — Supabase client factories (`client.ts`) and
  generated types.
- **`apps/web/src/server/config/env.ts`** — the single zod-validated env access
  point.
- **`packages/ui`** — shared design tokens only. It exports
  `@lumen/ui/tokens.css` and must stay independent from app code.
- **`apps/marketing`** — the public marketing site (port 3001): a
  dependency-light Next.js App Router app that renders a static landing page
  with metadata, `robots.txt`, and `sitemap.xml`. It consumes `@lumen/ui`
  tokens and links out to the app, but holds no Supabase client, service layer,
  or user data — so it shares no isolation boundary with `apps/web`.

## Seams for v2+ (do not violate)

These boundaries exist so later milestones plug in cleanly:

1. **Service layer.** In v2 the MCP server exposes the *same* services as tools.
   They already take an authenticated context and enforce scoping, so they work
   outside an HTTP request unchanged.
2. **`TranscriptionProvider` interface** *(M4)*. `nodejs-whisper` is the v1
   implementation and stays the batch default. v3 m2 added the **separate**
   `StreamingTranscriptionProvider` seam
   (`apps/web/src/lib/transcription/streaming-provider.ts`) for live capture:
   inference runs in the browser (Transformers.js Whisper in a Web Worker,
   WebGPU→WASM) and only finalized text segments reach the server via the
   live-session service (`server/services/live-sessions.ts`), which finalizes
   through the same `writeRecordingTranscript` path as batch jobs.
3. **`StorageProvider` interface** *(M4)*. Supabase Storage is the v1
   implementation; the backend can be swapped without touching callers.

**Shipped in v2** (the seams above held — no rewrite): vector/semantic search +
local embeddings (`semantic_search_chunks` + pgvector, hybrid FTS+semantic
retrieval in `search.ts`), and the MCP server (`apps/web/src/app/api/mcp/`)
exposing the v1 service layer over Streamable HTTP with bearer-JWT auth. The
service-layer client gained `.rpc()` and `.in()` (`services/context.ts`) — test
fakes must implement both. The proxy treats `/api/mcp` as a public prefix
(bearer-authenticated by the route, not the cookie session); see
[docs/SECURITY.md](docs/SECURITY.md).

**Shipped in v3 m2:** live/streaming transcription (browser-side Whisper, live
sessions behind `recording_status = 'live'`, finalized into the standard
recordings/transcripts pipeline).

**Shipped in v3 m3:** batch speaker diarization. A `DiarizationProvider` seam
(`apps/web/worker/diarization-provider.ts`) with a sherpa-onnx implementation
(pyannote segmentation-3.0 + 3D-Speaker embedding, local ONNX via
`bun run worker:diarization-models`). The worker diarizes the audio *before*
transcription (Whisper deletes its WAV input when done), then assigns each
segment the speaker turn with the largest time overlap
(`worker/speaker-merge.ts`). Env-gated by `DIARIZATION_ENABLED`; any
diarization error degrades to `speaker: null` and the job still completes.
The live path never labels speakers.

**Shipped in the navigation node tree (cross-cutting):** the old
folder/document/file navigation model was replaced by a single `library_nodes`
tree — `workspace`, `page`, `file`, and `audio` kinds nested by `parent_id` and
rooted on a `workspace_id`. The Library now roots at `/`, with workspace pages at
`/{workspaceSlug}` and node pages at `/{workspaceSlug}/{nodeSlug}`; legacy
`/library/**` URLs redirect to `/`. Workspaces and container pages can be
pinned. Recording, transcript, semantic-chunk, and tag-link rows attach to a
node via `node_id` (recordings/audio nodes one-to-one); page bodies live on the
node itself (`content_json` + a generated `content_tsv`). The migration was a
destructive current-dev reset (product-owner approved) that seeded one
`Imported workspace` per existing profile. Services, upload/live-session routes,
search, assistant retrieval, MCP, and both workers were retargeted to node IDs;
external MCP tool names and citation payloads stayed stable.

**Still not built** (clean boundaries, not placeholders): realtime collaboration.

## Security

RLS is the security boundary. The transcription worker runs with the service
role and **bypasses RLS**, so it must scope every query by `user_id` manually.
See [docs/SECURITY.md](docs/SECURITY.md).

## Data model

The navigation/content tree is `library_nodes` (kinds `workspace`, `page`,
`file`, `audio`); `recordings.node_id`, `semantic_search_chunks.node_id` (for
`source_type = 'page'`), and `tag_links.node_id` reference it, while
`recordings`/`transcripts`/`transcript_segments` remain domain tables attached to
audio nodes. Generated from migrations:
[docs/generated/db-schema.md](docs/generated/db-schema.md).
