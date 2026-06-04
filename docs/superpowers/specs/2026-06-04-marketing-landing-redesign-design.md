# Marketing landing redesign — design

**Date:** 2026-06-04
**Status:** Approved, pre-implementation
**Scope:** `apps/marketing` only. No changes to `apps/web` or shared packages.

## Goal

Grow the marketing landing page from a single static hero + feature grid into a
richer, visually appealing, lightly animated single-page site. Motion should
feel clean and modern — "almost fun to use" — while honoring the
dependency-light rule for the public marketing site (`AGENTS.md`).

## Constraints (non-negotiable)

- **Zero new runtime dependencies.** All motion is pure CSS (`@keyframes`,
  transitions) plus one small client hook using the browser-native
  `IntersectionObserver`. No animation libraries.
- `apps/marketing` stays a public, static, unauthenticated site: no Supabase
  client, no service layer, no user data. Links out to the app via
  `siteConfig.appUrl`.
- Reuse existing design tokens from `@lumen/ui/tokens.css` (dark canvas, purple
  accent hue 282, `Newsreader` serif, Geist sans). No new color system.
- `prefers-reduced-motion: reduce` disables all non-essential motion; revealed
  content shows immediately.
- `bun run check` (typecheck + Biome) stays green.

## Decisions

- **Content scope:** rich single page (no new routes).
- **Motion approach:** CSS-only + tiny IntersectionObserver hook.
- **Visual direction:** lean into the existing dark + purple theme (aurora/glow
  gradients, glass cards, animated grid).
- **No fabricated social proof.** No fake customer logos or testimonials. The
  social-proof slot is an honest, feature-derived trust strip.
- **Product visual is a CSS-rendered mock** of the Lumen app UI, not a real or
  fabricated screenshot.

## Page structure (top → bottom)

1. **Sticky header** — slim bar that condenses (blur + border + reduced padding)
   on scroll. Logo, "Sign in", "Get started".
2. **Hero** — animated aurora background (slow-drifting purple radial-gradient
   blobs, blurred, low opacity), faint animated dotted grid, serif headline with
   staggered fade-up on load, supporting paragraph, two CTAs.
3. **Product showcase** — CSS-rendered mock of the Lumen app (folder sidebar +
   note pane + transcript pane). Subtle parallax/float on scroll. Hero
   centerpiece visual.
4. **How it works** — three steps (Capture → Transcribe locally → Find
   anything) connected by an SVG line that draws itself (`stroke-dasharray`)
   when scrolled into view.
5. **Feature grid** — the existing six features, upgraded to glass cards with
   hover lift + accent glow and a scroll-reveal stagger.
6. **Trust strip** — honest value badges (local transcription, private by
   default, search everything, free to start). Not logos.
7. **Final CTA** — large serif callout with glow and a single "Get started"
   button.
8. **Footer** — expanded: tagline, simple nav, copyright.

## Motion mechanics

- **Scroll-reveal:** one client hook `useReveal` (~25 lines). An
  `IntersectionObserver` adds an `.is-visible` class when an element enters the
  viewport. Base state `opacity: 0; translateY(12px)`; transitions to visible.
  Stagger via CSS `transition-delay` keyed off an `--i` index custom property or
  `nth-child`.
- **Hero load:** pure CSS staggered fade-up keyframes; no JS.
- **Aurora background:** 2–3 absolutely-positioned radial-gradient blobs, slow
  drift keyframes (20–30s), `blur()`, low opacity. `transform`/`opacity` only
  (GPU-friendly).
- **Header condense:** small scroll listener toggles a `.scrolled` class.
- **How-it-works line draw:** SVG path animated via `stroke-dasharray` on
  reveal.
- **Card hover:** CSS only — `translateY(-4px)`, accent border glow.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables
  keyframes/transitions; reveals render visible immediately.

## File layout

```
apps/marketing/src/
  app/
    page.tsx              thin — composes the sections
    globals.css           + keyframes, reveal base styles, aurora, utilities
  components/             NEW
    site-header.tsx       'use client' (scroll condense)
    hero.tsx
    app-mock.tsx          CSS product mockup
    how-it-works.tsx
    feature-grid.tsx
    trust-strip.tsx
    final-cta.tsx
    site-footer.tsx
  hooks/
    use-reveal.ts         'use client' IntersectionObserver hook
  lib/
    site.ts               + content arrays (steps, trustBadges); sharper hero copy
```

- Server Components by default. Only `site-header` and components that consume
  `useReveal` are `'use client'`. Keep shipped JS minimal.

## Content additions to `site.ts`

- `steps[]` (3): Capture, Transcribe locally, Find anything — each title + body.
- `trustBadges[]`: Local transcription · Private by default · Search everything
  · Free to start. Feature-derived, honest.
- Sharper hero headline + supporting copy.

## Testing

- `bun run check` green (typecheck + Biome).
- Manual browser pass at `localhost:3001`: hero load animation, scroll reveals,
  card hover, header condense, reduced-motion (devtools emulation), mobile
  width.
- No Playwright harness exists for marketing; not adding one this round.

## Out of scope

- New routes/pages (pricing, about, changelog).
- Real screenshots or fabricated social proof.
- Any `apps/web` or shared-package change.
- Animation libraries / new runtime deps.
- e2e tests for marketing.
