# References

External documentation snapshots and pointers, kept reachable so they aren't
flagged as orphans. Mapped from [AGENTS.md](../../AGENTS.md).

- [supabase-llms.txt](supabase-llms.txt) — Supabase (Auth, RLS, Storage, CLI).
- [tiptap-llms.txt](tiptap-llms.txt) — TipTap editor (M3).
- [biome-llms.txt](biome-llms.txt) — Biome lint/format.
- [bun-llms.txt](bun-llms.txt) — Bun package manager / runner.
- [mcp-connect.md](mcp-connect.md) — How to connect an MCP host to Lumen (endpoint, bearer auth, example config).

<a id="design-handoff"></a>
> **Design handoff (`design_handoff_lumen_v1`):** the high-fidelity dark-theme
> visual + interaction spec lives outside the repo in the handoff bundle
> (`tokens.css`, `app.css`, JSX references, `README.md`). It is a **spec, not
> code to paste**. Its decisions are distilled into [../DESIGN.md](../DESIGN.md);
> consult the bundle only for pixel-level detail when implementing the restyle.

> For Next.js 16, the authoritative reference is the bundled docs at
> `node_modules/next/dist/docs/` — this version has breaking changes (e.g.
> `middleware` → `proxy`). Read it before writing framework code.
