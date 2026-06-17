# Lumen light-theme redesign — design spec

> **Status:** design input for
> [`exec-plans/completed/production/light-redesign.md`](../../exec-plans/completed/production/light-redesign.md).
> Date: 2026-06-16.

## Source

The full high-fidelity handoff (design guide, OKLCH token files, and interactive
HTML/JSX prototypes for both the web app and the marketing site) is vendored in
this repo at
[`docs/references/light-redesign-handoff/`](../../references/light-redesign-handoff/):

- [`README.md`](../../references/light-redesign-handoff/README.md) — the handoff
  guide: token tables, per-screen specs, interactions, "Coming soon" treatment.
- [`DESIGN_SYSTEM_README.md`](../../references/light-redesign-handoff/DESIGN_SYSTEM_README.md)
  — content voice, visual foundations, iconography, component API summary.
- [`tokens/`](../../references/light-redesign-handoff/tokens/) — canonical OKLCH
  token values (`colors.css`, `typography.css`, `spacing.css`, `base.css`,
  `components.css`, `fonts.css`). **These are the source of truth for token
  values.**
- [`web-app/`](../../references/light-redesign-handoff/web-app/) and
  [`marketing/`](../../references/light-redesign-handoff/marketing/) —
  interactive prototypes showing intended look + behavior. Reference, not code to
  paste.

The brief: move **both** products from the v1 dark-first theme to a clean,
Notion-inspired **light** theme with skinnier chrome (240px sidebar, 44px top
bar, ~29px rows, 32px controls), hairline borders, soft low shadows, and the
iris accent (`--accent-h: 282`) re-weighted darker (L≈0.56) to carry contrast on
white. Three families: Geist (chrome), Newsreader (reading), Geist Mono (meta).

## Binding decisions (override the handoff where they conflict)

These were decided with the product owner on 2026-06-16 and are **binding**:

1. **Light-only, keep the seam.** Light becomes the single shipped theme.
   `:root` carries the light values and `color-scheme: light`. The OKLCH
   structure is preserved so a future `.dark` scope can be reintroduced by
   overriding one block, but **no dark toggle ships now** and no dark values
   remain in `:root`. Leave the `@custom-variant dark` seam in place; do not
   build a working dark theme or theme switcher.

2. **No "Notify me" / email capture.** Scrap the lead-capture form entirely —
   the handoff's "Notify me" expand→submit→success flow ships **nowhere** (not
   in the final CTA, feature cards, or hero). There is no backend for it and the
   product owner has no plan to offer notify-on-launch. **Keep** the rest of the
   "Coming soon" treatment: dashed-border cards, the `--accent-soft` /
   `--accent-text` mono "Coming soon" / "Early access" badge, the outlined icon
   tile, the muted heading, and the disabled + "soon"-badged **Ask Lumen**
   sidebar item. AI feature cards simply present as "coming soon" with no CTA
   (or a disabled affordance) rather than a notify form.

## Implicated docs

The redesign rewrites the running design language, so these are updated in the
same branch (and checked by `docs-sanity-check`):

- [`docs/DESIGN.md`](../../DESIGN.md) — currently documents the v1 **dark** token
  system + per-screen specs. Rewrite to the light system.
- [`docs/FRONTEND.md`](../../FRONTEND.md) — references the 280px sidebar and
  dark-first; update sizing + theme statements.
- [`docs/references/index.md`](../../references/index.md) — add a pointer to this
  handoff.
