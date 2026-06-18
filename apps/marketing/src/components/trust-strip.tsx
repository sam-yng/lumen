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
            <span className="bg-(--accent-line) h-1.5 w-1.5 rounded-full" />
            {badge}
          </span>
        ))}
      </Reveal>
    </section>
  );
}
