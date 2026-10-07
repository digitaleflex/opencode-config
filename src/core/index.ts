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
export { TaskComplexity, RiskLevel, TaskType, ProofType } from "./types";
export { CircuitBreaker } from "./provider-breaker";
export { ProviderHealth } from "./provider-health";
export { resolveStrategy } from "./strategies";
export { RetryLogic, createHttpRetryableChecker, generateIdempotencyKey } from "./retry-backoff";
export { classifyError, shouldFailover, countsAgainstBreaker } from "./error-classifier";
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
export { TaskBudget } from "./budget";
export type { TaskBudgetOpts } from "./budget";
export type { ApprovalToken } from "./approval";
export { issueApproval, verifyApproval, clearApprovalNonces, resolveApprovalKey } from "./approval";
export { StateStore } from "./state-store";
export { WorkspaceGuard, checkEgress } from "./confinement";
export { McpGovernance } from "./mcp-governance";
export type { McpTool, McpManifest } from "./mcp-governance";
export { VERSION } from "./version";
export { loadMode, saveMode, loadRegistry, isWorkerAllowed, filterModelPlan } from "./mode";
export type { EngineMode, ModeState, WorkerTier, WorkerCost, CostRegistry } from "./mode";
export { redactSecrets, scanSecrets, redactDeep } from "./secret-redactor";
export type { Redaction, RedactResult } from "./secret-redactor";
export { scanStatic, bundledRuleCount } from "./static-rules";
export type {
  StaticRule,
  StaticFinding,
  StaticScanReport,
  RuleSeverity,
  RuleCategory,
} from "./static-rules";
export { judgeSemantic, NoopJudgeProvider } from "./semantic-judge";
export type { SemanticJudgment, JudgeProvider } from "./semantic-judge";

// Cross-repository orchestration exports
export { RepositoryRegistry, getRegistry, resetRegistry } from "./registry";
export type { RepositoryEntry, RegistrySchema, AuthorityResolution, CrossRepoWriteRequest } from "./registry";
export { AuthorizationGate, getAuthorizationGate, resetAuthorizationGate } from "./authorization-gate";
export type { AuthorizationInput, AuthorizationResult, AuthorizationDecision, WorkingTreeState, AuditRecord } from "./authorization-gate";
export { IssueParser, getIssueParser, resetIssueParser } from "./issue-parser";
export type { ParsedIssue, IssueIdentity, IssueImplementationStep } from "./issue-parser";
export { CrossRepoOrchestrator, getCrossRepoOrchestrator, resetCrossRepoOrchestrator } from "./cross-repo-orchestrator";
export type { OrchestrationPlan, OrchestrationStep, OrchestrationResult, CrossRepoContext } from "./cross-repo-orchestrator";

export { resolveLayers, resolveAgentOverride } from "./config/layered";
export type { ConfigLayer, LayeredConfigResult, AgentOverride } from "./config/layered";

export { resolveAgentProfile } from "./config/agent-profile";
export type { AgentProfile, AgentProfileSource } from "./config/agent-profile";

export { resolvePreset, resolveActivePreset, mergePresetMaps, normalizePreset, PresetResolutionError } from "./config/preset";
export type { PresetDefinition, PresetInput, PresetLayer, PresetSelection } from "./config/preset";

export { normalizeModelChain, selectFirstEligible } from "./config/model-chain";
export type { ModelCandidate, ModelPreference, ModelChain } from "./config/model-chain";

export { resolveSkills, resolveMcps, isSkillAllowed, isMcpAllowed } from "./config/capabilities";
export type { SkillDirectives, AgentCapabilities } from "./config/capabilities";

export { discoverProjectLocalSkills, discoverProjectLocalSkillNames } from "./config/project-skills";
export type { LocalSkill } from "./config/project-skills";

export { DecisionEngine } from "./decision-engine";
export type { DecisionRequest, DecisionResult, DecisionVerdict } from "./decision-engine";
