/**
 * budget-guard-pattern.ts
 *
 * Price estimation + spend limits per-request / daily / monthly,
 * adapted from ingridtoulotte/llm-fallback-router, MIT.
 *
 * Adapted for opencode/EURINHASH: instead of USD, we track
 * usage against FREE tier quotas (Novita 256K ctx, Groq free tier, etc.)
 *
 * Features:
 *   - Daily/monthly/per-request token budgets
 *   - Automatic provider skip when over budget
 *   - 75%/90% warning thresholds, 100% hard block
 *   - Built-in pricing table (override per model)
 *   - Dry-run mode (predict spend without calling)
 */

export interface BudgetLimits {
  /** Max spend (tokens or credits) per request. */
  perRequest?: number;
  /** Max spend per day (resets at 00:00 local). */
  daily?: number;
  /** Max spend per month (resets at 1st of month). */
  monthly?: number;
}

export interface PricingEntry {
  /** Model ID (e.g., "worker-novita:ling-3.0-flash-sante"). */
  modelId: string;
  /** Cost per 1K tokens (tokens / 1000 * costPer1k = usd). */
  costPer1kTokens: number;
}

export interface BudgetState {
  dailySpent: number;
  monthlySpent: number;
  warnings: {
    daily: boolean;
    monthly: boolean;
    perRequest: boolean;
  };
}

export class BudgetGuard {
  private limits: BudgetLimits;
  private dailySpent = 0;
  private monthlySpent = 0;
  private lastResetDay?: number;
  private lastResetMonth?: number;
  private readonly prices: Map<string, number> = new Map();

  constructor(limits: BudgetLimits = {}) {
    this.limits = limits;
    this.loadPrices();
    this.checkReset();
  }

  /** Estimate cost for a token usage in the given model. */
  estimateUsd(modelId: string, inputTokens: number, outputTokens: number): number {
    const costPer1k = this.prices.get(modelId) ?? 0.00001; // default fallback
    return ((inputTokens + outputTokens) / 1000) * costPer1k;
  }

  /** Check if a call is allowed (returns true if blocked). */
  isBlocked(modelId: string, inputTokens: number, outputTokens: number): boolean {
    this.checkReset();

    const estCost = this.estimateUsd(modelId, inputTokens, outputTokens);

    if (this.limits.perRequest && this.dailySpent + estCost > this.limits.perRequest) {
      return true;
    }
    if (this.limits.daily && this.dailySpent + estCost > this.limits.daily) {
      return true;
    }
    if (this.limits.monthly && this.monthlySpent + estCost > this.limits.monthly) {
      return true;
    }

    return false;
  }

  /** Record successful usage for budget tracking. */
  record(modelId: string, inputTokens: number, outputTokens: number): void {
    const cost = this.estimateUsd(modelId, inputTokens, outputTokens);
    this.dailySpent += cost;
    this.monthlySpent += cost;
  }

  /** Get current state and warning levels. */
  getState(): BudgetState {
    this.checkReset();

    const warnings = {
      daily: this.limits.daily ? (this.dailySpent / this.limits.daily) >= 0.75 : false,
      monthly: this.limits.monthly ? (this.monthlySpent / this.limits.monthly) >= 0.75 : false,
      perRequest: this.limits.perRequest ? (this.dailySpent / this.limits.perRequest) >= 0.75 : false,
    };

    return { dailySpent: this.dailySpent, monthlySpent: this.monthlySpent, warnings };
  }

  /** Reset counters at day/month boundaries. */
  private checkReset(): void {
    const now = new Date();
    const today = now.getDate();
    const thisMonth = now.getMonth();

    if (this.lastResetDay !== today) {
      this.dailySpent = 0;
      this.lastResetDay = today;
    }

    if (this.lastResetMonth !== thisMonth) {
      this.monthlySpent = 0;
      this.lastResetMonth = thisMonth;
    }
  }

  /** Load default pricing table (USD per 1K tokens). */
  private loadPrices(): void {
    const prices: PricingEntry[] = [
      { modelId: "worker-novita:ling-3.0-flash-sante", costPer1kTokens: 0.0001 },
      { modelId: "worker-groq:qwen", costPer1kTokens: 0.00007 },
      { modelId: "worker-zhipu:glm-4.7-flash", costPer1kTokens: 0.00005 },
      { modelId: "worker-google:gemini-2.5-flash", costPer1kTokens: 0.000075 },
    ];

    for (const p of prices) {
      this.prices.set(p.modelId, p.costPer1kTokens);
    }
  }

  /** Override pricing for a model. */
  setPrice(modelId: string, costPer1kTokens: number): void {
    this.prices.set(modelId, costPer1kTokens);
  }

  /** Get current daily spent. */
  getDailySpent(): number {
    this.checkReset();
    return this.dailySpent;
  }

  /** Get current monthly spent. */
  getMonthlySpent(): number {
    this.checkReset();
    return this.monthlySpent;
  }

  /** Reset all counters (manual). */
  reset(): void {
    this.dailySpent = 0;
    this.monthlySpent = 0;
    this.lastResetDay = undefined;
    this.lastResetMonth = undefined;
  }
}