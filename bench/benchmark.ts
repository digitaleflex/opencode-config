// bench/benchmark.ts — EURINHASH Governance Engine Performance Benchmark
// Measures: classification, risk assessment, policy evaluation, guard evaluation,
// proof verification, and full orchestration latency.
// Load levels: 1 / 10 / 100 / 1000 tasks. Concurrency: 10 / 50 / 100.
// Metrics: avg, min, max, P50, P95, P99, error rate, memory, CPU.

import { performance } from "node:perf_hooks";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyTask } from "../src/core/classifier";
import { assessRisk } from "../src/core/risk-assessor";
import { PolicyEngine } from "../src/core/policy-engine";
import { GuardOverrides } from "../src/core/guard-overrides";
import { ProofVerifier } from "../src/core/proof-verifier";
import { GovernanceOrchestrator } from "../src/core/orchestrator";
import type { TaskSpec, PolicySpec } from "../src/core/types";

// ---------------------------------------------------------------------------
// Task corpus — deterministic rotation across governance levels
// ---------------------------------------------------------------------------

const TASK_CORPUS: TaskSpec[] = [
  // L1-ish → CONFIG, LOW risk, APPROVED
  { description: "fix typo in README file", scope: ["docs"] },
  // L2 → FEATURE_LIMITED, LOW risk, APPROVED (tests + review proofs)
  { description: "fix bug in user service layer", scope: ["src"] },
  // L2 → REFACTOR_MODULE, LOW risk, APPROVED
  { description: "refactor data loader module", scope: ["src/core"] },
  // L2 → FEATURE_LIMITED, LOW risk, APPROVED
  { description: "add feature flag toggle helper", scope: ["src"] },
  // L3 → API_CHANGE, internal HIGH risk, APPROVED then BLOCKED (human approval pending)
  { description: "design api architecture for payment gateway", scope: ["api", "payment"] },
  // L4 → DESTRUCTIVE_OP, CRITICAL, full path then BLOCKED (human approval pending)
  { description: "deploy service to production, clean tmp with rm -rf tmp", scope: ["production"] },
  // Guard BLOCK
  { description: "run rm -rf / to clean the disk", operation: "rm -rf /" },
  // Guard WARN path (git push --force)
  { description: "git push --force origin main" },
];

function makeTask(i: number): TaskSpec {
  const base = TASK_CORPUS[i % TASK_CORPUS.length];
  return { ...base };
}

// ---------------------------------------------------------------------------
// Metric helpers
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

interface Stats {
  n: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  errors: number;
  errorRate: number;
}

function stats(samples: number[], errors: number): Stats {
  const sorted = [...samples].sort((a, b) => a - b);
  const n = samples.length;
  const sum = samples.reduce((acc, v) => acc + v, 0);
  return {
    n,
    avg: n > 0 ? sum / n : NaN,
    min: sorted[0] ?? NaN,
    max: sorted[n - 1] ?? NaN,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    errors,
    errorRate: n > 0 ? errors / n : NaN,
  };
}

function cpuNow(): number | null {
  try {
    const u = process.cpuUsage();
    return u.user + u.system;
  } catch {
    return null;
  }
}

function gcIfPossible(): void {
  try {
    (globalThis as { Bun?: { gc?: (force: boolean) => void } }).Bun?.gc?.(true);
  } catch {
    // GC not available — ignore
  }
}

// ---------------------------------------------------------------------------
// Component runners — each returns null on failure (counted as error)
// ---------------------------------------------------------------------------

type Component = "classify" | "risk" | "policy" | "guard" | "proof" | "orchestration";

function runComponent(
  component: Component,
  task: TaskSpec,
  ctx: BenchContext
): { ok: boolean; extra?: PolicySpec } {
  try {
    switch (component) {
      case "classify":
        classifyTask(task);
        return { ok: true };
      case "risk": {
        const t = { ...task, taskType: classifyTask(task) };
        assessRisk(t);
        return { ok: true };
      }
      case "policy": {
        const t = { ...task, taskType: classifyTask(task), risk: assessRisk({ ...task, taskType: classifyTask(task) }) };
        const decision = ctx.policyEngine.evaluatePolicy(t);
        return { ok: true, extra: decision.policy ?? undefined };
      }
      case "guard":
        ctx.guards.check(task);
        return { ok: true };
      case "proof": {
        const policy = ctx.policyFor(task);
        const t = { ...task, id: `task-${ctx.counter++}` };
        const chain = ctx.proofVerifier.generateProofChain(t, policy);
        ctx.proofVerifier.verifyProofChain(chain, t);
        return { ok: true };
      }
      case "orchestration":
        // handled separately (async)
        return { ok: true };
    }
  } catch {
    return { ok: false };
  }
}

interface BenchContext {
  policyEngine: PolicyEngine;
  guards: GuardOverrides;
  proofVerifier: ProofVerifier;
  orchestrator: GovernanceOrchestrator;
  counter: number;
  policyFor: (task: TaskSpec) => PolicySpec;
}

