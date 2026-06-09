# Tech debt tracker

Known shortcuts and things to revisit. Keep entries actionable.

| Item | Context | Milestone to address |
| --- | --- | --- |
| FFmpeg not installed locally | Host dep for `nodejs-whisper`; not needed until transcription. | M4 |
| In-app assistant: manual happy-path unverified | Implementation complete + merged-ready (PR #22); automated tests + build green. Needs a real Claude API key to run the browser happy-path (set key → ask over notes → create note → flashcards → tool-failure recovery → remove key → no-key state). No key available now — deferred. | When a Claude key is available |
| v3 cited retrieval: manual happy-path unverified | Shipped in PR #23; automated service/MCP/assistant tests + build green. Needs a real Claude key to confirm assistant answers cite `[S#]` labels that resolve to returned sources over a real transcript. **Production-readiness blocker** — must be verified before launch. See [`completed/v3/cited-retrieval.md`](completed/v3/cited-retrieval.md). | Before production readiness (needs a Claude key) |

_(Add rows as debt is incurred. Empty otherwise.)_
