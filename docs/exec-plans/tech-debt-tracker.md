# Tech debt tracker

Known shortcuts and things to revisit. Keep entries actionable.

| Item | Context | Milestone to address |
| --- | --- | --- |
| FFmpeg not installed locally | Host dep for `nodejs-whisper`; not needed until transcription. | M4 |
| Two Supabase test fakes | M4's inline fake in `library.test.ts` (lexical `order`) vs shared `__tests__/fake-supabase.ts` (numeric `order`, `ilike`/`textSearch`). Consolidate onto the shared fake. | M6 |

_(Add rows as debt is incurred. Empty otherwise.)_
