# Document Paragraph Anchors Plan (v4 Milestone 1)

> **Status:** completed — shipped on branch `feat/v4-document-anchors`
> **Version:** v4
> **Area:** semantic chunking, citations, editor/notes UX
> **Created:** 2026-06-11
> **Depends on:** [`completed/v2/semantic-search.md`](../../completed/v2/semantic-search.md)
> (chunking + `semantic_search_chunks`),
> [`completed/v3/citation-experience.md`](../../completed/v3/citation-experience.md)
> (citation chips + deep-link pattern to mirror).
> **Supersedes:** none
> **Design:** spike-first — Task 1 produces the anchor-representation
> decision; if a superpowers design spec is written for it, link it here
> before build.

## Goal

Make document citations land on the **exact paragraph**: clicking a document
`[S#]` chip opens the note scrolled to (and highlighting) the cited block, the
way transcript citations already deep-link to `?segment=<id>` / `?t=<ms>`
(v3 m4). Today `GroundedDocumentSource` carries only `documentId` because v2
document chunks store no location — transcript chunks got `start_ms`/`end_ms`
for free and documents got nothing.

## Decision Spike (Task 1 — resolved 2026-06-11)

Anchor representation options. Constraint discovered in scoping: the chunker
(`services/semantic-chunking.ts`) **normalizes whitespace before chunking**
(`normalizeText` collapses `\s+`), so character offsets into chunk `content`
do not map back to the original document text as-is.

1. **Block/paragraph index** — extract document text block-by-block from the
   TipTap JSON (`services/editor-content.ts`) and record which block range
   each chunk covers. Survives whitespace normalization; maps cleanly to the
   rendered DOM (nth block). Drifts when the user inserts/removes paragraphs
   above the anchor — acceptable staleness until the next re-index on save.
2. **Persistent TipTap node ids** — add a unique-id attribute to block nodes
   (editor schema change + content migration touching every stored document).
   Most stable across edits; highest blast radius.
3. **Character offsets into extracted plain text** — requires reworking
   normalization so offsets survive extraction, and offsets shift on any edit
   above the anchor. Likely dominated by option 1; include for completeness.

Evaluation criteria: stability under realistic edits, blast radius (does it
touch stored editor content?), and how cheaply the note view can scroll to the
anchor.

**Decision:** use block/paragraph indexes. Document extraction will preserve
TipTap block boundaries and each document chunk will record the zero-based
block range it covers. Citation links will carry the start block and the note
view will scroll/highlight that rendered block. This survives whitespace
normalization, maps directly to the rendered editor, keeps transcript chunks
untouched, and avoids stored-content migrations.

**Rejected:** persistent TipTap node ids are more stable after edits but require
schema/content migration across every stored note; that blast radius is too high
for v4 m1. Character offsets are less useful because existing chunk
normalization collapses whitespace, so offsets would either drift or require a
larger extraction/chunking rewrite for weaker UX than paragraph anchors.

## Scope

- **Chunking carries anchors:** extend the document path of
  `semantic-chunking.ts` so each document `SearchChunk` records its anchor
  (per the spike decision). Transcript chunks are untouched.
- **Migration (scoped to this plan):** nullable anchor column(s) on
  `semantic_search_chunks`. Regenerate `database.types.ts` and
  `docs/generated/db-schema.md` via the existing scripts.
- **Re-chunking/backfill:** existing documents get anchors the next time they
  are indexed; add a one-shot backfill (re-index all of the user's documents)
  so old notes aren't second-class. Backfill failures degrade — anchorless
  chunks keep today's behavior.
- **Contract (additive only):** `GroundedDocumentSource` gains an optional
  anchor field; `grounded-retrieval.ts` threads it through; the MCP
  `search_notes` payload grows the same optional field. No breaking change
  for external hosts.
- **UX:** document citation chips/source cards (`components/assistant/citations.tsx`)
  link to the note route with an anchor param (mirroring `?segment=`); the
  note view scrolls to and highlights the cited block, degrading to plain
  open when the anchor is missing or stale.

## Out Of Scope

- Word-level or character-precise highlights (deferred beyond v4).
- Anchors into uploaded files (PDFs etc.) — rich-text documents only; file
  chunks don't exist today and are not added here.
- Editor features (commenting, block permalinks in the UI) beyond
  scroll-and-highlight.
- Any change to transcript citations or the `/api/search` + `SearchPanel`
  contract.

## Verification Gate

- `bun run check` green.
- Unit tests: chunker emits correct anchors for multi-block documents
  (including blocks longer than `MAX_CHUNK_CHARS` and chunks spanning
  blocks); `GroundedDocumentSource` parsing round-trips with and without the
  anchor field; anchorless chunks still produce valid citations.
- Manual happy path (working rule #3): ask the assistant a question answered
  by a long multi-paragraph note, click the document citation, and land on
  the highlighted paragraph; verify an old (pre-backfill) chunk degrades to
  opening the note.

## Retrospective (m1 complete — 2026-06-11)

**Shipped:** document semantic chunks now carry nullable paragraph/block
anchors, `GroundedDocumentSource` and the MCP `search_notes` payload expose the
anchor additively, document citation links open `/library/notes/<id>?block=<n>`,
and the note editor highlights the cited block while anchorless sources still
open the note normally. The schema migration replaces
`match_semantic_search_chunks` so document source JSON includes `anchor` only
when present.

**Verification:** `bun run check` passed on 2026-06-11 after the final patch
(Biome, plan lifecycle, typecheck, 36 Vitest files / 224 tests). Local browser
verification used the seeded demo account plus a multi-paragraph note opened at
`?block=1`; the second paragraph received the citation highlight while the
first did not. Full assistant click-through remains covered by the existing
Claude-key production gate.

**Follow-up:** no contract-breaking follow-up. Existing chunks remain
anchorless until documents are re-indexed; the one-shot reindex helper degrades
per document and can be wired to an operator/admin entry point later if needed.
