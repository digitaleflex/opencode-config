# EURINHASH Governance Engine — Performance Baseline

> **Baseline reference (v2, 2026-09-06).** Future changes to `src/core/` MUST be compared
> against `bench/results/baseline.json` via `bun run bench:check` (or
> `bun bench/benchmark.ts --check bench/results/baseline.json`). Measured on engine v0.2.0
> after the escalation/instrumentation features and the correctness fixes below.
> **Never optimize before measuring.**

## 0. Changelog

| Ver | Date | Event |
|---|---|---|
| v1 | 2026-09-06 | First baseline. Captured pre-escalation engine. Orchestration P50 @1000: 0.0168–0.0192 ms. |
| v2 | 2026-09-06 | Re-baselined after: (a) risk-escalation + metrics instrumentation added to `PolicyEngine`/`GovernanceOrchestrator`, (b) content-bound proof hashes (§3.1 note), (c) destructive-first classifier ordering, (d) behavioral test suite `src/core/core.test.ts` (24 tests). Orchestration P50 @1000: 0.0171 ms — **no net regression** (the v2 check-mode initially reported ×1.9, root-caused to cold-start measurement, see §7). |

---

## 1. Benchmark Methodology

**Harness:** `bench/benchmark.ts` (run with `bun bench/benchmark.ts` from repo root).
Each operation is timed externally with `performance.now()` (sub-microsecond resolution),
never via the engine's own instrumentation (which uses coarse `Date.now()`).

**Pipeline measured (per task):**
`classifyTask → assessRisk → PolicyEngine.evaluatePolicy → guard regex scan → ProofVerifier.generateProofChain + verifyProofChain → final verdict`
This is the full synchronous governance path — the worker-pool execution (network calls) is
out of scope and separately simulated in the engine (50–150 ms, not measured here).

**Task corpus:** 8 deterministic tasks rotating across governance levels (L1 CONFIG → L2
FEATURE/REFACTOR → L3 API_CHANGE → L4 DESTRUCTIVE_OP, plus guard-block and guard-warn
descriptions). Results therefore include the realistic mix of APPROVED and BLOCKED verdicts.

**Protocol:**
- 500 warmup operations per component (JIT compile, regex caches) — not measured
- `Bun.gc(true)` between warmup and measurement
- Components measured in isolation at load levels **1 / 10 / 100 / 1000** sequential ops
- Full orchestration measured sequentially at the same 4 load levels
- Full orchestration measured concurrently at **10 / 50 / 100** in-flight tasks
  (per-task latency distribution + wall-clock for the whole batch)
- Fail-closed semantics included: BLOCKED tasks are part of the measured path

**Metrics:** avg, min, max, P50, P95, P99 (ms), error count/rate, memory
(RSS/heap before+after), total CPU time (µs→ms via `process.cpuUsage` delta).

**Stability:** the suite was run twice; both runs are summarized below. Single-shot
small-N levels (n=1..10) are noisy by construction — treat P50/P95 of load_100/load_1000
as the regression signal, not load_1.

## 2. Environment

| Item | Value |
|---|---|
| OS / arch | Windows x64 (win32), 4 logical CPUs |
| Runtime | Bun 1.4.1 |
| Engine | `src/core` v0.2.0, 4 policies loaded |
| Date | 2026-09-06 (see `meta.timestamp` in `bench/results/baseline.json`) |
| Wall clock (whole suite) | ~680 ms |
| Total CPU (whole suite) | ~266 ms (≈ 39% of wall) |
| Memory RSS | 20.4 MB → 42.9 MB (+22.5 MB over ~5 500 executions incl. warmup) |
| Heap used | 1.63 MB → 3.01 MB |

> Windows timer granularity and GC scheduling on a 4-core laptop produce millisecond-scale
> outliers (`max` column). These are environment noise, not engine cost.

## 3. Results (baseline v2, authoritative)

### 3.1 Component latency, sequential (ms) — load 1000

| Component | P50 | P95 | P99 | err |
|---|---|---|---|---|
| **classify** (destructive-first) | 0.0005 | 0.0009 | 0.0011 | 0 |
| **risk** (centralized, escalation-ready) | 0.0011 | 0.0073 | 0.0137 | 0 |
| **policy** (match + escalate) | 0.0017 | 0.0033 | 0.0322 | 0 |
| **guard** | 0.0006 | 0.0009 | 0.0037 | 0 |
| **proof** (SHA-256 content-bound, generate+verify) | 0.0146 | 0.0421 | 0.1471 | 0 |
| **orchestration** (full) | 0.0171 | 0.0407 | 0.0934 | 0 |

Proof hashes now bind `taskId | description | proofType` (content-bound, tamper-evident);
`verifyProofChain` requires the task and is fail-closed without it. Cost vs v1's
`taskId|type`-only hash: +~3 µs P50 on the proof step (0.0107 → 0.0146 ms) — the price of
authentication, accepted deliberately.

Full pipeline ≈ **17 µs (P50)**, ≈ **41 µs (P95)** at load 1000.

### 3.2 Orchestration — full pipeline (ms)

| load | avg | P50 | P95 | P99 | errors |
|---|---|---|---|---|---|
| 1000 | 0.0258 | 0.0171 | 0.0407 | 0.0934 | 0 |

Throughput at load 1000: ≈ **39 000 tasks/s** sustained (avg incl. outliers),
≈ **58 500 tasks/s** at P50.

### 3.3 Concurrency (orchestration, in-flight tasks)

| Concurrency | P50/task (ms) | wall (batch) |
|---|---|---|
| 100 | 0.96 | 1.93 ms (≈ 51 800 tasks/s) |

