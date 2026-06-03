# Search & transcripts

Full-text search across notes and transcripts, plus a read-only transcript
viewer. Built in M5; reads the M1 schema (no migration).

## v1 behaviour

- **Search:** a debounced search box in the workspace sidebar queries
  `/api/search`. Postgres `websearch_to_tsquery` matches document bodies
  (`content_tsv`) and transcript bodies (`full_text_tsv`); ILIKE matches document
  titles and file names as a fallback. Results are one unified list: body (FTS)
  hits rank above name-only hits, recency breaks ties.
- **Result actions:** document → opens the editor; transcript → opens the viewer;
  file → selects its folder.
- **Transcript viewer:** read-only. Shows recording status
  (pending/processing/done/failed), duration, and any error, then ordered
  segments with `[mm:ss]` timestamps and speaker labels. Search terms are
  highlighted when opened from a transcript hit.

## Out of scope (M5)

Audio playback, in-transcript find, semantic/vector search, search⇄tag
intersection, recordings in the unified library snapshot. The `TranscriptViewer`
is exported so M4 can later add a "View transcript" button on recording rows.

Status: M5 implemented.
