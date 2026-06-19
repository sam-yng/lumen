import type { CSSProperties } from "react";
import { Reveal } from "@/components/reveal";
import { features } from "@/lib/site";

export function FeatureGrid() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-20">
      <Reveal className="reveal mx-auto mb-12 max-w-2xl text-center">
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
          {features.map((feature, i) =>
            feature.soon ? (
              <div
                key={feature.title}
                className="reveal bg-surface-inset relative rounded-xl border border-dashed border-border p-6"
                style={{ "--i": i } as CSSProperties}
              >
                {feature.badge ? (
                  <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-(--accent-soft) px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-accent-text">
                    <span className="size-[5px] rounded-full bg-accent" />
                    {feature.badge}
                  </span>
                ) : null}
                <h3 className="text-text-2 mt-1 max-w-[80%] text-[15px] font-semibold">
                  {feature.title}
                </h3>
                <p className="text-text-3 mt-2 text-sm leading-relaxed">
                  {feature.body}
                </p>
              </div>
            ) : (
              <div
                key={feature.title}
                className="reveal border-border-soft bg-surface/60 rounded-xl border p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-(--accent-line) hover:shadow-[0_12px_40px_-12px_var(--accent-glow)]"
                style={{ "--i": i } as CSSProperties}
              >
                <h3 className="text-[15px] font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-text-3 mt-2 text-sm leading-relaxed">
                  {feature.body}
                </p>
              </div>
            ),
          )}
        </div>
      </Reveal>
    </section>
  );
}
