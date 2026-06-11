import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  citationHref,
  CitedText,
  SourceCards,
  splitCitations,
} from "@/components/assistant/citations";
import type { GroundedSource } from "@/server/services/grounded-retrieval";

function documentSource(over: Partial<GroundedSource> = {}): GroundedSource {
  return {
    citationId: "S1",
    kind: "document",
    title: "Biology notes",
    snippet: "the powerhouse of the cell",
    score: 0.9,
    source: { documentId: "d1" },
    ...over,
  };
}

function transcriptSource(
  source: Partial<{
    segmentId: string | null;
    startMs: number | null;
    endMs: number | null;
  }> = {},
): GroundedSource {
  return {
    citationId: "S2",
    kind: "transcript",
    title: "Lecture 3.wav",
    snippet: "the krebs cycle",
    score: 0.8,
    source: {
      transcriptId: "t1",
      recordingId: "r1",
      segmentId: "seg-1",
      startMs: 65_000,
      endMs: 70_000,
      ...source,
    },
  };
}

describe("splitCitations", () => {
  it("splits text around [S#] labels, keeping duplicates", () => {
    expect(splitCitations("Cells [S1] divide [S2] and grow [S1].")).toEqual([
      { kind: "text", text: "Cells " },
      { kind: "citation", label: "S1" },
      { kind: "text", text: " divide " },
      { kind: "citation", label: "S2" },
      { kind: "text", text: " and grow " },
      { kind: "citation", label: "S1" },
      { kind: "text", text: "." },
    ]);
  });

  it("returns plain text untouched", () => {
    expect(splitCitations("No citations here.")).toEqual([
      { kind: "text", text: "No citations here." },
    ]);
  });

  it("ignores non-citation brackets", () => {
    expect(splitCitations("[note] [S] [s1] [1]")).toEqual([
      { kind: "text", text: "[note] [S] [s1] [1]" },
    ]);
  });
});

describe("citationHref", () => {
  it("links document sources to the note", () => {
    expect(citationHref(documentSource())).toBe("/library/notes/d1");
  });

  it("links transcript sources to the cited segment", () => {
    expect(citationHref(transcriptSource())).toBe(
      "/library/transcripts/r1?segment=seg-1",
    );
  });

  it("falls back to the timestamp span when no segment resolved", () => {
    expect(citationHref(transcriptSource({ segmentId: null }))).toBe(
      "/library/transcripts/r1?t=65000",
    );
  });

  it("opens the transcript at the top when timing is null too", () => {
    expect(
      citationHref(
        transcriptSource({ segmentId: null, startMs: null, endMs: null }),
      ),
    ).toBe("/library/transcripts/r1");
  });
});

describe("CitedText", () => {
  it("renders known labels as links and unknown labels as plain text", () => {
    render(
      <CitedText
        text="Powerhouse [S1], unknown [S9]."
        sources={[documentSource()]}
      />,
    );
    const chip = screen.getByRole("link", { name: "S1" });
    expect(chip).toHaveAttribute("href", "/library/notes/d1");
    expect(screen.getByText("[S9]")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "S9" })).not.toBeInTheDocument();
  });

  it("renders every occurrence of a duplicate label as a chip", () => {
    render(<CitedText text="[S1] then [S1]" sources={[documentSource()]} />);
    expect(screen.getAllByRole("link", { name: "S1" })).toHaveLength(2);
  });
});

describe("SourceCards", () => {
  it("renders nothing without sources", () => {
    const { container } = render(<SourceCards sources={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders document and transcript cards with title, snippet, timestamp", () => {
    render(
      <SourceCards sources={[documentSource(), transcriptSource()]} />,
    );
    expect(screen.getByText("Biology notes")).toBeInTheDocument();
    expect(screen.getByText("the powerhouse of the cell")).toBeInTheDocument();
    expect(screen.getByText("Lecture 3.wav")).toBeInTheDocument();
    expect(screen.getByText("1:05")).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/library/notes/d1",
      "/library/transcripts/r1?segment=seg-1",
    ]);
  });

  it("omits the timestamp when transcript timing is null", () => {
    render(
      <SourceCards
        sources={[transcriptSource({ segmentId: null, startMs: null })]}
      />,
    );
    expect(screen.getByText("Lecture 3.wav")).toBeInTheDocument();
    expect(screen.queryByText(/^\d+:\d{2}$/)).not.toBeInTheDocument();
  });
});
