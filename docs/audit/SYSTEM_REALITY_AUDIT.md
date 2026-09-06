# SYSTEM REALITY AUDIT — EURINHASH Agent Governance Engine

**Date:** 2026-09-06  
**Auditor:** Senior Software Architect (automated)  
**Scope:** Complete repository at `~/.config/opencode`  
**Status:** 🔴 **UNREADY FOR PRODUCTION** — 7 core modules exist but fail-closed integrity is compromised

---

## 1. Executive Summary

The EURINHASH Governance Engine has a **well-designed architecture** (documented across 5+ architecture docs) and a **partially implemented core** (8 TypeScript files in `src/core/`). However, the system has **critical security gaps** that make it unsuitable for production use:

| Metric | Value |
|---|---|
| Core modules implemented | 7/7 (100%) |
| Core modules correct | 1/7 (14%) |
| Tests for core engine | **0** (zero) |
| CI/CD pipeline | **None** |
| FAIL-CLOSED violations | **9** (per chaos test) |
| Security vulnerabilities | **15** (per chaos test) |
| Documentation accuracy | ~40% (describes intended, not actual) |

**Bottom line:** The code exists and compiles, but produces **wrong results** for most edge cases. The architecture docs describe a system that does not yet exist in code. A previous chaos test (22 scenarios) found **0% pass rate**.

---

## 2. System Architecture

### 2.1 Repository Structure Map

```
~/.config/opencode/
├── src/
│   ├── core/                          # GOVERNANCE ENGINE (8 files, ~900 LOC)
│   │   ├── types.ts                   # Types/enums (108 LOC) — COMPLETE
│   │   ├── classifier.ts              # Task classification (89 LOC) — FLAWED
│   │   ├── risk-assessor.ts           # Risk assessment (94 LOC) — FLAWED
│   │   ├── policy-engine.ts           # Policy evaluation (161 LOC) — PARTIAL
│   │   ├── proof-verifier.ts          # Proof generation (159 LOC) — INTEGRITY ISSUES
│   │   ├── guard-overrides.ts         # Guard override system (141 LOC) — DUPLICATED
│   │   ├── orchestrator.ts            # Main orchestrator (140 LOC) — INCOMPLETE
│   │   └── index.ts                   # Barrel exports (22 LOC) — OK
│   └── policies/
│       └── default.yaml               # Policy definitions (71 LOC) — NOT LOADED BY CODE
│
├── plugin/                            # OPENCODE PLUGINS (3 active)
│   ├── guard.ts                       # Safety guard (22 LOC) — WORKING (plugin layer)
│   ├── audit-logger.ts                # Audit logging (210 LOC) — WORKING
│   └── context-summarizer.ts          # Context pruning (31 LOC) — BASIC
│
├── agent/                             # AGENT DEFINITIONS (10 agents)
│   ├── eurinhash.md                   # Main supervisor (118 LOC)
│   ├── builder.md, architect.md, ... # Specialized agents
│   └── worker-*.md                    # Worker definitions (4)
│
├── scripts/                           # PYTHON SCRIPTS (6 scripts)
│   ├── free-probe.py                  # Worker availability probe
│   ├── myfree-eurinhash.py            # Complete FREE router
│   ├── hash-direct.py                 # Windows wrapper
│   ├── hash-direct-wrapper.py         # Advanced Windows wrapper
│   ├── quota.py                       # Daily quota monitoring
│   └── view-audit-log.py              # Audit log viewer
│
├── docs/                              # DOCUMENTATION (30+ files)
│   ├── architecture/                  # 5 architecture docs
│   │   ├── TARGET_ARCHITECTURE.md     # Intended system design
│   │   ├── GOVERNANCE_MODEL.md        # Decision pipeline spec
│   │   ├── PROOF_MODEL.md             # Proof requirements spec
│   │   └── POLICY_ENGINE_DECISION.md  # Policy engine rationale
│   ├── audit/                         # Previous audits
│   │   └── CURRENT_STATE_AUDIT.md     # 2026-09-06 state audit
│   ├── testing/                       # Test reports
│   │   └── CHAOS_TEST_REPORT.md       # 22 scenarios, 0% pass
│   └── product/                       # Product specs
│       └── MVP_DEFINITION.md          # MVP scope and user stories
│
├── skills/                            # 38+ SKILLS
├── opencode.jsonc                     # OpenCode configuration
├── opencode.json                      # Plugin configuration
├── package.json                       # Dependencies
├── tsconfig.json                      # TypeScript config
├── free-models.json                   # Worker availability cache
├── provider_circuit.json              # Circuit breaker state
├── provider_usage.json                # Usage tracking
└── AGENTS.md                          # Global agent instructions
```

