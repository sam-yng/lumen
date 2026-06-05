import type { CSSProperties } from "react";
import { Reveal } from "@/components/reveal";
import { steps } from "@/lib/site";

const miniWaveformBars = Array.from({ length: 9 }, (_, i) => ({
  id: `mini-waveform-${i}`,
  height: `${10 + ((i * 11) % 18)}px`,
  index: i,
}));

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

        <div className="relative grid gap-4 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.n}
              className="reveal border-border-soft bg-surface/60 rounded-xl border p-5 backdrop-blur-sm"
              style={{ "--i": i } as CSSProperties}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="bg-[var(--accent-soft)] text-accent-text flex h-12 w-12 items-center justify-center rounded-full border border-[var(--accent-line)] font-serif text-base font-semibold">
                  {step.n}
                </div>
                <DemoArtifact index={i} />
              </div>
              <h3 className="mt-5 text-base font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="text-text-3 mt-2 text-pretty text-sm leading-relaxed">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function DemoArtifact({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="l-mini-demo flex items-end gap-1" aria-hidden="true">
        {miniWaveformBars.map((bar) => (
          <span
            key={bar.id}
            className="l-wave bg-warn/80 w-1.5 rounded-full"
            style={
              {
                "--h": bar.height,
                "--i": bar.index,
              } as CSSProperties
            }
          />
        ))}
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="l-mini-demo bg-surface-2 flex flex-col justify-center rounded-lg border border-[var(--accent-line)] px-2">
        <span className="text-busy font-mono text-[10px]">42%</span>
        <span className="bg-surface-3 mt-1 h-1.5 overflow-hidden rounded-full">
          <span className="l-progress block h-full rounded-full bg-busy" />
        </span>
      </div>
    );
  }

  return (
    <div className="l-mini-demo bg-surface-2 rounded-lg border border-[var(--accent-line)] p-2">
      <div className="flex items-center gap-1.5">
        <span className="bg-ok h-1.5 w-1.5 rounded-full" />
        <span className="bg-surface-3 h-1.5 w-10 rounded-full" />
      </div>
      <div className="bg-[var(--ok-soft)] mt-2 h-2 w-14 rounded-full" />
    </div>
  );
}
