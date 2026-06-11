# Tech debt tracker

Known shortcuts and things to revisit. Keep entries actionable.

| Item | Context | Milestone to address |
| --- | --- | --- |
| FFmpeg not installed locally | Host dep for `nodejs-whisper`; not needed until transcription. | M4 |
| Assistant/retrieval manual happy-paths (v2 + v3) | Builds shipped + accepted; only the Claude-key-dependent browser verification remains. Tracked as a single launch gate, not per-milestone debt — see [`prod-assistant-verification.md`](active/production/prod-readiness/prod-assistant-verification.md). | Before production readiness (needs a Claude key) |
| Abandoned live sessions stay in `live` status | A live capture whose tab closes/crashes leaves a `recordings` row in `live` with no audio object; deletable via the existing file-delete flow but not resumable or auto-expired. See [`streaming-transcription.md`](completed/v3/streaming-transcription.md) Decision Record. | v3 m3+ or a cleanup pass (e.g. stale-live sweep / finalize-from-stored-segments) |

_(Add rows as debt is incurred. Empty otherwise.)_
