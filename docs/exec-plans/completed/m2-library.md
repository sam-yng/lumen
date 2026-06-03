# M2 - Library Implementation Plan

> **For agentic workers:** Milestone-level plan. M2 introduces the first real
> workspace surface: folders, document/file metadata, and tags. Actual file
> bytes, Supabase Storage, audio recordings, and transcription remain M4.

**Goal:** Build a RLS-scoped library workspace with folder tree, document CRUD,
metadata-only file CRUD, tagging, service layer, route handlers, and TanStack
Query UI.

**Architecture:** Use a unified library snapshot service for reads, plus focused
mutation services for folders, documents, file metadata, tags, and tag links.
Route handlers authenticate, validate with zod, and delegate to services. The
protected home page becomes a client Query workspace that renders the tree,
current folder contents, tag filters, and CRUD controls.

**Tech Stack:** Next.js 16 App Router route handlers, React 19, TanStack Query,
Supabase user-scoped client, zod, Vitest, Tailwind v4 + shadcn/ui.

---

## Definition of done

- [ ] `src/server/services/*` contains framework-agnostic library services that
      take `{ userId, supabase }`, write `user_id` explicitly, and enforce
      user-scoped folder/tag/link checks before mutations.
- [ ] Route handlers under `src/app/api/library/**/route.ts` validate input,
      authenticate with `createServerSupabase()`, call services, and return
      typed JSON/errors.
- [ ] The protected `/` route renders a real library workspace with a sidebar
      tree, folder selection, folder/document/file metadata CRUD, tag creation,
      tag assignment/removal, and tag filtering.
- [ ] Files in M2 are metadata-only records (`name`, `mime_type`, `size_bytes`,
      `kind`, `folder_id`, `storage_key`). Actual binary upload and Storage
      integration are deferred to M4.
- [ ] Service tests cover scoping, validation-sensitive moves/links, CRUD
      behavior, and duplicate/foreign-resource failures.
- [ ] `bun run check` is green after each patch; the manual browser happy path
      works with the seeded demo user.
- [ ] Plan moves to `docs/exec-plans/completed/` with a short retrospective;
      pause for review at the milestone boundary.

---

## Design decisions

1. **Unified read model:** `getLibrarySnapshot()` returns folders, documents,
   files, tags, and tag links in one RLS-scoped payload. The UI gets a coherent
   workspace view without duplicating join logic across components.
2. **Focused mutations:** create/update/delete operations stay resource-specific
   so validation stays small and later MCP tools can expose predictable service
   methods.
3. **Folder moves are guarded:** services reject a folder move into itself or any
   descendant. Moving an item to `null` means the library root.
4. **Delete behavior follows schema:** deleting a folder cascades child folders
   and nulls document/file `folder_id` through database constraints. The service
   presents this clearly in UI copy rather than inventing extra cascade logic.
5. **Documents are title-only in M2:** create/update/delete and folder placement
   land now. TipTap JSON editing, autosave, and plain-text derivation are M3.
6. **File metadata only:** M2 can create and manage file records with synthetic
   `storage_key` values. M4 replaces the create flow with real upload while
   preserving the same library list and tagging surfaces.
7. **Tags are reusable labels:** users create tags once, then link/unlink them to
   documents, files, and recordings. M2 UI links tags to documents and files;
   recording links become visible once M4 creates recordings.

---

## File structure

- Create: `src/server/services/context.ts` - authenticated service context type
  and shared Supabase table type helpers.
- Create: `src/server/services/errors.ts` - typed service errors converted by
  route handlers into HTTP responses.
- Create: `src/server/services/library.ts` - unified snapshot read model.
- Create: `src/server/services/folders.ts` - folder create/rename/move/delete.
- Create: `src/server/services/documents.ts` - M2 document create/rename/move/delete.
- Create: `src/server/services/files.ts` - metadata-only file create/update/move/delete.
- Create: `src/server/services/tags.ts` - tag CRUD and tag link/unlink.
- Create: `src/server/services/__tests__/*.test.ts` - service-layer Vitest
  coverage with a typed fake Supabase client.
- Create: `src/app/api/library/**/route.ts` - route handlers for snapshot and
  mutations.
- Create: `src/app/api/library/http.ts` - auth, JSON parsing, and service-error
  response helpers for route handlers.
- Create: `src/components/library/*` - client workspace, API client, query keys,
  sidebar tree, item list, dialogs/forms, tag controls.
