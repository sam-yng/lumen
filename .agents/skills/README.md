# Agent skills (in-repo)

Portable agent skills committed to the repo so every machine and every tool
shares the same versions. Cross-tool path (`.agents/skills/`), not tool-specific.

## Discovery

Claude Code only auto-discovers skills under `~/.claude/skills/` or
`.claude/skills/`. It does **not** auto-load `.agents/skills/`. To use a skill
here, read its `SKILL.md` directly and follow it. Other tools (Codex, etc.)
that honor the `.agents/` convention can point at this directory.

## Skills

| Skill | Use when |
|-------|----------|
| [docs-sanity-check](docs-sanity-check/SKILL.md) | Validating `docs/` for stale content, broken links, orphans, generated drift. Part of the closing-branch process (below). |
| [finishing-a-development-branch](finishing-a-development-branch/SKILL.md) | Implementation done, tests green — decide merge / PR / cleanup. Backbone of the closing-branch process. |
| [executing-plans](executing-plans/SKILL.md) | Executing a written exec-plan in a separate session with review checkpoints. |
| [subagent-driven-development](subagent-driven-development/SKILL.md) | Executing an exec-plan's independent tasks via subagents in the current session. |
| [test-driven-development](test-driven-development/SKILL.md) | Implementing any feature/bugfix red-green-refactor. |
| [react-doctor](react-doctor/SKILL.md) | Finishing a React feature/bugfix or running `/doctor` — lint, a11y, bundle-size, architecture triage + regression check. Also wired as CI (`.github/workflows/react-doctor.yml`). |

The superpowers skills (`executing-plans`, `subagent-driven-development`,
`test-driven-development`) are the ones referenced by `docs/exec-plans/**`.
They are vendored verbatim from the `superpowers` plugin — keep them in sync
with upstream rather than editing in place.

## Closing-branch process

When implementation is complete and `bun run check` is green, before merge/PR:

1. Run **docs-sanity-check** — fix `BROKEN`/`DRIFT`, triage `ORPHAN`/`STALE`/`STUB`.
2. Run **finishing-a-development-branch** — verify tests, then pick merge / PR / keep / discard.

See AGENTS.md → Working rules.