### 2.2 Technology Stack

| Layer | Technology | Version/Notes |
|---|---|---|
| Runtime | Node.js + TypeScript | ES2020 target, CommonJS |
| Package Manager | npm + bun (both lockfiles present) | `bun.lock` + `package-lock.json` |
| Testing Framework | None configured | `package.json` has `"test": "echo \"Error: no test specified\""` |
| Linting | None configured | No eslint/ruff in package.json |
| CI/CD | None | No `.github/` directory |
| Build | TypeScript compiler | `tsc` via tsconfig, output to `dist/` |

### 2.3 Dependencies

**Production:**
- `@opencode-ai/plugin` (1.17.6) — OpenCode plugin SDK
- `@opentui/core` + `@opentui/solid` — TUI framework
- `solid-js` (1.9.15) — Reactive UI
- `@felipegenef/opencode-lazy-skills` — Token optimization
- `@zenobius/opencode-skillful` — Skill recommendation
- `oh-my-openagent` (4.19.4) — Agent orchestration
- `opencode-supermemory` (2.0.13) — Vector memory
- `@f97/opencode-morph-fast-apply` — Fast code editing (disabled)

**Missing (referenced in docs but absent from package.json):**
- No YAML parser (for `default.yaml`)
- No crypto library (for proof hashing)
- No test framework (vitest/jest/bun:test)
- No linting (eslint/ruff)

---

## 3. Implemented Features

### 3.1 Core Engine Modules — Detailed Analysis

#### `src/core/types.ts` — ✅ COMPLETE

| Attribute | Value |
|---|---|
| Responsibility | Define all types, enums, interfaces for the governance engine |
| Inputs | None (pure declarations) |
| Outputs | 7 enums + 7 interfaces |
| Dependencies | None |
| Quality | ✅ Well-structured, clear naming |

**Enums defined:** `TaskComplexity` (L1-L4), `RiskLevel` (LOW/HIGH/CRITICAL), `TaskType` (14 types), `ProofType` (5 types)

**Interfaces defined:** `TaskSpec`, `PolicySpec`, `ModelPlan`, `Proof`, `ProofChain`, `PolicyDecision`, `GuardOverride`, `ExecutionResult`

**Issue:** `classifier.ts` re-declares `TaskComplexity`, `TaskType`, and `TaskSpec` instead of importing from `types.ts`. This creates a **type duplication risk**.

---

#### `src/core/classifier.ts` — ⚠️ PARTIALLY IMPLEMENTED

| Attribute | Value |
|---|---|
| Responsibility | Classify tasks by type based on description keywords |
| Inputs | `TaskSpec` (description, scope) |
| Outputs | `TaskType` enum value |
| Dependencies | None (standalone function) |
| Quality | ⚠️ Keyword-based, fragile, duplicates types |

**What works:**
- Returns a `TaskType` for any input
- Covers L1-L4 ranges with keyword matching

**What fails:**
- **Type duplication**: Re-declares `TaskComplexity`, `TaskType`, `TaskSpec` instead of importing from `types.ts`
- **Ambiguous classification**: "fix typo" matches both L1 (`"fix"` → CONFIG) and L2 (`"fix"` → FEATURE_LIMITED); L1 wins because it's checked first
- **Keyword priority conflict**: `"fix"` appears in both L1 and L2 lists; `"change"` appears in L2 and L3
- **No scope analysis**: `scope` parameter is joined but never used for classification
- **No complexity assignment**: Function returns `TaskType` but never sets `TaskComplexity`
- **Default fallback**: Unknown descriptions default to `FEATURE_LIMITED` (L2), not `BLOCKED`

**Failure mode:** A task like "fix the authentication bug in production" could be classified as CONFIG (L1) because "fix" matches first, when it should be L3-L4.

---

