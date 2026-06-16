# References

External documentation snapshots and pointers, kept reachable so they aren't
flagged as orphans. Mapped from [AGENTS.md](../../AGENTS.md).

- [supabase-llms.txt](supabase-llms.txt) — Supabase (Auth, RLS, Storage, CLI).
- [tiptap-llms.txt](tiptap-llms.txt) — TipTap editor (M3).
- [biome-llms.txt](biome-llms.txt) — Biome lint/format.
- [bun-llms.txt](bun-llms.txt) — Bun package manager / runner.
- [mcp-connect.md](mcp-connect.md) — How to connect an MCP host to Lumen (endpoint, bearer auth, example config).

<a id="design-handoff"></a>
> **Design handoff — light redesign (2026-06-16):** the high-fidelity
> **light-theme** visual + interaction spec is vendored at
> [light-redesign-handoff/](light-redesign-handoff/) (OKLCH `tokens/`, the
> handoff `README.md` + `DESIGN_SYSTEM_README.md`, and interactive `web-app/` +
> `marketing/` prototypes). It is a **spec, not code to paste**. Its decisions
> are distilled into [../DESIGN.md](../DESIGN.md) and the design spec
> [../superpowers/specs/2026-06-16-light-redesign-design.md](../superpowers/specs/2026-06-16-light-redesign-design.md);
> consult the bundle for pixel-level detail. (The original
> `design_handoff_lumen_v1` dark spec it supersedes lived outside the repo.)

> For Next.js 16, the authoritative reference is the bundled docs at
> `node_modules/next/dist/docs/` — this version has breaking changes (e.g.
> `middleware` → `proxy`). Read it before writing framework code.
