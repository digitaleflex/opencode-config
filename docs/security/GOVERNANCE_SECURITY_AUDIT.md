# EURINHASH Governance Engine - Security Audit Report

**Version:** 0.2.0  
**Audit Date:** 2026-09-06  
**Classification:** CONFIDENTIAL - INTERNAL USE ONLY  
**Severity Distribution:** CRITICAL: 3 | HIGH: 5 | MEDIUM: 7 | LOW: 8

---

## Executive Summary

The EURINHASH Governance Engine implements a multi-stage pipeline for task classification, risk assessment, policy evaluation, guard checking, and proof verification. This audit identified **23 security findings** across all attack surfaces.

**Key Recommendations:**
1. Implement Unicode normalization (NFC) before all string matching
2. Add regex normalization to strip zero-width characters before pattern matching
3. Replace placeholder proofs with cryptographic verification
4. Add comprehensive audit logging of all governance decisions
5. Enforce fail-closed behavior consistently across all pipeline stages

---

## Findings Summary

### CRITICAL (3)

| ID | Finding | Impact |
|----|---------|--------|
| F-001 | Unicode Homoglyph Bypass in Classifier | Full governance bypass via confusable characters |
| F-002 | Guard Override Regex Bypass | Destructive commands escape detection |
| F-003 | Proof Chain Forgery | Approval bypass without verification |

### HIGH (5)

| ID | Finding | Impact |
|----|---------|--------|
| F-004 | Guard Pattern Coverage Gaps | Multiple destructive ops unblocked |
| F-005 | Replay Attack on Proof Chains | Stale proofs reused |
| F-006 | YAML Policy Injection Risk | RCE if parser added naively |
| F-007 | Inconsistent Guard Decision | WARN operations not blocked |
| F-008 | Classification Failure Fails Open | Wrong risk defaults |

### MEDIUM (7)

| ID | Finding | Impact |
|----|---------|--------|
| F-009 | Math.random() for IDs | Predictable task IDs |
| F-010 | Unnormalized Hash Input | Hash comparison failures |
| F-011 | Missing Audit Logging | No forensic trail |
| F-012 | Incomplete Input Validation | Field injection possible |
| F-013 | Case Sensitivity Inconsistency | Pattern bypass |
| F-014 | No Fallback Escalation | DoS potential |
| F-015 | Weak Human Approval | Approval spoof possible |

### LOW (8)

F-016 through F-023: Rate limiting, length limits, timeouts, error leaks, encryption, privacy, hardcoded policies, schema versioning.

---

## Critical Finding Details

### F-001: Unicode Homoglyph Bypass

**File:** src/core/classifier.ts

Attackers use Unicode confusables to bypass keyword detection:
- dеploy (Cyrillic е instead of Latin e)
- rm​-rf (zero-width joiner between rm and -rf)
- DROP᠎ DATABASE (Mongolian vowel separator)

**Mitigation:**


### F-002: Guard Pattern Bypass

**File:** src/core/guard-overrides.ts

Same Unicode bypass affects guard patterns. Pattern /rm\s+-rf/ does not match rм -rf (Cyrillic м).

**Mitigation:** Apply same Unicode normalization before regex testing.

### F-003: Placeholder Proof Acceptance

**File:** src/core/proof-verifier.ts

Proofs are generated with hardcoded status:"PASS" and placeholder evidence. The verification only checks hash validity, not actual test results.

**Mitigation:** Implement actual verification for each proof type.

---

## Security Principle

Critical uncertainty must result in: **DENY, BLOCK, or ESCALATE** - Never silently allow.

---

## Next Steps

1. Add Unicode normalization to classifier and guards
2. Implement real proof verification
3. Add comprehensive audit logging
4. Expand guard pattern coverage
5. Add proof timestamp validation
6. Make all patterns case-insensitive
7. Complete input validation

Do not deploy to production until F-001, F-002, F-003, F-011 are resolved.

---

## Detailed Findings

### F-001: Unicode Homoglyph Bypass in Classifier

**Severity:** CRITICAL | **CVSS:** 9.1

**Affected File:** `src/core/classifier.ts`