#### `src/core/risk-assessor.ts` — ⚠️ PARTIALLY IMPLEMENTED

| Attribute | Value |
|---|---|
| Responsibility | Assess risk level from task properties |
| Inputs | `TaskSpec` (operation, environment, data, taskType, scope) |
| Outputs | `RiskLevel` enum value |
| Dependencies | `types.ts` (correctly imported) |
| Quality | ⚠️ Incomplete keyword coverage, no null safety |

**What works:**
- Checks destructive operations (delete, drop, rm -rf, truncate, destroy)
- Checks production environment
- Checks sensitive data patterns (personal, password, secret, token, health, financial, pii)
- Checks blast radius keywords (database, auth, payment, security, production)

**What fails:**
- **Missing production escalation**: `environment: "production"` sets HIGH, but doesn't escalate to CRITICAL for deploy ops
- **Non-null assertion**: `task.taskType!` will crash if `taskType` is undefined
- **JSON.stringify on non-object**: If `task.data` is a string or number, `JSON.stringify()` works but the keyword scan is unreliable
- **No blast radius for service-level scope**: Only checks 5 keywords, misses "api", "microservice", "infrastructure"

**Failure mode:** A production deployment with PII data gets HIGH risk, but the PolicyEngine's internal `assessTaskRisk()` returns LOW (missing keywords), creating an inconsistent security posture.

---

#### `src/core/policy-engine.ts` — ⚠️ PARTIALLY IMPLEMENTED

| Attribute | Value |
|---|---|
| Responsibility | Evaluate task against policies, return decision |
| Inputs | `TaskSpec` (taskType, risk, description) |
| Outputs | `PolicyDecision` (decision, policy, proofsRequired, humanApproval) |
| Dependencies | `types.ts` |
| Quality | ⚠️ FAIL-OPEN design, duplicate risk assessment |

**What works:**
- 4 hardcoded policies (L1-L4) matching the architecture spec
- Fail-closed when no policy matches (returns BLOCKED)
- Returns appropriate `PolicyDecision` structure

**Critical flaws:**
- **FAIL-OPEN risk assessment**: `assessTaskRisk()` (lines 136-160) uses a different keyword list than `risk-assessor.ts`. Missing: `"production"`, `"deploy"`, `"personal"`, `"pii"`, `"financial"`, `"health"`. This means production tasks get LOW risk → L2 policy instead of L4.
- **YAML not loaded**: `default.yaml` exists but is never parsed by the code. Policies are hardcoded in `getDefaultPolicies()`. The YAML file is documentation-only.
- **Risk matching is required**: `evaluatePolicy()` requires `policy.risk === this.assessTaskRisk(task)`. Since the internal risk assessor is less comprehensive than the standalone one, valid policies may not match.
- **No dynamic policy loading**: No YAML parser, no file I/O, no policy registry

**Failure mode:** A "deploy to production with user PII" task → `assessTaskRisk()` returns LOW (no keywords match) → only L2-STANDARD policy matches → gets `planner→builder→reviewer` with no human approval.

---

#### `src/core/proof-verifier.ts` — ⚠️ PARTIALLY IMPLEMENTED

| Attribute | Value |
|---|---|
| Responsibility | Generate and verify proof chains |
| Inputs | `TaskSpec`, `PolicySpec`, `ProofChain` |
| Outputs | `ProofChain`, verification status |
| Dependencies | `types.ts` |
| Quality | ⚠️ Fake hashing, no actual verification |

**What works:**
- Generates proof chain structure matching the spec
- Creates proof objects for each required type
- Verifies chain integrity by comparing hashes
- Minimum proof requirements per complexity level

**Critical flaws:**
- **Fake SHA-256 hash**: `generateHash()` (lines 119-128) uses a 32-bit bitwise hash, not SHA-256. The output is padded to look like SHA-256 (`"sha256:" + hex`), but it's a **collision-prone 32-bit integer**.
- **Timestamp-based**: Hash includes `Date.now()`, meaning the same task produces different hashes each time. This breaks determinism.
- **No actual verification**: `generateProofChain()` creates all proofs with `status: "PASS"` by default. There's no connection to actual test runners, linters, or security scanners.
- **Verdict logic is incomplete**: L4 requires 4 proofs but the check is `proofs.length < 4`, which would fail if only 3 proof types are required by policy.
- **No PENDING resolution**: `HUMAN_APPROVAL` proof is created as `PENDING` but `verifyProofChain()` requires all proofs to be `PASS`. This means any L3/L4 task automatically fails verification.

