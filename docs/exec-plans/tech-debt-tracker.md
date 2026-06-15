# Tech debt tracker

Known shortcuts and things to revisit. Keep entries actionable.

| Item | Context | Milestone to address |
| --- | --- | --- |
| FFmpeg not installed locally | Host dep for `nodejs-whisper`; not needed until transcription. | M4 |
| Assistant/retrieval manual happy-paths (v2 + v3) | Builds shipped + accepted; only the Claude-key-dependent browser verification remains. Tracked as a single launch gate, not per-milestone debt — see [`assistant-launch.md`](queued/post-prod/assistant-launch.md). | Before production readiness (needs a Claude key) |
| ~~Abandoned live sessions stay in `live` status~~ **Addressed (v4 m5, 2026-06-12)** | A worker-scheduled sweep ([`completed/v4/stale-live-sessions.md`](completed/v4/stale-live-sessions.md)) finalizes stale live recordings from their stored segments or expires segmentless husks after `LIVE_SESSION_STALE_MINUTES` of inactivity. | Done — was scoped from the [`streaming-transcription.md`](completed/v3/streaming-transcription.md) Decision Record |

_(Add rows as debt is incurred. Empty otherwise.)_
