import type { CSSProperties } from "react";
import { Reveal } from "@/components/reveal";
import { features } from "@/lib/site";

export function FeatureGrid() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-20">
      <Reveal className="reveal mb-12 max-w-xl">
        <h2 className="font-serif text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          Built for the messy middle of real study.
        </h2>
        <p className="text-text-2 mt-4 text-pretty text-base leading-relaxed">
          Lectures, files, transcripts, search, and AI assistance all work from
          the same user-scoped workspace instead of becoming another pile of
          disconnected exports.
        </p>
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
