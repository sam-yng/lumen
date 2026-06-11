/**
 * Labeled fixture corpus for the v4 m3 retrieval-quality measurement.
 *
 * Study-notes documents + lecture transcripts, with queries grouped by the
 * failure shapes hybrid ranking is suspected of:
 *   - keyword: query terms appear verbatim in the target (lexical + semantic).
 *   - cross-chunk: the answer is spread across several distinct sources.
 *   - paraphrase: query uses synonyms that do NOT appear in the target text,
 *     so the hash-based DeterministicEmbeddingProvider has no shared tokens to
 *     score on (the real ceiling of the shipped embedding).
 *
 * Text is written so Postgres stemming never decides an outcome (see the
 * fidelity caveats in the plan).
 */

import type {
  FixtureDocument,
  FixtureQuery,
  FixtureTranscript,
} from "@/server/services/__tests__/retrieval-eval/corpus";

export const documents: FixtureDocument[] = [
  {
    id: "doc-mito",
    title: "Mitochondria",
    text: "Mitochondria synthesize ATP through aerobic respiration. The inner membrane hosts the electron transport chain where ATP synthase phosphorylates ADP.",
  },
  {
    id: "doc-photo",
    title: "Photosynthesis",
    text: "Photosynthesis occurs in chloroplasts. Sunlight drives the light reactions on the thylakoid, and the Calvin cycle fixes carbon dioxide into sugar.",
  },
  {
    id: "doc-dna",
    title: "DNA replication",
    text: "DNA replication is semiconservative. Helicase unwinds the double helix and polymerase assembles complementary nucleotides along each template strand.",
  },
  {
    id: "doc-neuron",
    title: "Neurons",
    text: "A neuron fires an action potential when depolarization crosses threshold. The signal travels down the axon and releases neurotransmitter at the synapse.",
  },
  {
    id: "doc-osmosis",
    title: "Osmosis",
    text: "Osmosis is the diffusion of water across a semipermeable membrane from low solute concentration to high solute concentration until equilibrium.",
  },
  {
    id: "doc-enzyme",
    title: "Enzymes",
    text: "An enzyme is a biological catalyst that lowers activation energy. The substrate binds the active site, and the reaction proceeds faster without being consumed.",
  },
  {
    id: "doc-immune",
    title: "Immune response",
    text: "Antibodies bind antigens displayed by invaders. Memory cells persist after the first encounter so a later exposure triggers a faster secondary response.",
  },
  {
    id: "doc-evolution",
    title: "Natural selection",
    text: "Natural selection favors heritable variation that improves reproductive success. Over generations advantageous adaptation accumulates within a population.",
  },
  {
    id: "doc-krebs",
    title: "Krebs cycle",
    text: "The Krebs cycle oxidizes acetyl groups in the mitochondrial matrix, producing NADH and FADH2 that feed the electron transport chain to make ATP.",
  },
  {
    id: "doc-glycolysis",
    title: "Glycolysis",
    text: "Glycolysis splits glucose into pyruvate in the cytoplasm, yielding a small net amount of ATP and the NADH that later supports respiration.",
  },
  {
    id: "doc-cellwall",
    title: "Cell wall",
    text: "The plant cell wall is built from cellulose fibers. It provides structural rigidity and resists the turgor pressure created by water entering the vacuole.",
  },
  {
    id: "doc-mitosis",
    title: "Mitosis",
    text: "Mitosis divides one nucleus into two identical daughter nuclei through prophase, metaphase, anaphase, and telophase, conserving the chromosome number.",
  },
];

export const transcripts: FixtureTranscript[] = [
  {
    id: "tx-cell-lecture",
    recordingId: "rec-cell",
    fileName: "Cell energy lecture.m4a",
    segments: [
      {
        startMs: 0,
        endMs: 6000,
        text: "Today we trace how a cell captures energy and stores it as ATP for later work.",
      },
      {
        startMs: 6000,
        endMs: 12000,
        text: "Respiration in the mitochondria is the main source of ATP in animal cells.",
      },
    ],
  },
  {
    id: "tx-genetics-lecture",
    recordingId: "rec-genetics",
    fileName: "Genetics lecture.m4a",
    segments: [
      {
        startMs: 0,
        endMs: 6000,
        text: "Replication copies DNA before a cell divides so each daughter keeps the full genome.",
      },
      {
        startMs: 6000,
        endMs: 12000,
        text: "Polymerase reads each template strand and pairs nucleotides to build the new strand.",
      },
    ],
  },
];

export const queries: FixtureQuery[] = [
  // --- keyword (terms appear verbatim) ---
  {
    id: "kw-mito",
    kind: "keyword",
    text: "mitochondria ATP",
    relevantSourceIds: ["doc:doc-mito"],
  },
  {
    id: "kw-photo",
    kind: "keyword",
    text: "photosynthesis chloroplasts",
    relevantSourceIds: ["doc:doc-photo"],
  },
  {
    id: "kw-osmosis",
    kind: "keyword",
    text: "osmosis semipermeable membrane",
    relevantSourceIds: ["doc:doc-osmosis"],
  },
  {
    id: "kw-enzyme",
    kind: "keyword",
    text: "enzyme activation energy catalyst",
    relevantSourceIds: ["doc:doc-enzyme"],
  },
  {
    id: "kw-dna",
    kind: "keyword",
    text: "DNA replication nucleotides",
    relevantSourceIds: ["doc:doc-dna", "tx:tx-genetics-lecture"],
  },
  // --- cross-chunk (answer spread across distinct sources) ---
  {
    id: "xc-atp-pathways",
    kind: "cross-chunk",
    text: "ATP respiration mitochondria",
    relevantSourceIds: [
      "doc:doc-mito",
      "doc:doc-krebs",
      "doc:doc-glycolysis",
      "tx:tx-cell-lecture",
    ],
  },
  {
    id: "xc-replication",
    kind: "cross-chunk",
    text: "replication polymerase template strand",
    relevantSourceIds: ["doc:doc-dna", "tx:tx-genetics-lecture"],
  },
  // --- paraphrase (synonyms absent from target text) ---
  {
    id: "pp-powerhouse",
    kind: "paraphrase",
    text: "which organelle is the powerhouse of the cell",
    relevantSourceIds: ["doc:doc-mito"],
  },
  {
    id: "pp-immune",
    kind: "paraphrase",
    text: "how the body defends itself against germs",
    relevantSourceIds: ["doc:doc-immune"],
  },
  {
    id: "pp-evolution",
    kind: "paraphrase",
    text: "why do species change over long periods of time",
    relevantSourceIds: ["doc:doc-evolution"],
  },
  {
    id: "pp-neuron",
    kind: "paraphrase",
    text: "how do nerve cells send messages",
    relevantSourceIds: ["doc:doc-neuron"],
  },
];
