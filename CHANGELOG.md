# CHANGELOG — EURINHASH Governance Engine

## [0.3.1] - 2026-09-10 — Hardened against Agentic AI attack research

### 🛡️ Quick Wins (from 4-agent deep research)

#### MerkleAuditTrail: RFC 6962 Compliance + Head Anchoring
- **RFC 6962 domain separation:** leaf hashes prefixed `0x00`, internal nodes `0x01` — prevents second-preimage attacks
- **Head anchoring:** `head()` + `verifyHead()` expose the latest entry hash; external parties can anchor it to detect log truncation
- **File:** `src/core/merkle-audit.ts`

#### AnomalyDetector: Mahalanobis Distance Scoring
- **Added:** 4-dimensional Mahalanobis distance over [task-type entropy, risk level, description length, burst count]
- Uses Welford-style online covariance tracking; flags at chi-squared threshold (p<0.01)
- **File:** `src/core/anomaly-detection.ts`

#### InjectionDetector: Unicode Tag Smuggling
- **Added category `UNICODE_TAG_SMUGGLING`:** blocks U+E0001-U+E007F invisible tag characters used in CoreBreak/ShareLock attacks
- **File:** `src/core/injection-detection.ts`

### 🔧 Medium Improvements (from OWASP Agentic + Flight Recorder research)

#### GuardOverrides: GuardFall Defense (Shell Canonicalization)
- `canonicalizeShell()` expands bash bypass forms before regex evaluation:
  - `$IFS`, `${IFS}`, `${IFS:...}` → literal space (`rm$IFS-rf` blocked)
  - Backslash escapes stripped (`rm\ -rf` blocked)
  - `$()`/`$((`)/backtick command substitution neutralized
  - Concatenated quoted strings joined
- **File:** `src/core/guard-overrides.ts`

#### GuardOverrides: CoreBreak Defense (Tool Attestation)
- `verifyToolAttestation()` rejects replayed nonces, expired tokens, uncovered tool paths
- `issueAttestation()` enables harness to mint model-issued authorization tokens
- **File:** `src/core/guard-overrides.ts`

#### DriftDetector: ASI Composite Drift (new module)
- Six-dimensional behavioral drift: tool frequency, risk escalation, complexity, description entropy, task diversity, repetition
- Exponential decay counters + baseline learning from first 20 samples
- **File:** `src/core/drift-detection.ts`

#### BehavioralFSM: Goal-Conditioned State Machine (new module)
- O(1) deny-by-default tool-call transition table
- Direct `delete`/`approve` from INIT is a sticky `VIOLATION` state
- **File:** `src/core/behavioral-fsm.ts`

#### Orchestrator: Anomaly Blocking Fix
- **Fixed:** anomaly detection no longer early-exits with `proofStatus: "FAIL"` (was bypassing proof chain); now it blocks via the final verdict path so `proofStatus` reflects the real proof chain (`PENDING` for human approval)
- **File:** `src/core/orchestrator.ts`

### 🧪 Validation
- 78 tests passing (was 61), 0 failing
- `tsc --noEmit` clean

## [0.2.0] - 2026-09-06 — P0 Critical Fixes from Chaos Testing

### 🔴 Critical Security Fixes (P0)

#### PolicyEngine: FAIL-CLOSED Defaults
- **Fixed:** Missing policy match now returns `BLOCKED` instead of falling back to L2-STANDARD with `APPROVED`
- **File:** `src/core/policy-engine.ts` lines 112-123
- **Before:** `"No exact match, using L2 fallback"` → `decision: "APPROVED"`
- **After:** `"No matching policy found - task blocked by default"` → `decision: "BLOCKED"`

#### ProofVerifier: Full Pipeline Integration
- **Fixed:** ProofVerifier was defined but never called in orchestrator
- **File:** `src/core/orchestrator.ts` 
- **Changes:**
  - Import and instantiate `ProofVerifier` in constructor
  - Generate proof chain in `execute()` pipeline
  - Verify proof chain with `verifyProofChain()`
  - Block execution on `proofStatus === "FAIL"`
  - Block execution if human approval required but not yet granted

#### Guard System: WARN → BLOCK for Critical Operations
- **Fixed:** Guard `WARN` previously resulted in `APPROVED` verdict
- **File:** `src/core/orchestrator.ts` line 66-68
- **Change:** `WARN` now results in `BLOCKED` for safety (fail-closed)
- **Rationale:** WARN patterns include force push, hard reset — should require explicit approval

#### Guard Regex: Fixed `/rm -rf /` Pattern Bypass
- **Fixed:** Pattern `/rm\s+-rf\s+\/\s*$/` required trailing space + end-of-string anchor
- **File:** `src/core/orchestrator.ts` line 108
- **Before:** Only matched `rm -rf / ` (with trailing space)
- **After:** Matches `rm -rf /` (without requiring trailing space)
- **Impact:** Prevents bypass of recursive root delete guard

#### Guard Patterns: Added Missing Destructive Operations
- **Added:** 5 new BLOCKED patterns for common destructive operations:
  - `rm -rf *` (wildcard recursive delete)
  - `TRUNCATE TABLE` (SQL table truncate)
  - `DELETE FROM table ;` (unqualified DELETE)
  - `chmod 777` (world-writable permissions)
  - `npm publish` (package publish - WARN, requires review)

#### Worker Execution: Fallback Chain Implementation
- **Implemented:** Full worker fallback chain in `GovernanceOrchestrator`
- **File:** `src/core/orchestrator.ts` lines 150-230
- **Chain:** `worker-codestral` → `worker-groq` → `worker-zhipu` → `worker-novita`
- **Behavior:**
  - On 429 (rate limit): automatically retry with next worker
  - On timeout/error: automatically retry with next worker
  - All workers exhausted → returns failure with `provider: undefined`
  - Simulated execution with realistic timing (50-150ms per worker)

### 🟡 Risk Assessment Consistency (P1) — In Progress

#### PolicyEngine.assessTaskRisk() Alignment
- **Issue:** `PolicyEngine.assessTaskRisk()` had different keywords than `risk-assessor.ts`
- **Fix:** Align both to use identical risk detection logic
- **Status:** In progress

#### Production + Scope → CRITICAL Consistency
- **Issue:** Production environment with sensitive scope didn't consistently produce CRITICAL
- **Fix:** Ensure both risk assessors produce identical CRITICAL for production + scope
- **Status:** Pending

### 📝 Files Modified

| File | Changes |
|------|---------|
| `src/core/policy-engine.ts` | FAIL-CLOSED default on missing policy |
| `src/core/orchestrator.ts` | ProofVerifier integration, guard fixes, worker fallback chain |
| `src/core/types.ts` | `PolicyDecision.policy` made optional for BLOCKED cases |

### 🧪 Validation

All P0 fixes implemented and ready for chaos re-test. The engine now:
1. ✅ Blocks on missing policy (FAIL-CLOSED)
2. ✅ Validates proofs before approval
3. ✅ Blocks on guard WARN for critical ops
4. ✅ Catches `rm -rf /` without trailing space bypass
5. ✅ Catches additional destructive patterns
6. ✅ Has working worker fallback chain

### Next Steps (Post-P0)
- [ ] Complete risk assessment consistency alignment
- [ ] Add performance metrics (P50/P95/P99)
- [ ] Run full chaos test matrix re-verification
- [ ] Document worker integration API