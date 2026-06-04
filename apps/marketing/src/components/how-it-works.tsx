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