**Attack Vector:**
```typescript
// classifier.ts line 23 - toLowerCase does NOT normalize Unicode
const desc = task.description.trim().toLowerCase();
// "d\u0435ploy" → "d\u0435ploy" (NOT "deploy")

// Lines 62-70 - Keyword matching is bypassed
if (desc.includes("deploy")) // FALSE for "d\u0435ploy"
```

**Bypass Examples:**
- "d\u0435ploy to production" - Cyrillic е (U+0435) vs Latin e (U+0065)
- "rm\u200b-rf /tmp" - Zero-width joiner (U+200B) between rm and -rf
- "DEPLΟY" - Greek omicron (U+039F) vs Latin O (U+004F)

**Impact:** Full governance bypass - destructive operations classified as safe

**Recommendation:**
```typescript
import { normalize } from 'node:querystring';

function validateAndNormalize(task: TaskSpec): string {
  // ... existing validation ...
  const normalized = desc.normalize('NFC');
  const sanitized = normalized.replace(/[\u200B-\u200F\uFEFF\u034F\u180E]/g, '');
  return sanitized.toLowerCase();
}
```

---

### F-002: Guard Override Regex Bypass via Homoglyph Injection

**Severity:** CRITICAL | **CVSS:** 9.1

**Affected Files:** `src/core/guard-overrides.ts`, `src/core/orchestrator.ts`

**Attack Vector:**
```typescript
// guard-overrides.ts line 15 - Case-sensitive, no Unicode normalization
pattern: /rm\s+-rf\s+\/\S?/

// Bypass examples:
Task: "r\u043C -rf /tmp"     // Cyrillic м (U+043C) instead of Latin m
Task: "rm -\u0432f /tmp"     // Cyrillic в (U+0432) instead of Latin f
Task: "rm\u200b-rf /tmp"     // Zero-width joiner
```

**Impact:** rm -rf guard completely bypassed, file deletion possible

**Recommendation:**
```typescript
function normalizeForMatching(text: string): string {
  return text.normalize('NFC').replace(/[\u200B-\u200F\uFEFF\u034F\u180E]/g, '');
}

check(task: TaskSpec): { ... } {
  const searchText = normalizeForMatching(this.buildSearchText(task));
  for (const override of this.overrides) {
    if (override.pattern.test(searchText)) { ... }
  }
}
```

---

### F-003: Proof Chain Forgery via Placeholder Evidence

**Severity:** CRITICAL | **CVSS:** 8.9

**Affected Files:** `src/core/proof-verifier.ts`, `src/core/orchestrator.ts`

**Attack Vector:**
```typescript
// proof-verifier.ts lines 20-28 - HARDCODED PASS
const testProof: Proof = {
  type: ProofType.TESTS,
  status: "PASS", // No actual validation!
  evidence: `Test suite executed for: ${task.description}`, // Placeholder
  hash: this.generateHash(task, ProofType.TESTS),
  timestamp: Date.now(),
};
```

**Bypass:** An attacker can provide any evidence - verification only checks hash validity

**Impact:** L3/L4 tasks approved without actual verification

**Recommendation:** Implement actual verification for each proof type:
```typescript
async generateProofChain(task: TaskSpec, policy: PolicySpec): Promise<ProofChain> {
  const testResult = await this.runActualTests(task); // MUST be implemented
  const testProof: Proof = {
    status: testResult.passed ? "PASS" : "FAIL",
    evidence: testResult.output, // Real test output
  };
}
```

---

### F-004: Guard Pattern Coverage Gaps

**Severity:** HIGH | **CVSS:** 7.5

**Missing Patterns:**
| Pattern | Risk | Example |
|---------|------|---------|
| `rm -r` | HIGH | `rm -r /var/data` |
| `rm -f` | HIGH | `rm -f /etc/passwd` |
| `del /f /s` | HIGH | Windows force delete |
| `Remove-Item -Recurse` | HIGH | PowerShell |
| `shutdown` | HIGH | System shutdown |
| `reboot` | HIGH | System reboot |
| `halt` | HIGH | System halt |
| `fork bomb` | CRITICAL | `:(){ :|:& };:` |

**Recommendation:** Expand patterns to include these dangerous commands.

---

### F-005: Replay Attack on Proof Chains

**Severity:** HIGH | **CVSS:** 7.5

**Affected File:** `src/core/proof-verifier.ts`

Proof chains include `timestamp` but never validate it. Old proofs can be replayed.

