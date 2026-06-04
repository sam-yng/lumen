# Marketing Landing Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Design spec:** [`docs/superpowers/specs/2026-06-04-marketing-landing-redesign-design.md`](../../superpowers/specs/2026-06-04-marketing-landing-redesign-design.md)

**Goal:** Grow `apps/marketing` from a static hero + feature grid into a richer, lightly animated single-page site (dark + purple, CSS-only motion, zero new deps).

**Architecture:** Server Components compose section components in `page.tsx`. Motion is pure CSS (`@keyframes`, transitions in `globals.css`) plus one small client `<Reveal>` wrapper that uses the browser-native `IntersectionObserver` to toggle an `is-visible` class. Only `<Reveal>` and `<SiteHeader>` are client components; everything else is server-rendered. `prefers-reduced-motion` disables motion via a CSS media query.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, `@lumen/ui` design tokens. No animation library.

---

## Conventions (read once before starting)

- **No TDD here.** Marketing has no test harness and CSS animation isn't unit-testable. The gate for every task is `bun run check` green (run from repo root). The final task adds a manual browser pass.
- **Reveal convention:** `<Reveal className="…">` renders a `div` that gets `is-visible` when scrolled into view. Style the elements you want to animate with the `reveal` class *inside* it; the CSS rule `.is-visible .reveal` drives them. Stagger with an `--i` index custom property.
- **Custom-property inline styles:** import `type { CSSProperties } from "react"` and cast: `style={{ "--i": 2 } as CSSProperties}`. Do NOT reference the `React` global.
- **Accent utilities:** `--accent-soft`, `--accent-line`, `--accent-glow`, and `--shadow-pop` are NOT mapped as Tailwind utilities. Use arbitrary forms: `bg-[var(--accent-soft)]`, `border-[var(--accent-line)]`, `shadow-[0_12px_40px_-12px_var(--accent-glow)]`, `shadow-[var(--shadow-pop)]`. `text-accent-text`, `bg-surface`, `bg-surface-3`, `text-text-2/3/4`, `border-border-soft` ARE valid utilities.
- Run `bun install` from repo root once before starting (no new deps, just ensures workspace is ready).

## File map

```
apps/marketing/src/
  app/
    page.tsx              MODIFY — thin composition of sections
    globals.css           MODIFY — l-chip, keyframes, reveal/aurora/grid utilities
  components/             NEW dir
    reveal.tsx            client IntersectionObserver wrapper
    site-header.tsx       client — scroll condense
    hero.tsx              aurora + grid + staggered load
    app-mock.tsx          CSS-rendered app UI mock
    how-it-works.tsx      3 steps + SVG line draw
    feature-grid.tsx      glass cards, hover, stagger
    trust-strip.tsx       honest value badges
    final-cta.tsx         glow callout
    site-footer.tsx       expanded footer
  lib/
    site.ts               MODIFY — add features, steps, trustBadges
```

---

## Task 1: Content + tokens in `site.ts`

**Files:**
- Modify: `apps/marketing/src/lib/site.ts`

- [ ] **Step 1: Replace the file contents**

```ts
/**
 * Canonical marketing-site config + landing-page content. URLs are
 * environment-overridable so the same build serves localhost in dev and the
 * real origins in production — set NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_APP_URL
 * there. See .env.example.
 */
export const siteConfig = {
  name: "Lumen",
  tagline: "Your study workspace, all in one place.",
  description:
    "Nest your notes in folders, upload lectures, transcribe them locally, and search across everything — one calm, private home for how you study.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

export const features = [
  {
    title: "Nested library",
    body: "Organise everything in folders within folders — notes, files, and recordings live side by side.",
  },
  {
    title: "Rich-text notes",
    body: "Write with a fast, structured editor: headings, lists, tables, and links that stay out of your way.",
  },
  {
    title: "Local transcription",
    body: "Upload a lecture or seminar and transcribe it on your own CPU. No audio leaves your machine to be processed.",
  },
  {
    title: "Transcript viewing",
    body: "Read transcripts alongside the source recording, ready to revisit and reference while you study.",
  },
  {
    title: "Tagging",
    body: "Tag anything and pull related material back together across the whole library in seconds.",
  },
  {
    title: "Full-text search",
    body: "Search across notes, files, and transcripts at once — find the one line you remember, instantly.",
  },
] as const;

export const steps = [
  {
    n: "01",
    title: "Capture",
    body: "Drop in lecture recordings, files, and notes — organised in nested folders from day one.",
  },
  {
    n: "02",
    title: "Transcribe locally",
    body: "Turn audio into searchable text on your own machine. No audio leaves your computer to be processed.",
  },
  {
    n: "03",
    title: "Find anything",
    body: "Full-text search across notes, files, and transcripts. Tag and pull related material together.",
  },
] as const;

export const trustBadges = [
  "Local transcription",
  "Private by default",
  "Search everything",
  "Free to start",
] as const;
```

