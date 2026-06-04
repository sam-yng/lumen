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

## Out of scope (M5)

In-transcript find, semantic/vector search, search⇄tag intersection. (Audio
playback and the transcript viewer itself ship in M4.)

Status: M5 implemented (search), integrated with the M4 transcript viewer.
