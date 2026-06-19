import { BookOpenText, LockKeyhole, Mic, Sparkles } from "lucide-react";
import { LumenMark } from "@/components/lumen-mark";

const FEATURES = [
  { label: "Nested study folders", icon: BookOpenText },
  { label: "Local audio transcription", icon: Mic },
  { label: "Tag and search everything", icon: Sparkles },
  { label: "Private workspace guardrails", icon: LockKeyhole },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh bg-background text-foreground min-[860px]:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-border-soft bg-surface p-10 min-[860px]:flex min-[860px]:flex-col min-[860px]:justify-between">
        <div
          className="pointer-events-none absolute -top-28 -left-28 size-80 rounded-full opacity-70 blur-3xl"
          style={{ background: "var(--accent-glow)" }}
        />
        <div className="relative">
          <div className="mb-16 inline-flex items-center gap-2.5">
            <LumenMark className="size-8 shadow-[0_0_24px_var(--accent-glow)]" />
            <span className="text-[17px] font-semibold">Lumen</span>
          </div>
          <h1 className="max-w-xl font-serif text-[38px] leading-[1.15] text-foreground">
            A quiet vault for notes, recordings, and the thoughts between them.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-text-2">
            Build a study library that keeps context close: folders, rich notes,
            uploaded files, transcripts, tags, and fast full-text recall.
          </p>
          <div className="mt-9 grid max-w-md gap-3">
            {FEATURES.map(({ label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="grid size-7 place-items-center rounded-md bg-(--accent-soft) text-accent-text">
                  <Icon className="size-4" />
                </span>
                <span className="text-sm text-text-2">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative font-mono text-[11.5px] leading-5 text-text-3">
          Private by default · your recordings never leave your machine
        </p>
      </section>
      <section className="flex min-h-dvh flex-col p-4 py-8 sm:p-6">
        <div className="flex flex-1 items-center justify-center">
          {children}
        </div>
      </section>
    </main>
  );
}
