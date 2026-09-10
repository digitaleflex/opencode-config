// src/core/index.ts — Barrel exports for EURINHASH Governance Engine

export { GovernanceOrchestrator } from "./orchestrator";
export { PolicyEngine } from "./policy-engine";
export { ProofVerifier } from "./proof-verifier";
export { GuardOverrides } from "./guard-overrides";
export { MerkleAuditTrail } from "./merkle-audit";
export { AnomalyDetector } from "./anomaly-detection";
export { InjectionDetector } from "./injection-detection";
export { StandardsMapper } from "./standards-mapping";
export { DriftDetector, DriftDimension } from "./drift-detection";
export { BehavioralFSM } from "./behavioral-fsm";
export { classifyTask } from "./classifier";
export { assessRisk, getRiskFromComplexity } from "./risk-assessor";
export {
  TaskComplexity,
  RiskLevel,
  TaskType,
  ProofType,
} from "./types";
export type {
  TaskSpec,
  PolicySpec,
  ModelPlan,
  Proof,
  ProofChain,
  PolicyDecision,
  GuardOverride,
  ExecutionResult,
  EvidenceBundle,
  TestEvidence,
  ScanEvidence,
} from "./types";

// Re-export new types
export type { AuditEntry, MerkleRoot, AuditProof } from "./merkle-audit";
export type { AnomalyResult, Baseline } from "./anomaly-detection";
export type { InjectionResult, InjectionScanReport } from "./injection-detection";
export type { ComplianceMapping, ComplianceReport } from "./standards-mapping";
export type { DriftReport, DriftReading } from "./drift-detection";
export type { FSMResult, StateTransition, ToolKind } from "./behavioral-fsm";
export type { ToolAttestation, AttestationResult } from "./guard-overrides";
export type { HeadAnchor } from "./merkle-audit";
