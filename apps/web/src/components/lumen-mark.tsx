import { cn } from "@/lib/utils";

/**
 * Lumen brand mark. The source art (public/lumen-mark.svg) is a square with the
 * circular logo inset on a near-white field, so we render it as a circular
 * background and slightly oversize it to bleed the art to the edge — this hides
 * the white corners against any surface tint. Decorative by default; pass
 * `label` when the mark stands alone without an adjacent "Lumen" wordmark.
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
        backgroundSize: "104%",
      }}
    />
  );
}
