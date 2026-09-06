// src/types.ts — EURINHASH Governance Engine Types

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

export interface TaskSpec {
  id?: string;
  description: string;
  taskType?: TaskType;
  complexity?: TaskComplexity;
  risk?: RiskLevel;
  scope?: string[];
  blastRadius?: "file" | "module" | "service" | "system";
  operation?: string;
  environment?: "development" | "staging" | "production";
  data?: Record<string, unknown>;
  user?: string;
  timestamp?: number;
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
  primary: string[]; // free workers first
  fallback: string[];
  strong?: string[];
}

export type ProofType = "tests" | "code_review" | "security_scan" | "human_approval" | "build_verification";

export interface Proof {
  type: ProofType;
  status: "PASS" | "FAIL" | "PENDING";
  evidence: string;
  hash: string;
  timestamp: number;
}

export interface ProofChain {
  taskId: string;
  proofs: Proof[];
  verdict: "PASS" | "FAIL" | "BLOCKED";
  rootHash: string;
}

export interface PolicyDecision {
  decision: "APPROVED" | "BLOCKED" | "REQUIRES_HUMAN";
  policy: PolicySpec;
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