- [ ] **Step 2: Verify**

Run: `bun run check`
Expected: PASS (no usages broken yet — `page.tsx` still imports `siteConfig` only).

- [ ] **Step 3: Commit**

```bash
git add apps/marketing/src/lib/site.ts
git commit -m "feat(marketing): add landing content (features, steps, trust badges)"
```

---

## Task 2: `globals.css` — chip, keyframes, motion utilities

**Files:**
- Modify: `apps/marketing/src/app/globals.css`

- [ ] **Step 1: Replace the file contents**

```css
@import "tailwindcss";
@import "@lumen/ui/tokens.css";

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    min-height: 100dvh;
    font: 400 15px / 1.6 var(--font-ui);
    letter-spacing: 0;
  }
  html {
    @apply font-sans;
    background: var(--canvas);
  }
  ::selection {
    background: var(--accent-soft);
    color: var(--text);
  }
}

@layer components {
  /* Pill chip — marketing previously referenced this class without defining it. */
  .l-chip {
    display: inline-flex;
    height: 24px;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--border-soft);
    border-radius: var(--r-pill);
    background: color-mix(in oklch, var(--surface-2), transparent 18%);
    padding: 0 9px;
    color: var(--text-2);
    font-size: 12px;
    line-height: 1;
  }
}

@layer utilities {
  /* Scroll-reveal: container gets .is-visible, descendant .reveal elements animate in. */
  .reveal {
    opacity: 0;
    transform: translateY(12px);
    transition:
      opacity 0.6s var(--ease),
      transform 0.6s var(--ease);
    transition-delay: calc(var(--i, 0) * 80ms);
    will-change: opacity, transform;
  }
  .is-visible .reveal,
  .reveal.is-visible {
    opacity: 1;
    transform: none;
  }

  /* Hero load: staggered fade-up, no JS. */
  .l-rise {
    opacity: 0;
    animation: l-fade-up 0.7s var(--ease) forwards;
    animation-delay: calc(var(--i, 0) * 90ms);
  }

  /* Aurora: slow-drifting blurred blobs behind the hero / final CTA. */
  .l-aurora {
    position: absolute;
    inset: -20% 0 auto 0;
    height: 70vh;
    overflow: hidden;
    pointer-events: none;
    z-index: 0;
  }
  .l-aurora::before,
  .l-aurora::after {
    content: "";
    position: absolute;
    border-radius: 999px;
    filter: blur(80px);
  }
  .l-aurora::before {
    left: 8%;
    top: -12%;
    width: 50vw;
    height: 50vw;
    background: radial-gradient(circle, var(--accent-glow), transparent 70%);
    animation: l-drift-a 24s ease-in-out infinite;
  }
  .l-aurora::after {
    right: 4%;
    top: 4%;
    width: 40vw;
    height: 40vw;
    background: radial-gradient(
      circle,
      oklch(0.74 0.13 244 / 22%),
      transparent 70%
    );
    animation: l-drift-b 30s ease-in-out infinite;
  }

  /* Faint dotted grid, faded out toward the bottom. */
  .l-grid {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: radial-gradient(
      color-mix(in oklch, var(--border-soft), transparent 20%) 1px,
      transparent 1px
    );
    background-size: 28px 28px;
    mask-image: radial-gradient(
      ellipse 70% 60% at 50% 0%,
      #000 40%,
      transparent 75%
    );
    z-index: 0;
  }

  /* SVG line that draws itself when its container becomes visible. */
  .l-draw {
    stroke-dasharray: var(--len, 200);
    stroke-dashoffset: var(--len, 200);
    transition: stroke-dashoffset 1.1s var(--ease);
  }
  .is-visible .l-draw {
    stroke-dashoffset: 0;
  }
}

@keyframes l-fade-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes l-drift-a {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(6%, 8%, 0) scale(1.15);
  }
}

@keyframes l-drift-b {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1.1);
  }
  50% {
    transform: translate3d(-8%, -6%, 0) scale(0.95);
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal,
  .l-rise {
    opacity: 1;
    transform: none;
    animation: none;
    transition: none;
  }
  .l-aurora::before,
  .l-aurora::after {
    animation: none;
  }
  .l-draw {
    stroke-dashoffset: 0;
    transition: none;
  }
}
```

