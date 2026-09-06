// src/core/policy-engine.ts — Policy Evaluation Engine (no external deps)

import {
  TaskSpec,
  PolicySpec,
  ProofType,
  RiskLevel,
  TaskComplexity,
  TaskType,
  PolicyDecision,
} from "./types";
import { assessRisk } from "./risk-assessor";
import { assessRisk } from "./risk-assessor";

export class PolicyEngine {
  private policies: PolicySpec[] = [];

  constructor() {
    this.policies = this.getDefaultPolicies();
  }

  private getDefaultPolicies(): PolicySpec[] {
    return [
      {
        name: "L1-SIMPLE",
        complexity: TaskComplexity.L1,
        taskTypes: [TaskType.TYPO, TaskType.CONFIG, TaskType.FORMAT],
        risk: RiskLevel.LOW,
        agents: ["builder"],
        modelPlan: {
          primary: ["worker-codestral", "worker-groq"],
          fallback: ["worker-zhipu", "worker-novita"],
        },
        proofsRequired: [],
        humanApproval: false,
        securityScan: false,
      },
      {
        name: "L2-STANDARD",
        complexity: TaskComplexity.L2,
        taskTypes: [
          TaskType.BUG_LOCALIZED,
          TaskType.FEATURE_LIMITED,
          TaskType.REFACTOR_MODULE,
        ],
        risk: RiskLevel.LOW,
        agents: ["planner", "builder", "reviewer"],
        modelPlan: {
          primary: ["worker-codestral", "worker-groq"],
          fallback: ["worker-zhipu", "worker-novita"],
        },
        proofsRequired: [ProofType.TESTS, ProofType.CODE_REVIEW],
        humanApproval: false,
        securityScan: false,
      },
      {
        name: "L3-COMPLEX",
        complexity: TaskComplexity.L3,
        taskTypes: [
          TaskType.API_CHANGE,
          TaskType.ARCH_DESIGN,
          TaskType.SECURITY,
        ],
        risk: RiskLevel.HIGH,
        agents: ["planner", "architect", "builder", "reviewer"],
        modelPlan: {
          primary: ["worker-codestral", "worker-groq"],
          fallback: ["worker-zhipu", "worker-novita"],
        },
        proofsRequired: [
          ProofType.TESTS,
          ProofType.CODE_REVIEW,
          ProofType.SECURITY_SCAN,
        ],
        humanApproval: true,
        securityScan: true,
      },
      {
        name: "L4-CRITICAL",
        complexity: TaskComplexity.L4,
        taskTypes: [
          TaskType.PRODUCTION_DEPLOY,
          TaskType.SENSITIVE_DATA,
          TaskType.DESTRUCTIVE_OP,
        ],
        risk: RiskLevel.CRITICAL,
        agents: ["planner", "architect", "security", "builder", "reviewer"],
        modelPlan: {
          primary: ["worker-codestral", "worker-groq"],
          fallback: ["worker-zhipu", "worker-novita"],
        },
        proofsRequired: [
          ProofType.TESTS,
          ProofType.CODE_REVIEW,
          ProofType.SECURITY_SCAN,
          ProofType.HUMAN_APPROVAL,
        ],
        humanApproval: true,
        securityScan: true,
      },
    ];
  }

  /**
   * Evaluate a task against loaded policies and return the matching policy decision.
   */
  evaluatePolicy(task: TaskSpec): PolicyDecision {
    // Find matching policy - use risk from task (already assessed by orchestrator)
    const taskRisk = task.risk || assessRisk(task);
    
    if (!task.taskType) { return { decision: "BLOCKED" as const, policy: null, proofsRequired: [], humanApproval: false, reason: "No taskType provided" }; }

    const matchingPolicy = this.policies.find((policy) =>
      policy.taskTypes.includes(task.taskType!) &&
      policy.risk === taskRisk
    );

    if (!matchingPolicy) {
      // No matching policy found - fail closed for security
      return {
        decision: "BLOCKED",
        policy: null,
        proofsRequired: [],
        humanApproval: false,
        reason: "No matching policy found - task blocked by default",
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

  getPolicyCount(): number {
    return this.policies.length;
  }
}