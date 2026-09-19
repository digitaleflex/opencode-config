/**
 * strategy-pattern.ts
 *
 * Pluggable selection strategies, adapted from
 * ingridtoulotte/llm-fallback-router (MIT, 0 deps).
 *
 * Adapted for opencode/EURINHASH: instead of "which LLM provider",
 * we route "which worker agent" based on task type.
 *
 * Strategies:
 *   priority     — declared order (explore → librarian → oracle)
 *   latency      — fastest EWMA latency first
 *   cost         — cheapest eligible model first
 *   weighted     — weighted random (canary / A/B)
 *   balanced     — composite of health score and latency (default)
 */

import type { ProviderHealth } from "./provider-health.js";

export interface WorkerTarget {
  id: string;
  priority?: number;
  weight?: number;
  tier?: string;
}

export interface Candidate {
  target: WorkerTarget;
  health: ProviderHealth;
  estCostUsd?: number;
}

export interface Strategy {
  readonly name: string;
  order(candidates: Candidate[]): Candidate[];
}

export type StrategyName = "priority" | "latency" | "cost" | "weighted" | "balanced";

function priorityOf(t: WorkerTarget): number {
  return t.priority ?? Number.MAX_SAFE_INTEGER;
}

function cmpBy(...keys: ((c: Candidate) => number)[]): (a: Candidate, b: Candidate) => number {
  return (a, b) => {
    for (const k of keys) {
      const d = k(a) - k(b);
      if (d !== 0) return d;
    }
    return 0;
  };
}

/** Follow the configured priority order; health/latency break ties. */
export const priorityStrategy: Strategy = {
  name: "priority",
  order(cands) {
    return [...cands].sort(
      cmpBy(
        (c) => priorityOf(c.target),
        (c) => -c.health.score(),
        (c) => c.health.latencyMs(),
      ),
    );
  },
};

/** Fastest provider first (by EWMA latency), score as tiebreak. */
export const latencyStrategy: Strategy = {
  name: "latency",
  order(cands) {
    return [...cands].sort(cmpBy((c) => c.health.latencyMs(), (c) => -c.health.score()));
  },
};

/** Cheapest estimated cost first; priority as tiebreak. */
export const costStrategy: Strategy = {
  name: "cost",
  order(cands) {
    return [...cands].sort(cmpBy((c) => c.estCostUsd ?? 0, (c) => priorityOf(c.target)));
  },
};

/**
 * Composite of availability score and latency. The pragmatic default: prefer
 * healthy and fast, fall back gracefully, respect priority only as a tiebreak.
 */
export const balancedStrategy: Strategy = {
  name: "balanced",
  order(cands) {
    const composite = (c: Candidate) => c.health.score() - c.health.latencyMs() / 100;
    return [...cands].sort(cmpBy((c) => -composite(c), (c) => priorityOf(c.target)));
  },
};

/**
 * Weighted traffic split. The primary pick is weighted-random by `weight`;
 * the remaining providers form the fallback chain, also weighted.
 * Pass a seeded `rng` for deterministic tests.
 */
export function weightedStrategy(rng: () => number = Math.random): Strategy {
  return {
    name: "weighted",
    order(cands) {
      const ordered: Candidate[] = [];
      const pool = [...cands];
      while (pool.length > 0) {
        const total = pool.reduce((s, c) => s + Math.max(0, c.target.weight ?? 1), 0);
        if (total <= 0) {
          ordered.push(...pool);
          break;
        }
        let r = rng() * total;
        let idx = 0;
        for (let i = 0; i < pool.length; i++) {
          r -= Math.max(0, pool[i]!.target.weight ?? 1);
          if (r <= 0) {
            idx = i;
            break;
          }
        }
        ordered.push(pool.splice(idx, 1)[0]!);
      }
      return ordered;
    },
  };
}

export function resolveStrategy(
  s: StrategyName | Strategy | undefined,
  rng?: () => number,
): Strategy {
  if (s === undefined) return balancedStrategy;
  if (typeof s !== "string") return s;
  switch (s) {
    case "priority":
      return priorityStrategy;
    case "latency":
      return latencyStrategy;
    case "cost":
      return costStrategy;
    case "weighted":
      return weightedStrategy(rng);
    case "balanced":
      return balancedStrategy;
  }
}
