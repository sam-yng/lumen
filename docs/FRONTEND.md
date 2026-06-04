# Frontend

Conventions for the `apps/web/src/app/` and `apps/web/src/components/` layers.

- Next.js 16 App Router, Server Components by default; `"use client"` only where
  interactivity needs it.
- Data fetching: TanStack Query on the client (provider in
  `apps/web/src/components/providers.tsx`); Server Components read via the
  server Supabase client.
- UI: Tailwind v4 + shadcn/ui (`apps/web/src/components/ui/`). Shared design
  tokens live in `packages/ui` and are consumed as `@lumen/ui/tokens.css`.
- Forms: React 19 `useActionState` + server actions; validate with zod.
- Visual language: see [DESIGN.md](DESIGN.md) for the full token system,
  per-screen specs, and interaction states. **Not yet implemented** — the dark
  theme restyle is a deferred pass after v1's functional milestones; current
  components still use the default shadcn neutral palette.

## Library workspace (M2)

- The protected `/` page renders `LibraryWorkspace`, a focused client component
  using TanStack Query against `/api/library`.
- Query key: `["library"]`. Every mutation invalidates that key after success.
- The workspace is a dense app surface: sidebar folder tree, current-folder
  content list, metadata creation forms, tag filter, and inline item actions.
- File rows are real uploads from M4 onward. Browser forms submit
  `multipart/form-data` to `/api/library/uploads`; the route stores bytes in
  private Supabase Storage and returns the created `files` row plus an optional
  `recordings` row for audio.

## Document editor (M3)

- Documents open inside the library workspace via `DocumentEditor`; no separate
  editor route exists in v1 yet.
- TipTap runs only in a client component and uses `immediatelyRender: false` for
  Next.js hydration safety.
- Autosave calls the existing document PATCH endpoint with `contentJson`, then
  invalidates the `["library"]` query key after a confirmed save.
- Icon toolbar controls use accessible labels and keep the workspace dense.

Status: M3 editor conventions captured; upload/transcription UI arrives in M4.
The dark-theme visual restyle (all milestones) is specified in
[DESIGN.md](DESIGN.md) and deferred to a post-v1 pass.

## Uploads and transcripts (M4)

- The library snapshot includes `recordings`; file rows with a matching
  recording show the transcription status badge.
- Uploading an audio file or saving a `MediaRecorder` capture creates a
  `pending` recording and enqueues local transcription.
- `TranscriptViewer` opens inside the workspace. It fetches
  `/api/library/transcripts/:recordingId`, shows pending/processing/failed/done
  states, retries failed recordings, and uses a real `<audio>` element against
  `/api/library/files/:id`.
- Completed transcripts render ordered timestamp segments; clicking a segment
  seeks the audio element to that segment start.

## Search (M5)

- `SearchPanel` (sidebar) queries `/api/search` with TanStack Query key
  `["search", q]`, debounced 250ms, enabled only for non-empty queries. It owns
  its own key and never touches `["library"]`.
- Results are one ranked list across document bodies + transcript bodies (FTS)
  and document titles + file names (ILIKE fallback). Match highlighting lives in
  `apps/web/src/components/search/highlight.tsx`.
- Result actions reuse the existing workspace panels: a document hit opens the
  `DocumentEditor`; a transcript hit opens M4's `TranscriptViewer` (looked up by
  `recordingId` from the snapshot); a file hit selects its folder.
- Search results intentionally remain visible while a changed query refetches
  (no flicker); a refresh indicator is a deferred polish item.

Status: M5 search conventions captured; transcript viewing reuses the M4 viewer.
