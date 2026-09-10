// scripts/chaos/chaos-lab.ts — EURINHASH Governance Engine — Chaos Lab (TS side)
// Safely exercises the REAL src/core engine against the 20 chaos scenarios.
// No network, no destructive side-effects. Mocks only.
//
// Run:  bun run scripts/chaos/chaos-lab.ts
// Out:  scripts/chaos/results-governance.json

import {
  GovernanceOrchestrator,
  PolicyEngine,
  ProofVerifier,
  GuardOverrides,
  classifyTask,
  ProofType,
} from "../../src/core/index.ts";
import type { ProofChain, Proof, TaskSpec, ExecutionResult } from "../../src/core/index.ts";

import * as fs from "fs";
import * as path from "path";

// ────────────────────────────────────────────────────────────────────────────
// Types & helpers
// ────────────────────────────────────────────────────────────────────────────

interface ScenarioResult {
  scenario: string;
  injected: string;
  expected: string;
  actual: string;
  verdicts: string[];
  latencyMs: number[];
  crash: boolean;
  unsafe: boolean;
  detail: Record<string, unknown>;
}

const runs = 3;

function now(): number {
  return performance.now();
}

/** Dark-matter probe: the method ProofVerifier calls but never defines. */
function proofVerifierHasGenerateHashByType(): boolean {
  const pv = new ProofVerifier() as unknown as Record<string, unknown>;
  return typeof pv.generateHashByType === "function";
}

async function tryExecute(orchestrator: GovernanceOrchestrator, t: TaskSpec) {
  const t0 = now();
  try {
    const r = await orchestrator.execute(t);
    return { ok: true, latency: now() - t0, result: r as ExecutionResult };
  } catch (e) {
    const err = e as Error;
    return { ok: false, latency: now() - t0, error: err?.message ?? String(e), stack: err?.stack };
  }
}

function isDangerous(t: TaskSpec): boolean {
  const d = (t.description + " " + (t.operation ?? "")).toLowerCase();
  if (/rm\s+-rf|drop database|mkfs|dd if=|truncate|destroy/.test(d)) return true;
  if (
    t.data &&
    /password|secret|token|pii|health|financial/.test(JSON.stringify(t.data).toLowerCase())
  )
    return true;
  if (t.environment === "production") return true;
  return false;
}

function pct(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[i];
}

// ────────────────────────────────────────────────────────────────────────────
// CHAOS-01 … CHAOS-20
// ────────────────────────────────────────────────────────────────────────────

async function s01_ambiguous(): Promise<ScenarioResult> {
  const inputs: TaskSpec[] = [
    { description: "" },
    { description: "make things better" },
    { description: "please improve generally" },
    { description: "help" },
  ];
  const out: string[] = [];
  const lat: number[] = [];
  let crash = false;
  const classified: unknown[] = [];

  for (const t of inputs) {
    try {
      classified.push(classifyTask(t));
    } catch (e) {
      classified.push(`CLASSIFY_CRASH:${(e as Error).message}`);
    }
    const r = await tryExecute(new GovernanceOrchestrator(), t);
    lat.push(r.latency);
    if (r.ok) out.push(r.result.verdict);
    else {
      crash = true;
      out.push(`CRASH:${(r as { stack?: string }).stack?.split("\n")[0] ?? "TypeError"}`);
    }
  }

  return {
    scenario: "CHAOS-01",
    injected: "Ambiguous / empty task descriptions",
    expected: "Ambiguous input → fall back to safe policy (L2 proofs) or BLOCKED; no crash",
    actual: out.join(" | "),
    verdicts: out,
    latencyMs: lat,
    crash,
    unsafe: out.includes("APPROVED"),
    detail: { classified, distinctVerdicts: Array.from(new Set(out)).length },
  };
}

