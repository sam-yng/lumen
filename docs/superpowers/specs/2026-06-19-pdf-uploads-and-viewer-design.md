# PDF-only Uploads & In-App PDF Viewer — Design

**Date:** 2026-06-19
**Status:** approved (brainstorm)
**Area:** library uploads, file viewing
**Exec plan:** [`pdf-uploads-and-viewer.md`](../../exec-plans/active/cross-cutting/pdf-uploads-and-viewer.md)

## Problem

Two gaps in the library import experience:

1. The generic upload dialog accepts any file type. We want to constrain it to
   the formats the product actually supports: **PDF documents** and **audio**
   (audio continues to flow into the transcription pipeline). Everything else
   (images, Office docs, archives, …) should be rejected.
2. Imported `file` nodes (PDFs) have no viewer. Opening one currently falls
   through to `canonicalNodePath` (folder navigation), so a PDF cannot be read
   in-app. We want to view PDFs in a modal using the
   [`@extend/pdf-viewer`](https://www.extend.ai/ui/docs/components/pdf-viewer)
   shadcn-registry component (EmbedPDF / PDFium backed).

## Decisions (binding)

- **Allowed upload types:** `application/pdf` and `audio/*`. All other MIME
  types are rejected.
- **Server is the authoritative gate.** The client `accept` attribute is UX
  only and is bypassable; `createUploadedFile` must reject disallowed types
  with a `ServiceError("validation", …)` → HTTP 400.
- **Audio behaviour is unchanged.** Audio uploads still branch to the
  transcription path; mic recording is untouched.
- **PDF viewing source** = the existing authenticated, user-scoped content
  route `GET /api/library/nodes/{id}/content` (streams inline). No new endpoint.
- **Trigger:** opening a `file` node whose `mime_type === "application/pdf"`
  opens the viewer modal instead of routing. Legacy non-PDF `file` nodes (from
  before this restriction) fall back to opening the content route in a new tab
  (download/native view).
- **Component:** install `@extend/pdf-viewer` via `bunx shadcn@latest add
  @extend/pdf-viewer`. Accept its footprint (`@embedpdf/*`, `@hugeicons/*`,
  `pdf-lib`, and registry deps popover/scroll-area/separator/spinner/tooltip/
  document-viewer-sidebar). Hugeicons is a new icon lib alongside lucide; this
  is accepted for this component only.

## Part A — Restrict uploads

- **Client** ([`file-upload-picker.tsx`](../../../apps/web/src/components/library/file-upload-picker.tsx)):
  add `accept="application/pdf,audio/*"`. On selection of a disallowed file,
  show an inline error and clear the input.
- **Server** ([`uploads.ts`](../../../apps/web/src/server/services/uploads.ts)):
  add a pure `isAllowedUploadMimeType(mimeType)` helper (allow `application/pdf`
  or `audio/*`, case-insensitive). `createUploadedFile` throws
  `ServiceError("validation", …)` before any storage write when the type is not
  allowed. The audio/non-audio branch is unchanged below the gate.

## Part B — PDF viewer modal

- Install the registry component into `src/components/ui/pdf-viewer.tsx` (+ its
  registry deps).
- New `PdfViewerDialog` client component wrapping the existing
  [`dialog.tsx`](../../../apps/web/src/components/ui/dialog.tsx) with large /
  near-fullscreen content, rendering `<PDFViewer src={contentUrl} />`. Dynamic
  import the viewer if SSR/WASM complains.
- Wire the dialog into the library workspace: `openNode`
  ([`library-workspace.tsx`](../../../apps/web/src/components/library/library-workspace.tsx))
  opens the dialog for PDF `file` nodes; non-PDF `file` nodes open the content
  route in a new tab.

## Risks

- **EmbedPDF is WASM/PDFium-backed.** Next 16 + Turbopack may need wasm/worker
  config or a client-only dynamic import. Primary integration risk; verify in
  the browser before declaring done.
- Bundle weight from the EmbedPDF plugin set; acceptable for an opt-in,
  lazily-mounted viewer.

## Testing

- Unit: `isAllowedUploadMimeType` allow/deny table; `createUploadedFile`
  rejects a disallowed type without writing to storage.
- Browser happy path: upload a PDF → open it → viewer renders, zoom/scroll
  work. Upload a disallowed type → rejected. Audio upload still transcribes.

## Out of scope

- Editing/annotating PDFs.
- Thumbnails in the library list.
- Migrating or converting existing non-PDF imported files.
