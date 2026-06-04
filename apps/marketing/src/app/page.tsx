import { siteConfig } from "@/lib/site";

const features = [
  {
    title: "Nested library",
    body: "Organise everything in folders within folders — notes, files, and recordings live side by side.",
  },
  {
    title: "Rich-text notes",
    body: "Write with a fast, structured editor: headings, lists, tables, and links that stay out of your way.",
  },
  {
    title: "Local transcription",
    body: "Upload a lecture or seminar and transcribe it on your own CPU. No audio leaves your machine to be processed.",
  },
  {
    title: "Transcript viewing",
    body: "Read transcripts alongside the source recording, ready to revisit and reference while you study.",
  },
  {
    title: "Tagging",
    body: "Tag anything and pull related material back together across the whole library in seconds.",
  },
  {
    title: "Full-text search",
    body: "Search across notes, files, and transcripts at once — find the one line you remember, instantly.",
  },
];

export default function HomePage() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          {siteConfig.name}
        </span>
        <a
          href={siteConfig.appUrl}
          className="text-text-2 text-sm transition-colors hover:text-foreground"
        >
          Sign in
        </a>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6">
        <section className="flex flex-col items-start gap-6 py-20 sm:py-28">
          <span className="l-chip">Study workspace</span>
          <h1 className="max-w-2xl font-serif text-4xl leading-tight font-semibold text-foreground sm:text-5xl">
            {siteConfig.tagline}
          </h1>
          <p className="text-text-2 max-w-xl text-lg leading-relaxed">
            {siteConfig.description}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href={`${siteConfig.appUrl}/signup`}
              className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
            >
              Get started
            </a>
            <a
              href={`${siteConfig.appUrl}/login`}
              className="border-border-soft text-text-2 rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors hover:text-foreground"
            >
              Sign in
            </a>
          </div>
        </section>

        <section className="grid gap-px overflow-hidden rounded-xl border border-border-soft bg-border-soft sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="bg-surface p-6">
              <h2 className="text-[15px] font-semibold text-foreground">
                {feature.title}
              </h2>
              <p className="text-text-3 mt-2 text-sm leading-relaxed">
                {feature.body}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="mx-auto mt-20 w-full max-w-5xl px-6 py-8">
        <p className="text-text-4 text-xs">
          © {siteConfig.name}. A study workspace for notes, recordings, and
          transcripts.
        </p>
      </footer>
    </>
  );
}