- Modify: `src/app/(app)/page.tsx` - replace placeholder with the library workspace.
- Modify: `src/app/(app)/layout.tsx` - tune app shell spacing for dense workspace use.
- Modify: `docs/product-specs/library-and-notes.md` - replace stub with M2/M3
  behavior notes and the M2 file-metadata boundary.
- Modify: `docs/FRONTEND.md` - capture TanStack Query + library UI conventions
  introduced in M2.

---

## Implementation phases

### Phase 1 - Service foundation

- [ ] Add service context and error helpers.
- [ ] Write failing service tests for library snapshot scoping and folder move
      cycle rejection.
- [ ] Implement `getLibrarySnapshot()` and folder CRUD/move services.
- [ ] Run `bun run check`; keep it green.
- [ ] Commit: `feat(m2): add library service foundation`.

### Phase 2 - Document and file metadata services

- [ ] Write failing tests for document create/rename/move/delete.
- [ ] Implement document services with M3 editor fields left nullable.
- [ ] Write failing tests for metadata-only file create/update/move/delete.
- [ ] Implement file services with deterministic storage-key generation.
- [ ] Run `bun run check`; keep it green.
- [ ] Commit: `feat(m2): add document and file metadata services`.

### Phase 3 - Tag services

- [ ] Write failing tests for tag create/rename/delete and duplicate handling.
- [ ] Write failing tests for tag link/unlink, including foreign target rejection.
- [ ] Implement tag services for documents and files in M2, preserving the
      recording target type for M4.
- [ ] Run `bun run check`; keep it green.
- [ ] Commit: `feat(m2): add tag services`.

### Phase 4 - Route handlers

- [ ] Add route helper for authentication, body parsing, zod validation, and
      service-error mapping.
- [ ] Add snapshot, folder, document, file, tag, and tag-link handlers under
      `src/app/api/library/**`.
- [ ] Add targeted route tests where behavior is not already covered by service
      tests.
- [ ] Run `bun run check`; keep it green.
- [ ] Commit: `feat(m2): expose library route handlers`.

### Phase 5 - TanStack Query workspace UI

- [ ] Add client API functions and query keys.
- [ ] Build the workspace shell: sidebar folder tree, root/folder selection,
      current-folder item list, and tag filter.
- [ ] Build forms/dialogs for folder, document, file metadata, and tag actions.
- [ ] Add optimistic or post-mutation invalidation for every mutation.
- [ ] Include loading, empty, and error states without expanding M6 hardening
      beyond what the workspace needs to be usable.
- [ ] Run `bun run check`; keep it green.
- [ ] Commit: `feat(m2): build library workspace UI`.

### Phase 6 - Docs, manual happy path, closeout

- [ ] Update product/frontend docs with M2 behavior and deferred M4 upload scope.
- [ ] Run `bun run check`.
- [ ] Start `bun run dev` and manually verify with `demo@lumen.test` /
      `demo12345`: create folder, create document, create file metadata, create
      tag, assign/remove tag, filter by tag, rename/move/delete items.
- [ ] Move this plan to `docs/exec-plans/completed/m2-library.md` with a short
      retrospective.
- [ ] Commit: `docs(m2): close library milestone`.
- [ ] Pause for review.

---

## Self-review

- **Scope check:** The plan implements M2 only. TipTap editing stays M3; file
  bytes, Storage, recordings, worker, and transcription stay M4; search stays M5.
- **Architecture check:** Services are framework-agnostic and remain suitable for
  later MCP exposure. Route handlers are thin validation/auth adapters.
- **Security check:** Services always write `user_id`; Supabase requests use the
  cookie-bound publishable-key client, so RLS remains the security boundary.
- **Testing check:** Each behavior phase starts with failing service tests before
  production code. Route/UI tests stay focused on behavior not already covered by
  services.
- **Docs check:** The product spec and frontend docs are updated in the same
  milestone as the code they describe.

---

## Retrospective

M2 shipped the unified library read model, framework-agnostic services, thin
route handlers, and a TanStack Query workspace UI. Files are deliberately
metadata-only; upload/storage/audio work remains M4.

Manual browser verification with the seeded demo user covered login, folder
creation, document creation, file metadata creation, tag creation, tag attach,
tag filtering, tag unlink, moving a document into a folder, and deleting file
metadata. The UI gained accessible names for icon-only controls during manual
testing, which made the workspace easier to operate and verify.

One implementation note for M3/M4: the library snapshot is now the stable client
read model. Future editor/upload work should extend the existing services and
query invalidation path rather than inventing separate client-side stores.