**Recommendation:**
```typescript
verifyProofChain(chain: ProofChain, task?: TaskSpec, maxAgeMs?: number): "PASS" | "FAIL" {
  const maxAge = maxAgeMs || 24 * 60 * 60 * 1000;
  for (const proof of chain.proofs) {
    if (proof.timestamp && (Date.now() - proof.timestamp) > maxAge) {
      return "FAIL"; // Proof too old
    }
  }
  return "PASS";
}
```

---

### F-006: YAML Policy Injection Risk

**Severity:** HIGH | **CVSS:** 7.0

**Affected File:** `src/core/policy-engine.ts`

Placeholder parser is secure (always throws). Risk exists if naive parser added.

**Recommendation:**
```typescript
import yaml from 'js-yaml';

private parseYaml(content: string): unknown {
  return yaml.load(content, {
    schema: yaml.JSON_SCHEMA, // Only JSON types
    json: true, // Strict mode
  });
}
```

---

### F-007: Inconsistent Guard Decision Application

**Severity:** HIGH | **CVSS:** 6.8

**Affected Files:** `src/core/orchestrator.ts` vs `src/core/guard-overrides.ts`

Orchestrator blocks WARN decisions, but `applyToDecision()` does not.

---

### F-008: Classification Failure Fails Open

**Severity:** HIGH | **CVSS:** 6.5

**Affected File:** `src/core/orchestrator.ts` lines 46-75

On classification error, defaults to FEATURE_LIMITED/HIGH instead of blocking.

---

### F-009: Task ID Collision via Math.random()

**Severity:** MEDIUM | **CVSS:** 5.9

`Math.random()` is not cryptographically secure. Use `crypto.randomBytes()`.

---

### F-010: Hash Generation Without Normalization

**Severity:** MEDIUM | **CVSS:** 5.3

Hash includes `task.description` without Unicode normalization.

---

### F-011: Missing Audit Logging of Governance Decisions

**Severity:** MEDIUM | **CVSS:** 5.3

The orchestrator computes decisions but does NOT log them. No forensic trail.

---

### F-012: Input Validation Gaps in TaskSpec

**Severity:** MEDIUM | **CVSS:** 4.8

Only `description` is validated. `environment`, `operation`, `data`, `scope` are unvalidated.

---

### F-013: Case Sensitivity Inconsistency

**Severity:** MEDIUM | **CVSS:** 4.3

Some patterns are case-sensitive, some are not. Make ALL patterns case-insensitive.

---

### F-014: Fallback Loop Exhaustion Without Escalation

**Severity:** MEDIUM | **CVSS:** 4.3

When all workers fail, no human notification or escalation.

---

### F-015: No Human Approval Verification

**Severity:** MEDIUM | **CVSS:** 4.0

Human approval only checks status field, not identity, scope, or signature.

---

## Testing Recommendations

### Security Unit Tests

```typescript
describe("Security: Unicode Normalization", () => {
  test("blocks Cyrillic homoglyph of deploy", () => {
    expect(classifyTask({ 
      description: "d\u0435ploy to production" 
    })).toBe(TaskType.DESTRUCTIVE_OP);
  });
  
  test("blocks zero-width space injection", () => {
    expect(classifyTask({ 
      description: "deploy\u200b production" 
    })).toBe(TaskType.DESTRUCTIVE_OP);
  });
});

describe("Security: Guard Bypass Prevention", () => {
  test("blocks cyrillic rm variant", () => {
    const guards = new GuardOverrides();
    expect(guards.check({ description: "r\u043C -rf /tmp" }).decision).toBe("BLOCKED");
  });
  
  test("blocks uppercase dangerous commands", () => {
    const guards = new GuardOverrides();
    expect(guards.check({ description: "RM -RF /" }).decision).toBe("BLOCKED");
  });
});
```

---

## Conclusion

The EURINHASH Governance Engine has solid foundational architecture but contains critical security gaps:

1. **Unicode confusable bypass** - Any destructive operation can bypass classification
2. **Guard pattern bypass** - File deletion protection disabled
3. **Placeholder proof acceptance** - Approval without verification

These findings confirm the security principle: **Critical uncertainty must result in DENY, BLOCK, or ESCALATE - never silently allow.**

**Status:** NOT PRODUCTION READY - Resolve F-001, F-002, F-003, F-011 before deployment.
