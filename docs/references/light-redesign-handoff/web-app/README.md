# Lumen Web App — UI kit

A high-fidelity, interactive recreation of the **Lumen study workspace**, redesigned
from the shipped dark theme to a clean, Notion-inspired **light theme** with skinnier
chrome (240px sidebar, ~44px top bar, 29px rows, 32px controls).

Open `index.html` for the click-through. It boots on the **auth screen**; sign in to
enter the workspace, then:

- **Sidebar** — wordmark, New note + search, nav (Library / Recents / Tags / Ask Lumen),
  recursive folder tree (click to select & expand), tags, and the user footer.
- **Library** — breadcrumb top bar, folder title + mono item count, tag filter chips,
  and grouped rows (Folders, Notes & files) with status badges and tag pills.
- **Note editor** — open any note: TipTap-style toolbar, autosave "Saved" dot, and a
  Newsreader reading surface.
- **Transcript viewer** (the signature view) — open `week-08.m4a`: round accent
  play/pause, a 130-bar waveform with a glowing playhead (click to seek), rate toggle,
  and timestamped segments that highlight + auto-scroll as the fake clock advances.

## Files
- `index.html` — orchestrator: view state, top bar, routing between screens.
- `app-data.jsx` — fake folders / notes / recordings / tags / transcript + the `LIcon` lucide helper.
- `app-screens.jsx` — `Sidebar`, `LibraryView`, item rows, filter chips, wordmark.
- `app-detail-screens.jsx` — `NoteEditor`, `TranscriptViewer`, `AuthScreen`.

All screens compose the design-system primitives (`Button`, `IconButton`, `Input`,
`Badge`, `Tag`, `Avatar`) from the compiled bundle and read colors/spacing/type from
the token layer — change a token and the whole app re-themes.

> Recreation, not production code: data is in-memory and interactions are cosmetic.
> Mirrors the real component tree in `apps/web/src/components/library/*`,
> `editor/document-editor.tsx`, and `transcripts/transcript-viewer.tsx`.
