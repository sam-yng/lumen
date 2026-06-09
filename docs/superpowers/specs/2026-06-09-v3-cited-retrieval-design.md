# V3 Cited Retrieval — Design

> **Status:** approved design (brainstorm complete)
> **Version:** v3 milestone 1
> **Area:** retrieval, citations, MCP, in-app assistant
> **Created:** 2026-06-09
> **Depends on:** `docs/exec-plans/completed/v2/semantic-search.md`,
> `docs/exec-plans/completed/v2/mcp-server-auth.md`,
> `docs/superpowers/specs/2026-06-08-in-app-assistant-design.md`

## Goal

Make Lumen's assistant and MCP retrieval source-grounded by returning structured
citations that point back to exact workspace sources. Transcript citations
should include the recording, timestamp span, and best matching transcript
segment when available.

This is the first v3 milestone. It deliberately does not change the audio
pipeline, sidebar search UI, batch transcription worker, or future
diarization/streaming decisions.

## Non-Negotiables

- Keep the existing `/api/search` route and sidebar `SearchPanel` contract
  unchanged.
- Improve the service/MCP retrieval contract in one place so both external MCP
  clients and the in-app assistant inherit citations.
- Reuse existing v2 semantic chunk metadata:
  `document_id`, `transcript_id`, `recording_id`, `start_ms`, and `end_ms`.
- Do not add a new LLM answer-generation service in this milestone. The model
  still composes the answer; Lumen supplies cited sources and prompt rules.
- Every query remains scoped to the authenticated user. Cross-user semantic rows
  must stay filtered by `user_id`.

## Key Decisions

1. **Approach:** add a citation-rich retrieval contract now, not a server-built
   `answer_question` tool. This is smaller, uses shipped v2 seams, and leaves
   room for a future cited-answer service without reshaping the source objects.
2. **Surface:** ship citations first through MCP `search_notes` and the in-app
   assistant. The sidebar search UI remains stable.
3. **Transcript precision:** resolve transcript chunk timestamps back to the
   best overlapping `transcript_segments` row when possible. If no exact segment
   matches, still return the timestamp span.
4. **Document precision:** cite document id + snippet for now. Exact document
   text offsets are out of scope because v2 document chunks do not store offsets.
5. **Rendering:** assistant citations are plain inline labels such as `[S1]`.
   Rich citation popovers and deep links are a later UI milestone.

## Architecture

Add a new service-layer retrieval path beside the existing search path:

```
assistant / external MCP host
  │
  ▼
search_notes MCP tool
  │
  ▼
retrieveGroundedSources(ctx, query, { embeddingProvider? })
  │
  ├─ semantic chunk RPC (when provider is supplied)
  ├─ lexical transcript/document fallback
  ├─ document hydration by id
  └─ transcript segment resolution by timestamp overlap
```

`searchLibrary` continues to return the current `SearchResult[]` for app search.
The new retrieval function returns citation-ready sources:

```ts
export type GroundedSource = {
  citationId: string;
  kind: "document" | "transcript";
  title: string;
  snippet: string;
  score: number | null;
  source: GroundedDocumentSource | GroundedTranscriptSource;
};

export type GroundedDocumentSource = {
  documentId: string;
};

export type GroundedTranscriptSource = {
  transcriptId: string;
  recordingId: string;
  segmentId: string | null;
  startMs: number | null;
  endMs: number | null;
};
```

`citationId` values are assigned after ranking, starting at `S1`, so a response
can cite returned sources deterministically as `[S1]`, `[S2]`, and so on.

## Data Flow

For an in-app assistant question:

1. The assistant receives the user's message and may call `search_notes`.
2. `search_notes` returns JSON with citation-ready `GroundedSource[]`.
3. The assistant system prompt instructs the model to answer factual questions
   about workspace content only from returned sources, cite claims with `[S#]`,
   and say when the sources do not support an answer.
