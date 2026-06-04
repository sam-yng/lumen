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
