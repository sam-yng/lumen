import Link from "next/link";

// Centered reading column for the legal pages. No Tailwind typography plugin in
// this repo, so spacing/weights are set with child selectors against the app's
// design tokens.
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-6 py-12">
      <header className="mb-10">
        <Link href="/" className="font-semibold text-foreground">
          Lumen
        </Link>
      </header>
      <article className="text-sm leading-6 text-text-2 [&_a]:text-accent-text [&_a]:underline [&_h1]:mb-4 [&_h1]:font-serif [&_h1]:text-[28px] [&_h1]:leading-tight [&_h1]:text-foreground [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:mb-1 [&_p]:mb-4 [&_strong]:text-foreground [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </article>
    </div>
  );
}
