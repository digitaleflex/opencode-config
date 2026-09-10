// src/core/types.ts — EURINHASH Governance Engine Types

export enum TaskComplexity {
  L1 = "L1",
  L2 = "L2",
  L3 = "L3",
  L4 = "L4",
}

export enum RiskLevel {
  LOW = "LOW",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum TaskType {
  TYPO = "TYPO",
  CONFIG = "CONFIG",
  FORMAT = "FORMAT",
  DOC_READ = "DOC_READ",
  DOC_WRITE = "DOC_WRITE",
  BUG_LOCALIZED = "BUG_LOCALIZED",
  FEATURE_LIMITED = "FEATURE_LIMITED",
  REFACTOR_MODULE = "REFACTOR_MODULE",
  API_CHANGE = "API_CHANGE",
  ARCH_DESIGN = "ARCH_DESIGN",
  SECURITY = "SECURITY",
  PRODUCTION_DEPLOY = "PRODUCTION_DEPLOY",
  SENSITIVE_DATA = "SENSITIVE_DATA",
  DESTRUCTIVE_OP = "DESTRUCTIVE_OP",
}

export enum ProofType {
  TESTS = "tests",
  CODE_REVIEW = "code_review",
  SECURITY_SCAN = "security_scan",
  HUMAN_APPROVAL = "human_approval",
  BUILD_VERIFICATION = "build_verification",
}

export interface TaskSpec {
  id?: string;
  description: string;
  taskType?: TaskType;
  complexity?: TaskComplexity;
  risk?: RiskLevel;
  scope?: string[];
  operation?: string;
  environment?: "development" | "staging" | "production";
  data?: { [key: string]: unknown };
}

export interface PolicySpec {
  name: string;
  complexity: TaskComplexity;
  taskTypes: TaskType[];
  risk: RiskLevel;
  agents: string[];
  modelPlan: ModelPlan;
  proofsRequired: ProofType[];
  humanApproval: boolean;
  securityScan: boolean;
}

export interface ModelPlan {
  primary: string[];
  fallback: string[];
}

export interface Proof {
  type: ProofType;
  status: "PASS" | "FAIL" | "PENDING";
  evidence: string;
  /** Content-bound hash of the task + proof type (tamper detection). */
  hash: string;
  /** Hash of the raw evidence payload this proof was derived from. */
  evidenceHash?: string;
  /** Origin of the evidence, e.g. "ci", "human", "scanner". */
  source?: string;
  timestamp: number;
}

/** Raw test-run evidence supplied by a trusted producer (CI, local runner). */
export interface TestEvidence {
  passed: number;
  failed: number;
  outputHash: string;
}

/** Raw security-scan evidence. */
export interface ScanEvidence {
  findings: number;
  outputHash: string;
}

/**
 * Evidence supplied to the orchestrator. Proofs are no longer fabricated:
 * a required proof is only PASS when authentic evidence is provided.
 */
export interface EvidenceBundle {
  testResult?: TestEvidence;
  reviewHash?: string;
  scanReport?: ScanEvidence;
  /** Human-approval reference (formal signed token lands in #6). */
  approvalToken?: string;
}

export interface ProofChain {
  taskId: string;
  proofs: Proof[];
  verdict: "PASS" | "FAIL" | "BLOCKED";
  rootHash: string;
}

export interface PolicyDecision {
  decision: "APPROVED" | "BLOCKED" | "REQUIRES_HUMAN";
  policy?: PolicySpec | null;
  proofsRequired: ProofType[];
  humanApproval: boolean;
  reason?: string;
}

export interface GuardOverride {
  pattern: RegExp;
  action: "BLOCK" | "WARN";
  policy: string;
  reason: string;
}

export type ExecutionResult = {
  taskId: string;
  taskType: TaskType;
  riskLevel: RiskLevel;
  policyDecision: PolicyDecision;
  guardDecision: "BLOCKED" | "ALLOWED";
  proofStatus: "PASS" | "FAIL" | "PENDING";
  verdict: "APPROVED" | "BLOCKED" | "REJECTED";
};


export function isValidTaskSpec(task: unknown): task is TaskSpec {
  return (
    typeof task === "object" &&
    task !== null &&
    "description" in task &&
    typeof (task as TaskSpec).description === "string" &&
    (task as TaskSpec).description.trim().length > 0
  );
}

