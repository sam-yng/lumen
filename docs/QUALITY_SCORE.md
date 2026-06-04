# Quality score

A running self-assessment of code/product quality against the bar this repo
holds itself to (backpressure green, types strict, docs link-clean, states
handled, tests meaningful).

| Dimension | Status |
| --- | --- |
| `bun run check` green | ✅ (M0) |
| Strict types, no unjustified `any` | ✅ (M0) |
| Auth + RLS isolation | ✅ all 9 tables; cross-user isolation verified (M1) |
| Empty/loading/error states | ✅ core workspace, search, editor, upload/transcript states handled |
| Vitest units + Playwright e2e | ✅ service/worker units plus one browser happy path |
| Docs link-clean | ✅ (M6) |

Update at each milestone boundary.