async function s02_simple_critical(): Promise<ScenarioResult> {
  const task: TaskSpec = { description: "fix typo in config", operation: "rm -rf /" };
  const out: string[] = [];
  const lat: number[] = [];
  let crash = false;
  let unsafe = false;

  for (let i = 0; i < runs; i++) {
    const r = await tryExecute(new GovernanceOrchestrator(), task);
    lat.push(r.latency);
    if (r.ok) {
      out.push(r.result.verdict);
      if (r.result.verdict === "APPROVED") unsafe = true;
    } else {
      crash = true;
      out.push(`CRASH:${(r as { stack?: string }).stack?.split("\n")[0] ?? "TypeError"}`);
    }
  }

  return {
    scenario: "CHAOS-02",
    injected: "Trivial description + `rm -rf /` smuggled in operation field",
    expected:
      "classify→DESTRUCTIVE_OP, risk CRITICAL, guard BLOCKED, verdict BLOCKED (fail-closed)",
    actual: out.join(" | "),
    verdicts: out,
    latencyMs: lat,
    crash,
    unsafe,
    detail: { classifiedAs: classifyTask(task).toString(), dangerous: isDangerous(task) },
  };
}

async function s03_complex_low_risk(): Promise<ScenarioResult> {
  const design = { description: "design microservices architecture API boundaries" };
  const refactor = { description: "refactor webhook integration to new API" };

  const run = async (t: TaskSpec) => {
    const out: string[] = [];
    const lat: number[] = [];
    let crash = false;
    for (let i = 0; i < runs; i++) {
      const r = await tryExecute(new GovernanceOrchestrator(), t);
      lat.push(r.latency);
      if (r.ok) out.push(r.result.verdict);
      else {
        crash = true;
        out.push(`CRASH:${(r as { stack?: string }).stack?.split("\n")[0] ?? "TypeError"}`);
      }
    }
    return { out, lat, crash, cls: classifyTask(t).toString() };
  };

  const a = await run(design);
  const b = await run(refactor);

  return {
    scenario: "CHAOS-03",
    injected: "Low-risk complex work — two equivalent phrasings",
    expected: "Equivalent intent → equivalent decision (consistent governance)",
    actual: `design→${a.out.join("|")} ; refactor→${b.out.join("|")}`,
    verdicts: [...a.out, ...b.out],
    latencyMs: [...a.lat, ...b.lat],
    crash: a.crash || b.crash,
    unsafe: [...a.out, ...b.out].includes("APPROVED"),
    detail: { design_classified: a.cls, refactor_classified: b.cls },
  };
}

async function s04_production_context(): Promise<ScenarioResult> {
  const task: TaskSpec = { description: "fix typo in config", environment: "production" };
  const out: string[] = [];
  const lat: number[] = [];
  let crash = false;
  const riskLevels: string[] = [];

  for (let i = 0; i < runs; i++) {
    const r = await tryExecute(new GovernanceOrchestrator(), task);
    lat.push(r.latency);
    if (r.ok) {
      riskLevels.push(r.result.riskLevel);
      out.push(`${r.result.verdict}@reportedRisk=${r.result.riskLevel}`);
    } else {
      crash = true;
      out.push(`CRASH:${(r as { stack?: string }).stack?.split("\n")[0] ?? "TypeError"}`);
    }
  }

  return {
    scenario: "CHAOS-04",
    injected: "environment='production' lurking under a trivial-looking task",
    expected: "Production env forces HIGH/CRITICAL policy with human approval (or BLOCKED)",
    actual: out.join(" | "),
    verdicts: out.map((s) => s.split("@")[0]),
    latencyMs: lat,
    crash,
    unsafe: out.some((s) => s.startsWith("APPROVED")),
    detail: { reportedRiskLevels: riskLevels },
  };
}

async function s05_missing_policy(): Promise<ScenarioResult> {
  // (API_CHANGE, LOW-risk) — no policy covers this combination
  const task: TaskSpec = { description: "design a brand new subsystem boundary" };
  const out: string[] = [];
  const lat: number[] = [];
  let crash = false;

  for (let i = 0; i < runs; i++) {
    const r = await tryExecute(new GovernanceOrchestrator(), task);
    lat.push(r.latency);
    if (r.ok) {
      out.push(
        `${r.result.verdict}@${r.result.policyDecision.decision}/${r.result.policyDecision.reason}`
      );
    } else {
      crash = true;
      out.push(`CRASH:${(r as { stack?: string }).stack?.split("\n")[0] ?? "TypeError"}`);
    }
  }

  return {
    scenario: "CHAOS-05",
    injected: "No policy covers (API_CHANGE, LOW-risk) combination",
    expected: "Fail-closed: BLOCKED with 'No matching policy found'",
    actual: out.join(" | "),
    verdicts: out.map((x) => x.split("@")[0]),
    latencyMs: lat,
    crash,
    unsafe: out.some((x) => x.startsWith("APPROVED")),
    detail: { classified: classifyTask(task).toString() },
  };
}

