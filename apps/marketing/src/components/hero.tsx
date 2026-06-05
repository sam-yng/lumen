import type { CSSProperties } from "react";
import { AppMock } from "@/components/app-mock";
import { siteConfig } from "@/lib/site";

const proofPoints = [
  "Private local transcription",
  "Nested study library",
  "Search notes + transcripts",
] as const;

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="l-aurora" aria-hidden="true" />
      <div className="l-grid" aria-hidden="true" />

      <div className="relative z-10 mx-auto grid min-h-[calc(88svh-64px)] w-full max-w-6xl items-center gap-10 px-6 py-14 sm:py-18 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <div className="flex flex-col items-start gap-6">
          <span className="l-chip l-rise" style={{ "--i": 0 } as CSSProperties}>
            Study workspace
          </span>
          <h1
            className="l-rise max-w-2xl text-balance font-serif text-4xl font-semibold leading-tight text-foreground sm:text-6xl"
            style={{ "--i": 1 } as CSSProperties}
          >
            {siteConfig.tagline}
          </h1>
          <p
            className="l-rise text-text-2 max-w-xl text-pretty text-lg leading-relaxed"
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
              className="border-border-soft bg-surface/40 text-text-2 rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors hover:text-foreground"
            >
              Sign in
            </a>
          </div>
          <div
            className="l-rise grid gap-2 pt-2 text-sm text-text-3 sm:grid-cols-3 lg:max-w-xl"
            style={{ "--i": 4 } as CSSProperties}
          >
            {proofPoints.map((point) => (
              <span
                key={point}
                className="border-border-soft bg-surface/40 flex items-center gap-2 rounded-lg border px-3 py-2"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                {point}
              </span>
            ))}
          </div>
        </div>

        <div
          className="l-rise relative mx-auto w-full max-w-[680px] lg:translate-y-8"
          style={{ "--i": 5 } as CSSProperties}
        >
          <div
            className="absolute -inset-6 rounded-[28px] bg-[radial-gradient(circle_at_35%_20%,var(--accent-glow),transparent_38%),radial-gradient(circle_at_85%_75%,var(--busy-soft),transparent_36%)] blur-2xl"
            aria-hidden="true"
          />
          <div className="relative">
            <AppMock variant="hero" />
          </div>
        </div>
      </div>
    </section>
  );
}
