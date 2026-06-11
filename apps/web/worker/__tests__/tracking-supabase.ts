// Shared in-memory Supabase fake for worker tests: records every query and
// its filters so tests can assert user_id scoping (the service-role caveat).

export type Row = Record<string, unknown>;

export class TrackingQuery {
  filters: Array<{ column: string; value: unknown }> = [];
  inserted: Row[] = [];
  updated: Row | null = null;
  private pendingUpdate: Row | null = null;
  private pendingDelete = false;
  private orderBy: string | null = null;

  constructor(
    readonly table: string,
    private readonly rows: Row[],
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string) {
    this.orderBy = column;
    return this;
  }

  insert(values: Row | Row[]) {
    const insertedRows = Array.isArray(values) ? values : [values];
    this.inserted.push(...insertedRows);
    this.rows.push(...insertedRows);
    return this;
  }

  update(values: Row) {
    this.pendingUpdate = values;
    this.updated = values;
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
    if (this.pendingDelete) this.deleteRows(matchingRows);
    return { data: matchingRows[0] ?? null, error: null };
  }

  async maybeSingle() {
    return this.single();
  }

  // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are awaitable; the fake mirrors that contract.
  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: Row[];
          error: null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const matchingRows = this.applyFilters(this.rows);
    if (this.pendingUpdate) {
      for (const row of matchingRows) Object.assign(row, this.pendingUpdate);
    }
    if (this.pendingDelete) this.deleteRows(matchingRows);

    return Promise.resolve({
      data: matchingRows,
      error: null,
    }).then(onfulfilled, onrejected);
  }

  private applyFilters(rows: Row[]) {
    let result = rows.filter((row) =>
      this.filters.every((filter) => row[filter.column] === filter.value),
    );

    if (this.orderBy) {
      result = [...result].sort(
        (a, b) => Number(a[this.orderBy ?? ""]) - Number(b[this.orderBy ?? ""]),
      );
    }

    return result;
  }

  private deleteRows(rows: Row[]) {
    for (const row of rows) {
      const index = this.rows.indexOf(row);
      if (index >= 0) this.rows.splice(index, 1);
    }
  }
}

export class TrackingSupabase {
  readonly queries: TrackingQuery[] = [];

  constructor(readonly tables: Record<string, Row[]>) {}

  from(table: string) {
    const query = new TrackingQuery(table, this.tables[table] ?? []);
    this.queries.push(query);
    return query;
  }
}