No degradation up to 100 in-flight tasks; no lock/contention path exists in the engine.

### 3.4 Run-to-run stability (run #1 vs run #2, load 1000)

| Component | P50 r1 | P50 r2 | P99 r1 | P99 r2 |
|---|---|---|---|---|
| classify | 0.0010 | 0.0010 | 0.0055 | 0.0030 |
| risk | 0.0017 | 0.0021 | 0.0050 | 0.0277 |
| policy | 0.0031 | 0.0029 | 0.0179 | 0.0278 |
| guard | 0.0007 | 0.0007 | 0.0023 | 0.0028 |
| proof | 0.0128 | 0.0107 | 0.2234 | 0.0515 |
| orchestration | 0.0180 | 0.0168 | 0.0670 | 0.1665 |

P50 is stable within ±25%; P99 varies up to 4× under GC jitter. **Regression gates must
use P50 and P95; treat P99/max as advisory.**

## 4. Bottlenecks (measured)

1. **Proof verification is the most expensive step** (~0.01–0.03 ms, ~5× the cheapest
   components) — it performs one SHA-256 per required proof plus a root-hash re-hash, twice
   (generate, then verify). Still trivial in absolute terms (P99 0.05 ms).
2. **Policy evaluation** costs ~2–9 µs: `find()` over policies plus a per-policy keyword
   rescan of the description (`assessTaskRisk` runs inside the match predicate → O(n·k)).
3. **Everything else is noise-level**: guard regex scan ≈ 0.7 µs for 13 patterns.
4. **GC/OS pauses** (1–25 ms spikes at load 1000) dominate `max` — unavoidable in-process;
   irrelevant at governance's expected call volume (per agent task, not per HTTP request).
5. **Concurrency overhead is scheduling, not the engine** — per-task wall grows because
   `Promise.all` interleaves N timers/queues on 1 thread; the pipeline itself never blocks.

Verdict: the engine has **no performance problem today**. Any change to it should be
justified by security or correctness, not speed.

## 5. Regression Risks

1. ~~**Proof-chain hash binding was weakened during baseline repair**~~ **RESOLVED (v2)**:
   hashes now bind `taskId|description|proofType`; `verifyProofChain(chain, task)` is
   fail-closed without the task. Tamper/description-swap covered by tests. Cost: +~3 µs P50.
2. ~~**Pre-baseline state was 100% broken at the proof step**~~ **RESOLVED (v2)**: crash fixed
   and pinned by `src/core/core.test.ts` (24 tests: fail-closed paths, guards, PENDING,
   tamper detection, escalation semantics).
3. **`classifyTask` ordering** ~~is a correctness risk~~ **RESOLVED (v2)**: destructive
   keywords are now checked FIRST (tested: "fix ... rm -rf" → DESTRUCTIVE_OP).
4. **Escalation path allocation churn**: `evaluatePolicy`/`assessRisk` create keyword arrays
   and stringify `task.data` on every call. Measured impact ≈ 0 (P50 0.0171 ms unchanged vs
   v1), but if a future change makes this hot-path-visible, hoist constants to module scope.
5. **Metrics instrumentation cost**: orchestrator records 6× `Date.now()` + array push per
   execution, unbounded `metrics[]` growth in long-lived processes. Negligible at P50 but a
   memory risk for long-running daemons — `clearMetrics()` exists, wire it to a rotation.
6. **Cold-start vs hot-path trap in the gate (learned the hard way, §7)**: never compare a
   cold-start check against a hot baseline; the check mode now replicates the full suite's
   warmup + a throwaway load_1000 pass before measuring.
7. **Environment coupling**: numbers valid for Bun 1.4.1 / win32 / 4 cores. Re-baseline on
   runtime or hardware change.

## 6. Recommendations

1. ~~**Regression gate (do this)**~~ **DONE (v2)**: `bun run bench:check` compares
   orchestration P50/P95 @1000 against `bench/results/baseline.json` (tolerance 1.2×,
   exit 1 on regression). Wire into CI: `bun test src/core && bun run bench:check`.
2. ~~**Add behavior/regression tests**~~ **DONE (v2)**: 24 tests green — keep them as the
   gate for any refactor of classifier/policy/proof logic.
3. **De-duplicate risk assessment** ~~planned~~ **DONE by parallel lane**: `evaluatePolicy`
   now delegates to the centralized `assessRisk` with explicit escalation.
4. **Metrics rotation for daemons** (§5.5) before any long-running deployment.
5. **Improve concurrency measurement later**: sustained ramp before drawing throughput
   conclusions under load.
6. **Do not optimize anything now.** Every measured operation is µs-scale with 0% errors;
   effort belongs in correctness and tests.

## 7. Methodology Lesson — the ×1.9 False Regression

The first `--check` run reported P50 ×1.94 vs baseline and "failed". Root cause was **not**
an engine regression: the baseline was captured late in a hot full-suite process
(~10 000 accumulated JIT-warm executions), while check mode measured after only 200
warmup ops. Identical engine, cold vs hot — ×2 difference.

**Fix applied**: check mode now replicates the suite's warmup profile (500 corpus ops
through every component + orchestration, one throwaway `load_1000` pass) before the
measured pass. Verified: ×1.02 and ×0.96 on consecutive runs — inside noise.

Rule: **a benchmark gate must reproduce the measurement conditions of its baseline.**

---

*Artifacts: `bench/benchmark.ts` (harness) · `bench/results/baseline.json` (authoritative) ·
`docs/testing/benchmark-baseline.json` (mirror). Reproduce: `bun bench/benchmark.ts`.*
