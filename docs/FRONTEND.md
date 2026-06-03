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

## Document editor (M3)

- Documents open inside the library workspace via `DocumentEditor`; no separate
  editor route exists in v1 yet.
- TipTap runs only in a client component and uses `immediatelyRender: false` for
  Next.js hydration safety.
- Autosave calls the existing document PATCH endpoint with `contentJson`, then
  invalidates the `["library"]` query key after a confirmed save.
- Icon toolbar controls use accessible labels and keep the workspace dense.

Status: M3 editor conventions captured; upload/transcription UI arrives in M4.