// ---------------------------------------------------------------------------
// Benchmark phases
// ---------------------------------------------------------------------------

const LOAD_LEVELS = [1, 10, 100, 1000];
const CONCURRENCY_LEVELS = [10, 50, 100];
const WARMUP_OPS = 500;
const COMPONENTS: Component[] = ["classify", "risk", "policy", "guard", "proof"];

function benchSequentialComponent(
  component: Component,
  load: number,
  ctx: BenchContext
): Stats {
  const samples: number[] = [];
  let errors = 0;
  for (let i = 0; i < load; i++) {
    const task = makeTask(i);
    const t0 = performance.now();
    const result = runComponent(component, task, ctx);
    const t1 = performance.now();
    samples.push(t1 - t0);
    if (!result.ok) errors++;
  }
  return stats(samples, errors);
}

async function benchOrchestrationSequential(
  load: number,
  ctx: BenchContext
): Promise<Stats> {
  const samples: number[] = [];
  let errors = 0;
  for (let i = 0; i < load; i++) {
    const task = makeTask(i);
    const t0 = performance.now();
    try {
      await ctx.orchestrator.execute(task);
    } catch {
      errors++;
    }
    const t1 = performance.now();
    samples.push(t1 - t0);
  }
  return stats(samples, errors);
}

async function benchOrchestrationConcurrent(
  concurrency: number,
  ctx: BenchContext
): Promise<{ stats: Stats; wallClock: number }> {
  const samples: number[] = [];
  let errors = 0;
  const wallStart = performance.now();
  const jobs = Array.from({ length: concurrency }, (_, i) => async () => {
    const task = makeTask(i);
    const t0 = performance.now();
    try {
      await ctx.orchestrator.execute(task);
    } catch {
      errors++;
    }
    samples.push(performance.now() - t0);
  });
  await Promise.all(jobs.map((j) => j()));
  const wallClock = performance.now() - wallStart;
  return { stats: stats(samples, errors), wallClock };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const REGRESSION_TOLERANCE = 1.2;

async function runCheck(baselinePath: string): Promise<void> {
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as {
    results: { orchestration: { load_1000: Stats } };
  };
  const ref = baseline.results.orchestration.load_1000;
  if (!ref) {
    console.error(`CHECK FAILED: baseline at ${baselinePath} has no orchestration.load_1000 data`);
    process.exit(1);
  }

  const policyEngine = new PolicyEngine();
  const guards = new GuardOverrides();
  const proofVerifier = new ProofVerifier();
  const orchestrator = new GovernanceOrchestrator();
  const allPolicies = (policyEngine as unknown as { policies: PolicySpec[] }).policies;
  const l2Policy = allPolicies.find((p) => p.name === "L2-STANDARD")!;
  const ctx: BenchContext = {
    policyEngine, guards, proofVerifier, orchestrator, counter: 0,
    policyFor: (task) => {
      const t = { ...task, taskType: classifyTask(task), risk: assessRisk({ ...task, taskType: classifyTask(task) }) };
      return policyEngine.evaluatePolicy(t).policy ?? l2Policy;
    },
  };

  // Match the full-suite thermal/JIT profile: full warmup through every
  // component, then a throwaway load_1000 pass, before the measured pass.
  // Without this the check compares cold-start numbers against a hot baseline.
  for (let i = 0; i < 500; i++) {
    for (const c of ["classify", "risk", "policy", "guard", "proof"] as Component[]) {
      runComponent(c, makeTask(i), ctx);
    }
    await orchestrator.execute(makeTask(i));
  }
  gcIfPossible();
  await benchOrchestrationSequential(1000, ctx);
  gcIfPossible();

  const current = await benchOrchestrationSequential(1000, ctx);

  const p50Ratio = current.p50 / ref.p50;
  const p95Ratio = current.p95 / ref.p95;
  const failed = p50Ratio > REGRESSION_TOLERANCE || p95Ratio > REGRESSION_TOLERANCE;

  console.log(`REGRESSION CHECK vs ${baselinePath}`);
  console.log(`  P50: ${ref.p50.toFixed(4)}ms -> ${current.p50.toFixed(4)}ms (x${p50Ratio.toFixed(2)})`);
  console.log(`  P95: ${ref.p95.toFixed(4)}ms -> ${current.p95.toFixed(4)}ms (x${p95Ratio.toFixed(2)})`);
  console.log(`  errors: ${current.errors}/${current.n}`);
  if (failed) {
    console.error(`CHECK FAILED: regression exceeds ${REGRESSION_TOLERANCE}x tolerance`);
    process.exit(1);
  }
  console.log("CHECK PASSED");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const checkIdx = argv.indexOf("--check");
  if (checkIdx >= 0) {
    await runCheck(argv[checkIdx + 1] ?? "bench/results/baseline.json");
    return;
  }

  const policyEngine = new PolicyEngine();
  const guards = new GuardOverrides();
  const proofVerifier = new ProofVerifier();
  const orchestrator = new GovernanceOrchestrator();

  // Deterministic policy lookup for proof benchmarks: fall back to L2 policy
  const allPolicies = (policyEngine as unknown as { policies: PolicySpec[] }).policies;
  const l2Policy = allPolicies.find((p) => p.name === "L2-STANDARD")!;

  const ctx: BenchContext = {
    policyEngine,
    guards,
    proofVerifier,
    orchestrator,
    counter: 0,
    policyFor: (task) => {
      const t = { ...task, taskType: classifyTask(task), risk: assessRisk({ ...task, taskType: classifyTask(task) }) };
      const decision = policyEngine.evaluatePolicy(t);
      return decision.policy ?? l2Policy;
    },
  };

  const memBefore = process.memoryUsage();
  const cpuBefore = cpuNow();
  const totalStart = performance.now();

  // Warmup (not measured) — JIT compile + regex caches
  for (let i = 0; i < WARMUP_OPS; i++) {
    for (const c of COMPONENTS) runComponent(c, makeTask(i), ctx);
    try {
      await orchestrator.execute(makeTask(i));
    } catch {
      // warmup errors expected pre-fix; counted in measured phases only
    }
  }
  gcIfPossible();

  const results: Record<string, Record<string, Stats | number>> = {};

  // Phase 1: sequential component benchmarks at load levels
  for (const component of COMPONENTS) {
    results[component] = {};
    for (const load of LOAD_LEVELS) {
      results[component][`load_${load}`] = benchSequentialComponent(component, load, ctx);
    }
  }

  // Phase 2: full orchestration, sequential at load levels
  results["orchestration"] = {};
  for (const load of LOAD_LEVELS) {
    results["orchestration"][`load_${load}`] = await benchOrchestrationSequential(load, ctx);
  }

  // Phase 3: orchestration concurrency levels
  results["orchestration_concurrent"] = {};
  for (const c of CONCURRENCY_LEVELS) {
    const { stats: s, wallClock } = await benchOrchestrationConcurrent(c, ctx);
    results["orchestration_concurrent"][`conc_${c}`] = { ...s, wallClock };
  }

  const totalElapsed = performance.now() - totalStart;
  const cpuAfter = cpuNow();
  const memAfter = process.memoryUsage();

  const meta = {
    timestamp: new Date().toISOString(),
    platform: `${process.platform} ${process.arch}`,
    runtime: typeof Bun !== "undefined" ? `bun ${Bun.version}` : `node ${process.version}`,
    cpuCount: typeof navigator !== "undefined" ? (navigator as { hardwareConcurrency?: number }).hardwareConcurrency : undefined,
    memoryBefore: { rssMb: +(memBefore.rss / 1048576).toFixed(2), heapUsedMb: +(memBefore.heapUsed / 1048576).toFixed(2) },
    memoryAfter: { rssMb: +(memAfter.rss / 1048576).toFixed(2), heapUsedMb: +(memAfter.heapUsed / 1048576).toFixed(2) },
    cpuDeltaMs: cpuBefore !== null && cpuAfter !== null ? +((cpuAfter - cpuBefore) / 1000).toFixed(2) : null,
    warmupOps: WARMUP_OPS,
    corpusSize: TASK_CORPUS.length,
    totalBenchElapsedMs: +totalElapsed.toFixed(2),
    engineVersion: orchestrator.getSummary().version,
    policiesLoaded: orchestrator.getSummary().policiesLoaded,
  };

  const output = { meta, results };
  mkdirSync("bench/results", { recursive: true });
  mkdirSync("docs/testing", { recursive: true });
  writeFileSync("bench/results/baseline.json", JSON.stringify(output, null, 2));
  writeFileSync(join("docs", "testing", "benchmark-baseline.json"), JSON.stringify(output, null, 2));

  // Console summary
  console.log("EURINHASH Governance Engine — Performance Baseline");
  console.log(JSON.stringify(meta, null, 2));
  for (const [component, levels] of Object.entries(results)) {
    console.log(`\n=== ${component} ===`);
    for (const [level, s] of Object.entries(levels)) {
      const st = s as Stats & { wallClock?: number };
      console.log(
        `  ${level}: n=${st.n} avg=${st.avg.toFixed(4)}ms min=${st.min.toFixed(4)}ms ` +
        `max=${st.max.toFixed(4)}ms p50=${st.p50.toFixed(4)}ms p95=${st.p95.toFixed(4)}ms ` +
        `p99=${st.p99.toFixed(4)}ms err=${st.errors} wall=${(st as { wallClock?: number }).wallClock?.toFixed(2) ?? "-"}ms`
      );
    }
  }
}

main().catch((err) => {
  console.error("BENCHMARK FAILED:", err);
  process.exit(1);
});
