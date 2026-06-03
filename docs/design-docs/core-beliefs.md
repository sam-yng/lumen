# Core beliefs

Two principles govern this repo.

## 1. The repo is the system of record

Everything needed to understand or extend the project lives in the repo as
versioned artifacts. If it isn't in the repo, it doesn't exist for an agent.

- [AGENTS.md](../../AGENTS.md) is a ~100-line **map** into `docs/` — not an
  encyclopedia.
- Knowledge is co-located with code and updated in the **same** change as the
  code it describes.
- Decisions, specs, and plans are committed as markdown, not left in chat.

## 2. Backpressure

Automated checks refuse unclean work; a human is never the default gate for
low-level correctness. See [BACKPRESSURE.md](../../BACKPRESSURE.md).

- One command — `bun run check` — runs Biome + `tsc --noEmit` + tests.
- Types make impossible states impossible.
- The human reviews only at milestone boundaries, for design and taste.
