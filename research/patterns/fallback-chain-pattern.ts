/**
 * fallback-chain-pattern.ts
 *
 * Ordered fallback chains for graceful degradation, adapted from
 * reaatech/llm-router (MIT).
 *
 * Adapted for opencode/EURINHASH: defines the degradation path
 * when a worker fails. Chain: worker-codestral → worker-groq → worker-zhipu → worker-novita → worker-google.
 *
 * Features:
 *   - Each model in the chain gets its own circuit breaker
 *   - Automatic failover on retryable errors (429, 5xx, timeout, network)
 *   - Stop immediately on non-retryable errors (400, auth, permission)
 *   - Full decision audit trail
 */

export interface FallbackChainDefinition {
  /** Chain name for identification. */
  name: string;
  /** Ordered list of worker IDs (primary first, fallback last). */
  models: string[];
  /** Circuit breaker config for each model in the chain. */
  circuitBreaker?: {
    failureThreshold?: number;
    resetTimeoutMs?: number;
    halfOpenMaxCalls?: number;
  };
}

export interface FallbackChainResult {
  /** The worker that succeeded. */
  selectedModel: string;
  /** True if a fallback worker was used. */
  isFallback: boolean;
  /** Position in chain (0 = primary, 1+ = fallback depth). */
  position: number;
  /** Errors from all failed attempts. */
  errors: Error[];
}

export class FallbackChainExhaustedError extends Error {
  public readonly errors: Error[];
  constructor(errors: Error[], message = "All workers in chain exhausted") {
    super(message);
    this.errors = errors;
    this.name = "FallbackChainExhaustedError";
  }
}

export class FallbackChain {
  private readonly models: string[];
  private readonly breakers: Map<string, boolean> = new Map();
  private readonly circuitBreakerConfig: Record<string, { failureThreshold: number; resetTimeoutMs: number; halfOpenMaxCalls: number }>;
  private errors: Error[] = [];

  constructor(def: FallbackChainDefinition) {
    this.models = def.models;
    this.circuitBreakerConfig = {};

    for (const model of def.models) {
      const cb = def.circuitBreaker ?? {
        failureThreshold: 5,
        resetTimeoutMs: 60_000,
        halfOpenMaxCalls: 3,
      };
      this.circuitBreakerConfig[model] = { ...cb };
      this.breakers.set(model, true); // starts enabled
    }
  }

  /** Execute starting from a specific model, falling back through the chain. */
  async executeFrom(
    startModelId: string,
    executor: (model: string) => Promise<{ success: boolean; output?: string; error?: Error; statusCode?: number }>,
    allModels: string[],
  ): Promise<FallbackChainResult> {
    const startIndex = this.models.indexOf(startModelId);
    const chain = startIndex >= 0
      ? this.models.slice(startIndex)
      : [...this.models];

    this.errors = [];
    let lastError: Error | undefined;

    for (let i = 0; i < chain.length; i++) {
      const model = chain[i]!;

      // Check if breaker is open for this model
      if (!this.breakers.get(model)) {
        this.errors.push(new Error(`${model} circuit breaker OPEN — skipping`));
        continue;
      }

      try {
        const result = await executor(model);

        if (result.success) {
          return {
            selectedModel: model,
            isFallback: i > 0,
            position: i,
            errors: this.errors,
          };
        }

        const err = new Error(result.error ?? "Worker failed");
        lastError = err;
        this.errors.push(err);

        // Non-retryable: stop immediately
        if (result.statusCode && result.statusCode >= 400 && result.statusCode < 500 && result.statusCode !== 429) {
          break;
        }

        // Record failure on breaker
        this.recordFailure(model);
      } catch (err: any) {
        lastError = err;
        this.errors.push(err);
        this.recordFailure(model);
      }
    }

    throw new FallbackChainExhaustedError(this.errors);
  }

  private recordFailure(model: string): void {
    // Simple breaker: disable after 3 consecutive failures
    const failures = this.errors.filter(e => e.message.includes(model)).length;
    if (failures >= (this.circuitBreakerConfig[model]?.failureThreshold ?? 5)) {
      this.breakers.set(model, false);
      // Auto-enable after cooldown
      const resetMs = this.circuitBreakerConfig[model]?.resetTimeoutMs ?? 60_000;
      setTimeout(() => this.breakers.set(model, true), resetMs);
    }
  }

  /** Get current breaker state for all models in chain. */
  getBreakerStates(): Record<string, boolean> {
    const states: Record<string, boolean> = {};
    for (const [model, enabled] of this.breakers) {
      states[model] = enabled;
    }
    return states;
  }

  /** Get the ordered chain of models. */
  getModels(): string[] {
    return [...this.models];
  }
}

/** Default EURINHASH worker chain. */
export const EURINHASH_DEFAULT_CHAIN: FallbackChainDefinition = {
  name: "eurinhash-default",
  models: ["worker-novita", "worker-groq", "worker-zhipu", "worker-google"],
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeoutMs: 60_000,
    halfOpenMaxCalls: 3,
  },
};

/** Create a FallbackChain with the default config. */
export function createFallbackChain(def: FallbackChainDefinition): FallbackChain {
  return new FallbackChain(def);
}