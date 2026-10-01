status: active

# Deepwork: Milestone 1 - EurinHash Cross-Repository Orchestration

## Goal
Resolve all 5 issues in milestone 1 as a combined workstream:
- #23: Establish EurinHash cross-repository orchestration architecture
- #24: Machine-readable repository map and authority registry
- #25: Canonical cross-repository issue specification
- #34: Enforce cross-repository execution boundaries and secret hygiene
- #42: Permission control and execution authorization gate

## Current State Analysis (from exploration)

### ✅ Already Implemented
- **Core governance engine**: classifier.ts, guard-overrides.ts, proof-verifier.ts, policy-engine.ts, types.ts
- **Unicode normalization**: unicode-normalize.ts (handles homoglyphs, invisible chars, fullwidth)
- **Security policies**: src/policies/default.yaml (L1-L4 complexity levels)
- **Test fixtures**: tests/fixtures/attacks.jsonl (41 attack cases)
- **Fuzz tests**: unicode.fuzz.test.ts (150 iterations × 4 bases = 600 mutations)
- **CI workflow**: .github/workflows/ci.yml

### ❌ Missing (Milestone Requirements)
| Requirement | Status | Notes |
|------------|--------|-------|
| docs/architecture.md | MISSING | Has 01-architecture.md but not the canonical cross-repo architecture |
| orchestration/repositories/ | MISSING | No such directory |
| repository-map.yaml | MISSING | Machine-readable registry |
| GitHub issue templates | MISSING | .github/ only has CI |
| Cross-repo orchestration logic | MISSING | No routing/authority resolution code |
| Authorization gate | MISSING | No ALLOW/DENY/REQUIRES_APPROVAL gate |
| Security boundary enforcement | PARTIAL | Guard overrides exist but no cross-repo boundaries |

### 🔴 Critical Security Findings (must fix)
- F-001: Unicode Homoglyph Bypass in Classifier
- F-002: Guard Override Regex Bypass  
- F-003: Proof Chain Forgery via Placeholder Evidence
- F-011: Missing Audit Logging

## Phased Plan

### Phase 1: Architecture & Registry Foundation (depends on nothing) ✅ COMPLETED
- Create `docs/architecture.md` with canonical 3-repo model ✅
- Create `orchestration/repositories/repository-map.yaml` with 3 repos + schema ✅
- Create registry parser/validator in `src/core/registry.ts` ✅
- **Gate**: @oracle review of architecture + registry design

### Phase 2: Issue Specification & Templates (depends on Phase 1) ✅ COMPLETED
- Create canonical issue schema in `orchestration/issues/issue-schema.json` ✅
- Create GitHub issue templates in `.github/ISSUE_TEMPLATE/` (feature, bug, ux, architecture) ✅
- Create issue parser in `src/core/issue-parser.ts` ✅
- **Gate**: @oracle review of issue contract

### Phase 3: Security Boundaries & Authorization Gate (depends on Phase 1, 2) 🔄 IN PROGRESS
- Create authorization gate in `src/core/authorization-gate.ts` (ALLOW/DENY/REQUIRES_APPROVAL/UNKNOWN)
- Implement cross-repository boundary checks (read vs write, path scope)
- Fix critical security findings F-001, F-002, F-003, F-011
- Add audit logging for governance decisions
- **Gate**: @oracle security review

### Phase 4: Integration & Validation (depends on Phase 1-3)
- Cross-repository routing/orchestration in `src/core/cross-repo-orchestrator.ts`
- End-to-end tests with fixtures (wrong-repo, dirty-tree, malformed issue, bypass)
- Validation evidence generation
- **Gate**: @oracle final review

## Dependencies
```
Phase 1 ──┬──► Phase 2 ──┐
          │              ├──► Phase 3 ──► Phase 4
          └──────────────┘
```

## File Ownership
- docs/architecture.md, orchestration/repositories/* → @fixer
- GitHub issue templates → @fixer
- src/core/registry.ts, issue-parser.ts, authorization-gate.ts, cross-repo-orchestrator.ts → @fixer
- Security fixes in classifier.ts, guard-overrides.ts, proof-verifier.ts → @fixer

## Next Action
Start Phase 1 implementation.