// src/core/budget.ts — Per-task cost/time guardrail (anti-DoS / runaway reasoning)
export interface TaskBudgetOpts {
  maxMs?: number;
  maxToolCalls?: number;
  maxTokens?: number;
}

export class TaskBudget {
  private maxMs: number;
  private maxToolCalls: number;
  private maxTokens: number;
  private spentMs: number;
  private spentTokens: number;
  private spentToolCalls: number;

  constructor(opts?: TaskBudgetOpts) {
    this.maxMs = opts?.maxMs ?? 30000;
    this.maxToolCalls = opts?.maxToolCalls ?? 20;
    this.maxTokens = opts?.maxTokens ?? 50000;
    this.spentMs = 0;
    this.spentTokens = 0;
    this.spentToolCalls = 0;
  }

  spend(ms: number, tokens?: number, toolCalls?: number): void {
    if (ms) this.spentMs += ms;
    if (typeof tokens === "number" && tokens) this.spentTokens += tokens;
    if (typeof toolCalls === "number" && toolCalls) this.spentToolCalls += toolCalls;
    // allow zero / explicit increments; also handle NaN safely
    if (ms === 0) this.spentMs += 0;
  }

  exhausted(): { exhausted: boolean; reason?: string } {
    if (this.spentMs > this.maxMs) {
      return { exhausted: true, reason: `budget exceeded: maxMs ${this.maxMs} exceeded (spent ${this.spentMs}ms)` };
    }
    if (this.spentToolCalls > this.maxToolCalls) {
      return { exhausted: true, reason: `budget exceeded: maxToolCalls ${this.maxToolCalls} exceeded (spent ${this.spentToolCalls})` };
    }
    if (this.spentTokens > this.maxTokens) {
      return { exhausted: true, reason: `budget exceeded: maxTokens ${this.maxTokens} exceeded (spent ${this.spentTokens})` };
    }
    return { exhausted: false };
  }

  remainingMs(): number {
    return Math.max(0, this.maxMs - this.spentMs);
  }

  reset(): void {
    this.spentMs = 0;
    this.spentTokens = 0;
    this.spentToolCalls = 0;
  }
}
