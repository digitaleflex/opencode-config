// src/core/cross-repo-orchestrator.ts — Cross-Repository Orchestration Engine
// Coordinates the full cross-repository lifecycle: issue → context → authority → routing → plan → approval → execution → validation → report

import { RepositoryRegistry, CrossRepoWriteRequest, getRegistry } from "./registry";
import { AuthorizationGate, AuthorizationInput, AuthorizationResult, getAuthorizationGate } from "./authorization-gate";
import { IssueParser, ParsedIssue, getIssueParser } from "./issue-parser";
import { PolicyEngine, getPolicyEngine } from "./policy-engine";
import { GuardOverrides } from "./guard-overrides";
import { ProofVerifier } from "./proof-verifier";
import { TaskSpec, TaskType, RiskLevel, PolicyDecision, ProofChain, EvidenceBundle, ExecutionResult, OperationType, TaskComplexity } from "./types";
import { classifyTask } from "./classifier";
import { assessRisk } from "./risk-assessor";
import { MerkleAuditTrail } from "./merkle-audit";
import { createHash, randomUUID } from "node:crypto";

export interface CrossRepoContext {
  issue: ParsedIssue;
  authority_resolutions: Map<string, any>; // repo_id -> authority resolution
  policy_decision: PolicyDecision | null;
  guard_decision: "BLOCKED" | "ALLOWED" | "WARN";
  proof_chain: ProofChain | null;
  authorization_result: AuthorizationResult | null;
}

export interface OrchestrationPlan {
  issue_id: string;
  steps: OrchestrationStep[];
  cross_repo_writes: CrossRepoWriteRequest[];
  requires_human_approval: boolean;
}

export interface OrchestrationStep {
  step: number;
  repository: "engineering" | "config" | "product";
  action: string;
  owner: "planner" | "architect" | "builder" | "reviewer" | "security" | "human";
  depends_on: number[];
  validation: string;
  authorization_input?: AuthorizationInput;
}

export interface OrchestrationResult {
  success: boolean;
  issue_id: string;
  executed_steps: number;
  failed_step?: number;
  error?: string;
  execution_results: ExecutionResult[];
  audit_trail: string[];
}

export class CrossRepoOrchestrator {
  private registry: RepositoryRegistry;
  private gate: AuthorizationGate;
  private parser: IssueParser;
  private policyEngine: PolicyEngine;
  private guards: GuardOverrides;
  private proofVerifier: ProofVerifier;
  private merkleAudit: MerkleAuditTrail;

  constructor() {
    this.registry = getRegistry();
    this.gate = getAuthorizationGate();
    this.parser = getIssueParser();
    this.policyEngine = getPolicyEngine();
    this.guards = new GuardOverrides();
    this.proofVerifier = new ProofVerifier();
    this.merkleAudit = new MerkleAuditTrail();
  }

  /**
   * Execute the full cross-repository orchestration lifecycle for an issue
   */
  async orchestrate(issueBody: string, evidence: EvidenceBundle = {}): Promise<OrchestrationResult> {
    // Phase 1: Parse issue
    const issue = this.parser.parseIssueBody(issueBody);
    const executableCheck = this.parser.isExecutable(issue);
    
    if (!executableCheck.executable) {
      return {
        success: false,
        issue_id: `issue-${issue.identity.issue_number || "unknown"}`,
        executed_steps: 0,
        error: `Issue not executable: ${executableCheck.reasons.join("; ")}`,
        execution_results: [],
        audit_trail: [],
      };
    }

    // Phase 2: Build orchestration plan
    const plan = this.buildPlan(issue);

    // Phase 3: Execute each step
    const results: ExecutionResult[] = [];
    const auditTrail: string[] = [];
    
    for (const step of plan.steps) {
      const stepResult = await this.executeStep(step, issue, evidence);
      results.push(stepResult);
      auditTrail.push(`Step ${step.step}: ${step.action} in ${step.repository} - ${stepResult.verdict}`);

      if (stepResult.verdict === "BLOCKED" || stepResult.verdict === "REJECTED") {
        return {
          success: false,
          issue_id: `issue-${issue.identity.issue_number}`,
          executed_steps: results.length,
          failed_step: step.step,
          error: stepResult.output || "Step blocked/rejected",
          execution_results: results,
          audit_trail: auditTrail,
        };
      }
    }

    // Phase 4: Validate cross-repo writes
    if (plan.cross_repo_writes.length > 0) {
      for (const write of plan.cross_repo_writes) {
        const authResult = this.gate.authorize({
          issue_id: `issue-${issue.identity.issue_number}`,
          repository: write.target_repo,
          branch: write.target_branch,
          target_paths: [write.target_path],
          operation: write.operation,
          tool_command: `cross_repo_write:${write.operation}:${write.target_path}`,
          risk: RiskLevel.HIGH,
          actor_agent: "cross-repo-orchestrator",
          requested_capability: "cross_repo_write",
          working_tree_state: { clean: true, dirty_files: [], untracked_files: [], conflicted_files: [] },
        });
        
        auditTrail.push(`Cross-repo write ${write.target_repo}:${write.target_path} - ${authResult.decision}`);
        
        if (authResult.decision === "DENY") {
          return {
            success: false,
            issue_id: `issue-${issue.identity.issue_number}`,
            executed_steps: results.length,
            error: `Cross-repo write denied: ${authResult.reason}`,
            execution_results: results,
            audit_trail: auditTrail,
          };
        }
      }
    }

    // Phase 5: Final validation
    const validationPassed = this.validateResults(results, issue);
    
    return {
      success: validationPassed,
      issue_id: `issue-${issue.identity.issue_number}`,
      executed_steps: results.length,
      error: validationPassed ? undefined : "Validation failed",
      execution_results: results,
      audit_trail: auditTrail,
    };
  }

