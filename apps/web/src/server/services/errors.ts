export type ServiceErrorCode =
  | "database"
  | "not_found"
  | "invalid_input"
  | "conflict";

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;

  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}

export function assertNoDatabaseError(
  error: { message: string } | null,
  message: string,
): asserts error is null {
  if (error) throw new ServiceError("database", `${message}: ${error.message}`);
}

export function assertFound<Row>(
  row: Row | null,
  message: string,
): asserts row is Row {
  if (!row) throw new ServiceError("not_found", message);
}
