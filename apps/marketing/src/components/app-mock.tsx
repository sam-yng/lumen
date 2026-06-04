import { Reveal } from "@/components/reveal";

const folders = [
  "Biology 101",
  "Lecture recordings",
  "Essay drafts",
  "Exam prep",
];

const transcriptLines = [
  "…so the mitochondrion is where respiration",
  "actually happens — that's the key takeaway",
  "for the exam. Note the inner membrane folds,",
  "called cristae, which increase surface area.",
];

export function AppMock() {
  return (
    <section className="mx-auto -mt-6 w-full max-w-5xl px-6 pb-10">
      <Reveal className="reveal">
        <div className="border-border-soft bg-surface overflow-hidden rounded-xl border shadow-[var(--shadow-pop)]">
          {/* window bar */}
          <div className="border-border-soft flex items-center gap-2 border-b px-4 py-3">
            <span className="bg-surface-3 h-3 w-3 rounded-full" />
            <span className="bg-surface-3 h-3 w-3 rounded-full" />
            <span className="bg-surface-3 h-3 w-3 rounded-full" />
            <span className="text-text-4 ml-3 text-xs">
              Lumen — Biology 101 / Respiration lecture
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] lg:grid-cols-[180px_1fr_240px]">
            {/* sidebar */}
            <aside className="border-border-soft hidden flex-col gap-1 border-r p-3 sm:flex">
              {folders.map((folder, i) => (
                <div
                  key={folder}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                    i === 0
                      ? "bg-[var(--accent-soft)] text-accent-text"
                      : "text-text-3"
                  }`}
                >
                  <span className="bg-current/60 h-3 w-3 rounded-sm opacity-70" />
                  {folder}
                </div>
              ))}
            </aside>

            {/* note pane */}
            <div className="p-6">
              <span className="l-chip mb-4">Lecture note</span>
              <h3 className="font-serif text-xl font-semibold text-foreground">
                Cellular respiration
              </h3>
              <div className="mt-4 space-y-2">
                <div className="bg-surface-2 h-3 w-5/6 rounded" />
                <div className="bg-surface-2 h-3 w-full rounded" />
                <div className="bg-surface-2 h-3 w-4/6 rounded" />
                <div className="bg-surface-2 mt-4 h-3 w-3/6 rounded" />
                <div className="bg-surface-2 h-3 w-5/6 rounded" />
              </div>
              <div className="mt-5 flex gap-2">
                <span className="border-border-soft text-text-3 rounded-full border px-2.5 py-1 text-xs">
                  #respiration
                </span>
                <span className="border-border-soft text-text-3 rounded-full border px-2.5 py-1 text-xs">
                  #midterm
                </span>
              </div>
            </div>

            {/* transcript pane */}
            <aside className="border-border-soft hidden border-l p-4 lg:block">
              <div className="text-text-4 mb-3 text-xs font-medium uppercase tracking-wide">
                Transcript
              </div>
              <div className="space-y-3">
                {transcriptLines.map((line, i) => (
                  <p
                    key={line}
                    className={`text-xs leading-relaxed ${
                      i === 0 ? "text-foreground" : "text-text-3"
                    }`}
                  >
                    <span className="text-accent-text mr-1.5 font-mono">
                      0:{String(12 + i * 7).padStart(2, "0")}
                    </span>
                    {line}
                  </p>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