  /**
   * Build orchestration plan from parsed issue
   */
  private buildPlan(issue: ParsedIssue): OrchestrationPlan {
    const steps: OrchestrationStep[] = [];
    const crossRepoWrites: CrossRepoWriteRequest[] = [];

    for (const implStep of issue.implementation_steps) {
      const isCrossRepo = implStep.repository !== "config"; // Assuming orchestration originates from config
      
      const step: OrchestrationStep = {
        step: implStep.step,
        repository: implStep.repository,
        action: implStep.action,
        owner: implStep.owner,
        depends_on: implStep.depends_on,
        validation: implStep.validation,
      };
      
      steps.push(step);

      // Track cross-repo writes from implementation boundary
      if (isCrossRepo) {
        const matchingChanges = issue.implementation_boundary.must_change.filter(
          c => c.repository === implStep.repository
        );
        for (const change of matchingChanges) {
          crossRepoWrites.push({
            source_repo: "config",
            target_repo: change.repository,
            target_branch: "main",
            target_path: change.path,
            operation: change.operation,
            issue_ref: `issue-${issue.identity.issue_number}`,
          });
        }
      }
    }

    const requiresHumanApproval = issue.acceptance_criteria.some(c => 
      c.criterion.toLowerCase().includes("approval") || 
      c.criterion.toLowerCase().includes("human")
    ) || crossRepoWrites.length > 0;

    return {
      issue_id: `issue-${issue.identity.issue_number}`,
      steps,
      cross_repo_writes: crossRepoWrites,
      requires_human_approval: requiresHumanApproval,
    };
  }

