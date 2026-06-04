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
