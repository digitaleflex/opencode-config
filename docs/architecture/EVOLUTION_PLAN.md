# EURINHASH Architecture Evolution Plan

**Version:** 0.2.0  
**Date:** 2026-09-06  
**Status:** IMPLEMENTED_IN_PROGRESS

---

## Executive Summary

This document defines the evolution path from current EURINHASH implementation to a runtime-independent Governance Core. The goal is decoupled, testable, multi-runtime governance without rewriting working components.

**Current State:** OpenCode-specific governance with hardcoded patterns.  
**Target State:** Runtime-agnostic governance with adapters for OpenCode, Claude Code, and future runtimes.

---

## 1. Current State Analysis

### 1.1 Working Components (DO NOT MODIFY)

| Component | Location | Status | Reason |
|-----------|----------|--------|--------|
| Classifier | src/core/classifier.ts | WORKS | Regex-based, simple, testable |
| Risk Assessor | src/core/risk-assessor.ts | WORKS | Pure function, no side effects |
| Policy Engine | src/core/policy-engine.ts | WORKS | Declarative rules, testable |
| Proof Verifier | src/core/proof-verifier.ts | WORKS | Hash verification, testable |
| Guard Overrides | src/core/guard-overrides.ts | WORKS | Pattern matching, testable |
| Orchestrator | src/core/orchestrator.ts | WORKS | Coordinates everything |

### 1.2 Current Coupling Issues

**Problems:**
1. `worker-codestral`, `worker-groq` — OpenCode subagent names hardcoded
2. File paths like `provider_circuit.json` — Windows-specific
3. `hash-direct.py` integration — OpenCode-specific wrapper
4. Audit logs to `logs/` — OpenCode directory structure

### 1.3 Current Modules

```
src/core/
├── classifier.ts       # Pure: TaskSpec → TaskType
├── risk-assessor.ts    # Pure: TaskSpec → RiskLevel
├── policy-engine.ts    # Pure: TaskSpec + Risk → PolicySpec
├── guard-overrides.ts  # Pure: TaskSpec → GuardDecision
├── proof-verifier.ts   # Pure: TaskSpec + Policy → ProofChain
├── orchestrator.ts     # Stateful: coordinates all above
└── types.ts           # Interfaces only
```

**Good:** All core modules are pure functions.  
**Bad:** Orchestrator couples them to OpenCode runtime.

---

## 2. Target State

### 2.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    GOVERNANCE CORE                          │
│  (Runtime-agnostic, pure functions, testable)             │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │
│  │ Classifier  │ │Risk Assessor│ │    Policy Engine    │ │
│  └──────┬──────┘ └──────┬──────┘ └──────────┬──────────┘ │
│         │                │                    │              │
│         └────────────────┼────────────────────┘              │
│                          ▼                                   │
│                 ┌────────────────┐                          │
│                 │ Decision Engine│                          │
│                 └────────┬───────┘                          │
│                          │                                  │
│         ┌────────────────┼────────────────┐                │
│         ▼                ▼                ▼                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │ Guard Layer │ │ Proof Layer │ │ Audit Layer │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   RUNTIME ADAPTERS                          │
│                                                             │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│   │  OpenCode    │  │ Claude Code   │  │   Future     │  │
│   │   Adapter    │  │   Adapter     │  │   Adapters   │  │
│   └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Interfaces (Do Not Change)

```typescript
interface GovernanceInput {
  prompt: string;
  workspace?: WorkspaceContext;
  userProfile?: UserProfile;
}

interface GovernanceOutput {
  decision: "APPROVED" | "BLOCKED" | "PENDING";
  taskSpec: TaskSpec;
  policy: PolicySpec;
  proofChain: ProofChain;
  auditEntries: AuditEntry[];
}

interface RuntimeAdapter {
  invokeAgent(agentId: string, payload: unknown): Promise<AgentResult>;
  runTool(tool: string, args: unknown): Promise<ToolResult>;
  submitProof(type: ProofType, result: unknown): Promise<void>;
  requestApproval(reason: string): Promise<ApprovalResult>;
}
```

---

## 3. Architectural Gaps

### 3.1 Gap Analysis

| Gap | Current | Target | Priority |
|-----|---------|--------|----------|
| **Runtime Coupling** | Orchestrator → OpenCode | Orchestrator → Adapter Interface | CRITICAL |
| **Worker Naming** | `worker-codestral` | Abstract `ModelProvider` | HIGH |
| **File Paths** | Windows-specific | Runtime-agnostic paths | MEDIUM |
| **Audit Format** | JSONL to `logs/` | Structured AuditService | MEDIUM |
| **Proof Execution** | Placeholder (F-003) | Real verification hooks | HIGH |
| **Policy Loading** | Hardcoded defaults | External YAML + hot-reload | LOW |

### 3.2 Gap Details

#### GAP-1: Runtime Coupling (CRITICAL)
**Problem:** `GovernanceOrchestrator.execute()` directly calls OpenCode-specific code.
**Evidence:**
```typescript
const WORKER_CHAIN = ["worker-codestral", "worker-groq", ...];
```
**Fix:** Extract `ModelProvider` interface, implement OpenCode adapter.

