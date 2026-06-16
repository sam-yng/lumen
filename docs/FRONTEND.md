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
  per-screen specs, and interaction states. Implemented — the app is now a
  **light** theme (the 2026-06-16 light redesign replaced the original
  dark-first restyle); the 2026-06 frontend overhaul added the responsive layer
  below. Tokens keep the OKLCH structure + `@custom-variant dark` seam so a dark
  theme could be reintroduced, but no dark toggle ships today.

## Responsive conventions (2026-06 frontend overhaul)

- **Mobile-first.** Base styles target ~375px phones; enhance with `sm` (640)
  / `md` (768) / `lg` (1024). No horizontal scroll at any width ≥320px.
- **Shell:** `LibraryShell` renders the 240px (`--sidebar-w`) sidebar column only at `lg+`;
  below that the full sidebar lives in a left `Sheet` drawer
  (`components/ui/sheet.tsx`) opened by the top-bar hamburger. Any link/button
  activation inside the drawer closes it.
- **Dialogs:** `DialogContent` is a bottom sheet below `sm` and a centered
  modal at `sm+`. Every dialog's actions go through `DialogFooter` (stacked
  full-width on mobile, right-aligned row at `sm+`). Never hand-roll dialog
  footers.
- **Row actions:** list rows are a single full-width tap target plus one `⋯`
  `DropdownMenu`; selects in flows use the styled native
  `components/ui/select.tsx`. Dialogs opened from a menu item must defer one
  tick past menu teardown (see `openAfterMenuCloses` in `library-item-row.tsx`).
- **Touch targets:** the shared `Button` expands its hit area ~12px on coarse
  pointers; keep interactive controls ≥44px effective. Hover-only reveals
  (`md:opacity-0 md:group-hover:opacity-100`) always pair with
  `md:group-focus-within:opacity-100` and stay visible below `md`.
- **Type:** inputs render ≥16px below `sm` (global rule — prevents iOS focus
  zoom); mono meta gets `tabular-nums`; headings `text-wrap: balance`.
- **Motion:** tw-animate utilities on `data-[state]` with
  `motion-reduce:animate-none`.
- The assistant panel (`(app)/layout.tsx`) is hidden below `lg`; a responsive
  assistant entry point is future work.

## Library workspace (M2)

- `/library` renders `LibraryWorkspace`, a focused client component using
  TanStack Query against `/api/library` (`/` redirects to `/library`).
- Query key: `["library"]`. Every mutation invalidates that key after success.
- The workspace is a dense app surface: sidebar folder tree, current-folder
  content list, create actions, tag filter, and inline item actions. It is the
  query boundary; the chrome and pieces live in `library-shell`,
  `library-sidebar`, `library-actions`, `library-content`, `library-item-row`,
  and `tag-panel`.
- Destructive/text-entry flows use the local `dialog` primitive
  (`TextInputDialog` / `ConfirmDialog`) — never `window.prompt`/`confirm`.
- **Responsive action bars:** top-bar action buttons keep their icon at all
  widths and hide the text label below the `sm` breakpoint (`hidden sm:inline`)
  so a narrow viewport never overflows. Keep a `title`/`sr-only` label on
  icon-only controls.
- File rows are real uploads from M4 onward. Browser forms submit
  `multipart/form-data` to `/api/library/uploads`; the route stores bytes in
  private Supabase Storage and returns the created `files` row plus an optional
  `recordings` row for audio.

## Document editor (M3)

- Documents open full-page at `/library/notes/[id]` via `DocumentEditor`, with a
  "Back to library" link. Transcripts open at
  `/library/transcripts/[recordingId]`.
- TipTap runs only in a client component and uses `immediatelyRender: false` for
  Next.js hydration safety.
- Autosave calls the existing document PATCH endpoint with `contentJson`, then
  invalidates the `["library"]` query key after a confirmed save.
- Icon toolbar controls use accessible labels and keep the workspace dense.

Status: M3 editor conventions captured; upload/transcription UI arrives in M4.
The light-theme visual language (all milestones) specified in
[DESIGN.md](DESIGN.md) has shipped, including the mobile-first responsive
pass above.

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
