# Frontend

Conventions for the `app/` and `components/` layers.

- Next.js 16 App Router, Server Components by default; `"use client"` only where
  interactivity needs it.
- Data fetching: TanStack Query on the client (provider in
  `src/components/providers.tsx`); Server Components read via the server Supabase
  client.
- UI: Tailwind v4 + shadcn/ui (`src/components/ui/`).
- Forms: React 19 `useActionState` + server actions; validate with zod.

## Library workspace (M2)

- The protected `/` page renders `LibraryWorkspace`, a focused client component
  using TanStack Query against `/api/library`.
- Query key: `["library"]`. Every mutation invalidates that key after success.
- The workspace is a dense app surface: sidebar folder tree, current-folder
  content list, metadata creation forms, tag filter, and inline item actions.
- File rows are metadata-only in M2; do not add browser upload controls until the
  M4 Storage boundary lands.

Status: M2 library conventions captured; editor-specific conventions arrive in
M3.