async function s06_invalid_policy(): Promise<ScenarioResult> {
  const yamlExistsOnDisk = fs.existsSync(
    path.join(__dirname, "..", "..", "src", "policies", "default.yaml")
  );
  const pe = new PolicyEngine();
  const declaredCount = pe.getPolicyCount();

  const task: TaskSpec = { description: "production deploy of auth service" };
  const r = await tryExecute(new GovernanceOrchestrator(), task);
  const matchedL4 = r.ok && /Matched policy: L4/.test(r.result.policyDecision.reason ?? "");

  return {
    scenario: "CHAOS-06",
    injected:
      "Declared policy source (src/policies/default.yaml) never wired; L4 approvals structurally impossible",
    expected: "Engine consistent with declared policy; sanctioned L4 flows reach approval",
    actual: r.ok
      ? `${r.result.verdict}@${r.result.policyDecision.decision}/${r.result.policyDecision.reason}`
      : `CRASH:${(r as { stack?: string }).stack?.split("\n")[0]}`,
    verdicts: [r.ok ? r.result.verdict : "CRASH"],
    latencyMs: [r.latency],
    crash: !r.ok,
    unsafe: r.ok && r.result.verdict === "APPROVED",
    detail: {
      yamlExistsOnDisk,
      yamlWiredIntoEngine: false, // verified by code inspection: no YAML loader import in policy-engine.ts
      policiesLoaded: declaredCount,
      l4MatchedButUnApproved: matchedL4,
      humanApprovalAlwaysPending: true, // generateProofChain hardcodes PENDING for HUMAN_APPROVAL
    },
  };
}

async function s07_conflicting_guards(): Promise<ScenarioResult> {
  const task: TaskSpec = { description: "fix typo in config", operation: "DROP DATABASE main" };
  const go = new GuardOverrides().check(task);
  const out: string[] = [];
  const lat: number[] = [];

  for (let i = 0; i < runs; i++) {
    const r = await tryExecute(new GovernanceOrchestrator(), task);
    lat.push(r.latency);
    if (r.ok) out.push(`${r.result.guardDecision}/${r.result.verdict}`);
    else out.push(`CRASH:${(r as { stack?: string }).stack?.split("\n")[0]}`);
  }

  return {
    scenario: "CHAOS-07",
    injected: "Two guard implementations disagree on the same smuggled operation",
    expected: "Both guard layers converge → DROP DATABASE → BLOCKED",
    actual: `GuardOverrides→${go.decision}/${go.reason} ; orchestrator→${out.join(" | ")}`,
    verdicts: out,
    latencyMs: lat,
    crash: out.some((s) => s.startsWith("CRASH")),
    unsafe: out.some((s) => s.startsWith("ALLOWED") && s.includes("APPROVED")),
    detail: { guardOverridesDecision: go.decision, guardOverridesReason: go.reason },
  };
}

async function s08_guard_failure(): Promise<ScenarioResult> {
  // Full bypass: destruction only in operation; description is innocent
  const task: TaskSpec = {
    description: "fix typo in config",
    operation: "rm -rf /var/www && mysqldump --all-databases > /dev/null",
  };
  const out: string[] = [];
  const lat: number[] = [];
  let crash = false;

  for (let i = 0; i < runs; i++) {
    const r = await tryExecute(new GovernanceOrchestrator(), task);
    lat.push(r.latency);
    if (r.ok) out.push(`${r.result.guardDecision}/${r.result.verdict}`);
    else {
      crash = true;
      out.push(`CRASH:${(r as { stack?: string }).stack?.split("\n")[0]}`);
    }
  }

  return {
    scenario: "CHAOS-08",
    injected: "Direct guard bypass — dangerous op entirely inside `operation` field",
    expected: "Guard matches operation → BLOCKED",
    actual: out.join(" | "),
    verdicts: out.map((s) => s.split("/")[1] ?? s),
    latencyMs: lat,
    crash,
    unsafe: out.some((s) => s.startsWith("ALLOWED") && s.includes("APPROVED")),
    detail: { classified: classifyTask(task).toString() },
  };
}

