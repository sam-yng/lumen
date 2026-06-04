import type {
  QueryResult,
  ServiceContext,
  ServiceQuery,
} from "@/server/services/context";

export type Row = Record<string, unknown>;

export const userId = "user-1";
export const otherUserId = "user-2";

export class FakeQuery implements ServiceQuery<Row> {
  private filters: Array<{ column: string; value: unknown }> = [];
  private ilikeFilters: Array<{ column: string; needle: string }> = [];
  private orderBy: string | null = null;
  private pendingUpdate: Row | null = null;
  private pendingDelete = false;

  constructor(
    private readonly rows: Row[],
    private readonly error: Error | null = null,
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  ilike(column: string, pattern: string) {
    this.ilikeFilters.push({
      column,
      needle: pattern.replace(/%/g, "").toLowerCase(),
    });
    return this;
  }

  textSearch() {
    // Tsvector matching happens in Postgres; the fake returns the seeded rows
    // and relies on eq()/ilike() for assertable filtering.
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
    return this;
  }

  delete() {
    this.pendingDelete = true;
    return this;
  }

  async single() {
    const matchingRows = this.applyFilters(this.rows);
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
    return Promise.resolve({
      data: this.applyFilters(this.rows),
      error: this.error,
    }).then(onfulfilled, onrejected);
  }

  private applyFilters(rows: Row[]) {
    let result = rows
      .filter((row) =>
        this.filters.every((filter) => row[filter.column] === filter.value),
      )
      .filter((row) =>
        this.ilikeFilters.every((filter) =>
          String(row[filter.column] ?? "")
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

export class FakeSupabase {
  readonly tables: Record<string, Row[]>;

  constructor(tables: Record<string, Row[]>) {
    this.tables = tables;
  }

  from<TableRow extends Record<string, unknown>>(
    table: string,
  ): ServiceQuery<TableRow> {
    return new FakeQuery(
      this.tables[table] ?? [],
    ) as unknown as ServiceQuery<TableRow>;
  }
}

export function createContext(tables: Record<string, Row[]>): ServiceContext {
  return { userId, supabase: new FakeSupabase(tables) };
}
