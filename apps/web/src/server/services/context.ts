export type ServiceDatabaseError = {
  message: string;
  code?: string;
};

export type QueryResult<Row extends Record<string, unknown>> = {
  data: Row[];
  error: ServiceDatabaseError | null;
};

export type RpcResult<Row extends Record<string, unknown>> = {
  data: Row[];
  error: ServiceDatabaseError | null;
};

export type SingleQueryResult<Row extends Record<string, unknown>> = {
  data: Row | null;
  error: ServiceDatabaseError | null;
};

export type ServiceQuery<Row extends Record<string, unknown>> = PromiseLike<
  QueryResult<Row>
> & {
  select(columns?: string): ServiceQuery<Row>;
  eq(column: string, value: unknown): ServiceQuery<Row>;
  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ): ServiceQuery<Row>;
  in(column: string, values: unknown[]): ServiceQuery<Row>;
  ilike(column: string, pattern: string): ServiceQuery<Row>;
  textSearch(
    column: string,
    query: string,
    options?: { type?: "plain" | "phrase" | "websearch"; config?: string },
  ): ServiceQuery<Row>;
  insert(
    values: Record<string, unknown> | Record<string, unknown>[],
  ): ServiceQuery<Row>;
  update(values: Record<string, unknown>): ServiceQuery<Row>;
  delete(): ServiceQuery<Row>;
  single(): Promise<SingleQueryResult<Row>>;
  maybeSingle(): Promise<SingleQueryResult<Row>>;
};

export type ServiceSupabaseClient = {
  from<Row extends Record<string, unknown>>(table: string): ServiceQuery<Row>;
  rpc<Row extends Record<string, unknown>>(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<RpcResult<Row>>;
};

export type ServiceContext = {
  userId: string;
  supabase: ServiceSupabaseClient;
};
