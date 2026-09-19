/**
 * provider-health-pattern.ts
 *
 * EWMA latency tracking + error rate + composite health score,
 * adapted from ingridtoulotte/llm-fallback-router.
 *
 * Adapted for opencode/EURINHASH: tracks per-worker health.
 */

export interface HealthOptions {
  /** EWMA alpha for latency (0-1). Higher = more reactive. */
  ewmaAlpha?: number;
  /** Rolling window in ms for error rate. */
  windowMs?: number;
  /** Minimum requests before error rate is computed. */
  minimumRequests?: number;
  /** Max samples in rolling window. */
  maxSamples?: number;
  /** Injectable clock. */
  now?: () => number;
}

const DEFAULT_HEALTH: HealthOptions = {
  ewmaAlpha: 0.3,
  windowMs: 60_000,
  minimumRequests: 5,
  maxSamples: 256,
};

interface Outcome {
  t: number;
  ok: boolean;
  latencyMs?: number;
}

export class ProviderHealth {
  private readonly opt: HealthOptions;
  private readonly now: () => number;
  private outcomes: Outcome[] = [];
  private ewmaLatency = 0;
  private hasLatency = false;

  constructor(options: HealthOptions = {}) {
    this.opt = { ...DEFAULT_HEALTH, ...options };
    this.now = this.opt.now ?? Date.now;
  }

  recordSuccess(latencyMs: number): void {
    this.outcomes.push({ t: this.now(), ok: true, latencyMs });
    this.updateEwma(latencyMs);
    this.prune();
  }

  recordFailure(error: string, countsAgainstBreaker: boolean): void {
    this.outcomes.push({ t: this.now(), ok: false });
    this.prune();
  }

  /** EWMA latency (0 if no successful calls yet). */
  latencyMs(): number {
    return this.hasLatency ? this.ewmaLatency : 0;
  }

  /** Rolling error rate over the window, in [0,1]. */
  errorRate(): number {
    this.prune();
    if (this.outcomes.length < this.opt.minimumRequests) return 0;
    const fails = this.outcomes.reduce((n, o) => n + (o.ok ? 0 : 1), 0);
    return fails / this.outcomes.length;
  }

  /** Composite score: higher = healthier. 100 = perfect. */
  score(): number {
    const err = this.errorRate();
    if (err >= 1) return 0;
    const base = (1 - err) * 100;
    const latPenalty = this.hasLatency ? Math.min(this.ewmaLatency / 100, 30) : 0;
    return Math.max(0, Math.round(base - latPenalty));
  }

  /** Human-readable status. */
  status(): "healthy" | "degraded" | "unhealthy" {
    const s = this.score();
    if (s >= 80) return "healthy";
    if (s >= 50) return "degraded";
    return "unhealthy";
  }

  private updateEwma(latencyMs: number): void {
    if (!this.hasLatency) {
      this.ewmaLatency = latencyMs;
      this.hasLatency = true;
    } else {
      this.ewmaLatency = this.opt.ewmaAlpha! * latencyMs + (1 - this.opt.ewmaAlpha!) * this.ewmaLatency;
    }
  }

  private prune(): void {
    const cutoff = this.now() - this.opt.windowMs!;
    let i = 0;
    while (i < this.outcomes.length && this.outcomes[i]!.t < cutoff) i += 1;
    const overflow = this.outcomes.length - i - this.opt.maxSamples!;
    if (overflow > 0) i += overflow;
    if (i > 0) this.outcomes.splice(0, i);
  }
}