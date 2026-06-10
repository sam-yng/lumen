import { ChevronDown } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

/** Styled native select — better mobile ergonomics than a custom listbox. */
export function Select({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        data-slot="select"
        className="h-9 w-full appearance-none rounded-md border border-input bg-[var(--surface-2)] pr-8 pl-3 text-[13px] text-foreground transition-[border-color,box-shadow,background] duration-150 ease-[var(--ease)] outline-none focus-visible:border-[var(--accent-line)] focus-visible:ring-3 focus-visible:ring-[var(--accent-soft)] disabled:pointer-events-none disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-[var(--text-3)]" />
    </div>
  );
}
