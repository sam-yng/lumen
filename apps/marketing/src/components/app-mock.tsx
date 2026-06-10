import type { CSSProperties } from "react";
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

const systemStages = [
  {
    label: "Local capture",
    value: "recordings, notes, files",
  },
  {
    label: "Hybrid retrieval",
    value: "full-text + semantic chunks",
  },
  {
    label: "MCP tools",
    value: "same contract in-app and external",
  },
  {
    label: "Claude assistant",
    value: "enabled with your API key",
  },
] as const;

const toolCalls = [
  "search_notes",
  "get_transcript",
  "list_by_tag",
  "create_note",
] as const;

const retrievalRows = [
  { label: "FTS", value: "respiration lecture" },
  { label: "Vector", value: "membrane surface area" },
  { label: "Source", value: "Biology 101 / week 08" },
] as const;

const waveformBars = Array.from({ length: 24 }, (_, i) => ({
  id: `waveform-${i}`,
  height: `${18 + ((i * 17) % 28)}px`,
  index: i,
}));

export function AppMock({
  variant = "section",
}: {
  variant?: "hero" | "section";
}) {
  if (variant === "hero") {
    return <ProductFrame compact />;
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-20">
      <Reveal className="grid items-start gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:gap-12">
        <div className="reveal max-w-sm lg:sticky lg:top-24">
          <span className="l-chip">AI and retrieval layer</span>
          <h2 className="mt-5 max-w-sm text-balance font-serif text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
            Not just storage. A tool-aware study system.
          </h2>
          <p className="text-text-2 mt-4 text-pretty text-base leading-relaxed">
            Lumen turns your workspace into retrievable context: local
            transcripts, semantic chunks, service-layer tools, MCP access, and
            an in-app assistant when you add your Claude API key.
          </p>
          <div className="mt-7 grid gap-3">
            {systemStages.map((stage) => (
              <div
                key={stage.label}
                className="border-border-soft bg-surface/60 l-system-card rounded-lg border p-3"
              >
                <p className="text-sm font-medium text-foreground">
                  {stage.label}
                </p>
                <p className="text-text-3 mt-1 text-xs">{stage.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="reveal">
          <CapabilityMap />
        </div>
      </Reveal>
    </section>
  );
}

function CapabilityMap() {
  return (
    <div
      aria-hidden="true"
      className="border-border-soft bg-surface relative overflow-hidden rounded-xl border p-4 shadow-[var(--shadow-pop)] sm:p-5"
    >
      <div className="l-system-grid" />
      <div className="relative grid gap-4 lg:grid-cols-[1fr_0.92fr]">
        <div className="space-y-4">
          <div className="border-border-soft bg-background/50 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="l-chip">Retrieval</span>
              <span className="text-text-4 font-mono text-[10px]">
                scoped by user
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {retrievalRows.map((row, i) => (
                <div
                  key={row.label}
                  className="l-retrieval-row bg-surface-2 flex items-center gap-3 rounded-md px-3 py-2"
                  style={{ "--i": i } as CSSProperties}
                >
                  <span className="text-accent-text w-14 font-mono text-[10px]">
                    {row.label}
                  </span>
                  <span className="text-text-2 truncate text-xs">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border-border-soft bg-background/50 rounded-lg border p-4">
              <span className="text-text-4 text-[10px] font-medium uppercase tracking-wide">
                Local transcription
              </span>
              <div className="mt-4 flex h-14 items-end gap-1.5">
                {waveformBars.slice(0, 14).map((bar) => (
                  <span
                    key={`system-${bar.id}`}
                    className="l-wave bg-ok/80 w-full rounded-full"
                    style={
                      {
                        "--h": bar.height,
                        "--i": bar.index,
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
            </div>

            <div className="border-border-soft bg-background/50 rounded-lg border p-4">
              <span className="text-text-4 text-[10px] font-medium uppercase tracking-wide">
                Semantic chunks
              </span>
              <div className="mt-4 grid grid-cols-5 gap-1.5">
                {Array.from({ length: 20 }, (_, i) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: static decorative grid
                    key={i}
                    className="l-vector-cell bg-[var(--accent-soft)] h-4 rounded"
                    style={{ "--i": i } as CSSProperties}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-border-soft bg-background/50 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="l-chip">Assistant</span>
            <span className="text-warn font-mono text-[10px]">Claude key</span>
          </div>
          <div className="mt-4 rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] p-3">
            <p className="text-sm font-medium text-foreground">
              "Summarize the respiration lecture and make exam prompts."
            </p>
            <p className="text-text-3 mt-2 text-xs leading-relaxed">
              The assistant can call scoped MCP tools over your own workspace.
              Inference runs through your Anthropic account.
            </p>
          </div>
          <div className="mt-4 space-y-2">
            {toolCalls.map((tool, i) => (
              <div
                key={tool}
                className="l-tool-call border-border-soft bg-surface-2 flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                style={{ "--i": i } as CSSProperties}
              >
                <span className="text-text-2 font-mono text-xs">{tool}</span>
                <span className="bg-ok h-1.5 w-1.5 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductFrame({ compact = false }: { compact?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`l-product-frame border-border-soft bg-surface overflow-hidden rounded-xl border shadow-[var(--shadow-pop)] ${
        compact ? "l-product-frame--compact" : ""
      }`}
    >
      <div className="border-border-soft flex items-center gap-2 border-b px-4 py-3">
        <span className="bg-danger/70 h-3 w-3 rounded-full" />
        <span className="bg-warn/70 h-3 w-3 rounded-full" />
        <span className="bg-ok/70 h-3 w-3 rounded-full" />
        <span className="text-text-4 ml-3 truncate text-xs">
          Lumen - Biology 101 / Respiration lecture
        </span>
        <span className="l-live-dot ml-auto hidden sm:inline-flex" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[164px_1fr] lg:grid-cols-[174px_1fr_230px]">
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
              <span className="h-3 w-3 rounded-sm bg-current/60 opacity-70" />
              <span className="truncate">{folder}</span>
            </div>
          ))}
          <div className="border-border-soft mt-3 border-t pt-3">
            <div className="text-text-4 mb-2 text-[10px] font-medium uppercase tracking-wide">
              Upload
            </div>
            <div className="bg-surface-2 rounded-lg p-2">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-text-2 truncate">week-08.m4a</span>
                <span className="text-busy font-mono">42%</span>
              </div>
              <div className="bg-surface-3 mt-2 h-1.5 overflow-hidden rounded-full">
                <div className="l-progress h-full rounded-full bg-busy" />
              </div>
            </div>
          </div>
        </aside>

        <div className={compact ? "p-5" : "p-6"}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="l-chip">Lecture note</span>
            <span className="border-border-soft text-text-3 rounded-full border px-2.5 py-1 text-xs">
              #midterm
            </span>
          </div>
          <p className="mt-4 font-serif text-xl font-semibold text-foreground">
            Cellular respiration
          </p>
          <div className="mt-4 space-y-2">
            <div className="l-type-line bg-surface-2 h-3 w-5/6 rounded" />
            <div className="l-type-line bg-surface-2 h-3 w-full rounded [animation-delay:260ms]" />
            <div className="l-type-line bg-surface-2 h-3 w-4/6 rounded [animation-delay:520ms]" />
            <div className="bg-surface-2 mt-4 h-3 w-3/6 rounded" />
            <div className="bg-surface-2 h-3 w-5/6 rounded" />
          </div>

          <div className="border-border-soft bg-surface/70 mt-5 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-text-3 text-xs">Recording</span>
              <span className="text-warn font-mono text-xs">local</span>
            </div>
            <div className="mt-3 flex h-12 items-end gap-1">
              {waveformBars.map((bar) => (
                <span
                  key={bar.id}
                  className="l-wave bg-accent-text/70 w-full rounded-full"
                  style={
                    {
                      "--h": bar.height,
                      "--i": bar.index,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          </div>
        </div>

        <aside className="border-border-soft hidden border-l p-4 lg:block">
          <div className="text-text-4 mb-3 text-xs font-medium uppercase tracking-wide">
            Transcript
          </div>
          <div className="space-y-3">
            {transcriptLines.map((line, i) => (
              <p
                key={line}
                className={`l-transcript-line rounded-md px-2 py-1 text-xs leading-relaxed ${
                  i === 0 ? "text-foreground" : "text-text-3"
                }`}
                style={{ "--i": i } as CSSProperties}
              >
                <span className="text-accent-text mr-1.5 font-mono">
                  0:{String(12 + i * 7).padStart(2, "0")}
                </span>
                {line}
              </p>
            ))}
          </div>
          <div className="border-border-soft bg-surface-2 mt-5 rounded-lg border p-3">
            <div className="text-text-4 text-[10px] font-medium uppercase tracking-wide">
              Search
            </div>
            <div className="border-border-soft mt-2 flex items-center gap-2 rounded-md border px-2 py-1.5">
              <span className="bg-accent-text h-1.5 w-1.5 rounded-full" />
              <span className="text-text-2 text-xs">cristae exam</span>
              <span className="l-caret bg-accent-text h-3 w-px" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
