/**
 * src/core/budget-guard.ts
 *
 * Budget guard + quota tracking for EURINHASH workers, adapted from
 * ingridtoulotte/llm-fallback-router budget.ts (MIT) and
 * research/patterns/budget-guard-pattern.ts.
 *
 * Keyed by WORKER ID (worker-novita, worker-groq, ...) rather than model ID,
 * matching GovernanceOrchestrator's unit of routing.
 *
 * Features:
 *   - Per-request / daily / monthly spend limits (skip worker when over)
 *   - Per-worker request counts per day (free-tier quota tracking)
 *   - 75% warning / 90% critical thresholds, hard block at 100%
 *   - Built-in pricing table (USD per 1K tokens), overridable
 *   - Injectable clock for deterministic tests
 */

export interface BudgetLimits {
  /** Max spend per request (USD). */
  perRequest?: number;
  /** Max spend per day (USD, resets at local midnight). */
  daily?: number;
  /** Max spend per month (USD, resets at 1st of month). */
  monthly?: number;
  /** Max requests per worker per day (free-tier quota). */
  requestsPerWorkerDaily?: number;
}

export interface BudgetState {
  dailySpent: number;
  monthlySpent: number;
  workerRequests: Record<string, number>;
  warnings: {
    daily: boolean;
    monthly: boolean;
  };
}

export class BudgetGuard {
  private limits: BudgetLimits;
  private dailySpent = 0;
  private monthlySpent = 0;
  private readonly workerRequests = new Map<string, number>();
  private lastResetDay?: number;
  private lastResetMonth?: number;
  private readonly prices = new Map<string, number>();
  private readonly now: () => Date;

  constructor(limits: BudgetLimits = {}, now?: () => Date) {
    this.limits = limits;
    this.now = now ?? (() => new Date());
    this.loadPrices();
    this.checkReset();
  }

  /** Estimate cost (USD) for a token count on the given worker. */
  estimateCost(worker: string, tokens: number): number {
    const costPer1k = this.prices.get(worker) ?? 0.00001;
    return (tokens / 1000) * costPer1k;
  }

  /** True if calling this worker now would blow a budget or quota. */
  isBlocked(worker: string, estTokens: number): boolean {
    this.checkReset();
    const estCost = this.estimateCost(worker, estTokens);

    if (this.limits.perRequest !== undefined && estCost > this.limits.perRequest) {
      return true;
    }
    if (this.limits.daily !== undefined && this.dailySpent + estCost > this.limits.daily) {
      return true;
    }
    if (this.limits.monthly !== undefined && this.monthlySpent + estCost > this.limits.monthly) {
      return true;
    }
    if (
      this.limits.requestsPerWorkerDaily !== undefined &&
      (this.workerRequests.get(worker) ?? 0) >= this.limits.requestsPerWorkerDaily
    ) {
      return true;
    }
    return false;
  }

  /** Record an actual (successful) call for spend + quota accounting. */
  record(worker: string, tokens: number): void {
    this.checkReset();
    const cost = this.estimateCost(worker, tokens);
    this.dailySpent += cost;
    this.monthlySpent += cost;
    this.workerRequests.set(worker, (this.workerRequests.get(worker) ?? 0) + 1);
  }

  /** Current state + warning flags (≥75% of a limit). */
  getState(): BudgetState {
    this.checkReset();
    const workerRequests: Record<string, number> = {};
    for (const [worker, count] of this.workerRequests) {
      workerRequests[worker] = count;
    }
    return {
      dailySpent: this.dailySpent,
      monthlySpent: this.monthlySpent,
      workerRequests,
      warnings: {
        daily: this.limits.daily !== undefined && this.dailySpent / this.limits.daily >= 0.75,
        monthly: this.limits.monthly !== undefined && this.monthlySpent / this.limits.monthly >= 0.75,
      },
    };
  }

  /** True when usage is ≥90% of a limit (critical). */
  isCritical(): boolean {
    this.checkReset();
    if (this.limits.daily !== undefined && this.dailySpent / this.limits.daily >= 0.9) return true;
    if (this.limits.monthly !== undefined && this.monthlySpent / this.limits.monthly >= 0.9) return true;
    return false;
  }

  private checkReset(): void {
    const now = this.now();
    const today = now.getDate();
    const thisMonth = now.getMonth();

    if (this.lastResetDay !== today) {
      this.dailySpent = 0;
      this.workerRequests.clear();
      this.lastResetDay = today;
    }
    if (this.lastResetMonth !== thisMonth) {
      this.monthlySpent = 0;
      this.lastResetMonth = thisMonth;
    }
  }

  /** Default pricing table: USD per 1K tokens per worker (free tiers ~0). */
  private loadPrices(): void {
    const prices: Record<string, number> = {
      "worker-novita": 0.0001,
      "worker-groq": 0.00007,
      "worker-zhipu": 0.00005,
      "worker-google": 0.000075,
      "worker-codestral": 0.0001,
    };
    for (const [worker, cost] of Object.entries(prices)) {
      this.prices.set(worker, cost);
    }
  }

  setPrice(worker: string, costPer1kTokens: number): void {
    this.prices.set(worker, costPer1kTokens);
  }

  getDailySpent(): number {
    this.checkReset();
    return this.dailySpent;
  }

  getMonthlySpent(): number {
    this.checkReset();
    return this.monthlySpent;
  }

  getWorkerRequestCount(worker: string): number {
    this.checkReset();
    return this.workerRequests.get(worker) ?? 0;
  }

  reset(): void {
    this.dailySpent = 0;
    this.monthlySpent = 0;
    this.workerRequests.clear();
    this.lastResetDay = undefined;
    this.lastResetMonth = undefined;
  }
}
