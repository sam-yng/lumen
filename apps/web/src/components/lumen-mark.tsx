import { cn } from "@/lib/utils";

/**
 * Lumen brand mark. The source art (public/lumen-mark.svg) is already a
 * transparent-cornered circle, so it just fills the box; `rounded-full` keeps
 * the box-shadow circular. Decorative by default; pass `label` when the mark
 * stands alone without an adjacent "Lumen" wordmark.
 */
export function LumenMark({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "inline-block shrink-0 rounded-full bg-center bg-no-repeat",
        className,
      )}
      style={{
        backgroundImage: "url(/lumen-mark.svg)",
        backgroundSize: "contain",
      }}
    />
  );
}
