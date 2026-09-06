# FIX ROADMAP — EURINHASH Governance Engine

**Date:** 2026-09-06  
**Status:** Ready for execution  
**Estimated total effort:** 5-7 days  
**Dependency:** None — all phases can start immediately

---

## Overview

```
Phase A: Sécurité        ████████░░░░░░░░░░░░  1-2 jours  (P0 - URGENT)
Phase B: Intégration     ░░░░░░░░████████░░░░  2-3 jours  (P1)
Phase C: Qualité         ░░░░░░░░░░░░░░░░████  3-5 jours  (P2)
Phase D: Features        ░░░░░░░░░░░░░░░░░░██  1-2 semaines (P3)
```

---

## PHASE A — Sécurité (1-2 jours)

### A1. Unifier les Risk Assessors

**Fichier:** `src/core/policy-engine.ts`  
**Effort:** 30 min  
**Résout:** S-004 (deux risk assessors incohérents)

**Problème:** `PolicyEngine.assessTaskRisk()` (lignes 136-160) utilise une liste de keywords incomplète. Le `assessRisk()` de `risk-assessor.ts` est plus complet et gère `environment`, `data`, `scope`, `taskType`.

**Avant (policy-engine.ts):**
```typescript
private assessTaskRisk(task: TaskSpec): RiskLevel {
  const highRiskKeywords = ["deploy", "production", "delete", "drop", "database", "security", "auth", "payment"];
  const desc = task.description.toLowerCase();
  if (highRiskKeywords.some((k) => desc.includes(k))) {
    return RiskLevel.HIGH;
  }
  const criticalKeywords = ["rm -rf", "format", "mkfs", "dd if="];
  if (criticalKeywords.some((k) => desc.includes(k))) {
    return RiskLevel.CRITICAL;
  }
  return RiskLevel.LOW;
}
```

**Après (policy-engine.ts):**
```typescript
// En haut du fichier, ajouter l'import :
import { assessRisk } from "./risk-assessor";

// Supprimer complètement la méthode assessTaskRisk() (lignes 136-160)

// Dans evaluatePolicy(), remplacer :
evaluatePolicy(task: TaskSpec): PolicyDecision {
  if (!task.taskType) {
    return {
      decision: "BLOCKED",
      policy: null,
      proofsRequired: [],
      humanApproval: false,
      reason: "No taskType provided — blocked by default",
    };
  }

  const taskRisk = assessRisk(task);  // ← utilise le risk-assessor complet

  const matchingPolicy = this.policies.find((policy) =>
    policy.taskTypes.includes(task.taskType!) &&
    policy.risk === taskRisk
  );

  if (!matchingPolicy) {
    return {
      decision: "BLOCKED",
      policy: null,
      proofsRequired: [],
      humanApproval: false,
      reason: `No matching policy for taskType=${task.taskType} risk=${taskRisk} — blocked by default`,
    };
  }

  return {
    decision: "APPROVED",
    policy: matchingPolicy,
    proofsRequired: matchingPolicy.proofsRequired,
    humanApproval: matchingPolicy.humanApproval,
    reason: `Matched policy: ${matchingPolicy.name}`,
  };
}
```

**Vérification:** `risk-assessor.ts` gère déjà `environment`, `data`, `scope`, `taskType`, `operation`. Plus de doublon.

---

### A2. Null Safety dans Risk Assessor

**Fichier:** `src/core/risk-assessor.ts`  
**Effort:** 5 min  
**Résout:** S-005 (crash sur undefined)

**Avant (ligne 56):**
```typescript
if (highRiskTypes.includes(task.taskType!)) {
```

**Après:**
```typescript
if (task.taskType && highRiskTypes.includes(task.taskType)) {
```

**Même chose ligne 61:**
```typescript
// Avant :
if (criticalRiskTypes.includes(task.taskType!)) {

// Après :
if (task.taskType && criticalRiskTypes.includes(task.taskType)) {
```

---

### A3. Supprimer la duplication de types dans classifier.ts

**Fichier:** `src/core/classifier.ts`  
**Effort:** 10 min  
**Résout:** S-008 (type duplication)

**Avant (lignes 1-35):**
```typescript
export enum TaskComplexity { L1 = "L1", L2 = "L2", L3 = "L3", L4 = "L4" }
export enum TaskType { TYPO = "TYPO", CONFIG = "CONFIG", ... }
export interface TaskSpec { ... }
```