**Failure mode:** Every L3/L4 task gets `proofStatus: "FAIL"` because human approval is always PENDING. The orchestrator then returns `BLOCKED` for all complex tasks.

---

#### `src/core/guard-overrides.ts` — ⚠️ PARTIALLY IMPLEMENTED

| Attribute | Value |
|---|---|
| Responsibility | Check tasks against dangerous operation patterns |
| Inputs | `TaskSpec` (description, operation) |
| Outputs | Guard check result (matched, decision, reason) |
| Dependencies | `types.ts` |
| Quality | ⚠️ Duplicated by orchestrator, regex gaps |

**What works:**
- 8 guard patterns covering critical operations
- `BLOCK` for destructive ops (rm -rf /, mkfs, dd, DROP DATABASE, curl|sh, format .env)
- `WARN` for risky ops (git push --force, git reset --hard)
- `applyToDecision()` integrates with PolicyDecision

**Critical flaws:**
- **Duplicated by orchestrator**: `orchestrator.ts` has its own `checkGuards()` method (lines 105-126) with identical patterns. The `GuardOverrides` class is **imported in index.ts but never used by the orchestrator**.
- **Regex bypass**: `rm -rf /home/user/data` bypasses the pattern `/rm\s+-rf\s+\/\s*$/` because it requires trailing `/$` or `/$ `. The orchestrator's pattern `/rm\s+-rf\s+\//` is broader but still misses `rm -rf /home`.
- **No scope in search**: `buildSearchText()` only joins `description` and `operation`, not `scope`. A task with `scope: ["database", "auth"]` is not checked against guard patterns.
- **WARN doesn't block**: `applyToDecision()` only adds a warning string but doesn't change the decision. A WARN result still allows execution.

---

#### `src/core/orchestrator.ts` — ⚠️ CRITICALLY INCOMPLETE

| Attribute | Value |
|---|---|
| Responsibility | Main entry point, coordinate all governance steps |
| Inputs | `TaskSpec` |
| Outputs | `ExecutionResult` |
| Dependencies | `classifier`, `risk-assessor`, `policy-engine`, `proof-verifier`, `types` |
| Quality | ❌ Proof verification not integrated, no worker execution |

**What works:**
- Pipeline structure: classify → assess risk → evaluate policy → check guards → generate proofs → verify → verdict
- Fail-closed on policy BLOCKED
- Fail-closed on guard BLOCKED
- Fail-closed on guard WARN (treats as BLOCKED)

**Critical flaws:**
- **ProofVerifier not integrated**: The orchestrator imports `ProofVerifier` but `proofStatus` is set to the result of `verifyProofChain()` which requires all proofs to be PASS. Since human approval is always PENDING, this always returns FAIL for L3/L4.
- **GuardOverrides not used**: The orchestrator uses its own `checkGuards()` method instead of the `GuardOverrides` class. The imported class is dead code.
- **No worker execution**: The orchestrator returns an `ExecutionResult` but never invokes any worker. The `modelPlan` from the policy is ignored. Worker fallback logic described in docs does not exist in code.
- **No error handling**: If `classifyTask()` or `assessRisk()` throws (e.g., on null input), the orchestrator crashes with an uncaught exception instead of returning BLOCKED.
- **`guardDecision` type mismatch**: The `checkGuards()` method returns `{ decision: "BLOCKED" | "ALLOWED" | "WARN", reason: string }` but the `ExecutionResult` type expects `guardDecision: "BLOCKED" | "ALLOWED"`. The `WARN` case is handled in logic but the type system doesn't reflect it.
- **No persistence**: Despite architecture docs specifying `logs/tasks/<id>.json`, `logs/policies/<id>.json`, etc., no file I/O exists in the orchestrator.

---

#### `src/core/index.ts` — ✅ COMPLETE

| Attribute | Value |
|---|---|
| Responsibility | Barrel exports for all modules |
| Quality | ✅ Clean, all exports match implementations |

**Issue:** Exports `GuardOverrides` class which is unused by the orchestrator (dead code).

