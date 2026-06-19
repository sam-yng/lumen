# PDF Uploads & In-App PDF Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` before each production-code patch. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** active - implementation complete; `bun run check` + production build green; live in-browser PDF-render click-through pending (milestone human happy-path)
**Version:** cross-cutting
**Area:** library uploads, file viewing, UI components
**Created:** 2026-06-19
**Design:** [`2026-06-19-pdf-uploads-and-viewer-design.md`](../../../superpowers/specs/2026-06-19-pdf-uploads-and-viewer-design.md)

**Goal:** Constrain library uploads to PDF + audio (server-authoritative), and
let users read PDFs in-app via a modal built on the `@extend/pdf-viewer`
shadcn-registry component, sourced from the existing content route.

**Architecture:** Upload restriction lands as a pure MIME allow-list in the
service layer (`uploads.ts`) plus a client `accept` hint. PDF viewing reuses the
authenticated `GET /api/library/nodes/{id}/content` route as the viewer `src`;
the viewer is an opt-in, lazily-mounted client modal wired into `openNode`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, TanStack
Query, Supabase node services, Vitest + Testing Library, shadcn/ui, EmbedPDF.

---

## Binding Decisions

- Allowed upload MIME types: `application/pdf` and `audio/*`. All else rejected.
- Server (`createUploadedFile`) is the authoritative gate; reject before any
  storage write with `ServiceError("validation", …)`.
- Audio path and mic recording are unchanged.
- Viewer `src` = `/api/library/nodes/{id}/content` (no new endpoint).
- PDF `file` nodes open the viewer modal; legacy non-PDF `file` nodes open the
  content route in a new tab.

## Tasks

### Task 1: Server-side upload type restriction

**Files:**
- Modify: `apps/web/src/server/services/uploads.ts`
- Modify: `apps/web/src/server/services/__tests__/` (new or existing uploads test)

**Steps:**
- [ ] TDD: add `isAllowedUploadMimeType` (allow `application/pdf` or `audio/*`,
      case-insensitive) with an allow/deny table test.
- [ ] TDD: `createUploadedFile` throws `ServiceError("validation", …)` for a
      disallowed type and does NOT call `storage.upload`.
- [ ] Implement the helper and the guard at the top of `createUploadedFile`.
- [ ] `bun run check` green.

### Task 2: Client upload picker accept + inline rejection

**Files:**
- Modify: `apps/web/src/components/library/file-upload-picker.tsx`

**Steps:**
- [ ] Add `accept="application/pdf,audio/*"`.
- [ ] On disallowed selection, show inline error + clear the input.
- [ ] `bun run check` green.

### Task 3: Install `@extend/pdf-viewer`

**Files:**
- Add: `apps/web/src/components/ui/pdf-viewer.tsx` (+ registry deps)
- Modify: `apps/web/package.json` (embedpdf/hugeicons/pdf-lib deps)

**Steps:**
- [ ] Run `bunx shadcn@latest add @extend/pdf-viewer` from `apps/web`.
- [ ] Confirm registry deps resolved (popover, scroll-area, separator, spinner,
      tooltip, document-viewer-sidebar) and `bun install` clean.
- [ ] `bun run check` green (lint/format the generated files if needed).

### Task 4: PdfViewerDialog component

**Files:**
- Add: `apps/web/src/components/library/pdf-viewer-dialog.tsx`

**Steps:**
- [ ] Build a client modal wrapping `dialog.tsx` (large content), rendering
      `<PDFViewer src={contentUrl} />`; dynamic-import the viewer if needed.
- [ ] `bun run check` green.

### Task 5: Wire into library workspace open flow

**Files:**
- Modify: `apps/web/src/components/library/library-workspace.tsx`

**Steps:**
- [ ] In `openNode`: PDF `file` node → open dialog with
      `/api/library/nodes/{id}/content`; non-PDF `file` node → open content
      route in a new tab.
- [ ] `bun run check` green.

### Task 6: Browser verification

**Steps:**
- [ ] Dev server: upload a PDF → open it → viewer renders, zoom/scroll work.
- [ ] Upload a disallowed type → rejected (client + server).
- [ ] Audio upload still transcribes.
- [ ] Resolve any EmbedPDF WASM/Turbopack integration issues.

## Verification

- `bun run check` green (370 tests incl. new `uploads.test.ts`, typecheck, biome, plans).
- `bun run build` green — library route lazy-loads the EmbedPDF viewer; `@base-ui/react`
  + `@embedpdf/*` + `extend-ui/*` bundle compiles (clears the WASM/Turbopack risk).
- Pending: live in-browser PDF-render + upload-rejection click-through. Blocked from
  automation by an already-running user dev server on port 3000; left for the
  milestone human happy-path.

## Integration note

extend.ai's `pdf-viewer` is **Base UI** based, not Radix. To avoid colliding with
the app's Radix primitives, extend's Base-UI kit is isolated under
`apps/web/src/components/extend-ui/` (installed via the `@extend` registry with the
`ui`/`components` aliases temporarily repointed there). The viewer is consumed only
through `components/library/pdf-viewer-dialog.tsx`. `biome.json` relaxes a few lint
rules for `extend-ui/**` since it is vendored, clobber-safe on re-install.