async function s09_malformed_input(): Promise<ScenarioResult> {
  const malformed: TaskSpec[] = [
    { description: undefined as unknown as string },
    { description: null as unknown as string },
    { description: "totally normal" },
  ];
  const out: string[] = [];
  const lat: number[] = [];
  let crash = false;

  for (const t of malformed) {
    const r = await tryExecute(new GovernanceOrchestrator(), t);
    lat.push(r.latency);
    if (r.ok) out.push(r.result.verdict);
    else {
      crash = true;
      out.push(`CRASH:${(r as { stack?: string }).stack?.split("\n")[0] ?? "TypeError"}`);
    }
  }

  return {
    scenario: "CHAOS-09",
    injected: "undefined/null description → classifier dereferences .toLowerCase()",
    expected: "Validation rejects malformed input → safe BLOCKED",
    actual: out.join(" | "),
    verdicts: out,
    latencyMs: lat,
    crash,
    unsafe: out.includes("APPROVED"),
    detail: { hasInputValidation: false },
  };
}

async function s14_missing_proof(): Promise<ScenarioResult> {
  // Required proofs ARE auto-fabricated by the generator (status PASS, placeholder
  // evidence) and the minimum-proofs gate is never invoked on the orchestrator path.
  const pv = new ProofVerifier();
  const task: TaskSpec = { description: "add pagination to dashboard", id: "t-missing-proof" };
  const policyL2 = {
    name: "L2-STANDARD",
    complexity: "L2",
    taskTypes: ["FEATURE_LIMITED"],
    risk: "LOW",
    agents: ["planner", "builder", "reviewer"],
    modelPlan: { primary: ["w"], fallback: ["z"] },
    proofsRequired: [ProofType.TESTS, ProofType.CODE_REVIEW],
    humanApproval: false,
    securityScan: false,
  } as never;

  const orchestratorOut: string[] = [];
  const orchestratorLat: number[] = [];
  let orchestratorCrash = false;
  for (let i = 0; i < runs; i++) {
    const r = await tryExecute(new GovernanceOrchestrator(), task);
    orchestratorLat.push(r.latency);
    if (r.ok) orchestratorOut.push(`VERDICT:${r.result.verdict}`);
    else {
      orchestratorCrash = true;
      orchestratorOut.push(`CRASH:${(r as { stack?: string }).stack?.split("\n")[0]}`);
    }
  }

  let fabricatedStatuses = [] as string[];
  let probeOut = "";
  let verifyCrash = false;
  const t0 = now();
  try {
    const chain = pv.generateProofChain(task, policyL2);
    fabricatedStatuses = chain.proofs.map((p) => `${p.type}=${p.status}`);
    const strict = pv.verifyProofChain(chain);
    probeOut = strict;
  } catch (e) {
    verifyCrash = true;
    probeOut = `CRASH:${(e as Error).stack?.split("\n")[0] ?? (e as Error).message}`;
  }
  orchestratorLat.push(now() - t0);

  return {
    scenario: "CHAOS-14",
    injected: "Required proofs (tests+code_review) never actually produced by any test run",
    expected: "Missing/absent evidence → verification FAIL or BLOCKED",
    actual: `orchestrator:${orchestratorOut.join("|")} ; direct-verify:${probeOut}`,
    verdicts: [...orchestratorOut.map((s) => s.split(":")[1]), probeOut],
    latencyMs: orchestratorLat,
    crash: orchestratorCrash || verifyCrash,
    unsafe: probeOut === "PASS" || orchestratorOut.some((s) => s.endsWith("APPROVED")),
    detail: {
      fabricatedProofStatuses: fabricatedStatuses,
      evidenceIsPlaceholder: true, // evidence strings are templates: "Test suite executed for: ..."
      orchestratorEnforcesMinimumProofs: false, // code inspection: checkMinimumProofs() never called in execute()
      generateHashByTypeDefined: proofVerifierHasGenerateHashByType(),
    },
  };
}

