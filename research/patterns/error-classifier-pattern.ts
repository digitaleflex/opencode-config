/**
 * error-classifier-pattern.ts
 *
 * Classifies errors into retryable vs non-retryable, adapted from
 * ingridtoulotte/llm-fallback-router and reaatech/llm-router.
 *
 * Adapted for opencode/EURINHASH: distinguishes transient API failures
 * (retryable → fallback worker) from client-side errors (non-retryable →
 * stop immediately, don't burn other workers).
 */

export type ErrorKind =
  | "unknown"
  | "timeout"
  | "network"
  | "server_error"
  | "rate_limit"
  | "bad_request"
  | "auth"
  | "permission"
  | "cancelled";

/** Retryable errors → fallback to next worker. */
export function shouldFailover(kind: ErrorKind): boolean {
  switch (kind) {
    case "timeout":
    case "network":
    case "server_error":
    case "rate_limit":
      return true;
    case "bad_request":
    case "auth":
    case "permission":
    case "cancelled":
    case "unknown":
      return false;
  }
}

/** Whether this error counts against the circuit breaker. */
export function countsAgainstBreaker(kind: ErrorKind): boolean {
  switch (kind) {
    case "timeout":
    case "network":
    case "server_error":
    case "rate_limit":
      return true;
    case "bad_request":
    case "auth":
    case "permission":
    case "cancelled":
    case "unknown":
      return false;
  }
}

/**
 * Classify an HTTP status code into an ErrorKind.
 */
export function classifyStatus(status: number): ErrorKind {
  if (status === 429) return "rate_limit";
  if (status >= 400 && status < 500) {
    if (status === 400 || status === 422) return "bad_request";
    if (status === 401 || status === 403) return "auth";
    return "bad_request";
  }
  if (status >= 500) return "server_error";
  return "unknown";
}

/**
 * Classify a thrown error into an ErrorKind.
 */
export function classifyError(err: unknown): ErrorKind {
  if (err instanceof Error) {
    const name = err.name;
    const msg = err.message;
    if (name === "AbortError" || /abort|timed? ?out/i.test(msg)) return "timeout";
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|network/i.test(msg)) return "network";
    const m = /(?:status|code)[:\s]*(\d{3})/i.exec(msg);
    if (m) return classifyStatus(parseInt(m[1]!, 10));
  }
  return "unknown";
}