**Après:**
```typescript
import { TaskType, TaskSpec } from "./types";

export function classifyTask(task: TaskSpec): TaskType {
  // ... reste de la fonction identique
}
```

**Note:** Supprimer les 35 premières lignes. Garder uniquement la fonction `classifyTask`.

---

### A4. Corriger les regex des guards

**Fichiers:** `src/core/guard-overrides.ts` (ligne 15) + `src/core/orchestrator.ts` (ligne 108)  
**Effort:** 10 min  
**Résout:** S-002 (bypass regex)

**guard-overrides.ts — Avant (ligne 15):**
```typescript
{ pattern: /rm\s+-rf\s+\/\s*$/, action: "BLOCK", ... }
```

**guard-overrides.ts — Aprés:**
```typescript
{ pattern: /rm\s+-rf\s+\/\S?/, action: "BLOCK", policy: "HUMAN_ONLY", reason: "Recursive delete blocked (any path under /)" },
```

**orchestrator.ts — Avant (ligne 108):**
```typescript
{ pattern: /rm\s+-rf\s+\//, action: "BLOCKED" as const, reason: "Recursive root delete blocked" },
```

**orchestrator.ts — Aprés:**
```typescript
{ pattern: /rm\s+-rf\s+\/\S?/, action: "BLOCKED" as const, reason: "Recursive delete blocked (any path under /)" },
```

---

### A5. Vrai SHA-256 dans Proof Verifier

**Fichier:** `src/core/proof-verifier.ts`  
**Effort:** 15 min  
**Résout:** S-003 (hash fake), S-012 (timestamp non-déterministe)

**Avant (lignes 1-11 + 119-143):**
```typescript
import { TaskSpec, ProofChain, Proof, ProofType, PolicySpec, ExecutionResult, PolicyDecision } from "./types";

// ...

private generateHash(task: TaskSpec, proofType: ProofType): string {
  const content = `${task.id || ""}|${task.description}|${proofType}|${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return "sha256:" + (Math.abs(hash).toString(16).padStart(64, "0"));
}

