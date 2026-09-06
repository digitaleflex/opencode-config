# EURINHASH - Core Engine (MVP)

## Overview
Core governance engine for EURINHASH. Provides task classification, risk assessment, policy evaluation, and proof verification.

## Architecture

```
Task → Classifier → Risk Assessor → Policy Engine → Proof Verifier → Result
```

## 1. Task Classifier

```typescript
// src/classifier.ts
import { TaskSpec } from "./types";
import { RiskLevel } from "./risk";

export function classifyTask(task: TaskSpec): TaskType {
  const keywords = task.description.toLowerCase().split(" ");
  
  if (keywords.includes("typo") || keywords.includes("fix")) {
    return TaskType.L1;
  }
  if (keywords.includes("config") || keywords.includes("format")) {
    return TaskType.L1;
  }
  if (keywords.includes("bug") || keywords.includes("feature") || keywords.includes("refactor")) {
    return TaskType.L2;
  }
  if (keywords.includes("api") || keywords.includes("change")) {
    return TaskType.L3;
  }
  if (keywords.includes("deploy") || keywords.includes("production")) {
    return TaskType.L4;
  }
  return TaskType.L1;
}

export enum TaskType {
  L1 = "L1 - Simple",
  L2 = "L2 - Standard",
  L3 = "L3 - Complex",
  L4 = "L4 - Critical"
}
```

## 2. Risk Assessor

```typescript
// src/risk-assessor.ts
import { TaskSpec } from "./types";
import { RiskLevel } from "./risk";

export function assessRisk(task: TaskSpec): RiskLevel {
  let risk = RiskLevel.LOW;
  
  // File count modifier
  if (task.scope?.includes("database")) risk = risk === RiskLevel.HIGH ? RiskLevel.CRITICAL : RiskLevel.HIGH;
  if (task.scope?.includes("network")) risk = risk === RiskLevel.LOW ? RiskLevel.MEDIUM : RiskLevel.HIGH;
  
  // Destructive operations
  if (task.operation === "delete" || task.operation === "drop" || task.operation === "reset") {
    risk = risk === RiskLevel.LOW ? RiskLevel.HIGH : RiskLevel.CRITICAL;
  }
  
  // Production environment
  if (task.environment === "production") risk = risk === RiskLevel.LOW ? RiskLevel.MEDIUM : RiskLevel.HIGH;
  
  // Sensitive data
  if (task.data?.contains("personal") || task.data?.contains("health") || task.data?.contains("financial")) {
    risk = risk === RiskLevel.LOW ? RiskLevel.HIGH : RiskLevel.CRITICAL;
  }
  
  return risk;
}
```

## 3. Policy Engine

```typescript
// src/policy-engine.ts
import { PolicySpec } from "./types";
import { loadDefaultPolicies } from "./policies";

export function evaluatePolicy(task: TaskSpec, policy: PolicySpec): PolicyDecision {
  const requiredAgents = policy.requiredAgents || [];
  const model = policy.model || "free";
  const proofsRequired = policy.proofsRequired || 0;
  
  // Check if task matches policy
  if (!matchesPolicy(task, policy)) {
    return { decision: "BLOCKED", reason: "Policy mismatch" };
  }
  
  // Determine required agents
  const requiredAgents = policy.requiredAgents.filter(a => a.type !== "human");
  
  // Check if all required agents are available
  const availableAgents = getAvailableAgents();
  const missing = requiredAgents.filter(a => !availableAgents.some(a => a.name === a.id));
  
  if (missing.length > 0) {
    return { decision: "BLOCKED", reason: `Missing agents: ${missing.join(", ")}` };
  }
  
  // Determine proof requirements
  const proofs = collectRequiredProofs(task, policy);
  
  return {
    decision: "APPROVED",
    requiredAgents,
    proofsRequired,
    proofStrategy: determineProofStrategy(task, policy)
  };
}
```

## 4. Proof Verifier

```typescript
// src/proof-verifier.ts
import { PolicySpec } from "./types";

export function verifyProof(task: TaskSpec, policy: PolicySpec): ProofReport {
  const proofs = [];
  
  // Run tests
  if (policy.requireTests) {
    const testResults = runTests(task, policy);
    proofs.push({ type: "tests", status: testResults.passed ? "PASS" : "FAIL", count: testResults.count });
  }
  
  // Add reviewer approval if required
  if (policy.requireHumanApproval) {
    const reviewer = getReviewer();
    if (reviewer) {
      const review = reviewer.approve(task, policy);
      if (review.status === "APPROVED") {
        proofs.push({ type: "human_approval", status: "APPROVED", reviewer });
      } else {
        proofs.push({ type: "human_approval", status: "REJECTED", reason: review.reason });
      }
    }
  }
  
  // Add security scan if required
  if (policy.requireSecurityScan) {
    const securityReport = runSecurityScan(task, policy);
    proofs.push({ type: "security_scan", status: securityReport.passed ? "PASS" : "FAIL", findings: securityReport.findings });
  }
  
  return {
    status: proofs.every(p => p.status === "PASS"),
    totalProofs: proofs.length,
    proofs
  };
}
```

## 5. Guard Overrides

