"use client";

import { FileText, Mic } from "lucide-react";
import Link from "next/link";
import {
  citationHref,
  formatTime,
  isTranscriptSource,
  splitCitations,
} from "@/components/assistant/citation-format";
import type { GroundedSource } from "@/server/services/grounded-retrieval";

/** Assistant text with known [S#] labels rendered as clickable chips. */
export function CitedText({
  text,
  sources,
}: {
  text: string;
  sources: GroundedSource[];
}) {
  const byLabel = new Map(sources.map((source) => [source.citationId, source]));
  return (
    <p>
      {splitCitations(text).map((part) => {
        if (part.kind === "text") {
          return <span key={part.start}>{part.text}</span>;
        }
        const source = byLabel.get(part.label);
        if (!source) {
          // Server-side validation found no retrieved source for this label
          // (hallucinated citation, or sources were lost): degraded chip.
          return (
            <span
              key={part.start}
              title="This citation does not match any source from this answer."
              className="mx-0.5 inline-flex items-center rounded border border-dashed border-border-soft px-1 align-baseline font-mono text-[11px] text-text-3 line-through"
            >
              {part.label}
            </span>
          );
        }
        return (
          <Link
            key={part.start}
            href={citationHref(source)}
            title={source.title}
            className="mx-0.5 inline-flex items-center rounded bg-(--accent-soft) px-1 align-baseline font-mono text-[11px] text-accent-text hover:underline"
          >
            {part.label}
          </Link>
        );
      })}
    </p>
  );
}

/** The turn's sources as click-through cards below the answer. */
export function SourceCards({ sources }: { sources: GroundedSource[] }) {
  if (sources.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1">
      {sources.map((source) => {
        const timestamp =
          isTranscriptSource(source.source) && source.source.startMs !== null
            ? formatTime(source.source.startMs)
            : null;
        return (
          <li key={source.citationId}>
            <Link
              href={citationHref(source)}
              className="block rounded-md border border-border-soft bg-surface-2 px-2 py-1.5 transition hover:bg-surface-3"
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <span className="font-mono text-[10px] text-accent-text">
                  {source.citationId}
                </span>
                {source.kind === "transcript" ? (
                  <Mic className="size-3 shrink-0 text-text-3" />
                ) : (
                  <FileText className="size-3 shrink-0 text-text-3" />
                )}
                <span className="truncate">{source.title}</span>
                {timestamp ? (
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-text-3">
                    {timestamp}
                  </span>
                ) : null}
              </span>
              {source.snippet ? (
                <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                  {source.snippet}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