4. The browser continues to render a plain text assistant message. Citations
   appear inline, for example: `Oxidative phosphorylation creates ATP [S1].`

External MCP clients receive the same JSON tool result and can render citations
however they choose.

Example transcript source:

```json
{
  "citationId": "S1",
  "kind": "transcript",
  "title": "seminar-week-4.m4a",
  "snippet": "The tutor defines oxidative phosphorylation...",
  "score": 0.88,
  "source": {
    "transcriptId": "t1",
    "recordingId": "r1",
    "segmentId": "seg42",
    "startMs": 812000,
    "endMs": 826000
  }
}
```

## Retrieval Details

Semantic chunk rows already carry source metadata. The cited retrieval service
should parse the same RPC rows as `searchLibrary`, but keep more metadata:

- document chunks: `documentId`, `content`, `similarity`
- transcript chunks: `transcriptId`, `recordingId`, `startMs`, `endMs`,
  `content`, `similarity`

For transcript chunks, load candidate `transcript_segments` rows by
`transcript_id` and timestamp overlap:

```sql
segment.start_ms <= chunk.end_ms
and segment.end_ms >= chunk.start_ms
```

Choose the segment with the largest overlap. If there is a tie, choose the
earliest `start_ms`. If no overlap exists, return `segmentId: null` and preserve
the chunk timestamp span.

For lexical transcript hits, use the transcript-level match as a broader
citation. If needed, approximate the timestamp by selecting the first segment
whose text contains the first query term. If no segment matches, return the
transcript id and recording id with null timing.

## MCP And Assistant Behavior

`search_notes` changes from the legacy `SearchResult[]` shape to a cited
retrieval payload:

```ts
export type SearchNotesToolResult = {
  query: string;
  sources: GroundedSource[];
};
```

The tool description should say that returned `citationId` labels are the only
valid labels to cite.

The assistant system prompt should add three rules:

- Use tool-returned sources for claims about the user's workspace.
- Cite each supported claim with labels like `[S1]`.
- If the sources are insufficient, say what is missing instead of guessing.

The assistant response type and UI do not need to change in this milestone.

## Error Handling

- Empty or whitespace queries return `{ query, sources: [] }`.
- If semantic search is unavailable because no embedding provider is supplied,
  return lexical cited sources.
- Malformed semantic rows are skipped, matching existing `searchLibrary`
  behavior.
- Transcript chunks with no matching segment keep their timestamp span and set
  `segmentId: null`.
- Transcript results with no timing data still cite the transcript and
  recording.
- Database errors use existing `ServiceError`/`assertNoDatabaseError` handling
  and surface through MCP as error results.

## Testing

- Pure helper tests for assigning stable citation labels and choosing the best
  overlapping transcript segment.
- Service tests for semantic transcript chunks returning `recordingId`,
  `startMs`, `endMs`, and resolved `segmentId`.
- Service tests for lexical fallback citations when no embedding provider is
  supplied.
- Security tests that cross-user semantic rows and transcript segments are not
  returned.
- MCP tests that `runSearchNotes` returns `{ query, sources }` with citation
  labels.
- Assistant tests that the system prompt includes citation rules and the tool
  loop still executes through MCP.
- Regression tests that `searchLibrary`, `/api/search`, and the sidebar search
  result shape remain unchanged.

## Out Of Scope

- Live/streaming transcription.
- Speaker diarization.
- Python sidecar evaluation for diarization.
- Citation popovers, sidebar source cards, or clickable citation UI.
- Server-built `answer_question` generation with citation validation.
- Document text offsets and exact paragraph anchors.
- Reranking beyond the current hybrid ranking inputs.

## Verification Gate

- `bun run check` green.
- Focused service and MCP tests pass.
- Manual assistant happy path: ask a question over an existing transcript and
  confirm the answer cites returned `[S#]` labels.
- Manual MCP check: call `search_notes` and confirm each source has a stable
  `citationId` and enough metadata to open the source later.
