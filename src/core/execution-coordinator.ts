import { randomUUID } from "node:crypto";
import { AuthorizationGate, type AuthorizationInput, type AuthorizationResult } from "./authorization-gate";
import { DecisionEngine, type DecisionRequest, type DecisionResult } from "./decision-engine";
import { ProofVerifier } from "./proof-verifier";
import type { EvidenceBundle, TaskSpec } from "./types";

export type ExecutionPhase =
  | "DECIDING"
  | "WAITING_APPROVAL"
  | "AUTHORIZING"
  | "EXECUTING"
  | "VERIFYING"
  | "COMPLETED"
  | "BLOCKED"
  | "FAILED";

export interface ExecutionRequest {
  issueId: string;
  task: TaskSpec;
  repository: string;
  branch: string;
  targetPaths: string[];
  operation: "CREATE" | "UPDATE" | "DELETE";
  toolCommand: string;
  actorAgent?: string;
  decision?: Omit<DecisionRequest, "task">;
  authorization?: Partial<AuthorizationInput>;
  evidence?: EvidenceBundle;
}

export interface ExecutionAdapter {
  execute(input: {
    executionId: string;
    task: TaskSpec;
    decision: DecisionResult;
  }): Promise<{ output: string }>;
}

export interface ExecutionRecord {
  executionId: string;
  issueId: string;
  taskId: string;
  phase: ExecutionPhase;
  decision?: DecisionResult;
  authorization?: AuthorizationResult;
  output?: string;
  verification?: "PASS" | "FAIL" | "PENDING";
  error?: string;
}

export class ExecutionCoordinator {
  constructor(
    private readonly decisionEngine = new DecisionEngine(),
    private readonly authorizationGate = new AuthorizationGate(),
    private readonly proofVerifier = new ProofVerifier(),
  ) {}

  async execute(
    request: ExecutionRequest,
    adapter: ExecutionAdapter,
  ): Promise<ExecutionRecord> {
    const executionId = `exec-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
    const base: ExecutionRecord = {
      executionId,
      issueId: request.issueId,
      taskId: request.task.id ?? `task-${randomUUID().slice(0, 8)}`,
      phase: "DECIDING",
    };

    const decision = this.decisionEngine.decide({
      task: request.task,
      ...request.decision,
      agent: request.actorAgent ?? request.decision?.agent,
    });

    if (decision.verdict === "DENY") {
      return { ...base, phase: "BLOCKED", decision, error: decision.reason };
    }

    if (decision.verdict === "ASK") {
      return { ...base, phase: "WAITING_APPROVAL", decision, error: decision.reason };
    }

    const policyDecision = decision.policy;
    const authInput: AuthorizationInput = {
      issue_id: request.issueId,
      repository: request.repository,
      branch: request.branch,
      target_paths: request.targetPaths,
      operation: request.operation,
      tool_command: request.toolCommand,
      risk: request.task.risk ?? policyDecision.policy?.risk ?? "LOW",
      actor_agent: decision.selectedAgent ?? request.actorAgent ?? "eurinhash",
      requested_capability: request.decision?.requestedMcp
        ? `mcp:${request.decision.requestedMcp}`
        : "filesystem.write",
      working_tree_state: {
        clean: true,
        dirty_files: [],
        untracked_files: [],
        conflicted_files: [],
      },
      policy_decision: policyDecision,
      ...request.authorization,
    };

    const authorization = this.authorizationGate.authorize(authInput);

    if (authorization.decision !== "ALLOW") {
      return {
        ...base,
        phase: authorization.decision === "REQUIRES_APPROVAL" ? "WAITING_APPROVAL" : "BLOCKED",
        decision,
        authorization,
        error: authorization.reason,
      };
    }

    try {
      const execution = await adapter.execute({ executionId, task: request.task, decision });

      const verification =
        decision.policy.proofsRequired.length === 0
          ? "PASS"
          : this.verifyEvidence(request.task, decision, request.evidence);

      if (verification !== "PASS") {
        return {
          ...base,
          phase: "FAILED",
          decision,
          authorization,
          output: execution.output,
          verification,
          error: `Verification ${verification.toLowerCase()}`,
        };
      }

      return {
        ...base,
        phase: "COMPLETED",
        decision,
        authorization,
        output: execution.output,
        verification,
      };
    } catch (error) {
      return {
        ...base,
        phase: "FAILED",
        decision,
        authorization,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private verifyEvidence(
    task: TaskSpec,
    decision: DecisionResult,
    evidence: EvidenceBundle = {},
  ): "PASS" | "FAIL" | "PENDING" {
    if (!decision.policy.policy) return "PASS";
    const chain = this.proofVerifier.generateProofChain(task, decision.policy.policy, evidence);
    return this.proofVerifier.verifyProofChain(chain, task, evidence);
  }
}