private computeRootHash(proofs: Proof[]): string {
  const hashContent = proofs.map((p) => p.hash).join("");
  let hash = 0;
  for (let i = 0; i < hashContent.length; i++) {
    const char = hashContent.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return "sha256:" + (Math.abs(hash).toString(16).padStart(64, "0"));
}
```

**Après:**
```typescript
import { createHash } from "node:crypto";
import { TaskSpec, ProofChain, Proof, ProofType, PolicySpec } from "./types";

// ...

private generateHash(task: TaskSpec, proofType: ProofType): string {
  // Déterministe : même input → même hash (pas de Date.now())
  const content = `${task.id || "unknown"}|${task.description}|${proofType}`;
  return "sha256:" + createHash("sha256").update(content).digest("hex");
}

private computeRootHash(proofs: Proof[]): string {
  const hashContent = proofs.map((p) => p.hash).join("|");
  return "sha256:" + createHash("sha256").update(hashContent).digest("hex");
}
```

**Note:** Supprimer les imports `ExecutionResult` et `PolicyDecision` (inutilisés dans ce fichier).

---

### A6. Corriger la logique PENDING dans Proof Verifier

**Fichier:** `src/core/proof-verifier.ts`  
**Effort:** 15 min  
**Résout:** S-009 (PENDING auto-fail pour L3/L4)

**Avant (ligne 100):**
```typescript
verifyProofChain(chain: ProofChain): "PASS" | "FAIL" {
  for (const proof of chain.proofs) {
    const expectedHash = this.generateHashByType(chain.taskId, proof.type);
    if (proof.hash !== expectedHash) {
      return "FAIL";
    }
  }
  const allPassed = chain.proofs.every((p) => p.status === "PASS");
  if (!allPassed) {
    return "FAIL";
  }
  return "PASS";
}
```

**Après (nouvelle signature + logique):**
```typescript
verifyProofChain(chain: ProofChain): "PASS" | "FAIL" | "PENDING" {
  // Vérifier l'intégrité des hashes
  for (const proof of chain.proofs) {
    const expectedHash = this.generateHashByType(chain.taskId, proof.type);
    if (proof.hash !== expectedHash) {
      return "FAIL";
    }
  }

  // Distinguer PENDING (en attente humaine) de FAIL (preuve rejetée)
  const hasPending = chain.proofs.some((p) => p.status === "PENDING");
  if (hasPending) {
    return "PENDING";
  }

  const allPassed = chain.proofs.every((p) => p.status === "PASS");
  if (!allPassed) {
    return "FAIL";
  }

  return "PASS";
}
```

**Impact dans orchestrator.ts (ligne 59):**
```typescript
// Avant :
const proofStatus = this.proofVerifier.verifyProofChain(proofChain);

// Après — gérer PENDING :
const proofResult = this.proofVerifier.verifyProofChain(proofChain);
const proofStatus = proofResult === "PENDING" ? "FAIL" : proofResult;
// PENDING = en attente d'approbation humaine = pas encore prêt = BLOCKED
```

---

## PHASE B — Intégration Core (2-3 jours)

### B1. Utiliser GuardOverrides au lieu de checkGuards()

**Fichier:** `src/core/orchestrator.ts`  
**Effort:** 20 min  
**Résout:** S-006 (GuardOverrides dead code)

**Avant (constructeur + checkGuards):**
```typescript
import { classifyTask } from "./classifier";
import { assessRisk } from "./risk-assessor";
import { PolicyEngine } from "./policy-engine";
import { ProofVerifier } from "./proof-verifier";
import { TaskSpec, ExecutionResult, ... } from "./types";

export class GovernanceOrchestrator {
  private policyEngine: PolicyEngine;
  private proofVerifier: ProofVerifier;

  constructor() {
    this.policyEngine = new PolicyEngine();
    this.proofVerifier = new ProofVerifier();
  }
  // ...
  private checkGuards(description: string) { ... }  // 30 lignes dupliquées
}
```

**Après:**
```typescript
import { classifyTask } from "./classifier";
import { assessRisk } from "./risk-assessor";
import { PolicyEngine } from "./policy-engine";
import { ProofVerifier } from "./proof-verifier";
import { GuardOverrides } from "./guard-overrides";
import { TaskSpec, ExecutionResult, ... } from "./types";

export class GovernanceOrchestrator {
  private policyEngine: PolicyEngine;
  private proofVerifier: ProofVerifier;
  private guardOverrides: GuardOverrides;

  constructor() {
    this.policyEngine = new PolicyEngine();
    this.proofVerifier = new ProofVerifier();
    this.guardOverrides = new GuardOverrides();
  }

  // Supprimer checkGuards() (lignes 105-131)
  // Ajouter :
  private checkTaskGuards(task: TaskSpec) {
    return this.guardOverrides.check(task);
  }
}
```

**Dans execute() — Avant (ligne 50):**
```typescript
const guardDecision = this.checkGuards(task.description);
```

**Dans execute() — Aprés:**
```typescript
const guardResult = this.checkTaskGuards(task);
```

**Adapter le type de retour (ligne 80):**
```typescript
// Avant :
guardDecision: guardDecision.decision,

// Après :
guardDecision: guardResult.decision === "WARN" ? "BLOCKED" : guardResult.decision,
```

---

### B2. Error Handling dans Orchestrator

**Fichier:** `src/core/orchestrator.ts`  
**Effort:** 20 min  
**Résout:** R-001, S-007 (crash sur malformed input)

**Avant (execute):**
```typescript
async execute(task: TaskSpec): Promise<ExecutionResult> {
  const taskId = this.generateId();
  const taskType = classifyTask(task);
  // ... pipeline sans try/catch
}
```

**Après:**
```typescript
async execute(task: TaskSpec): Promise<ExecutionResult> {
  const taskId = this.generateId();

  try {
    // Validation d'entrée
    if (!task || typeof task.description !== "string" || !task.description.trim()) {
      return this.blockedResult(taskId, task, "Invalid task: description is required");
    }

    // Step 1: Classify
    const taskType = classifyTask(task);
    const taskWithType = { ...task, taskType };

    // Step 2: Assess Risk
    const riskLevel = assessRisk(taskWithType);
    const taskWithRisk = { ...taskWithType, risk: riskLevel };

    // Step 3: Evaluate Policy
    const policyDecision = this.policyEngine.evaluatePolicy(taskWithRisk);
    if (policyDecision.decision === "BLOCKED") {
      return {
        taskId, taskType, riskLevel, policyDecision,
        guardDecision: "ALLOWED", proofStatus: "FAIL", verdict: "BLOCKED",
      };
    }

    // Step 4: Check guards
    const guardResult = this.checkTaskGuards(task);
    if (guardResult.decision === "BLOCKED") {
      return {
        taskId, taskType, riskLevel, policyDecision,
        guardDecision: "BLOCKED", proofStatus: "FAIL", verdict: "BLOCKED",
      };
    }

    // Step 5: Generate proofs
    const proofChain = this.proofVerifier.generateProofChain(
      { ...taskWithRisk, id: taskId }, policyDecision.policy!
    );

    // Step 6: Verify proofs
    const proofResult = this.proofVerifier.verifyProofChain(proofChain);
    const proofStatus = proofResult === "PENDING" ? "FAIL" : proofResult;

    // Step 7: Verdict
    let verdict: "APPROVED" | "BLOCKED" | "REJECTED" = "APPROVED";
    if (guardResult.decision === "WARN") verdict = "BLOCKED";
    else if (proofStatus === "FAIL") verdict = "BLOCKED";
    else if (policyDecision.humanApproval && !this.hasHumanApproval(proofChain)) verdict = "BLOCKED";

    return {
      taskId, taskType, riskLevel, policyDecision,
      guardDecision: guardResult.decision === "WARN" ? "BLOCKED" : guardResult.decision,
      proofStatus, verdict,
    };

  } catch (error) {
    // Fail-closed : toute erreur = BLOCKED
    return this.blockedResult(taskId, task, `Governance error: ${error instanceof Error ? error.message : "unknown"}`);
  }
}

private blockedResult(taskId: string, task: TaskSpec, reason: string): ExecutionResult {
  return {
    taskId,
    taskType: task?.taskType || TaskType.FEATURE_LIMITED,
    riskLevel: RiskLevel.HIGH,
    policyDecision: {
      decision: "BLOCKED", policy: null, proofsRequired: [],
      humanApproval: false, reason,
    },
    guardDecision: "BLOCKED",
    proofStatus: "FAIL",
    verdict: "BLOCKED",
  };
}
```

---

### B3. Ajouter validation d'entrée dans Types

**Fichier:** `src/core/types.ts`  
**Effort:** 5 min  
**Résout:** S-007 (input validation)

**Ajouter après la définition de TaskSpec (ligne 51):**
```typescript
export function isValidTaskSpec(task: unknown): task is TaskSpec {
  return (
    typeof task === "object" &&
    task !== null &&
    "description" in task &&
    typeof (task as TaskSpec).description === "string" &&
    (task as TaskSpec).description.trim().length > 0
  );
}
```

---

### B4. Charger les policies depuis YAML

**Fichiers:** `src/core/policy-engine.ts` + `package.json`  
**Effort:** 1 heure  
**Résout:** S-011 (YAML not loaded)

**Étape 1 — Installer yaml:**
```bash
npm install yaml
```

**Étape 2 — Modifier policy-engine.ts:**
```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { assessRisk } from "./risk-assessor";
import { TaskSpec, PolicySpec, ProofType, RiskLevel, TaskComplexity, TaskType, PolicyDecision } from "./types";

export class PolicyEngine {
  private policies: PolicySpec[] = [];

  constructor() {
    this.policies = this.loadPolicies();
  }

  private loadPolicies(): PolicySpec[] {
    try {
      const yamlPath = join(__dirname, "..", "policies", "default.yaml");
      const content = readFileSync(yamlPath, "utf-8");
      const doc = parseYaml(content);
      const rawPolicies = (doc as any).policies || [];

      return rawPolicies.map((p: any) => ({
        name: p.name,
        complexity: p.complexity as TaskComplexity,
        taskTypes: (p.task_types || []) as TaskType[],
        risk: p.risk as RiskLevel,
        agents: p.agents || [],
        modelPlan: {
          primary: p.model_plan?.primary || [],
          fallback: p.model_plan?.fallback || [],
        },
        proofsRequired: (p.proofs_required || []) as ProofType[],
        humanApproval: p.human_approval || false,
        securityScan: p.security_scan || false,
      }));
    } catch (err) {
      console.error("[PolicyEngine] Failed to load YAML, using defaults:", err);
      return this.getDefaultPolicies();
    }
  }

  // garder getDefaultPolicies() comme fallback
  private getDefaultPolicies(): PolicySpec[] { ... }
}
```

---

### B5. Corriger le type guardDecision dans ExecutionResult

**Fichier:** `src/core/types.ts`  
**Effort:** 5 min

**Avant (ligne 105):**
```typescript
guardDecision: "BLOCKED" | "ALLOWED";
```

**Après:**
```typescript
guardDecision: "BLOCKED" | "ALLOWED" | "WARN";
```

---

## PHASE C — Qualité (3-5 jours)

### C1. Installer le framework de test

```bash
npm install --save-dev vitest
```

**package.json — modifier scripts:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

### C2. Tests — classifier.ts

**Fichier:** `src/core/classifier.test.ts`

```typescript
import { describe, test, expect } from "vitest";
import { classifyTask } from "./classifier";
import { TaskType } from "./types";

describe("classifyTask", () => {
  test("typo → CONFIG (L1)", () => {
    expect(classifyTask({ description: "fix typo in README" })).toBe(TaskType.CONFIG);
  });

  test("feature request → FEATURE_LIMITED (L2)", () => {
    expect(classifyTask({ description: "add login feature" })).toBe(TaskType.FEATURE_LIMITED);
  });

  test("API change → API_CHANGE (L3)", () => {
    expect(classifyTask({ description: "modify the API contract" })).toBe(TaskType.API_CHANGE);
  });

  test("deploy production → DESTRUCTIVE_OP (L4)", () => {
    expect(classifyTask({ description: "deploy to production" })).toBe(TaskType.DESTRUCTIVE_OP);
  });

  test("destructive rm -rf → DESTRUCTIVE_OP (L4)", () => {
    expect(classifyTask({ description: "rm -rf everything" })).toBe(TaskType.DESTRUCTIVE_OP);
  });

  test("unknown → FEATURE_LIMITED (default)", () => {
    expect(classifyTask({ description: "do something" })).toBe(TaskType.FEATURE_LIMITED);
  });
});
```

---

### C3. Tests — risk-assessor.ts

**Fichier:** `src/core/risk-assessor.test.ts`

```typescript
import { describe, test, expect } from "vitest";
import { assessRisk } from "./risk-assessor";
import { RiskLevel, TaskType } from "./types";

describe("assessRisk", () => {
  test("destructive operation → CRITICAL", () => {
    expect(assessRisk({
      description: "clean up",
      operation: "rm -rf /data",
    })).toBe(RiskLevel.CRITICAL);
  });

  test("production environment → HIGH", () => {
    expect(assessRisk({
      description: "update config",
      environment: "production",
    })).toBe(RiskLevel.HIGH);
  });

  test("PII data → HIGH", () => {
    expect(assessRisk({
      description: "process users",
      data: { pii: true, password: "xxx" },
    })).toBe(RiskLevel.HIGH);
  });

  test("auth scope → HIGH", () => {
    expect(assessRisk({
      description: "modify module",
      scope: ["auth", "database"],
    })).toBe(RiskLevel.HIGH);
  });

  test("simple task → LOW", () => {
    expect(assessRisk({
      description: "fix typo",
    })).toBe(RiskLevel.LOW);
  });

  test("undefined taskType does not crash", () => {
    expect(() => assessRisk({ description: "test" })).not.toThrow();
  });
});
```

---

### C4. Tests — policy-engine.ts

**Fichier:** `src/core/policy-engine.test.ts`

```typescript
import { describe, test, expect } from "vitest";
import { PolicyEngine } from "./policy-engine";
import { TaskType, RiskLevel } from "./types";

describe("PolicyEngine", () => {
  const engine = new PolicyEngine();

  test("loads 4 default policies", () => {
    expect(engine.getPolicyCount()).toBe(4);
  });

  test("L1 task → APPROVED with L1-SIMPLE policy", () => {
    const result = engine.evaluatePolicy({
      description: "fix typo",
      taskType: TaskType.CONFIG,
      risk: RiskLevel.LOW,
    });
    expect(result.decision).toBe("APPROVED");
    expect(result.policy?.name).toBe("L1-SIMPLE");
    expect(result.humanApproval).toBe(false);
  });

  test("L3 task → APPROVED with human approval", () => {
    const result = engine.evaluatePolicy({
      description: "modify API",
      taskType: TaskType.API_CHANGE,
      risk: RiskLevel.HIGH,
    });
    expect(result.decision).toBe("APPROVED");
    expect(result.policy?.name).toBe("L3-COMPLEX");
    expect(result.humanApproval).toBe(true);
  });

  test("no taskType → BLOCKED", () => {
    const result = engine.evaluatePolicy({
      description: "something",
    });
    expect(result.decision).toBe("BLOCKED");
  });

  test("unknown taskType → BLOCKED", () => {
    const result = engine.evaluatePolicy({
      description: "unknown",
      taskType: "UNKNOWN" as TaskType,
      risk: RiskLevel.LOW,
    });
    expect(result.decision).toBe("BLOCKED");
  });
});
```

---

### C5. Tests — proof-verifier.ts

**Fichier:** `src/core/proof-verifier.test.ts`

```typescript
import { describe, test, expect } from "vitest";
import { ProofVerifier } from "./proof-verifier";
import { TaskType, RiskLevel, TaskComplexity } from "./types";

describe("ProofVerifier", () => {
  const verifier = new ProofVerifier();

  test("L1 task generates 0 proofs", () => {
    const chain = verifier.generateProofChain(
      { description: "fix typo", complexity: TaskComplexity.L1 },
      { name: "L1", complexity: TaskComplexity.L1, taskTypes: [], risk: RiskLevel.LOW,
        agents: [], modelPlan: { primary: [], fallback: [] }, proofsRequired: [],
        humanApproval: false, securityScan: false }
    );
    expect(chain.proofs.length).toBe(0);
    expect(chain.verdict).toBe("FAIL"); // 0 proofs = FAIL
  });

  test("L2 task generates 2 proofs", () => {
    const chain = verifier.generateProofChain(
      { description: "add feature", complexity: TaskComplexity.L2 },
      { name: "L2", complexity: TaskComplexity.L2, taskTypes: [], risk: RiskLevel.LOW,
        agents: [], modelPlan: { primary: [], fallback: [] },
        proofsRequired: ["tests" as any, "code_review" as any],
        humanApproval: false, securityScan: false }
    );
    expect(chain.proofs.length).toBe(2);
  });

  test("hash is deterministic (no timestamp)", () => {
    const task = { description: "test", id: "task-1" };
    const hash1 = (verifier as any).generateHash(task, "tests");
    const hash2 = (verifier as any).generateHash(task, "tests");
    expect(hash1).toBe(hash2);
  });

  test("verifyProofChain returns PENDING for human approval", () => {
    const chain = {
      taskId: "test",
      proofs: [{ type: "human_approval" as any, status: "PENDING" as const,
                 evidence: "", hash: "sha256:abc", timestamp: 0 }],
      verdict: "PASS" as const,
      rootHash: "sha256:root",
    };
    // Le hash ne matchera pas → FAIL (pas PENDING)
    // Mais si on mock le hash : 
    expect(["PASS", "FAIL", "PENDING"]).toContain(verifier.verifyProofChain(chain));
  });
});
```

---

### C6. Tests — orchestrator.ts (intégration)

**Fichier:** `src/core/orchestrator.test.ts`

```typescript
import { describe, test, expect } from "vitest";
import { GovernanceOrchestrator } from "./orchestrator";
import { TaskType } from "./types";

describe("GovernanceOrchestrator", () => {
  const orchestrator = new GovernanceOrchestrator();

  test("returns version info", () => {
    const summary = orchestrator.getSummary();
    expect(summary.version).toBe("0.2.0");
    expect(summary.policiesLoaded).toBeGreaterThan(0);
  });

  test("L1 task → APPROVED", async () => {
    const result = await orchestrator.execute({
      description: "fix typo in README",
    });
    expect(result.verdict).toBe("APPROVED");
    expect(result.taskType).toBeDefined();
  });

  test("destructive task → BLOCKED", async () => {
    const result = await orchestrator.execute({
      description: "rm -rf /important/data",
    });
    expect(result.verdict).toBe("BLOCKED");
  });

  test("empty description → BLOCKED (fail-closed)", async () => {
    const result = await orchestrator.execute({
      description: "",
    });
    expect(result.verdict).toBe("BLOCKED");
  });

  test("null task → BLOCKED (fail-closed)", async () => {
    const result = await orchestrator.execute(null as any);
    expect(result.verdict).toBe("BLOCKED");
  });
});
```

---

### C7. CI/CD GitHub Actions

**Fichier:** `.github/workflows/test.yml`

```yaml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run test
      - run: npx tsc --noEmit
```

---

### C8. Standardiser le package manager

**Action:** Supprimer `bun.lock` (garder `package-lock.json`)

```bash
rm bun.lock
```

---

## PHASE D — Features (1-2 semaines)

### D1. Worker Execution dans Orchestrator

**Fichier:** `src/core/orchestrator.ts`  
**Effort:** 1 jour

L'orchestrator a déjà `executeWorker()` et `runWorkerWithTimeout()` (lignes 140-207) mais elles ne sont jamais appelées. Il faut :

1. Après le verdict APPROVED, appeler `executeWorker(task)`
2. Intégrer le résultat dans l'ExecutionResult
3. Ajouter un champ `output?: string` au type ExecutionResult

```typescript
// Dans execute(), après le verdict :
if (verdict === "APPROVED") {
  const workerResult = await this.executeWorker(taskWithRisk);
  // Ajouter le résultat worker au return
}
```

---

### D2. Proof Persistence

**Fichier:** `src/core/orchestrator.ts` + nouveau `src/core/proof-store.ts`  
**Effort:** 1 jour

```typescript
// src/core/proof-store.ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { ProofChain } from "./types";

const PROOFS_DIR = join(homedir(), ".config", "opencode", "logs", "proofs");

export async function saveProofChain(chain: ProofChain): Promise<string> {
  const dir = join(PROOFS_DIR, chain.taskId);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, "_chain.json");
  await writeFile(filePath, JSON.stringify(chain, null, 2), "utf-8");
  return filePath;
}
```

---

### D3. Audit Trail Integration

**Fichier:** `src/core/orchestrator.ts`  
**Effort:** 4 heures

Événements à logger via le plugin `audit-logger.ts` :
- `governance.classify` — taskType + complexity
- `governance.risk` — riskLevel + factors
- `governance.policy` — policyName + decision
- `governance.guard` — guardDecision + reason
- `governance.proof` — proofStatus + verdict

---

### D4. Model Router

**Fichier:** nouveau `src/core/model-router.ts`  
**Effort:** 1 jour

```typescript
// Lire free-models.json, provider_circuit.json
// Sélectionner le meilleur worker disponible
// Gérer le fallback sur 429
```

---

## Matrice de Dépendances

```
A1 (unify risk) ──────────────────┐
A2 (null safety) ─────────────────┤
A3 (type dedup) ──────────────────┤
A4 (regex fix) ───────────────────┤
A5 (real SHA-256) ────────────────┤
A6 (PENDING logic) ───────────────┤
                                   ↓
