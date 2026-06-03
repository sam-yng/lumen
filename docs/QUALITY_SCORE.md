# Quality score

A running self-assessment of code/product quality against the bar this repo
holds itself to (backpressure green, types strict, docs link-clean, states
handled, tests meaningful).

| Dimension | Status |
| --- | --- |
| `bun run check` green | ✅ (M0) |
| Strict types, no unjustified `any` | ✅ (M0) |
| Auth + RLS isolation | ✅ profiles pattern (M0); domain tables in M1 |
| Empty/loading/error states | ⏳ M6 |
| Vitest units + Playwright e2e | ⏳ smoke only; full e2e in M6 |
| Docs link-clean | ✅ (M0) |

Update at each milestone boundary.
