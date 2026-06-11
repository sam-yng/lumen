/**
 * Faithful in-memory Supabase double for the v4 m3 retrieval harness.
 *
 * Unlike the shared FakeSupabase (whose textSearch is a whole-string substring
 * stub), this double approximates Postgres `websearch_to_tsquery` AND semantics
 * over unstemmed tokens, and routes `match_semantic_search_chunks` through the
 * reference RPC scored on the corpus embeddings — so both the lexical and the
 * hybrid path measure what production would do, not the stub's behavior.
 */

import type { FixtureChunkRow } from "@/server/services/__tests__/retrieval-eval/reference-rpc";
import { matchSemanticSearchChunksReference } from "@/server/services/__tests__/retrieval-eval/reference-rpc";
import type {
  RpcResult,
  ServiceQuery,
  ServiceSupabaseClient,
} from "@/server/services/context";

type Row = Record<string, unknown>;

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function textColumnFor(column: string): string {
  if (column === "content_tsv") return "content_text";
  if (column === "full_text_tsv") return "full_text";
  return column;
}

class EvalQuery implements ServiceQuery<Row> {
  private eqFilters: Array<{ column: string; value: unknown }> = [];
  private inFilters: Array<{ column: string; values: unknown[] }> = [];
  private ilikeFilters: Array<{ column: string; needle: string }> = [];
  private textSearchFilters: Array<{ column: string; tokens: string[] }> = [];

  constructor(private readonly rows: Row[]) {}

  select() {
    return this;
  }
  eq(column: string, value: unknown) {
    this.eqFilters.push({ column, value });
    return this;
  }
  in(column: string, values: unknown[]) {
    this.inFilters.push({ column, values });
    return this;
  }
  ilike(column: string, pattern: string) {
    this.ilikeFilters.push({
      column,
      needle: pattern.replace(/%/g, "").toLowerCase(),
    });
    return this;
  }
  textSearch(column: string, query: string) {
    this.textSearchFilters.push({ column, tokens: tokenize(query) });
    return this;
  }
  order() {
    return this;
  }
  insert() {
    return this;
  }
  update() {
    return this;
  }
  delete() {
    return this;
  }
  async single() {
    return { data: this.apply()[0] ?? null, error: null };
  }
  async maybeSingle() {
    return this.single();
  }
  // biome-ignore lint/suspicious/noThenProperty: mirrors the awaitable query builder contract.
  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: Row[];
          error: null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.apply(), error: null as null }).then(
      onfulfilled,
      onrejected,
    );
  }

  private apply(): Row[] {
    return this.rows
      .filter((row) => this.eqFilters.every((f) => row[f.column] === f.value))
      .filter((row) =>
        this.inFilters.every((f) => f.values.includes(row[f.column])),
      )
      .filter((row) =>
        this.ilikeFilters.every((f) =>
          String(row[f.column] ?? "")
            .toLowerCase()
            .includes(f.needle),
        ),
      )
      .filter((row) =>
        this.textSearchFilters.every((f) => {
          const content = new Set(
            tokenize(String(row[textColumnFor(f.column)] ?? "")),
          );
          return f.tokens.length > 0 && f.tokens.every((t) => content.has(t));
        }),
      );
  }
}

export class EvalSupabase implements ServiceSupabaseClient {
  constructor(
    private readonly tables: Record<string, Row[]>,
    private readonly chunkRows: FixtureChunkRow[],
    private readonly matchUserId: string,
  ) {}

  from<R extends Record<string, unknown>>(table: string): ServiceQuery<R> {
    return new EvalQuery(
      this.tables[table] ?? [],
    ) as unknown as ServiceQuery<R>;
  }

  async rpc<R extends Record<string, unknown>>(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<RpcResult<R>> {
    if (fn !== "match_semantic_search_chunks") {
      return { data: [], error: null };
    }
    const queryEmbedding = parseEmbedding(args.query_embedding);
    const rows = matchSemanticSearchChunksReference({
      chunks: this.chunkRows,
      queryEmbedding,
      queryText: String(args.query_text ?? ""),
      matchUserId: this.matchUserId,
      matchCount: Number(args.match_count ?? 8),
    });
    return { data: rows as unknown as R[], error: null };
  }
}

function parseEmbedding(value: unknown): number[] {
  if (Array.isArray(value)) return value as number[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as number[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}