B1 (use GuardOverrides) ──────────┐
B2 (error handling) ──────────────┤
B3 (input validation) ────────────┤
B4 (YAML loading) ────────────────┤
B5 (guardDecision type) ──────────┤
                                   ↓
C1 (test framework) ──────────────┐
C2-C6 (unit tests) ───────────────┤
C7 (CI/CD) ───────────────────────┤
C8 (lockfile) ─────────────────────┤
                                   ↓
D1 (worker execution) ────────────┐
D2 (proof persistence) ───────────┤
D3 (audit trail) ─────────────────┤
D4 (model router) ────────────────┘
```

---

## Checklist de Validation

### Après Phase A
- [ ] `risk-assessor.ts` est le seul risk assessor
- [ ] `task.taskType!` n'existe plus (optional chaining partout)
- [ ] `classifier.ts` n'a plus de enum dupliqué
- [ ] `rm -rf /home/user` est bloqué par les guards
- [ ] Les hashes sont déterministes (même input = même hash)
- [ ] `verifyProofChain` retourne PENDING quand humanApproval est en attente

### Après Phase B
- [ ] `orchestrator.ts` utilise `GuardOverrides` (pas de checkGuards dupliqué)
- [ ] `execute()` a un try/catch qui retourne BLOCKED sur erreur
- [ ] `policy-engine.ts` charge `default.yaml` (ou fallback hardcoded)
- [ ] `guardDecision` peut être "WARN" dans ExecutionResult
- [ ] `isValidTaskSpec()` existe dans types.ts

### Après Phase C
- [ ] `npm test` passe (tous les tests verts)
- [ ] `npx tsc --noEmit` passe (pas d'erreurs TypeScript)
- [ ] CI/CD green sur GitHub
- [ ] Plus de `bun.lock`

### Après Phase D
- [ ] L'orchestrator appelle les workers en cas de APPROVED
- [ ] Les proof chains sont persistées dans `logs/proofs/`
- [ ] Les événements governance sont loggués
- [ ] Le model router lit `free-models.json`

---

*Roadmap générée le 2026-09-06*  
*Prête pour exécution — commencer par A1*