- [ ] **Step 2: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/marketing/src/app/globals.css
git commit -m "feat(marketing): add CSS motion utilities and chip styles"
```

---

## Task 3: `<Reveal>` client wrapper

**Files:**
- Create: `apps/marketing/src/components/reveal.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { type ReactNode, useEffect, useRef } from "react";

/**
 * Wraps content and adds an `is-visible` class the first time it scrolls into
 * view, letting CSS (`.is-visible .reveal`) drive the entrance animation.
 * Reduced-motion users get instant content via the CSS media query, so there
 * is no JS branch for it here.
 */
export function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          el.classList.add("is-visible");
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/marketing/src/components/reveal.tsx
git commit -m "feat(marketing): add Reveal scroll-into-view wrapper"
```

---

## Task 4: `<SiteHeader>` (sticky, condenses on scroll)

**Files:**
- Create: `apps/marketing/src/components/site-header.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useState } from "react";
import { siteConfig } from "@/lib/site";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-border-soft bg-background/80 border-b backdrop-blur-md"
          : "border-b border-transparent"
      }`}
    >
      <div
        className={`mx-auto flex w-full max-w-5xl items-center justify-between px-6 transition-all duration-300 ${
          scrolled ? "py-3" : "py-5"
        }`}
      >
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          {siteConfig.name}
        </span>
        <nav className="flex items-center gap-4">
          <a
            href={`${siteConfig.appUrl}/login`}
            className="text-text-2 text-sm transition-colors hover:text-foreground"
          >
            Sign in
          </a>
          <a
            href={`${siteConfig.appUrl}/signup`}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          >
            Get started
          </a>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/marketing/src/components/site-header.tsx
git commit -m "feat(marketing): add sticky header that condenses on scroll"
```

---

## Task 5: `<Hero>` (aurora + grid + staggered load)

**Files:**
- Create: `apps/marketing/src/components/hero.tsx`

- [ ] **Step 1: Create the file**

```tsx
import type { CSSProperties } from "react";
import { siteConfig } from "@/lib/site";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="l-aurora" aria-hidden="true" />
      <div className="l-grid" aria-hidden="true" />
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-6 py-24 sm:py-32">
        <span className="l-chip l-rise" style={{ "--i": 0 } as CSSProperties}>
          Study workspace
        </span>
        <h1
          className="l-rise max-w-2xl font-serif text-4xl font-semibold leading-tight text-foreground sm:text-6xl"
          style={{ "--i": 1 } as CSSProperties}
        >
          {siteConfig.tagline}
        </h1>
        <p
          className="l-rise text-text-2 max-w-xl text-lg leading-relaxed"
          style={{ "--i": 2 } as CSSProperties}
        >
          {siteConfig.description}
        </p>
        <div
          className="l-rise flex flex-wrap items-center gap-3 pt-2"
          style={{ "--i": 3 } as CSSProperties}
        >
          <a
            href={`${siteConfig.appUrl}/signup`}
            className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
          >
            Get started
          </a>
          <a
            href={`${siteConfig.appUrl}/login`}
            className="border-border-soft text-text-2 rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors hover:text-foreground"
          >
            Sign in
          </a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/marketing/src/components/hero.tsx
git commit -m "feat(marketing): add animated hero with aurora background"
```

