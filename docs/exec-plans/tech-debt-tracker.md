# Tech debt tracker

Known shortcuts and things to revisit. Keep entries actionable.

| Item | Context | Milestone to address |
| --- | --- | --- |
| FFmpeg not installed locally | Host dep for `nodejs-whisper`; not needed until transcription. | M4 |
| Assistant/retrieval manual happy-paths (v2 + v3) | Builds shipped + accepted; only the Claude-key-dependent browser verification remains. Tracked as a single launch gate, not per-milestone debt — see [`prod-assistant-verification.md`](active/production/prod-readiness/prod-assistant-verification.md). | Before production readiness (needs a Claude key) |

_(Add rows as debt is incurred. Empty otherwise.)_