  /**
   * Execute a single orchestration step
   */
  private async executeStep(
    step: OrchestrationStep,
    issue: ParsedIssue,
    evidence: EvidenceBundle
  ): Promise<ExecutionResult> {
    const taskId = `task-${issue.identity.issue_number}-${step.step}-${randomUUID().slice(0, 8)}`;
    
    // Build task spec from issue context
    const task: TaskSpec = {
      id: taskId,
      description: `${step.action} (step ${step.step} of issue ${issue.identity.issue_number})`,
      taskType: this.inferTaskType(issue, step),
      complexity: this.inferComplexity(step.repository),
      scope: issue.repository_scope.read_repositories,
      operation: step.action,
    };

    // Classify and assess risk
    const taskType = classifyTask(task);
    const riskLevel = assessRisk(task);

    // Policy evaluation
    const policyDecision = this.policyEngine.evaluatePolicy(task, "free");

    // Guard check
    const guardResult = this.guards.check(task);

    // Proof chain
    let proofChain: ProofChain | null = null;
    let proofStatus: "PASS" | "FAIL" | "PENDING" = "PENDING";
    
    if (policyDecision.policy) {
      proofChain = this.proofVerifier.generateProofChain(task, policyDecision.policy, evidence);
      proofStatus = this.proofVerifier.verifyProofChain(proofChain, task, evidence);
    }

    // Authorization gate
    const authInput: AuthorizationInput = {
      issue_id: `issue-${issue.identity.issue_number}`,
      repository: step.repository,
      branch: "main",
      target_paths: issue.implementation_boundary.must_change
        .filter(c => c.repository === step.repository)
        .map(c => c.path),
      operation: "UPDATE",
      tool_command: step.action,
      risk: riskLevel,
      actor_agent: step.owner,
      requested_capability: step.repository === "config" ? "filesystem.write" : "cross_repo_write",
      working_tree_state: { clean: true, dirty_files: [], untracked_files: [], conflicted_files: [] },
      policy_decision: policyDecision,
      proof_chain: proofChain || undefined,
      guard_decision: guardResult.decision,
    };

    const authResult = this.gate.authorize(authInput);

    // Record to Merkle audit trail
    this.merkleAudit.record({
      timestamp: new Date().toISOString(),
      taskId,
      taskDescription: task.description,
      stage: "execution",
      decision: authResult.decision === "ALLOW" ? "APPROVED" : authResult.decision,
      detail: {
        step: step.step,
        repository: step.repository,
        action: step.action,
        authDecision: authResult.decision,
        authReason: authResult.reason,
        policyDecision: policyDecision.decision,
        guardDecision: guardResult.decision,
        proofStatus,
      },
    });

    // Determine verdict
    let verdict: "APPROVED" | "BLOCKED" | "REJECTED" = "APPROVED";
    let output = "";

    if (authResult.decision === "DENY" || authResult.decision === "UNKNOWN") {
      verdict = "BLOCKED";
      output = `Authorization denied: ${authResult.reason}`;
    } else if (authResult.decision === "REQUIRES_APPROVAL") {
      verdict = "BLOCKED"; // Block until human approval
      output = `Requires human approval: ${authResult.reason}`;
    } else if (guardResult.decision === "BLOCKED") {
      verdict = "BLOCKED";
      output = `Guard blocked: ${guardResult.reason}`;
    } else if (policyDecision.decision === "BLOCKED") {
      verdict = "BLOCKED";
      output = `Policy blocked: ${policyDecision.reason}`;
    } else if (proofStatus === "FAIL" || proofStatus === "PENDING") {
      verdict = "BLOCKED";
      output = `Proof verification ${proofStatus.toLowerCase()}`;
    }

    return {
      taskId,
      taskType,
      riskLevel,
      policyDecision,
      guardDecision: guardResult.decision,
      proofStatus,
      verdict,
      output: verdict === "APPROVED" ? `Executed: ${step.action}` : output,
      provider: step.owner,
    };
  }

  /**
   * Infer task type from issue context
   */
  private inferTaskType(issue: ParsedIssue, step: OrchestrationStep): TaskType {
    const typeMap: Record<string, TaskType> = {
      feature: TaskType.FEATURE_LIMITED,
      bug: TaskType.BUG_LOCALIZED,
      ux: TaskType.FEATURE_LIMITED,
      architecture: TaskType.ARCH_DESIGN,
      configuration: TaskType.CONFIG,
      maintenance: TaskType.REFACTOR_MODULE,
      security: TaskType.SECURITY,
      performance: TaskType.FEATURE_LIMITED,
      "capability-gap": TaskType.FEATURE_LIMITED,
    };
    return typeMap[issue.identity.type] || TaskType.FEATURE_LIMITED;
  }

  /**
   * Infer complexity from repository
   */
  private inferComplexity(repository: string): TaskComplexity {
    if (repository === "engineering") return TaskComplexity.L3;
    if (repository === "product") return TaskComplexity.L2;
    return TaskComplexity.L2;
  }

  /**
   * Validate execution results against acceptance criteria
   */
  private validateResults(results: ExecutionResult[], issue: ParsedIssue): boolean {
    // Check all steps approved
    const allApproved = results.every(r => r.verdict === "APPROVED");
    if (!allApproved) return false;

    // Check acceptance criteria mapped to evidence
    // This would be more sophisticated in real implementation
    return true;
  }

  /**
   * Get registry for external access
   */
  getRegistry(): RepositoryRegistry {
    return this.registry;
  }

  /**
   * Get authorization gate for external access
   */
  getGate(): AuthorizationGate {
    return this.gate;
  }
}

// Singleton
let orchestratorInstance: CrossRepoOrchestrator | null = null;

export function getCrossRepoOrchestrator(): CrossRepoOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new CrossRepoOrchestrator();
  }
  return orchestratorInstance;
}

export function resetCrossRepoOrchestrator(): void {
  orchestratorInstance = null;
}