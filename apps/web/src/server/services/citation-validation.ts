import type { GroundedSource } from "@/server/services/grounded-retrieval";

/**
 * The wire shape of an [S#] citation in assistant text. Shared with the UI
 * splitter (components/assistant/citation-format.ts) so validation and
 * rendering can never disagree on what counts as a citation. Safe to share as
 * a global regex: both sides use String.matchAll, which clones the regex.
 */
export const CITATION_MENTION_PATTERN = /\[(S\d+)\]/g;

export type CitationSummary = {
  validMentions: number;
  invalidMentions: number;
};

export type CitationValidation = {
  /** Retrieved sources that the answer actually cites, in retrieved order. */
  sources: GroundedSource[];
  /** Distinct cited labels with no matching retrieved source, first-seen order. */
  invalidCitations: string[];
  /** Per-turn mention counts for observability. */
  summary: CitationSummary;
};

/**
 * Check every [S#] mention in an answer against the sources retrieved that
 * turn. Existence-only: a mention is valid iff its exact label matches a
 * retrieved citationId. The answer text itself is never modified.
 */
export function validateCitations(
  message: string,
  sources: GroundedSource[],
): CitationValidation {
  const byLabel = new Map(sources.map((s) => [s.citationId, s]));
  const citedLabels = new Set<string>();
  const invalidCitations: string[] = [];
  const summary: CitationSummary = { validMentions: 0, invalidMentions: 0 };

  for (const match of message.matchAll(CITATION_MENTION_PATTERN)) {
    const label = match[1] ?? "";
    if (byLabel.has(label)) {
      summary.validMentions += 1;
      citedLabels.add(label);
    } else {
      summary.invalidMentions += 1;
      if (!invalidCitations.includes(label)) invalidCitations.push(label);
    }
  }

  return {
    sources: sources.filter((s) => citedLabels.has(s.citationId)),
    invalidCitations,
    summary,
  };
}