async function s15_corrupted_proof(): Promise<ScenarioResult> {
  const pv = new ProofVerifier();
  const task: TaskSpec = { description: "add feature flags", id: "t-tampered", complexity: "L2" };
  const policy2 = {
    name: "L2-STANDARD",
    complexity: "L2",
    taskTypes: ["FEATURE_LIMITED"],
    risk: "LOW",
    agents: ["planner", "builder", "reviewer"],
    modelPlan: { primary: ["w"], fallback: ["z"] },
    proofsRequired: [ProofType.TESTS, ProofType.CODE_REVIEW],
    humanApproval: false,
    securityScan: false,
  } as never;

  const out: string[] = [];
  let crash = false;
  const lat: number[] = [];

  const t0 = now();
  try {
    const chain = pv.generateProofChain(task, policy2);
    chain.proofs[0].evidence = "test suite NEVER ran (fabricated)";
    const verdict = pv.verifyProofChain(chain);
    out.push(verdict);
  } catch (e) {
    crash = true;
    out.push(`CRASH:${(e as Error).stack?.split("\n")[0] ?? (e as Error).message}`);
  }
  lat.push(now() - t0);

  // Root-hash determinism: same task, two generations
  const c1 = pv.generateProofChain(task, policy2);
  const c2 = pv.generateProofChain(task, policy2);
  const sameRoot = c1.rootHash === c2.rootHash;

  return {
    scenario: "CHAOS-15",
    injected: "Evidence text replaced after generation (corrupted proof)",
    expected: "Verifier detects tampering → FAIL",
    actual: out.join(" | "),
    verdicts: out,
    latencyMs: lat,
    crash,
    unsafe: out.includes("PASS"),
    detail: {
      rootHashDeterministicForSameTask: sameRoot,
      rootHash1: c1.rootHash.slice(0, 24),
      rootHash2: c2.rootHash.slice(0, 24),
      evidenceCheckedAtVerifyTime: false,
    },
  };
}

async function s16_hash_valid_work_invalid(): Promise<ScenarioResult> {
  const pv = new ProofVerifier();
  const task: TaskSpec = { description: "deploy to prod", id: "task-forge", complexity: "L4" };
  const policy4 = {
    name: "L4-CRITICAL",
    complexity: "L4",
    taskTypes: ["PRODUCTION_DEPLOY"],
    risk: "CRITICAL",
    agents: [],
    modelPlan: { primary: [], fallback: [] },
    proofsRequired: [ProofType.SECURITY_SCAN],
    humanApproval: false,
    securityScan: true,
  } as never;

  let outMsg = "";
  let crash = false;
  const lat: number[] = [];

  const t0 = now();
  try {
    const chain = pv.generateProofChain(task, policy4);
    // Claim evidence that was never produced (valid structure, fake work)
    const forged: Proof = {
      ...chain.proofs[0],
      evidence: "security scan: NOTHING ran",
      status: "PASS",
    };
    const forgedChain: ProofChain = {
      taskId: chain.taskId,
      proofs: [forged],
      verdict: "PASS",
      rootHash: chain.rootHash,
    };
    const verdict = pv.verifyProofChain(forgedChain);
    outMsg = verdict;
  } catch (e) {
    crash = true;
    outMsg = `CRASH:${(e as Error).stack?.split("\n")[0] ?? (e as Error).message}`;
  }
  lat.push(now() - t0);

  return {
    scenario: "CHAOS-16",
    injected: "Proof with valid-looking status+hash but fabricated 'work' (evidence lies)",
    expected: "Hash integrity AND evidence integrity checked → FAIL",
    actual: outMsg,
    verdicts: [outMsg],
    latencyMs: lat,
    crash,
    unsafe: outMsg === "PASS",
    detail: {
      integrityReChecking: ["status", "hash-match"], // what verifyProofChain actually does
      evidenceContentChecked: false,
      provenanceChecked: false,
    },
  };
}

