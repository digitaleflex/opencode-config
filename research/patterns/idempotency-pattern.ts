/**
 * idempotency-pattern.ts
 *
 * TTL-based in-memory deduplication for safe retries of non-idempotent
 * operations, adapted from reaatech/llm-router (MIT).
 *
 * Adapted for opencode/EURINHASH: enables safe retry of failed worker
 * calls. A retry with the same key returns the cached result instead of
 * re-executing the side-effect (e.g., posting a comment, charging a user).
 *
 * Use case: when a worker succeeds but the network drops before we
 * receive the response, the retry would normally re-execute. With
 * idempotency keys, the second call hits the cache and returns the
 * stored result.
 */

export interface IdempotencyStoreOptions {
  /** TTL for cached results in ms (default: 5 minutes). */
  ttlMs?: number;
  /** Max entries before LRU eviction. */
  maxEntries?: number;
  /** Injectable clock (for tests). */
  now?: () => number;
}

interface CacheEntry<T> {
  result: T;
  expiresAt: number;
}

/** Generate a unique idempotency key. */
export function generateIdempotencyKey(): string {
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export class IdempotencyStore<T = unknown> {
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly cache: Map<string, CacheEntry<T>> = new Map();

  constructor(options: IdempotencyStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? 300_000; // 5 min
    this.maxEntries = options.maxEntries ?? 1000;
    this.now = options.now ?? Date.now;
  }

  /** Get cached result for key, or undefined if not cached / expired. */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < this.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.result;
  }

  /** Store result for key. Returns true if stored, false if already exists. */
  set(key: string, result: T): boolean {
    this.pruneExpired();

    if (this.cache.has(key)) {
      // Already cached — don't overwrite (race-condition safety)
      return false;
    }

    if (this.cache.size >= this.maxEntries) {
      // LRU eviction: delete oldest
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      result,
      expiresAt: this.now() + this.ttlMs,
    });
    return true;
  }

  /** Check if key exists and is not expired. */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /** Delete a specific key. */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /** Clear all entries. */
  clear(): void {
    this.cache.clear();
  }

  /** Get current cache size. */
  size(): number {
    this.pruneExpired();
    return this.cache.size;
  }

  private pruneExpired(): void {
    const cutoff = this.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < cutoff) {
        this.cache.delete(key);
      }
    }
  }
}