---

### 3.2 Plugin Layer

#### `plugin/guard.ts` — ✅ WORKING (independent layer)

| Attribute | Value |
|---|---|
| Responsibility | Intercept bash commands before execution |
| Hook | `tool.execute.before` |
| Patterns | `rm -rf /`, `mkfs`, `dd of=/dev/`, `git push --force` |
| Quality | ✅ Simple, effective, correct regex |

This is a **separate safety layer** that works independently of the core engine. It's the only guard that actually blocks commands at runtime.

#### `plugin/audit-logger.ts` — ✅ WORKING

| Attribute | Value |
|---|---|
| Responsibility | Log all tool executions with secret redaction |
| Hooks | `tool.execute.before`, `tool.execute.after`, `agent.invoked` (best-effort) |
| Features | Secret redaction, sensitive detection, log rotation (30 days) |
| Quality | ✅ Production-quality, fire-and-forget, error-tolerant |

#### `plugin/context-summarizer.ts` — ⚠️ BASIC

| Attribute | Value |
|---|---|
| Responsibility | Prune old conversation context |
| Quality | ⚠️ Crude token estimation (chars/4), aggressive pruning |

---

### 3.3 Supporting Infrastructure

#### `scripts/free-probe.py` — ✅ WORKING
Tests all 7 workers, outputs status + latency, writes `free-models.json`.

#### `scripts/myfree-eurinhash.py` — ✅ WORKING
Complete FREE router with worker fallback, quality/price reporting.

#### `provider_circuit.json` — ✅ EXISTING
Circuit breaker state for 8 providers. All currently `CLOSED`.

#### `provider_usage.json` — ✅ EXISTING
Daily usage tracking. Minimal data (1 entry).

---

## 4. Architecture Reality Check

### IMPLEMENTED (code exists, compiles, basic functionality works)

| Component | File | Status |
|---|---|---|
| Type definitions | `types.ts` | ✅ Complete |
| Task classifier | `classifier.ts` | ⚠️ Works but fragile |
| Risk assessor | `risk-assessor.ts` | ⚠️ Works but incomplete |
| Policy engine | `policy-engine.ts` | ⚠️ Works but FAIL-OPEN risks |
| Proof verifier | `proof-verifier.ts` | ⚠️ Structure works, integrity broken |
| Guard overrides | `guard-overrides.ts` | ⚠️ Works but unused by orchestrator |
| Orchestrator | `orchestrator.ts` | ⚠️ Pipeline exists, critical gaps |
| Safety guard plugin | `plugin/guard.ts` | ✅ Working |
| Audit logger plugin | `plugin/audit-logger.ts` | ✅ Working |
| Worker probe | `scripts/free-probe.py` | ✅ Working |
| FREE router | `scripts/myfree-eurinhash.py` | ✅ Working |

### PARTIALLY IMPLEMENTED (exists but incomplete or incorrect)

| Component | Gap |
|---|---|
| Policy YAML loading | `default.yaml` exists but is never parsed; policies hardcoded in TS |
| Proof chain integrity | Fake SHA-256 (32-bit), non-deterministic, no actual verification |
| Guard integration | `GuardOverrides` class exists but orchestrator uses its own `checkGuards()` |
| Worker execution | Orchestrator returns result but never calls any worker |
| Risk consistency | Two different risk assessors with different keyword lists |

### DOCUMENTED ONLY (described in docs, no code)

| Component | Location |
|---|---|
| Agent Selector | `TARGET_ARCHITECTURE.md §2.4` |
| Model Router | `TARGET_ARCHITECTURE.md §2.5` |
| Runtime Adapter | `TARGET_ARCHITECTURE.md §3` |
| Proof persistence | `PROOF_MODEL.md §4` (`logs/proofs/<id>/`) |
| Policy versioning | `POLICY_ENGINE_DECISION.md §5` |
| Learning loop | `GOVERNANCE_MODEL.md §6` |
| Waiver system | `PROOF_MODEL.md §6.2` |
| Emergency hotfix flow | `PROOF_MODEL.md §6.3` |

### PLANNED (in roadmap, not started)

