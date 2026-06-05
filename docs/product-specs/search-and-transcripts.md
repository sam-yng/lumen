# Search & transcripts

Full-text search across notes and transcripts. Built in M5; reads the M1 schema
(no migration). Transcript viewing reuses the M4 `TranscriptViewer`.

## v1 behaviour

- **Search:** a debounced search box in the workspace sidebar queries
  `/api/search`. Postgres `websearch_to_tsquery` matches document bodies
  (`content_tsv`) and transcript bodies (`full_text_tsv`); ILIKE matches document
  titles and file names as a fallback. Results are one unified list: body (FTS)
  hits rank above name-only hits, recency breaks ties.
- **Result actions (reuse existing workspace panels):** a document hit opens the
  `DocumentEditor`; a transcript hit opens the M4 `TranscriptViewer` (the result
  carries `recordingId`, looked up against the snapshot's `recordings`); a file
  hit selects its folder.
- **Transcript viewing** is the M4 viewer: recording status, `<audio>` playback,
  and click-to-seek segments. M5 adds the search entry point into it.

## v2 semantic-search foundation

Semantic search is now available in the service layer behind an explicit local
embedding provider. The default `/api/search` route still uses the v1 FTS path,
so request handlers do not do CPU embedding work unless a caller opts in.

- **Storage:** semantic retrieval reads user-owned rows from
  `semantic_search_chunks`. Chunks point back to documents or transcripts,
  include enough source metadata for later citations, and store pgvector
  embeddings plus a chunk-level FTS column.
- **Indexing:** document and transcript write services can refresh chunks when
  a provider is passed through dependency injection. Existing callers remain
  default-free; tests use the deterministic local provider.
- **Hybrid service search:** `searchLibrary` can merge body FTS, semantic chunk
  hits, and title/file fallback results. FTS body/transcript hits remain first,
  semantic hits rank ahead of title/file-only hits, and result shapes remain
  compatible with the current search panel.

## Out of scope (M5)

In-transcript find and search⇄tag intersection. (Audio playback and the
transcript viewer itself ship in M4.) Semantic/vector search is no longer M5
scope; its v2 service foundation is described above.

Status: M5 implemented (search), integrated with the M4 transcript viewer.
