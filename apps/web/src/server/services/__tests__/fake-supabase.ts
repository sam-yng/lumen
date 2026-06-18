import type {
  QueryResult,
  ServiceContext,
  ServiceQuery,
} from "@/server/services/context";

export type Row = Record<string, unknown>;
export type QueryAction = "delete" | "insert" | "select" | "update";
export type QueryLogEntry = {
  action: QueryAction;
  table: string;
  filters: Array<{ column: string; value: unknown }>;
  values?: Row | Row[];
};
export type RpcLogEntry = {
  fn: string;
  args: Record<string, unknown>;
};

export const userId = "user-1";
export const otherUserId = "user-2";

export class FakeQuery implements ServiceQuery<Row> {
  private filters: Array<{ column: string; value: unknown }> = [];
  private inFilters: Array<{ column: string; values: unknown[] }> = [];
  private ilikeFilters: Array<{ column: string; needle: string }> = [];
  private textSearchFilters: Array<{ column: string; needle: string }> = [];
  private orderBy: string | null = null;
  private pendingSelect = false;
  private pendingUpdate: Row | null = null;
  private pendingDelete = false;
  private insertedRows: Row[] | null = null;

  constructor(
    private readonly table: string,
    private readonly rows: Row[],
    private readonly queryLog: QueryLogEntry[],
    private readonly error: Error | null = null,
  ) {}

  select() {
    this.pendingSelect = true;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
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
    this.textSearchFilters.push({
      column,
      needle: query.toLowerCase(),
    });
    return this;
  }

  order(column: string) {
    this.orderBy = column;
    return this;
  }

  update(values: Row) {
    this.pendingUpdate = values;
    return this;
  }

  insert(values: Row | Row[]) {
    const insertedRows = Array.isArray(values) ? values : [values];
    this.rows.push(...insertedRows);
    this.insertedRows = insertedRows;
    this.queryLog.push({
      action: "insert",
      table: this.table,
      filters: [...this.filters],
      values,
    });
    return this;
  }

  delete() {
    this.pendingDelete = true;
    return this;
  }

  async single() {
    const matchingRows = this.applyFilters(this.insertedRows ?? this.rows);
    this.logPendingSelect();
    this.logPendingMutation();
    if (this.pendingUpdate) {
      for (const row of matchingRows) Object.assign(row, this.pendingUpdate);
    }
    if (this.pendingDelete) this.deleteMatchingRows(matchingRows);
    const data = matchingRows[0] ?? null;
    return { data, error: this.error };
  }

  async maybeSingle() {
    return this.single();
  }

  // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are awaitable; the fake mirrors that contract.
  then<TResult1 = QueryResult<Row>, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult<Row>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const matchingRows = this.applyFilters(this.insertedRows ?? this.rows);
    this.logPendingSelect();
    this.logPendingMutation();
    if (this.pendingUpdate) {
      for (const row of matchingRows) Object.assign(row, this.pendingUpdate);
    }
    if (this.pendingDelete) this.deleteMatchingRows(matchingRows);

    return Promise.resolve({
      data: matchingRows,
      error: this.error,
    }).then(onfulfilled, onrejected);
  }

  private logPendingSelect() {
    if (!this.pendingSelect) {
      return;
    }

    this.queryLog.push({
      action: "select",
      table: this.table,
      filters: [
        ...this.filters,
        ...this.inFilters.map((filter) => ({
          column: filter.column,
          value: filter.values,
        })),
      ],
    });
    this.pendingSelect = false;
  }

  private logPendingMutation() {
    if (this.pendingUpdate) {
      this.queryLog.push({
        action: "update",
        table: this.table,
        filters: [...this.filters],
        values: this.pendingUpdate,
      });
    }

    if (this.pendingDelete) {
      this.queryLog.push({
        action: "delete",
        table: this.table,
        filters: [...this.filters],
      });
    }
  }

  private applyFilters(rows: Row[]) {
    let result = rows
      .filter((row) =>
        this.filters.every((filter) => row[filter.column] === filter.value),
      )
      .filter((row) =>
        this.inFilters.every((filter) =>
          filter.values.includes(row[filter.column]),
        ),
      )
      .filter((row) =>
        this.ilikeFilters.every((filter) =>
          String(row[filter.column] ?? "")
            .toLowerCase()
            .includes(filter.needle),
        ),
      )
      .filter((row) =>
        this.textSearchFilters.every((filter) =>
          String(row[textColumnFor(filter.column)] ?? "")
            .toLowerCase()
            .includes(filter.needle),
        ),
      );

    if (this.orderBy) {
      const column = this.orderBy;
      result = [...result].sort((a, b) => {
        const av = a[column];
        const bv = b[column];
        if (typeof av === "number" && typeof bv === "number") return av - bv;
        return String(av).localeCompare(String(bv));
      });
    }

    return result;
  }

  private deleteMatchingRows(rowsToDelete: Row[]) {
    for (const row of rowsToDelete) {
      const index = this.rows.indexOf(row);
      if (index >= 0) this.rows.splice(index, 1);
    }
  }
}

function textColumnFor(column: string) {
  if (column === "content_tsv") return "content_text";
  if (column === "full_text_tsv") return "full_text";
  return column;
}

export class FakeSupabase {
  readonly queryLog: QueryLogEntry[] = [];
  readonly rpcLog: RpcLogEntry[] = [];
  readonly tables: Record<string, Row[]>;
  readonly rpcRows: Record<string, Row[]>;

  constructor(
    tables: Record<string, Row[]>,
    rpcRows: Record<string, Row[]> = {},
  ) {
    this.tables = tables;
    this.rpcRows = rpcRows;
  }

  from<TableRow extends Record<string, unknown>>(
    table: string,
  ): ServiceQuery<TableRow> {
    return new FakeQuery(
      table,
      this.tables[table] ?? [],
      this.queryLog,
    ) as unknown as ServiceQuery<TableRow>;
  }

  async rpc<RowType extends Record<string, unknown>>(
    fn: string,
    args: Record<string, unknown>,
  ) {
    this.rpcLog.push({ fn, args });
    let rows = this.rpcRows[fn] ?? [];

    if (fn === "match_semantic_search_chunks") {
      rows = rows.filter((row) => row.user_id === args.match_user_id);
    }

    return { data: rows as RowType[], error: null };
  }
}

export function createContext(
  tables: Record<string, Row[]>,
  rpcRows: Record<string, Row[]> = {},
): ServiceContext {
  return { userId, supabase: new FakeSupabase(tables, rpcRows) };
}
