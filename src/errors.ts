export type ErrorCode =
  | "INVALID_INPUT"
  | "UNSUPPORTED_MODE"
  | "INVALID_ASSET_MAP"
  | "RELEASE_NOT_RESOLVED"
  | "RELEASE_LOOKUP_FAILED"
  | "ASSET_NOT_FOUND"
  | "ASSET_AMBIGUOUS"
  | "UNIMPLEMENTED_MILESTONE";

export class BrewUpError extends Error {
  readonly code: ErrorCode;
  readonly hint?: string;

  constructor(code: ErrorCode, message: string, hint?: string) {
    super(message);
    this.name = "BrewUpError";
    this.code = code;
    this.hint = hint;
  }
}

export function formatErrorMessage(error: unknown): string {
  if (error instanceof BrewUpError) {
    const hintSuffix = error.hint ? ` Hint: ${error.hint}` : "";
    return `[${error.code}] ${error.message}${hintSuffix}`;
  }

  if (error instanceof Error) {
    return `[UNKNOWN] ${error.message}`;
  }

  return `[UNKNOWN] ${String(error)}`;
}
