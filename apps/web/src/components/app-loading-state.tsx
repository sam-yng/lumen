import { Loader2 } from "lucide-react";

export function AppLoadingState({
  label,
  overlay = false,
}: {
  label: string;
  overlay?: boolean;
}) {
  return (
    <div
      aria-busy="true"
      className={
        overlay
          ? "fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-[1px]"
          : "grid min-h-96 place-items-center bg-background"
      }
    >
      <output
        aria-label={label}
        className="flex items-center gap-2 rounded-md border border-border-soft bg-surface px-3 py-2 text-sm shadow-(--shadow-pop)"
      >
        <Loader2 className="size-4 animate-spin text-accent-text" />
        {label}…
      </output>
    </div>
  );
}
