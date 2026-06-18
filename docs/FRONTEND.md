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

## Library workspace (node tree)

- The Library roots at `/`; `/{workspaceSlug}` renders a workspace and
  `/{workspaceSlug}/{nodeSlug}` renders a node. All three mount the same
  `LibraryWorkspace` client component, a focused boundary using TanStack Query
  against the `/api/library` snapshot. Legacy `/library/**` URLs redirect to `/`.
- Navigation and content are a single `library_nodes` tree (`workspace`, `page`,
  `file`, `audio` kinds nested by `parent_id`). The shell resolves the selected
  workspace/node from the route slugs and renders children by `parent_id`; root
  `/` lists workspace nodes, a workspace route lists that workspace's children.
- Query key: `["library"]`. Every mutation invalidates that key after success.
- The workspace is a dense app surface: sidebar node tree (workspaces + nested
  pages, with pinned containers above the Library section), current-node content
  list, create actions, tag filter, and inline item actions. It is the query
  boundary; the chrome and pieces live in `library-shell`, `library-sidebar`,
  `library-actions`, `library-content`, `library-item-row`, and `tag-panel`.
- **First run:** when the snapshot has no `workspace` node, a blocking
  `Create a workspace` Dialog is shown; submitting calls `createWorkspace` and
  navigates to `/{workspaceSlug}`.
- **Selection + bulk actions:** desktop rows support single click, Ctrl/Cmd
  toggle, and Shift range selection; double-click opens. A `LibraryItemActions`
  bar exposes Move / Delete / Clear, disabled while busy, with a blocking
  loading overlay during bulk delete.
- Destructive/text-entry flows use the local `dialog` primitive
  (`TextInputDialog` / `ConfirmDialog`) — never `window.prompt`/`confirm`.
- **Responsive action bars:** top-bar action buttons keep their icon at all
  widths and hide the text label below the `sm` breakpoint (`hidden sm:inline`)
  so a narrow viewport never overflows. Keep a `title`/`sr-only` label on
  icon-only controls.
- File and audio rows are real uploads. Browser forms submit
  `multipart/form-data` to `/api/library/uploads`; the route stores bytes in
  private Supabase Storage and creates a `file`/`audio` `library_nodes` row (plus
  an optional `recordings` row for audio).

## Page editor

- Page nodes open full-page at `/{workspaceSlug}/{nodeSlug}` via `DocumentEditor`,
  which consumes a `page` `library_nodes` row. Audio nodes render the transcript
  viewer at the same node route.
- TipTap runs only in a client component and uses `immediatelyRender: false` for
  Next.js hydration safety.
- Autosave PATCHes the node via `/api/library/nodes/:id` (`updateNode` →
  `updateLibraryNode`) with `contentJson`, then invalidates the `["library"]`
  query key after a confirmed save.
- Icon toolbar controls use accessible labels and keep the workspace dense.

Status: M3 editor conventions captured; upload/transcription UI arrives in M4.
The light-theme visual language (all milestones) specified in
[DESIGN.md](DESIGN.md) has shipped, including the mobile-first responsive
pass above.

## Uploads and transcripts (M4)

- The library snapshot includes `recordings`; audio nodes with a matching
  recording show the transcription status badge.
- Uploading an audio file or saving a `MediaRecorder` capture creates an `audio`
  node, a `pending` recording (`node_id`), and enqueues local transcription.
- `TranscriptViewer` opens inside the workspace. It fetches
  `/api/library/transcripts/:recordingId`, shows pending/processing/failed/done
  states, retries failed recordings, and uses a real `<audio>` element against
  the node content route `/api/library/nodes/:id/content`.
- Completed transcripts render ordered timestamp segments; clicking a segment
  seeks the audio element to that segment start.

## Search (M5)

- `SearchPanel` (sidebar) queries `/api/search` with TanStack Query key
  `["search", q]`, debounced 250ms, enabled only for non-empty queries. It owns
  its own key and never touches `["library"]`.
- Results are one ranked list across page bodies + transcript bodies (FTS)
  and page/file/audio node titles (ILIKE fallback). Match highlighting lives in
  `apps/web/src/components/search/highlight.tsx`.
- Result actions reuse the existing workspace panels: a page hit opens the
  `DocumentEditor`; a transcript hit opens the `TranscriptViewer` (looked up by
  `recordingId` from the snapshot); a file hit selects its parent node.
- Search results intentionally remain visible while a changed query refetches
  (no flicker); a refresh indicator is a deferred polish item.

Status: M5 search conventions captured; transcript viewing reuses the M4 viewer.