| Component | Roadmap Phase |
|---|---|
| Multi-runtime adapter | Phase 4 |
| Dashboard / UI | Phase 4 |
| Custom policy editor | Phase 4 |
| Enterprise features (SSO, RBAC) | Phase 5 |
| Cloud deployment | Phase 5 |
| CI/CD pipeline | Phase 3 (not started) |
| Unit tests for core engine | Phase 3 (not started) |

### MISSING (not even planned)

| Component | Impact |
|---|---|
| YAML parser integration | Policies can't be loaded from files |
| Crypto library for hashing | Proof integrity is fake |
| Error boundary / graceful degradation | Crashes on malformed input |
| Task ID uniqueness guarantee | Collision risk under concurrency |
| Integration test harness | No end-to-end validation |
| Type-safe risk matching | Two risk assessors, inconsistent results |

---

## 5. Security Risks

### CRITICAL (P0) — Immediate Action Required

| ID | Risk | Component | Impact |
|---|---|---|---|
| S-001 | **FAIL-OPEN policy engine** | `policy-engine.ts` | Unknown task types may be APPROVED instead of BLOCKED |
| S-002 | **Guard regex bypass** | `orchestrator.ts` | `rm -rf /home/user` not blocked (pattern requires `/$`) |
| S-003 | **Proof verification fake** | `proof-verifier.ts` | 32-bit hash provides no integrity guarantee |
| S-004 | **Two inconsistent risk assessors** | `policy-engine.ts` + `risk-assessor.ts` | Production tasks may get LOW risk → L2 policy |
| S-005 | **No null safety** | `risk-assessor.ts`, `policy-engine.ts` | `task.taskType!` crashes on undefined |
| S-006 | **GuardOverrides dead code** | `orchestrator.ts` | Imported class never used; orchestrator has duplicate logic |
| S-007 | **No input validation** | `orchestrator.ts` | Malformed TaskSpec causes uncaught exceptions |

### HIGH (P1)

| ID | Risk | Component | Impact |
|---|---|---|---|
| S-008 | **Type duplication** | `classifier.ts` | Re-declares types from `types.ts`; type drift risk |
| S-009 | **PENDING proofs auto-fail** | `proof-verifier.ts` | All L3/L4 tasks fail verification (human approval always PENDING) |
| S-010 | **WARN doesn't block** | `guard-overrides.ts` | Guard WARN adds string but execution proceeds |
| S-011 | **No YAML loading** | `policy-engine.ts` | Policies can't be updated without code changes |
| S-012 | **Timestamp in hashes** | `proof-verifier.ts` | Same task produces different hashes each time |

### MEDIUM (P2)

| ID | Risk | Component | Impact |
|---|---|---|---|
| S-013 | **Task ID collision** | `orchestrator.ts` | `Date.now() + random` not collision-resistant |
| S-014 | **Log rotation only on startup** | `audit-logger.ts` | If plugin reloads, rotation may not run |
| S-015 | **Secret redaction regex** | `audit-logger.ts` | Pattern may miss non-standard key names |

---

## 6. Reliability Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R-001 | **No error handling in orchestrator** | Crashes on malformed input | Add try/catch, return BLOCKED on error |
| R-002 | **No worker execution** | Orchestrator never calls workers | Implement worker delegation |
| R-003 | **No retry/fallback logic** | Single point of failure | Implement circuit breaker pattern |
| R-004 | **Synchronous only** | No concurrency support | Add async queue, unique ID generation |
| R-005 | **No health checks** | Can't detect degraded state | Add component health endpoints |
| R-006 | **Both lockfiles present** | Dependency resolution ambiguity | Remove one, standardize on npm or bun |
| R-007 | **No test framework** | Can't validate changes | Add vitest or bun:test |
| R-008 | **No CI/CD** | No automated quality gates | Add GitHub Actions |

---

## 7. Performance Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| P-001 | **JSON.stringify for risk scan** | O(n) on data size for every task | Use targeted field access |
| P-002 | **No caching** | Policy evaluation repeated | Cache policy lookups |
| P-003 | **Regex compilation** | Guard patterns compiled on every check | Pre-compile patterns |
| P-004 | **No benchmarks** | Can't measure or optimize | Add performance test suite |

---

## 8. Technical Debt

### High-Priority Debt