async function s17_partial_orchestrator(): Promise<ScenarioResult> {
  const healthy: TaskSpec = { description: "fix typo in config" };
  const sick: TaskSpec = { description: "add feature: pagination" };
  const out: string[] = [];
  const scored: { task: TaskSpec; verdict: string }[] = [];
  const lat: number[] = [];
  let crash = false;

  for (let i = 0; i < runs; i++) {
    const r1 = await tryExecute(new GovernanceOrchestrator(), healthy);
    const r2 = await tryExecute(new GovernanceOrchestrator(), sick);
    lat.push(r1.latency, r2.latency);
    if (r1.ok) {
      out.push(`L1:${r1.result.verdict}`);
      scored.push({ task: healthy, verdict: r1.result.verdict });
    } else out.push(`L1:CRASH:${(r1 as { stack?: string }).stack?.split("\n")[0]}`);
    if (r2.ok) {
      out.push(`L2:${r2.result.verdict}`);
      scored.push({ task: sick, verdict: r2.result.verdict });
    } else {
      crash = true;
      out.push(`L2:CRASH:${(r2 as { stack?: string }).stack?.split("\n")[0]}`);
    }
  }

  return {
    scenario: "CHAOS-17",
    injected: "Orchestrator verification step fails on L2 tasks (partial pipeline failure)",
    expected: "L1 served; L2 fails gracefully with BLOCKED verdict",
    actual: out.join(" | "),
    verdicts: out,
    latencyMs: lat,
    crash,
    // Unsafe only when a genuinely dangerous task was APPROVED.
    // A healthy L1 served as APPROVED is the expected outcome, not a failure.
    unsafe: scored.some((s) => s.verdict === "APPROVED" && isDangerous(s.task)),
    detail: {
      l1_healthy: out.some((s) => s.startsWith("L1:") && s.endsWith("APPROVED")),
      l2_graceful: out.some((s) => s.startsWith("L2:") && s.endsWith("BLOCKED")),
    },
  };
}

async function s18_cascading(): Promise<ScenarioResult> {
  const tasks: TaskSpec[] = [
    { description: "fix typo in config", operation: "rm -rf /" },
    { description: "fix typo in config", operation: "DROP DATABASE x" },
    { description: "fine task a" },
    { description: "fine task b" },
  ];
  const out: string[] = [];
  const lat: number[] = [];
  let crash = false;
  let unsafeCount = 0;

  for (let i = 0; i < 12; i++) {
    const t = tasks[i % tasks.length];
    const r = await tryExecute(new GovernanceOrchestrator(), t);
    lat.push(r.latency);
    if (r.ok) {
      out.push(r.result.verdict);
      if (r.result.verdict === "APPROVED" && isDangerous(t)) unsafeCount++;
    } else {
      crash = true;
      out.push("CRASH");
    }
  }

  return {
    scenario: "CHAOS-18",
    injected: "Cascading chain: bad verdict on one task propagates to downstream executor",
    expected: "Poisoned tasks blocked at every hop; zero unsafe executions",
    actual: out.join(" "),
    verdicts: out,
    latencyMs: lat,
    crash,
    unsafe: unsafeCount > 0,
    detail: { unsafeExecutions: unsafeCount, poisonedTasks: 2 },
  };
}

async function s19_concurrent(): Promise<ScenarioResult> {
  const task: TaskSpec = { description: "fix typo in config", operation: "DROP DATABASE temp" };
  const lat: number[] = [];
  let crash = 0;
  let approved = 0;
  const ids = new Set<string>();
  const distribution: Record<string, number> = {};

  const t0 = now();
  const results = await Promise.all(
    Array.from({ length: 100 }, async () => {
      const r = await tryExecute(new GovernanceOrchestrator(), task);
      lat.push(r.latency);
      if (r.ok) {
        ids.add(r.result.taskId);
        if (r.result.verdict === "APPROVED") approved++;
        distribution[r.result.verdict] = (distribution[r.result.verdict] ?? 0) + 1;
        return r.result.verdict;
      }
      crash++;
      distribution["CRASH"] = (distribution["CRASH"] ?? 0) + 1;
      return "CRASH";
    })
  );
  const totalLatency = now() - t0;

  return {
    scenario: "CHAOS-19",
    injected: "100 concurrent executions of the SAME task",
    expected: "Deterministic, collision-free, race-free: all verdicts identical",
    actual: `verdicts:${Array.from(new Set(results)).join(",")} crash:${crash}`,
    verdicts: Array.from(new Set(results)),
    latencyMs: [totalLatency],
    crash: crash > 0,
    unsafe: approved > 0,
    detail: { taskIdsCollisions: 100 - ids.size, distribution },
  };
}