---

## Task 6: `<AppMock>` (CSS-rendered product mock)

**Files:**
- Create: `apps/marketing/src/components/app-mock.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { Reveal } from "@/components/reveal";

const folders = [
  "Biology 101",
  "Lecture recordings",
  "Essay drafts",
  "Exam prep",
];

const transcriptLines = [
  "…so the mitochondrion is where respiration",
  "actually happens — that's the key takeaway",
  "for the exam. Note the inner membrane folds,",
  "called cristae, which increase surface area.",
];

export function AppMock() {
  return (
    <section className="mx-auto -mt-6 w-full max-w-5xl px-6 pb-10">
      <Reveal className="reveal">
        <div className="border-border-soft bg-surface overflow-hidden rounded-xl border shadow-[var(--shadow-pop)]">
          {/* window bar */}
          <div className="border-border-soft flex items-center gap-2 border-b px-4 py-3">
            <span className="bg-surface-3 h-3 w-3 rounded-full" />
            <span className="bg-surface-3 h-3 w-3 rounded-full" />
            <span className="bg-surface-3 h-3 w-3 rounded-full" />
            <span className="text-text-4 ml-3 text-xs">
              Lumen — Biology 101 / Respiration lecture
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] lg:grid-cols-[180px_1fr_240px]">
            {/* sidebar */}
            <aside className="border-border-soft hidden flex-col gap-1 border-r p-3 sm:flex">
              {folders.map((folder, i) => (
                <div
                  key={folder}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                    i === 0
                      ? "bg-[var(--accent-soft)] text-accent-text"
                      : "text-text-3"
                  }`}
                >
                  <span className="bg-current/60 h-3 w-3 rounded-sm opacity-70" />
                  {folder}
                </div>
              ))}
            </aside>

            {/* note pane */}
            <div className="p-6">
              <span className="l-chip mb-4">Lecture note</span>
              <h3 className="font-serif text-xl font-semibold text-foreground">
                Cellular respiration
              </h3>
              <div className="mt-4 space-y-2">
                <div className="bg-surface-2 h-3 w-5/6 rounded" />
                <div className="bg-surface-2 h-3 w-full rounded" />
                <div className="bg-surface-2 h-3 w-4/6 rounded" />
                <div className="bg-surface-2 mt-4 h-3 w-3/6 rounded" />
                <div className="bg-surface-2 h-3 w-5/6 rounded" />
              </div>
              <div className="mt-5 flex gap-2">
                <span className="border-border-soft text-text-3 rounded-full border px-2.5 py-1 text-xs">
                  #respiration
                </span>
                <span className="border-border-soft text-text-3 rounded-full border px-2.5 py-1 text-xs">
                  #midterm
                </span>
              </div>
            </div>

            {/* transcript pane */}
            <aside className="border-border-soft hidden border-l p-4 lg:block">
              <div className="text-text-4 mb-3 text-xs font-medium uppercase tracking-wide">
                Transcript
              </div>
              <div className="space-y-3">
                {transcriptLines.map((line, i) => (
                  <p
                    key={line}
                    className={`text-xs leading-relaxed ${
                      i === 0 ? "text-foreground" : "text-text-3"
                    }`}
                  >
                    <span className="text-accent-text mr-1.5 font-mono">
                      0:{String(12 + i * 7).padStart(2, "0")}
                    </span>
                    {line}
                  </p>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/marketing/src/components/app-mock.tsx
git commit -m "feat(marketing): add CSS-rendered app showcase mock"
```

---

## Task 7: `<HowItWorks>` (3 steps + drawn line)

**Files:**
- Create: `apps/marketing/src/components/how-it-works.tsx`

- [ ] **Step 1: Create the file**

```tsx
import type { CSSProperties } from "react";
import { Reveal } from "@/components/reveal";
import { steps } from "@/lib/site";

export function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-20">
      <Reveal className="reveal mb-12 max-w-xl">
        <h2 className="font-serif text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          From recording to recall in three steps.
        </h2>
      </Reveal>

      <Reveal className="relative">
        <svg
          aria-hidden="true"
          className="absolute inset-x-0 top-7 hidden h-px w-full sm:block"
          preserveAspectRatio="none"
          viewBox="0 0 100 1"
        >
          <line
            x1="0"
            y1="0.5"
            x2="100"
            y2="0.5"
            stroke="var(--accent-line)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            className="l-draw"
            style={{ "--len": 100 } as CSSProperties}
          />
        </svg>

        <div className="relative grid gap-10 sm:grid-cols-3 sm:gap-8">
          {steps.map((step, i) => (
            <div
              key={step.n}
              className="reveal"
              style={{ "--i": i } as CSSProperties}
            >
              <div className="bg-[var(--accent-soft)] text-accent-text flex h-14 w-14 items-center justify-center rounded-full border border-[var(--accent-line)] font-serif text-lg font-semibold">
                {step.n}
              </div>
              <h3 className="mt-5 text-base font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="text-text-3 mt-2 text-sm leading-relaxed">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/marketing/src/components/how-it-works.tsx
git commit -m "feat(marketing): add how-it-works steps with drawn connector"
```

---

## Task 8: `<FeatureGrid>` (glass cards, hover, stagger)

**Files:**
- Create: `apps/marketing/src/components/feature-grid.tsx`

- [ ] **Step 1: Create the file**

```tsx
import type { CSSProperties } from "react";
import { Reveal } from "@/components/reveal";
import { features } from "@/lib/site";

export function FeatureGrid() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-20">
      <Reveal className="reveal mb-12 max-w-xl">
        <h2 className="font-serif text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          Everything you need to study, in one place.
        </h2>
      </Reveal>

      <Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="reveal border-border-soft bg-surface/60 rounded-xl border p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent-line)] hover:shadow-[0_12px_40px_-12px_var(--accent-glow)]"
              style={{ "--i": i } as CSSProperties}
            >
              <h3 className="text-[15px] font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="text-text-3 mt-2 text-sm leading-relaxed">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/marketing/src/components/feature-grid.tsx
git commit -m "feat(marketing): upgrade feature grid to glass cards with hover"
```

---

## Task 9: `<TrustStrip>`

**Files:**
- Create: `apps/marketing/src/components/trust-strip.tsx`

- [ ] **Step 1: Create the file**

```tsx
import type { CSSProperties } from "react";
import { Reveal } from "@/components/reveal";
import { trustBadges } from "@/lib/site";

export function TrustStrip() {
  return (
    <section className="border-border-soft border-y">
      <Reveal className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 py-10">
        {trustBadges.map((badge, i) => (
          <span
            key={badge}
            className="reveal text-text-3 flex items-center gap-2 text-sm font-medium"
            style={{ "--i": i } as CSSProperties}
          >
            <span className="bg-[var(--accent-line)] h-1.5 w-1.5 rounded-full" />
            {badge}
          </span>
        ))}
      </Reveal>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/marketing/src/components/trust-strip.tsx
git commit -m "feat(marketing): add honest trust-strip value badges"
```

---

## Task 10: `<FinalCta>` and `<SiteFooter>`

**Files:**
- Create: `apps/marketing/src/components/final-cta.tsx`
- Create: `apps/marketing/src/components/site-footer.tsx`

- [ ] **Step 1: Create `final-cta.tsx`**

```tsx
import type { CSSProperties } from "react";
import { Reveal } from "@/components/reveal";
import { siteConfig } from "@/lib/site";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden">
      <div className="l-aurora" aria-hidden="true" />
      <Reveal className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 py-28 text-center">
        <h2 className="reveal max-w-xl font-serif text-3xl font-semibold leading-tight text-foreground sm:text-5xl">
          Start studying smarter today.
        </h2>
        <p
          className="reveal text-text-2 max-w-md text-lg"
          style={{ "--i": 1 } as CSSProperties}
        >
          Your notes, recordings, and transcripts — organised, private, and
          searchable.
        </p>
        <a
          href={`${siteConfig.appUrl}/signup`}
          className="reveal bg-primary text-primary-foreground rounded-lg px-6 py-3 text-sm font-medium transition-opacity hover:opacity-90"
          style={{ "--i": 2 } as CSSProperties}
        >
          Get started
        </a>
      </Reveal>
    </section>
  );
}
```

- [ ] **Step 2: Create `site-footer.tsx`**

```tsx
import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-border-soft border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[15px] font-semibold text-foreground">
            {siteConfig.name}
          </span>
          <p className="text-text-4 mt-1 text-xs">
            A study workspace for notes, recordings, and transcripts.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <a
            href={`${siteConfig.appUrl}/login`}
            className="text-text-3 text-sm transition-colors hover:text-foreground"
          >
            Sign in
          </a>
          <a
            href={`${siteConfig.appUrl}/signup`}
            className="text-text-3 text-sm transition-colors hover:text-foreground"
          >
            Get started
          </a>
        </nav>
      </div>
      <div className="border-border-soft border-t">
        <p className="text-text-4 mx-auto w-full max-w-5xl px-6 py-5 text-xs">
          © {new Date().getFullYear()} {siteConfig.name}. A study workspace for
          notes, recordings, and transcripts.
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/marketing/src/components/final-cta.tsx apps/marketing/src/components/site-footer.tsx
git commit -m "feat(marketing): add final CTA and expanded footer"
```

---

## Task 11: Compose `page.tsx` + manual verification

**Files:**
- Modify: `apps/marketing/src/app/page.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import { AppMock } from "@/components/app-mock";
import { FeatureGrid } from "@/components/feature-grid";
import { FinalCta } from "@/components/final-cta";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TrustStrip } from "@/components/trust-strip";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <Hero />
        <AppMock />
        <HowItWorks />
        <FeatureGrid />
        <TrustStrip />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 2: Verify the gate**

Run: `bun run check`
Expected: PASS (typecheck + Biome across the workspace).

- [ ] **Step 3: Production build sanity**

Run: `cd apps/web/../marketing && bun run build` (or from repo root: `cd apps/marketing && bun run build`)
Expected: build completes; `/` is statically generated; no client-component or import errors.

- [ ] **Step 4: Manual browser pass**

Run: `cd apps/marketing && bun run dev` then open `http://localhost:3001`. Confirm:
  - Hero text fades up in sequence on load; aurora blobs drift slowly; dotted grid fades toward the bottom.
  - Sticky header condenses (blur + border + tighter padding) after scrolling a few px.
  - App mock, how-it-works steps, feature cards, trust badges, and final CTA each fade/slide in as they enter the viewport (staggered).
  - How-it-works connector line draws left→right when the row enters view (desktop width).
  - Feature cards lift and glow on hover.
  - Resize to mobile width: sidebar/transcript panes in the mock hide, grids collapse to one column, nothing overflows horizontally.
  - In devtools, emulate `prefers-reduced-motion: reduce` (Rendering tab) and reload: content is fully visible immediately, no drift/draw/fade.

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/app/page.tsx
git commit -m "feat(marketing): compose redesigned landing page"
```

---

## Self-review notes (author)

- **Spec coverage:** header (T4), hero/aurora/grid (T2,T5), product showcase (T6), how-it-works + drawn line (T2,T7), feature grid glass+hover+stagger (T2,T8), trust strip honest badges (T1,T9), final CTA (T10), footer (T10), reveal hook→`<Reveal>` component (T3), reduced-motion (T2), content in site.ts (T1), compose + manual test (T11). All spec sections mapped.
- **Deviation from spec:** spec named `hooks/use-reveal.ts`; implemented as `components/reveal.tsx` wrapper instead — same IntersectionObserver idea, but lets server-component sections stay server-rendered (a client child is cheaper than marking each section `'use client'`). Honors the minimal-JS goal better.
- **Type consistency:** `<Reveal>` props `{children, className}` used identically everywhere; `CSSProperties` cast pattern used for every `--i`/`--len`; `features`/`steps`/`trustBadges` shapes match their consumers.
- **No placeholders:** every step has full file contents or exact commands.
```
