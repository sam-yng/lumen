# Tech debt tracker

Known shortcuts and things to revisit. Keep entries actionable.

| Item | Context | Milestone to address |
| --- | --- | --- |
| FFmpeg not installed locally | Host dep for `nodejs-whisper`; not needed until transcription. | M4 |
| In-app assistant: manual happy-path unverified | Implementation complete + merged-ready (PR #22); automated tests + build green. Needs a real Claude API key to run the browser happy-path (set key → ask over notes → create note → flashcards → tool-failure recovery → remove key → no-key state). No key available now — deferred. | When a Claude key is available |

_(Add rows as debt is incurred. Empty otherwise.)_
