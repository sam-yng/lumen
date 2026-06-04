"use client";

import type { ReactNode } from "react";

export function LibraryShell({
  sidebar,
  topBar,
  children,
}: {
  sidebar: ReactNode;
  topBar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid h-dvh min-h-0 flex-1 grid-cols-1 overflow-hidden bg-background lg:grid-cols-[280px_minmax(0,1fr)]">
      {sidebar}
      <section className="flex min-h-0 flex-col overflow-hidden">
        {topBar}
        <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </div>
      </section>
    </div>
  );
}