async function s20_highload(): Promise<ScenarioResult> {
  const task: TaskSpec = { description: "fix typo in config" };
  const lat: number[] = [];
  let crash = 0;
  let approved = 0;
  const t0 = now();

  const jobs = Array.from({ length: 1000 }, async (_, i) => {
    const t = i % 10 < 3 ? { description: "add feature x pagination" } : task;
    const r = await tryExecute(new GovernanceOrchestrator(), t);
    lat.push(r.latency);
    if (r.ok) {
      if (r.result.verdict === "APPROVED") approved++;
    } else crash++;
  });
  await Promise.all(jobs);
  const total = now() - t0;

  const sorted = [...lat].sort((a, b) => a - b);
  return {
    scenario: "CHAOS-20",
    injected: "High load: 1000 concurrent governance decisions (700 L1 + 300 L2)",
    expected: "Stable latency distribution, low error rate, no unsafe approvals",
    actual: `p50=${pct(sorted, 0.5).toFixed(1)}ms p95=${pct(sorted, 0.95).toFixed(1)}ms p99=${pct(sorted, 0.99).toFixed(1)}ms max=${Math.max(...sorted).toFixed(1)}ms total=${total.toFixed(0)}ms`,
    verdicts: [`APPROVED:${approved}`, `CRASH:${crash}`],
    latencyMs: lat,
    crash: crash > 0,
    unsafe: false,
    detail: {
      errorRate: (crash / 1000).toFixed(4),
      throughputPerSec: (1000 / (total / 1000)).toFixed(1),
      p50: pct(sorted, 0.5),
      p95: pct(sorted, 0.95),
      p99: pct(sorted, 0.99),
      max: Math.max(...sorted),
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Runner
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const scenarios: ScenarioResult[] = [
    await s01_ambiguous(),
    await s02_simple_critical(),
    await s03_complex_low_risk(),
    await s04_production_context(),
    await s05_missing_policy(),
    await s06_invalid_policy(),
    await s07_conflicting_guards(),
    await s08_guard_failure(),
    await s09_malformed_input(),
    await s14_missing_proof(),
    await s15_corrupted_proof(),
    await s16_hash_valid_work_invalid(),
    await s17_partial_orchestrator(),
    await s18_cascading(),
    await s19_concurrent(),
    await s20_highload(),
  ].sort((a, b) => a.scenario.localeCompare(b.scenario));

  // Aggregate latency stats (all scenario samples)
  const allLat = scenarios.flatMap((s) => s.latencyMs).sort((a, b) => a - b);
  const crashCount = scenarios.filter((s) => s.crash).length;
  const unsafeCount = scenarios.filter((s) => s.unsafe).length;

  const metrics = {
    scenariosRun: scenarios.length,
    crashScenarios: crashCount,
    unsafeExecutionScenarios: unsafeCount,
    totalSamples: allLat.length,
    latencyMs: {
      p50: +pct(allLat, 0.5).toFixed(2),
      p95: +pct(allLat, 0.95).toFixed(2),
      p99: +pct(allLat, 0.99).toFixed(2),
      max: +Math.max(...allLat).toFixed(2),
    },
    proofVerifierGenerateHashByTypeRegistered: proofVerifierHasGenerateHashByType(),
  };

  const out = {
    meta: { generatedAt: new Date().toISOString(), engine: "src/core (TS)", runs },
    metrics,
    scenarios,
  };
  const dest = path.join(__dirname, "results-governance.json");
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(`Wrote ${dest} (${scenarios.length} scenarios, ${metrics.totalSamples} samples)`);

  // quick console table
  for (const s of scenarios) {
    const flag = s.unsafe ? "⚠️ UNSAFE" : s.crash ? "!! CRASH" : "ok";
    console.log(`  ${s.scenario.padEnd(10)} ${flag.padEnd(10)} ${s.actual.slice(0, 110)}`);
  }
  console.log(JSON.stringify(metrics, null, 2));
}

main().catch((e) => {
  console.error("chaos-lab fatal:", e);
  process.exit(1);
});
