"use client";

import { Dialog as SheetPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;

/**
 * Left-side drawer. Built on the dialog primitive so focus trapping, Esc, and
 * overlay dismissal come for free. Used for the mobile sidebar; render a
 * visually hidden <SheetTitle> inside for screen readers.
 */
export function SheetContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
      <SheetPrimitive.Content
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full w-[85vw] max-w-[320px] flex-col border-r border-border-soft bg-surface shadow-(--shadow-pop) outline-none",
          "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:animate-in data-[state=open]:slide-in-from-left motion-reduce:animate-none",
          className,
        )}
        {...props}
      >
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