| Item | Location | Effort to Fix |
|---|---|---|
| Duplicate type declarations | `classifier.ts` lines 1-35 | 5 min (import from types.ts) |
| Duplicate guard logic | `orchestrator.ts` lines 105-126 vs `guard-overrides.ts` | 30 min (use GuardOverrides class) |
| Duplicate risk assessment | `policy-engine.ts` lines 136-160 vs `risk-assessor.ts` | 1 hour (unify risk assessment) |
| Fake SHA-256 hash | `proof-verifier.ts` lines 119-142 | 15 min (use `crypto` module) |
| YAML not loaded | `policy-engine.ts` | 2 hours (add yaml parser) |
| No error handling | `orchestrator.ts` | 1 hour (add try/catch) |

### Medium-Priority Debt

| Item | Location | Effort to Fix |
|---|---|---|
| No unit tests | `src/core/` | 1-2 days |
| No CI/CD | `.github/` | 2-4 hours |
| Both lockfiles | root | 10 min (delete one) |
| Dead code (GuardOverrides) | `index.ts`, `orchestrator.ts` | 30 min |
| Context sumarizer quality | `plugin/context-summarizer.ts` | 2 hours |

### Low-Priority Debt

| Item | Location | Effort to Fix |
|---|---|---|
| No performance benchmarks | `src/core/` | 4 hours |
| Documentation accuracy | `docs/` | Ongoing |
| Skill catalog alignment | `skills/` | Ongoing |

---

## 9. Recommended Priorities

### Phase A: Security Hardening (1-2 days)

1. **Fix FAIL-OPEN policy engine** — Add catch-all BLOCKED policy for unknown task types
2. **Unify risk assessment** — Remove `PolicyEngine.assessTaskRisk()`, use `risk-assessor.ts` everywhere
3. **Fix guard regex** — Broaden patterns to cover `rm -rf /home`, not just `rm -rf /`
4. **Add null safety** — Optional chaining on all `task.taskType!` accesses
5. **Replace fake hash** — Use `crypto.createHash('sha256')` from Node.js stdlib

### Phase B: Core Integration (2-3 days)

6. **Integrate GuardOverrides** — Replace orchestrator's `checkGuards()` with `GuardOverrides` class
7. **Add error handling** — Wrap orchestrator pipeline in try/catch, return BLOCKED on error
8. **Fix proof verification** — Handle PENDING human approval correctly (don't auto-fail)
9. **Load YAML policies** — Add `yaml` package, parse `default.yaml` at startup
10. **Remove type duplication** — Import from `types.ts` in `classifier.ts`

### Phase C: Quality Foundation (3-5 days)

11. **Add test framework** — Install vitest, create test files for each module
12. **Write unit tests** — Target >80% coverage for core modules
13. **Add CI/CD** — GitHub Actions with lint + test + type-check
14. **Standardize package manager** — Choose npm or bun, remove the other lockfile
15. **Add integration tests** — End-to-end governance pipeline tests

### Phase D: Feature Completion (1-2 weeks)

16. **Implement worker execution** — Orchestrator calls workers with fallback chain
17. **Implement proof persistence** — Write proof chains to `logs/proofs/<id>/`
18. **Implement audit trail** — Log governance decisions via audit-logger
19. **Implement Model Router** — Use `free-models.json` + circuit breaker for worker selection
20. **Implement Agent Selector** — Translate PolicySpec.agents into actual agent invocations

---

## 10. Conclusion

The EURINHASH Governance Engine has a **solid architectural vision** but is in an **early implementation state**. The code compiles and the basic pipeline structure works, but:

- **Security is compromised** by FAIL-OPEN defaults and inconsistent risk assessment
- **Proof integrity is fake** (32-bit hash, not SHA-256)
- **Worker execution is missing** (orchestrator never calls workers)
- **Testing is absent** (no test framework, no test files)
- **Documentation describes intended state**, not actual state

**Recommendation:** Do NOT use this system for any production or security-sensitive task until Phase A (Security Hardening) and Phase B (Core Integration) are complete. The existing plugins (`guard.ts`, `audit-logger.ts`) provide real protection at the OpenCode layer and should be relied upon until the core engine is hardened.

---

*Audit generated: 2026-09-06*  
*Repository: `~/.config/opencode`*  
*Chaos test reference: `docs/testing/CHAOS_TEST_REPORT.md`*
