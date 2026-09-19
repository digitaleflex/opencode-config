/**
 * retry-backoff-pattern.ts
 *
 * Exponential backoff with jitter and idempotency store,
 * adapted from reaatech/llm-router-fallback (MIT).
 *
 * Adapted for opencode/EURINHASH: used when retrying a failed worker task.
 */

export interface RetryOptions {
  /** Total attempts including the first try. */
  maxAttempts: number;
  /** Base delay in milliseconds. */
  backoffMs: number;
  /** Maximum backoff cap. */
  maxBackoffMs: number;
  /** Whether to apply random jitter to delays. */
  jitter: boolean;
  /** Idempotency store TTL in ms (0 = disabled). */
  idempotencyTtlMs: number;
  /** Injectable clock (for tests). */
  now?: () => number;
  /** Injectable RNG (for tests). */
  rng?: () => number;
}

export const DEFAULT_RETRY: RetryOptions = {
  maxAttempts: 3,
  backoffMs: 1000,
  maxBackoffMs: 30000,
  jitter: true,
  idempotencyTtlMs: 300_000, // 5 minutes
};

export class RetryLogic {
  private readonly opt: RetryOptions;
  private readonly now: () => number;
  private readonly rng: () => number;

  constructor(options: Partial<RetryOptions> = {}) {
    this.opt = { ...DEFAULT_RETRY, ...options };
    this.now = this.opt.now ?? Date.now;
    this.rng = this.opt.rng ?? Math.random;
  }

  /**
   * Execute an async function with retry logic.
   * @param fn - async function to retry
   * @param isRetryable - function that returns true if error should trigger retry
   * @param idempotencyKey - optional key for deduplication across retries
   */
  async execute<T>(
    fn: () => Promise<T>,
    isRetryable: (error: unknown) => boolean,
    idempotencyKey?: string,
  ): Promise<T> {
    // Idempotency store: if we have a cached result, return it immediately
    if (idempotencyKey && this.opt.idempotencyTtlMs > 0) {
      const cached = IdempotencyStore.get(idempotencyKey);
      if (cached !== undefined) return cached;
    }

    let attempt = 0;
    let lastError: unknown;

    while (attempt < this.opt.maxAttempts) {
      attempt++;
      try {
        const result = await fn();
        // Success: cache result if idempotency key provided
        if (idempotencyKey && this.opt.idempotencyTtlMs > 0) {
          IdempotencyStore.set(idempotencyKey, result, this.opt.idempotencyTtlMs);
        }
        return result;
      } catch (err) {
        lastError = err;
        if (!isRetryable(err) || attempt === this.opt.maxAttempts) {
          // Non-retryable error or exhausted attempts: throw
          throw err;
        }
        // Wait before next attempt
        await this.delay(attempt);
      }
    }
    // Should not reach here
    throw lastError;
  }

  private delay(attemptNumber: number): Promise<void> {
    // Exponential backoff: base * 2^(attempt-1)
    let delayMs = this.opt.backoffMs * Math.pow(2, attemptNumber - 1);
    // Cap at maxBackoffMs
    if (delayMs > this.opt.maxBackoffMs) delayMs = this.opt.maxBackoffMs;
    // Apply jitter if enabled
    if (this.opt.jitter) {
      const jitter = this.rng() * 0.5 * delayMs; // +/- 25%
      delayMs = delayMs - jitter * 0.5 + this.rng() * jitter;
    }
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, delayMs)));
  }
}

/**
 * Simple in-memory idempotency store with TTL.
 * Not meant for production-scale; suitable for single-process retries.
 */
class IdempotencyStore {
  private static store: Map<string, { value: any; expiry: number }> = new Map();

  static get<T>(key: string): T | undefined {
    const item = this.store.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiry) {
      this.store.delete(key);
      return undefined;
    }
    return item.value;
  }

  static set<T>(key: string, value: any, ttlMs: number): void {
    this.store.set(key, {
      value,
      expiry: Date.now() + ttlMs,
    });
    // Optional: periodic cleanup could be added
  }
}

/**
 * Create a retryable error checker for HTTP-like errors.
 * Returns true for 429, 5xx, and network errors.
 */
export function createHttpRetryableChecker(): (error: unknown) => boolean {
  return (error: unknown) => {
    if (error === null || error === undefined) return false;
    // Assume error has a status property (HTTP) or is a network error
    const err = error as { status?: number; message?: string; name?: string };
    if (typeof err.status === "number") {
      return err.status === 429 || err.status >= 500;
    }
    // Network errors: check message or name
    const msg = (err.message ?? "").toLowerCase();
    const name = (err.name ?? "").toLowerCase();
    return (
      msg.includes("failed") ||
      msg.includes("network") ||
      msg.includes("timeout") ||
      msg.includes("fetch") ||
      name.includes("interrupted") ||
      name.includes("abort")
    );
  };
}

/**
 * Generate a random idempotency key.
 */
export function generateIdempotencyKey(): string {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}