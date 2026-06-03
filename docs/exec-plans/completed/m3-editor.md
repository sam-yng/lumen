# M3 - Editor Implementation Plan

> **For agentic workers:** Milestone-level plan. M3 turns M2 document records
> into editable rich-text notes. It does not add search UI, uploads,
> transcription, recordings, or AI/MCP features.

**Goal:** Add a TipTap editor for documents with debounced autosave, persisted
TipTap JSON, and derived plain text in `documents.content_text`.

**Architecture:** Extend the existing M2 document service, route handler, and
TanStack Query workspace rather than adding a parallel editor store. The
workspace keeps the folder/list/tag model, and selecting a document opens an
editor panel that saves through the existing authenticated document route. Plain
text is derived server-side from the submitted TipTap JSON so search-facing data
is not trusted to client code.

**Tech Stack:** Next.js 16 App Router, React 19, TanStack Query, TipTap
(`@tiptap/react`, StarterKit, Placeholder, Link, Table, TaskList), Supabase
user-scoped client, zod, Vitest, Tailwind v4 + shadcn/ui.

---

## Definition of done

- [ ] TipTap dependencies are installed and checked into `package.json` /
      `bun.lock`.
- [ ] Document services support content updates: `content_json` TipTap JSON and
      derived `content_text` plain text.
- [ ] Route handlers validate rich-text update input and continue to map service
      errors cleanly.
- [ ] The library workspace lets users open a document editor from the document
      list without leaving the protected shell.
- [ ] The editor provides basic rich-text controls, placeholder text, link/task
      support from the configured extensions, debounced autosave, visible save
      state, and unsaved-change protection by continuing to save on content
      changes.
- [ ] Tests cover plain-text derivation and document content updates.
- [ ] `bun run check` is green after each patch; manual browser happy path
      verifies create/open/edit/autosave/reload.
- [ ] Plan moves to `docs/exec-plans/completed/` with a short retrospective;
      pause for review at the milestone boundary.

---

## Design decisions

1. **Editor lives inside the library workspace.** M3 keeps students oriented in
   their folder context and avoids a new route surface before M4/M5 add more
   media/search views.
2. **Autosave uses the existing document route.** `PATCH /api/library/documents/:id`
   accepts title/folder updates from M2 and gains content updates for M3. The
   client invalidates the library snapshot after confirmed saves.
3. **Server derives `content_text`.** Client sends only TipTap JSON. The service
   extracts readable text from the JSON document and writes both fields in one
   update, keeping FTS input deterministic.
4. **Seeded plain-text documents get a default TipTap document.** If
   `content_json` is null, the editor initializes with a paragraph using
   `content_text` when present, otherwise an empty document.
5. **No search/editor deep links yet.** Search lands in M5. M3 only needs an
   ergonomic in-workspace editor and durable content persistence.

---

## File structure

- Modify: `package.json`, `bun.lock` - add TipTap runtime dependencies.
- Create: `src/server/services/editor-content.ts` - TipTap JSON guards and
  plain-text extraction.
- Modify: `src/server/services/documents.ts` - accept content JSON updates and
  derive `content_text`.
- Modify: `src/server/services/__tests__/library.test.ts` - add document content
  update coverage.
- Modify: `src/app/api/library/documents/[id]/route.ts` - validate `contentJson`
  in the document PATCH schema.
- Modify: `src/components/library/library-api.ts` - expose document content
  updates and shared document update types.
- Create: `src/components/editor/document-editor.tsx` - TipTap editor,
  toolbar, save state, and debounced save.
- Modify: `src/components/library/library-workspace.tsx` - document open state
  and editor panel integration.
- Modify: `docs/product-specs/library-and-notes.md` - mark M3 editor behavior.
- Modify: `docs/FRONTEND.md` - capture editor UI/autosave conventions.
- Modify: `docs/references/tiptap-llms.txt` - replace the M3 stub with the
  installed extension set and local usage notes.

---

## Implementation phases

### Phase 1 - Dependencies and service contract

- [ ] Add TipTap dependencies from the v1 brief:
      `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`,
      `@tiptap/extension-placeholder`, `@tiptap/extension-link`,
      `@tiptap/extension-table`, `@tiptap/extension-table-row`,
      `@tiptap/extension-table-cell`, `@tiptap/extension-table-header`,
      `@tiptap/extension-task-list`, `@tiptap/extension-task-item`.
- [ ] Write failing tests for TipTap JSON plain-text derivation and document
      content persistence.
- [ ] Implement `editor-content.ts` and extend `updateDocument()`.
- [ ] Run `bun run check`; keep it green.

### Phase 2 - Route/API content updates

- [ ] Extend the document PATCH zod schema with `contentJson`.
- [ ] Extend `library-api.ts` document update inputs with `contentJson`.
- [ ] Run `bun run check`; keep it green.

### Phase 3 - Editor UI

- [ ] Build `DocumentEditor` as a client component with TipTap extensions,
      toolbar buttons, placeholder, initial JSON fallback, and debounced save.
- [ ] Integrate document selection into `LibraryWorkspace` with an editor panel
      beside/below the current folder list.
- [ ] Keep M2 item actions available; add an explicit Open/Edit document action
      with accessible labels.
- [ ] Run `bun run check`; keep it green.

### Phase 4 - Docs, manual happy path, closeout

- [ ] Update product/frontend/reference docs for M3.
- [ ] Run `bun run check`.
- [ ] Start `bun run dev` and manually verify with `demo@lumen.test` /
      `demo12345`: create/open a document, type rich text, observe autosave
      state, reload, confirm content persists, and confirm `content_text` is
      derived through the API/service path.
- [ ] Move this plan to `docs/exec-plans/completed/m3-editor.md` with a short
      retrospective.
- [ ] Commit with a conventional M3 message.
- [ ] Pause for review.

---

## Self-review

- **Scope check:** M3 only edits documents. Search stays M5; uploads,
  recordings, storage, worker, and transcription stay M4; no AI/MCP surface is
  added.
- **Architecture check:** The existing service/route/Query seams are extended,
  preserving the M2 library snapshot as the stable read model.
- **Security check:** Document updates remain `user_id` scoped in the service
  and route handlers still use the cookie-bound Supabase client.
- **Testing check:** Plain-text derivation and persistence are covered at the
  service layer before production code changes.
- **Docs check:** Product, frontend, TipTap reference notes, and the milestone
  plan are updated in the same change as the editor.

---

## Retrospective

M3 shipped the TipTap editor in the existing library workspace. Document content
now saves through the M2 document route with `contentJson`, and the service
derives `content_text` server-side for the future M5 full-text search path.

Manual browser verification covered demo login, document creation, opening the
editor, keyboard editing, autosave, API confirmation that `content_text` was
derived, reload, and reopening the saved content. The in-app browser could load
the app but hit input-helper limitations, so the final happy path used headless
Playwright against the same local dev server.

One implementation note for M4/M5: the library snapshot remains the shared read
model. Search can now rely on `documents.content_text` being populated by editor
saves; upload/transcription should keep using the same service/route/Query
seams.