#### GAP-2: Worker Name Coupling (HIGH)
**Problem:** Worker names like `worker-codestral` are OpenCode subagent concepts.
**Fix:** Abstract as `ModelProvider { id, specialty, endpoint, credentials }`.

#### GAP-3: File System Coupling (MEDIUM)
**Problem:** Audit logs written to `logs/` with Windows path handling.
**Fix:** Inject `FileSystem` abstraction into AuditLayer.

---

## 4. Decisions Required

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| **Adapter Pattern** | Dependency Injection | Factory Pattern | DI (simpler, testable) |
| **Policy Format** | YAML | JSON | YAML (human-editable) |
| **Audit Storage** | File System | Database | File System (current) |
| **Hot Reload** | Watch + reload | Restart required | Watch (future) |

### Recommended Decisions

1. **Adapter Pattern:** Dependency Injection
   - Pass adapter via constructor: `new GovernanceOrchestrator(adapter)`
   - Default: OpenCode adapter for backward compatibility

2. **Policy Format:** YAML (already designed, not yet implemented)
   - Load from `policies/*.yaml`
   - Schema already defined in `types.ts`

---

## 5. Migration Plan

### Phase 1: Extract Interfaces (No Behavior Change)
```
Week 1-2:
├── Extract GovernanceInput/Output interfaces
├── Define RuntimeAdapter interface
├── Add adapter parameter to Orchestrator constructor
├── Create OpenCodeAdapter as default implementation
└── Verify: All existing tests pass
```

### Phase 2: Extract Model Provider (No Behavior Change)
```
Week 3-4:
├── Define ModelProvider interface
├── Extract WORKER_CHAIN to config
├── Create ProviderRegistry class
├── Update Orchestrator to use registry
└── Verify: Same behavior, different config
```

### Phase 3: Real Proof Verification (F-003 Complete)
```
Week 5-6:
├── Define ProofVerifier interface
├── Implement TestProofVerifier
├── Implement ReviewProofVerifier
├── Implement SecurityScanProofVerifier
├── Update orchestrator to call verifiers
└── Verify: L2 tasks blocked without real proofs
```

### Phase 4: Audit Service Abstraction (F-011 Complete)
```
Week 7-8:
├── Define AuditService interface
├── Create JsonFileAuditService (current behavior)
├── Create ConsoleAuditService (dev)
├── Update Orchestrator to use AuditService
└── Verify: Same logs, different storage
```

### Phase 5: Runtime Adapter Implementation (Future)
```
Week 9-12:
├── Create ClaudeCodeAdapter
├── Create GenericCliAdapter
├── Add adapter selection config
├── Update tests for multi-runtime
└── Verify: Same governance, different execution
```

---

## 6. Testing Strategy

### Unit Tests (Pure Functions)
All 38 existing tests plus new security tests for F-001, F-002.

### Integration Tests (With Adapter)
- Approves L1 task with mock adapter
- Blocks L4 task pending human approval
- Falls back through worker chain on 429

### Adapter Contract Tests
- adapter.listWorkers() returns available workers
- adapter.invokeAgent() returns result or throws
- adapter.submitProof() validates proof format

---

## 7. Backward Compatibility

### Preserved Behavior
- All 38 existing tests pass unchanged
- OpenCode integration works without modification
- File paths and naming conventions preserved
- Audit log format unchanged

### New Capabilities
- Claude Code adapter (future)
- Swappable audit services
- Externalized policy configuration
- Real proof verification

---

## 8. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| **Runtime coupling** | 100% OpenCode | <20% via adapter |
| **Test coverage** | 38 tests | 100+ tests |
| **Proof verification** | Placeholder | Real execution |
| **Audit trail** | JSONL only | Queryable API |
| **Multi-runtime** | OpenCode only | 2+ adapters |

---

## 9. File Structure Target

```
src/
├── core/
│   ├── interfaces.ts        # NEW: All public interfaces
│   ├── classifier.ts         # UNCHANGED
│   ├── risk-assessor.ts     # UNCHANGED
│   ├── policy-engine.ts    # UNCHANGED (add YAML loading)
│   ├── guard-overrides.ts  # UNCHANGED
│   ├── proof-verifier.ts   # ENHANCED (real verification)
│   ├── orchestrator.ts     # REFACTOR (use adapter)
│   └── types.ts            # UNCHANGED
│
├── adapters/
│   ├── interface.ts        # NEW: RuntimeAdapter interface
│   ├── opencode.ts         # NEW: OpenCode implementation
│   ├── claude-code.ts      # FUTURE: Claude Code implementation
│   └── index.ts            # NEW: Adapter exports
│
├── services/
│   ├── audit/
│   │   ├── interface.ts     # NEW: AuditService interface
│   │   ├── json-file.ts    # REFACTOR: Current behavior
│   │   └── console.ts      # NEW: Dev mode
│   └── proof/
│       ├── interface.ts    # NEW: ProofVerifier interface
│       ├── test.ts         # FUTURE: Test execution
│       └── security.ts     # FUTURE: Security scan
│
└── index.ts                # UNCHANGED (barrel exports)

tests/
├── unit/                   # Pure function tests
├── integration/           # Orchestrator tests
└── adapters/              # Adapter contract tests
```

---

**End of Evolution Plan**
