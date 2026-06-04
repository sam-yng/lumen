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
