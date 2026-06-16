"use client";

import { Menu } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export function LibraryShell({
  sidebar,
  topBar,
  children,
}: {
  sidebar: ReactNode;
  topBar: ReactNode;
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="grid h-dvh min-h-0 flex-1 grid-cols-1 overflow-hidden bg-background lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)]">
      <div className="hidden min-h-0 lg:flex lg:flex-col">{sidebar}</div>
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent
          aria-describedby={undefined}
          // Any nav/folder/tag activation inside the drawer should also close
          // it; capturing link/button clicks is simpler than threading a
          // callback through every sidebar row. Two opt-outs: portaled dialogs
          // (React events propagate through the React tree, so a dialog owned
          // by drawer content would unmount with the drawer) and anything
          // marked data-drawer-stay (e.g. controls that open those dialogs).
          onClickCapture={(event) => {
            const target = event.target as HTMLElement;
            // The drawer itself is role="dialog"; only skip dialogs OTHER
            // than it (portaled children rendered by drawer content).
            const dialog = target.closest('[role="dialog"]');
            if (dialog && dialog !== event.currentTarget) return;
            if (target.closest("[data-drawer-stay]")) return;
            if (target.closest("a, button")) setNavOpen(false);
          }}
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>
      <section className="flex min-h-0 flex-col overflow-hidden">
        <div className="sticky top-0 z-20 flex min-h-[var(--topbar-h)] items-center gap-1 border-b border-[var(--border-soft)] bg-background/95 px-4 backdrop-blur lg:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="-ml-1.5 lg:hidden"
            title="Open navigation"
            onClick={() => setNavOpen(true)}
          >
            <span className="sr-only">Open navigation</span>
            <Menu className="size-4" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center">{topBar}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </div>
      </section>
    </div>
  );
}