```typescript
// src/guard-overrides.ts
import { GuardOverride } from "./types";

export function applyGuards(task: TaskSpec, policy: PolicySpec): PolicyDecision {
  const overrides = loadGuardOverrides();
  
  for (const override of overrides) {
    if (matchesOperation(task, override.operation)) {
      return {
        decision: override.blockAction ? "BLOCKED" : "ALLOWED",
        reason: override.reason
      };
    }
  }
  
  return {
    decision: "APPROVED",
    reason: "No blocks"
  };
}
```

## 6. Main Orchestrator

```typescript
// src/orchestrator.ts
import { TaskClassifier } from "./classifier";
import { RiskAssessor } from "./risk-assessor";
import { PolicyEngine } from "./policy-engine";
import { ProofVerifier } from "./proof-verifier";
import { GuardOverrides } from "./guard-overrides";

export class GovernanceOrchestrator {
  constructor() {
    this.classifier = new TaskClassifier();
    this.riskAssessor = new RiskAssessor();
    this.policyEngine = new PolicyEngine();
    this.proofVerifier = new ProofVerifier();
    this.guardOverrides = new GuardOverrides();
  }
  
  async execute(task: TaskSpec): Promise<ExecutionResult> {
    console.log(`Processing task: ${task.description}`);
    
    // Step 1: Classify
    const taskType = this.classifier.classify(task);
    console.log(`Classified as: ${taskType}`);
    
    // Step 2: Assess Risk
    const risk = this.riskAssessor.assessRisk(task);
    console.log(`Risk level: ${risk}`);
    
    // Step 3: Evaluate Policy
    const policy = this.policyEngine.loadPolicy(task.type);
    const policyDecision = this.policyEngine.evaluatePolicy(task, policy);
    console.log(`Policy decision: ${policyDecision.decision}`);
    
    // Step 4: Apply Guards
    const guardDecision = this.guardOverrides.applyGuards(task, policy);
    console.log(`Guard decision: ${guardDecision.decision}`);
    
    // Step 5: Verify Proofs
    const proofReport = this.proofVerifier.verifyProof(task, policy);
    console.log(`Proof status: ${proofReport.status}`);
    
    return {
      taskId: this.generateId(),
      taskType,
      riskLevel,
      policyDecision,
      guardDecision,
      proofStatus: proofReport.status,
      verdict: this.computeVerdict(risk, policyDecision, guardDecision, proofReport)
    };
  }
  
  private computeVerdict(
    risk: RiskLevel,
    policyDecision: "APPROVED" | "BLOCKED",
    guardDecision: "BLOCKED" | "ALLOWED",
    proofStatus: "PASS" | "FAIL"
  ): "APPROVED" | "BLOCKED" | "REJECTED" {
    if (risk === RiskLevel.CRITICAL || guardDecision === "BLOCKED" || proofStatus === "FAIL") {
      return "BLOCKED";
    }
    if (risk === RiskLevel.HIGH && policyDecision === "BLOCKED") {
      return "BLOCKED";
    }
    return "APPROVED";
  }
}
```

## 7. Types

```typescript
// src/types.ts
export enum TaskType {
  L1 = "L1 - Simple",
  L2 = "L2 - Standard",
  L3 = "L3 - Complex",
  L4 = "L4 - Critical"
}

export enum RiskLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL"
}

export interface TaskSpec {
  id?: string;
  description: string;
  scope?: string;
  operation?: string;
  environment?: "development" | "staging" | "production";
  data?: object;
  requiredAgents?: string[];
  policy?: PolicySpec;
}

export interface PolicySpec {
  name: string;
  requiredAgents: string[];
  model: "free" | "strong";
  proofsRequired: number;
  requiredProofs: string[];
  humanApproval?: boolean;
  securityScan?: boolean;
}

export interface PolicyDecision {
  decision: "APPROVED" | "BLOCKED";
  reason?: string;
}

export interface ProofReport {
  status: "PASS" | "FAIL";
  totalProofs: number;
  proofs: Array<{
    type: string;
    status: "PASS" | "FAIL";
    // ... additional fields
  }>;
}
```

## Usage Example

```typescript
const orchestrator = new GovernanceOrchestrator();

const task: TaskSpec = {
  description: "Fix typo in login component",
  scope: "frontend",
  operation: "fix",
  environment: "development",
  requiredAgents: ["builder"]
};

const result = await orchestrator.execute(task);
console.log(result);
// {
//   taskId: "task-123",
//   taskType: "L1 - Simple",
//   riskLevel: "LOW",
//   policyDecision: "APPROVED",
//   guardDecision: "ALLOWED",
//   proofStatus: "PASS",
//   verdict: "APPROVED"
// }
```

## Integration Points

- **EURINHASH Supervisor** — wraps the orchestrator
- **Audit Logger** — logs all governance decisions
- **Guard Overrides** — blocks dangerous ops
- **Policy Engine** — loads YAML policies
- **Proof Verifier** — generates proof chains
- **Rate Limit Fallback** — handles failures gracefully

## Testing Strategy

- Unit tests for each component
- Integration tests for the full workflow
- Edge case testing (unknown tasks, missing data)
- Performance tests (response time < 100ms for L1)

## Next Steps

1. Implement the core engine files above
2. Create the YAML policy files
3. Set up integration tests
4. Build the npx installer script
5. Create the GitHub issues for tracking

The MVP is ready to be implemented. Shall I start building the core engine files?