// src/core/mode.ts — Engine mode (free | pro) + worker cost registry.
// Free mode (default, fail-closed): only free/trial workers are allowed.
// Pro mode (explicit opt-in): paid workers allowed, spend tracked against
// an optional monthly cap. Mode resolution: EURINHASH_MODE env var >
// mode.json (cwd) > "free".

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { ModelPlan } from "./types";

export type EngineMode = "free" | "pro";
export type WorkerTier = "free" | "trial" | "paid";

export interface ModeState {
  mode: EngineMode;
  proMonthlyCapUsd?: number;
  updatedAt?: string;
}

export interface WorkerCost {
  tier: WorkerTier;
  notes?: string;
  inputUsdPerM?: number;
  outputUsdPerM?: number;
}

export type CostRegistry = Record<string, WorkerCost>;

const MODE_FILE = "mode.json";
const REGISTRY_FILE = join("policies", "models.json");

/** Built-in fallback registry (used when policies/models.json is missing). */
const DEFAULT_REGISTRY: CostRegistry = {
  "worker-codestral": { tier: "free" },
  "worker-groq": { tier: "free" },
  "worker-novita": { tier: "free" },
  "worker-zhipu": { tier: "free" },
  "worker-sambanova": { tier: "free" },
  "worker-google": { tier: "free" },
  "worker-cerebras": { tier: "trial" },
  "worker-cohere": { tier: "trial" },
  "worker-ollama": { tier: "free" },
  "worker-pollinations": { tier: "free" },
};

function modeFilePath(dir?: string): string {
  return join(dir || process.cwd(), MODE_FILE);
}

function registryPath(dir?: string): string {
  return join(dir || process.cwd(), REGISTRY_FILE);
}

/** Resolve the engine mode. Never throws; defaults to "free" (fail-closed). */
export function loadMode(dir?: string): ModeState {
  const env = (process.env.EURINHASH_MODE || "").trim().toLowerCase();
  if (env === "pro" || env === "free") {
    return { mode: env };
  }
  try {
    const file = modeFilePath(dir);
    if (existsSync(file)) {
      const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<ModeState>;
      if (raw.mode === "pro" || raw.mode === "free") {
        return {
          mode: raw.mode,
          ...(typeof raw.proMonthlyCapUsd === "number"
            ? { proMonthlyCapUsd: raw.proMonthlyCapUsd }
            : {}),
          ...(typeof raw.updatedAt === "string" ? { updatedAt: raw.updatedAt } : {}),
        };
      }
    }
  } catch {
    // fall through to default
  }
  return { mode: "free" };
}

/** Persist the engine mode. Switches to "pro" only via explicit call. */
export function saveMode(state: ModeState, dir?: string): void {
  const file = modeFilePath(dir);
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2),
      "utf8"
    );
  } catch {
    // non-fatal: caller keeps running in the requested mode in memory
  }
}

/** Load the worker cost registry (file, else built-in defaults). Never throws. */
export function loadRegistry(dir?: string): CostRegistry {
  try {
    const file = registryPath(dir);
    if (existsSync(file)) {
      const raw = JSON.parse(readFileSync(file, "utf8")) as {
        workers?: Record<string, WorkerCost>;
      };
      if (raw.workers && typeof raw.workers === "object") {
        const clean: CostRegistry = {};
        for (const [k, v] of Object.entries(raw.workers)) {
          if (v && (v.tier === "free" || v.tier === "trial" || v.tier === "paid")) {
            clean[k] = v;
          }
        }
        if (Object.keys(clean).length > 0) return clean;
      }
    }
  } catch {
    // fall through to defaults
  }
  return { ...DEFAULT_REGISTRY };
}

/** Is this worker usable in the given mode? Unknown workers are denied (fail-closed). */
export function isWorkerAllowed(
  worker: string,
  mode: EngineMode,
  registry?: CostRegistry
): boolean {
  const reg = registry ?? DEFAULT_REGISTRY;
  const entry = reg[worker];
  if (!entry) return false;
  if (mode === "pro") return true;
  return entry.tier === "free" || entry.tier === "trial";
}

/**
 * Filter a policy model plan to the workers allowed in this mode.
 * Returns null when nothing remains (caller must BLOCK fail-closed).
 */
export function filterModelPlan(
  plan: ModelPlan | undefined | null,
  mode: EngineMode,
  registry?: CostRegistry
): ModelPlan | null {
  if (!plan || typeof plan !== "object") return null;
  const reg = registry ?? DEFAULT_REGISTRY;
  const primary = (plan.primary || []).filter((w) => isWorkerAllowed(w, mode, reg));
  const fallback = (plan.fallback || []).filter((w) => isWorkerAllowed(w, mode, reg));
  if (primary.length === 0 && fallback.length === 0) return null;
  return { primary, fallback };
}
