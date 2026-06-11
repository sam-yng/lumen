"use client";

import { FileText, Mic } from "lucide-react";
import Link from "next/link";
import type {
  GroundedSource,
  GroundedTranscriptSource,
} from "@/server/services/grounded-retrieval";

export type CitationPart =
  | { kind: "text"; text: string }
  | { kind: "citation"; label: string };

const CITATION_PATTERN = /\[(S\d+)\]/g;

/** Split assistant text into plain runs and [S#] citation labels. */
export function splitCitations(text: string): CitationPart[] {
  const parts: CitationPart[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(CITATION_PATTERN)) {
    if (match.index > lastIndex) {
      parts.push({ kind: "text", text: text.slice(lastIndex, match.index) });
    }
    parts.push({ kind: "citation", label: match[1] ?? "" });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ kind: "text", text: text.slice(lastIndex) });
  }
  return parts;
}

function isTranscriptSource(
  source: GroundedSource["source"],
): source is GroundedTranscriptSource {
  return "transcriptId" in source;
}

/**
 * Where a citation clicks through to.
 * - Documents open the note.
 * - Transcripts deep-link the viewer: ?segment=<id> when the cited segment is
 *   known, else ?t=<startMs> for a timestamp-only span, else the plain
 *   transcript page (null timing opens at the top).
 */
export function citationHref(source: GroundedSource): string {
  if (!isTranscriptSource(source.source)) {
    return `/library/notes/${source.source.documentId}`;
  }
  const transcript = source.source;
  const base = `/library/transcripts/${transcript.recordingId}`;
  if (transcript.segmentId !== null) {
    return `${base}?segment=${transcript.segmentId}`;
  }
  if (transcript.startMs !== null) return `${base}?t=${transcript.startMs}`;
  return base;
}

function formatTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

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
      {splitCitations(text).map((part, index) => {
        if (part.kind === "text") {
          // biome-ignore lint/suspicious/noArrayIndexKey: static split of one string
          return <span key={index}>{part.text}</span>;
        }
        const source = byLabel.get(part.label);
        if (!source) {
          // Unknown label (model invented it, or sources were lost): plain text.
          // biome-ignore lint/suspicious/noArrayIndexKey: static split of one string
          return <span key={index}>[{part.label}]</span>;
        }
        return (
          <Link
            // biome-ignore lint/suspicious/noArrayIndexKey: static split of one string
            key={index}
            href={citationHref(source)}
            title={source.title}
            className="mx-0.5 inline-flex items-center rounded bg-[var(--accent-soft)] px-1 align-baseline font-mono text-[11px] text-[var(--accent-text)] hover:underline"
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
              className="block rounded-md border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-1.5 transition hover:bg-[var(--surface-3)]"
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <span className="font-mono text-[10px] text-[var(--accent-text)]">
                  {source.citationId}
                </span>
                {source.kind === "transcript" ? (
                  <Mic className="size-3 shrink-0 text-[var(--text-3)]" />
                ) : (
                  <FileText className="size-3 shrink-0 text-[var(--text-3)]" />
                )}
                <span className="truncate">{source.title}</span>
                {timestamp ? (
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-[var(--text-3)]">
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
