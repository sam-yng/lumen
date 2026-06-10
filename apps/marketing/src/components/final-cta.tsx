import type { CSSProperties } from "react";
import { Reveal } from "@/components/reveal";
import { siteConfig } from "@/lib/site";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden">
      <div className="l-aurora" aria-hidden="true" />
      <Reveal className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 py-28 text-center">
        <h2 className="reveal max-w-xl font-serif text-3xl font-semibold leading-tight text-foreground sm:text-5xl">
          Build a study workspace you can actually ask questions of.
        </h2>
        <p
          className="reveal text-text-2 max-w-md text-lg"
          style={{ "--i": 1 } as CSSProperties}
        >
          Your notes, recordings, transcripts, and retrieval tools stay
          organized together. Add your Claude API key when you want AI
          assistance over that workspace.
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
