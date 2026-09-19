/**
 * circuit-breaker-pattern.ts
 *
 * Per-provider 3-state circuit breaker, adapted from
 * ingridtoulotte/llm-fallback-router (MIT, 0 deps).
 *
 * Adapted for opencode/EURINHASH: each "provider" is a worker agent
 * (worker-novita, worker-groq, worker-zhipu, worker-google) and the breaker
 * is keyed by worker ID rather than URL.
 *
 * States:
 *   closed     — normal traffic; failures counted in rolling window
 *   open       — quarantined; instant skip (no timeout tax)
 *   half_open  — cooldown elapsed; probe traffic allowed; N successes → closed
 *
 * Why: one sick worker should not drag the latency of every request.
 * Rolling window is bounded by maxSamples so bookkeeping stays O(1).
 */

export interface BreakerOptions {
  /** Failure rate in [0,1] that opens the breaker once `minimumRequests` is met. */
  failureThreshold: number;
  /** Rolling window length in ms for computing the failure rate. */
  windowMs: number;
  /** How long to stay open before allowing probe traffic. */
  cooldownMs: number;
  /** Successful probes required in half-open before closing. */
  halfOpenSuccesses: number;
  /** Don't open until at least this many requests are in the window. */
  minimumRequests: number;
  /** Hard cap on retained outcomes (O(1) bookkeeping). */
  maxSamples: number;
  /** Injectable clock (for tests). */
  now?: () => number;
}

export const DEFAULT_BREAKER: BreakerOptions = {
  failureThreshold: 0.5,
  windowMs: 30_000,
  cooldownMs: 15_000,
  halfOpenSuccesses: 2,
  minimumRequests: 5,
  maxSamples: 256,
};

export type BreakerState = "closed" | "open" | "half_open";

interface Outcome {
  t: number;
  ok: boolean;
}

export class CircuitBreaker {
  private readonly opt: BreakerOptions;
  private readonly now: () => number;
  private outcomes: Outcome[] = [];
  private _state: BreakerState = "closed";
  private openedAt = 0;
  private halfOpenOk = 0;
  private halfOpenInFlight = 0;

  constructor(options: Partial<BreakerOptions> = {}) {
    this.opt = { ...DEFAULT_BREAKER, ...options };
    this.now = this.opt.now ?? Date.now;
  }

  /** Current state, after applying any time-based transition (open → half_open). */
  state(): BreakerState {
    if (this._state === "open" && this.now() - this.openedAt >= this.opt.cooldownMs) {
      this._state = "half_open";
      this.halfOpenOk = 0;
      this.halfOpenInFlight = 0;
    }
    return this._state;
  }

  /** May a request be sent right now? Half-open allows a single probe at a time. */
  canRequest(): boolean {
    const s = this.state();
    if (s === "open") return false;
    if (s === "half_open") {
      if (this.halfOpenInFlight > 0) return false;
      this.halfOpenInFlight += 1;
      return true;
    }
    return true;
  }

  onSuccess(): void {
    this.record(true);
    if (this._state === "half_open") {
      this.halfOpenInFlight = Math.max(0, this.halfOpenInFlight - 1);
      this.halfOpenOk += 1;
      if (this.halfOpenOk >= this.opt.halfOpenSuccesses) this.close();
    }
  }

  onFailure(): void {
    this.record(false);
    if (this._state === "half_open") {
      // Probe failed — straight back to open, restart cooldown.
      this.trip();
      return;
    }
    if (this._state === "closed" && this.failureRate() >= this.opt.failureThreshold) {
      this.trip();
    }
  }

  /** Rolling failure rate over the window, in [0,1]. */
  failureRate(): number {
    this.prune();
    if (this.outcomes.length < this.opt.minimumRequests) return 0;
    const fails = this.outcomes.reduce((n, o) => n + (o.ok ? 0 : 1), 0);
    return fails / this.outcomes.length;
  }

  private record(ok: boolean): void {
    this.outcomes.push({ t: this.now(), ok });
    this.prune();
  }

  private prune(): void {
    const cutoff = this.now() - this.opt.windowMs;
    let i = 0;
    while (i < this.outcomes.length && this.outcomes[i]!.t < cutoff) i += 1;
    const overflow = this.outcomes.length - i - this.opt.maxSamples;
    if (overflow > 0) i += overflow;
    if (i > 0) this.outcomes.splice(0, i);
  }

  private trip(): void {
    this._state = "open";
    this.openedAt = this.now();
    this.halfOpenInFlight = 0;
  }

  private close(): void {
    this._state = "closed";
    this.outcomes = [];
    this.halfOpenOk = 0;
    this.halfOpenInFlight = 0;
  }
}