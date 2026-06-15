import Link from "next/link";

export function LegalFooter() {
  return (
    <footer className="border-t border-[var(--border-soft)] px-6 py-4 text-center text-xs text-[var(--text-3)]">
      <Link
        href="/privacy"
        className="underline-offset-4 hover:text-[var(--accent-text)] hover:underline"
      >
        Privacy
      </Link>
      <span className="mx-2">·</span>
      <Link
        href="/terms"
        className="underline-offset-4 hover:text-[var(--accent-text)] hover:underline"
      >
        Terms
      </Link>
    </footer>
  );
}
