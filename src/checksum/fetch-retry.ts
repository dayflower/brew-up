import { BrewUpError } from "../errors.js";

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_BASE_DELAY_MS = 300;

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

export async function fetchWithRetry(
  url: string,
  resourceDescription: string,
): Promise<Response> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= DEFAULT_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });

      if (response.ok) {
        return response;
      }

      const statusMessage = `HTTP status: ${response.status} (attempt ${attempt}/${DEFAULT_MAX_ATTEMPTS}).`;
      if (
        !isRetryableStatus(response.status) ||
        attempt === DEFAULT_MAX_ATTEMPTS
      ) {
        throw new BrewUpError(
          "CHECKSUM_FETCH_FAILED",
          `Failed to download ${resourceDescription}.`,
          statusMessage,
        );
      }

      lastError = statusMessage;
    } catch (error) {
      if (error instanceof BrewUpError) {
        throw error;
      }

      const errorMessage = `${toErrorMessage(error)} (attempt ${attempt}/${DEFAULT_MAX_ATTEMPTS}).`;
      if (attempt === DEFAULT_MAX_ATTEMPTS) {
        throw new BrewUpError(
          "CHECKSUM_FETCH_FAILED",
          `Failed to download ${resourceDescription}.`,
          errorMessage,
        );
      }

      lastError = errorMessage;
    }

    const backoffMs = DEFAULT_BASE_DELAY_MS * 2 ** (attempt - 1);
    await wait(backoffMs);
  }

  throw new BrewUpError(
    "CHECKSUM_FETCH_FAILED",
    `Failed to download ${resourceDescription}.`,
    lastError,
  );
}
