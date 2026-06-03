# Plans

Milestone execution plans live under [exec-plans/](exec-plans/):

- **active/** — one markdown plan per in-flight milestone. _(none yet)_
- **completed/** — plans moved here with a short retrospective when done.
  - [m0-harness-and-scaffold.md](exec-plans/completed/m0-harness-and-scaffold.md)
  - [m1-schema-and-rls.md](exec-plans/completed/m1-schema-and-rls.md)
  - [m2-library.md](exec-plans/completed/m2-library.md)
  - [m3-editor.md](exec-plans/completed/m3-editor.md)
  - [m4-transcription.md](exec-plans/completed/m4-transcription.md)
- [tech-debt-tracker.md](exec-plans/tech-debt-tracker.md) — known shortcuts.

Build order: M0 harness → M1 schema+RLS → M2 library → M3 editor →
M4 transcription → M5 viewer+search → M6 harden+document. Gate at each boundary.
