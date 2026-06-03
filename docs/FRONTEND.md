# Frontend

Conventions for the `app/` and `components/` layers.

- Next.js 16 App Router, Server Components by default; `"use client"` only where
  interactivity needs it.
- Data fetching: TanStack Query on the client (provider in
  `src/components/providers.tsx`); Server Components read via the server Supabase
  client.
- UI: Tailwind v4 + shadcn/ui (`src/components/ui/`).
- Forms: React 19 `useActionState` + server actions; validate with zod.

Status: stub — expand as the library and editor land (M2–M3).
