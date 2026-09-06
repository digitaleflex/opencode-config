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
   * Matches by taskType and complexity, then escalates based on assessed risk.
   */
  evaluatePolicy(task: TaskSpec): PolicyDecision {
    if (!task.taskType) {
      return {
        decision: "BLOCKED",
        policy: null,
        proofsRequired: [],
        humanApproval: false,
        reason: "No taskType provided",
      };
    }

    // Assess risk using the centralized risk assessor
    const taskRisk = task.risk || assessRisk(task);
    
    // Find matching policy by taskType and complexity (not risk)
    const matchingPolicy = this.policies.find((policy) =>
      policy.taskTypes.includes(task.taskType!) &&
      policy.complexity === (task.complexity || this.inferComplexity(task.taskType))
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

    // Escalate decision based on assessed risk
    let decision: PolicyDecision["decision"] = "APPROVED";
    let humanApproval = matchingPolicy.humanApproval;
    let proofsRequired = [...matchingPolicy.proofsRequired];

    // If assessed risk is higher than policy risk, escalate
    if (this.isRiskHigher(taskRisk, matchingPolicy.risk)) {
      decision = "REQUIRES_HUMAN";
      humanApproval = true;
      if (!proofsRequired.includes(ProofType.HUMAN_APPROVAL)) {
        proofsRequired.push(ProofType.HUMAN_APPROVAL);
      }
      if (!proofsRequired.includes(ProofType.SECURITY_SCAN)) {
        proofsRequired.push(ProofType.SECURITY_SCAN);
      }
    }

    return {
      decision,
      policy: matchingPolicy,
      proofsRequired,
      humanApproval,
      reason: `Matched policy: ${matchingPolicy.name}${taskRisk !== matchingPolicy.risk ? ` (escalated from ${matchingPolicy.risk} to ${taskRisk})` : ""}`,
    };
  }

  /**
   * Infer complexity from taskType when not explicitly provided.
   */
  private inferComplexity(taskType: TaskType): TaskComplexity {
    const l1Types = [TaskType.TYPO, TaskType.CONFIG, TaskType.FORMAT, TaskType.DOC_READ, TaskType.DOC_WRITE];
    const l2Types = [TaskType.BUG_LOCALIZED, TaskType.FEATURE_LIMITED, TaskType.REFACTOR_MODULE];
    const l3Types = [TaskType.API_CHANGE, TaskType.ARCH_DESIGN, TaskType.SECURITY];
    const l4Types = [TaskType.PRODUCTION_DEPLOY, TaskType.SENSITIVE_DATA, TaskType.DESTRUCTIVE_OP];

    if (l1Types.includes(taskType)) return TaskComplexity.L1;
    if (l2Types.includes(taskType)) return TaskComplexity.L2;
    if (l3Types.includes(taskType)) return TaskComplexity.L3;
    if (l4Types.includes(taskType)) return TaskComplexity.L4;
    return TaskComplexity.L2; // Default to L2 for unknown types
  }

  /**
   * Compare risk levels: returns true if a > b
   */
  private isRiskHigher(a: RiskLevel, b: RiskLevel): boolean {
    const order = { [RiskLevel.LOW]: 1, [RiskLevel.HIGH]: 2, [RiskLevel.CRITICAL]: 3 };
    return order[a] > order[b];
  }

  /**
   * Load policies from YAML file (with error handling for invalid YAML).
   */
  loadPoliciesFromYaml(yamlContent: string): void {
    try {
      // Simple YAML parsing - in production use a proper YAML parser
      // This is a placeholder for the actual implementation
      const parsed = this.parseYaml(yamlContent);
      if (Array.isArray(parsed)) {
        this.policies = parsed;
      }
    } catch (error) {
      // Fail closed: on invalid YAML, keep default policies and log error
      console.error("[PolicyEngine] Invalid YAML policy, using defaults:", error);
      this.policies = this.getDefaultPolicies();
    }
  }

  /**
   * Simple YAML parser placeholder - replace with js-yaml in production.
   */
  private parseYaml(content: string): unknown {
    // Minimal implementation - throws on invalid YAML
    if (!content || content.trim().length === 0) {
      throw new Error("Empty YAML content");
    }
    // In production: return require('js-yaml').load(content);
    throw new Error("YAML parsing not implemented - use default policies");
  }

  getPolicyCount(): number {
    return this.policies.length;
  }
}