// src/core/policy-engine.ts — Policy Evaluation Engine (no external deps)

import {
  TaskSpec,
  PolicySpec,
  ProofType,
  RiskLevel,
  TaskComplexity,
  TaskType,
  PolicyDecision,
  ModelPlan,
} from "./types";
import { assessRisk } from "./risk-assessor";
import { filterModelPlan, loadRegistry, type CostRegistry, type EngineMode } from "./mode";

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
          fallback: ["worker-zhipu", "worker-novita", "worker-google"],
        },
        proofsRequired: [],
        humanApproval: false,
        securityScan: false,
      },
      {
        name: "L2-STANDARD",
        complexity: TaskComplexity.L2,
        taskTypes: [TaskType.BUG_LOCALIZED, TaskType.FEATURE_LIMITED, TaskType.REFACTOR_MODULE],
        risk: RiskLevel.LOW,
        agents: ["planner", "builder", "reviewer"],
        modelPlan: {
          primary: ["worker-codestral", "worker-groq"],
          fallback: ["worker-zhipu", "worker-novita", "worker-google"],
        },
        proofsRequired: [ProofType.TESTS, ProofType.CODE_REVIEW],
        humanApproval: false,
        securityScan: false,
      },
      {
        name: "L3-COMPLEX",
        complexity: TaskComplexity.L3,
        taskTypes: [TaskType.API_CHANGE, TaskType.ARCH_DESIGN, TaskType.SECURITY],
        risk: RiskLevel.HIGH,
        agents: ["planner", "architect", "builder", "reviewer"],
        modelPlan: {
          primary: ["worker-codestral", "worker-groq"],
          fallback: ["worker-zhipu", "worker-novita", "worker-google"],
        },
        proofsRequired: [ProofType.TESTS, ProofType.CODE_REVIEW, ProofType.SECURITY_SCAN],
        humanApproval: true,
        securityScan: true,
      },
      {
        name: "L4-CRITICAL",
        complexity: TaskComplexity.L4,
        taskTypes: [TaskType.PRODUCTION_DEPLOY, TaskType.SENSITIVE_DATA, TaskType.DESTRUCTIVE_OP],
        risk: RiskLevel.CRITICAL,
        agents: ["planner", "architect", "security", "builder", "reviewer"],
        modelPlan: {
          primary: ["worker-codestral", "worker-groq"],
          fallback: ["worker-zhipu", "worker-novita", "worker-google"],
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
  evaluatePolicy(
    task: TaskSpec,
    mode: EngineMode = "free",
    registry?: CostRegistry
  ): PolicyDecision {
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
    const matchingPolicy = this.policies.find(
      (policy) =>
        policy.taskTypes.includes(task.taskType!) &&
        policy.complexity === (task.complexity || this.inferComplexity(task.taskType!))
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

    // Enforce engine mode on the worker plan: in "free" mode only
    // free/trial workers survive; empty plan => BLOCKED fail-closed.
    const reg = registry ?? loadRegistry();
    const effectivePlan = filterModelPlan(matchingPolicy.modelPlan, mode, reg);
    if (!effectivePlan) {
      return {
        decision: "BLOCKED",
        policy: matchingPolicy,
        proofsRequired: [...matchingPolicy.proofsRequired],
        humanApproval: matchingPolicy.humanApproval,
        reason: `No ${mode}-mode workers left in policy ${matchingPolicy.name} — task blocked`,
      };
    }
    const effectivePolicy: PolicySpec = { ...matchingPolicy, modelPlan: effectivePlan };

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
      policy: effectivePolicy,
      proofsRequired,
      humanApproval,
      reason: `Matched policy: ${matchingPolicy.name}${taskRisk !== matchingPolicy.risk ? ` (escalated from ${matchingPolicy.risk} to ${taskRisk})` : ""}`,
    };
  }

  /**
   * Infer complexity from taskType when not explicitly provided.
   */
  private inferComplexity(taskType: TaskType): TaskComplexity {
    const l1Types = [
      TaskType.TYPO,
      TaskType.CONFIG,
      TaskType.FORMAT,
      TaskType.DOC_READ,
      TaskType.DOC_WRITE,
    ];
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
      const parsed = this.parseYaml(yamlContent) as Record<string, unknown>;

      if (parsed && Array.isArray(parsed.policies)) {
        const policies: PolicySpec[] = parsed.policies.map((p: Record<string, unknown>) => ({
          name: p.name as string,
          complexity: p.complexity as TaskComplexity,
          taskTypes: (p.taskTypes || p.tasktypes) as TaskType[],
          risk: p.risk as RiskLevel,
          agents: p.agents as string[],
          modelPlan: PolicyEngine.parseModelPlan(p),
          proofsRequired: (p.proofsRequired || p.proofsrequired || []) as ProofType[],
          humanApproval: p.humanApproval as boolean,
          securityScan: p.securityScan as boolean,
        }));
        this.policies = policies;
      }
    } catch (error) {
      // Fail closed: on invalid YAML, keep default policies and log error
      console.error("[PolicyEngine] Invalid YAML policy, using defaults:", error);
      this.policies = this.getDefaultPolicies();
    }
  }

  /**
   * Extract a ModelPlan from a parsed policy object. Handles both inline
   * `{ primary: [...], fallback: [...] }` values and the nested mapping
   * form parsed into stray `primary`/`fallback` keys. Missing plan yields
   * empty lists (callers fail closed on empty plans).
   */
  private static parseModelPlan(p: Record<string, unknown>): ModelPlan {
    const direct = p.modelPlan ?? p.modelplan;
    if (direct && typeof direct === "object" && !Array.isArray(direct)) {
      const d = direct as Record<string, unknown>;
      return {
        primary: Array.isArray(d.primary) ? (d.primary as string[]) : [],
        fallback: Array.isArray(d.fallback) ? (d.fallback as string[]) : [],
      };
    }
    const primary = p.primary;
    const fallback = p.fallback;
    return {
      primary: Array.isArray(primary) ? (primary as string[]) : [],
      fallback: Array.isArray(fallback) ? (fallback as string[]) : [],
    };
  }

  /**
   * Lightweight YAML parser (zero-dependency subset).
   * Parses the EURINHASH policy YAML format: lists of objects with scalars.
   */
  private parseYaml(content: string): unknown {
    if (!content || content.trim().length === 0) {
      throw new Error("Empty YAML content");
    }

    const lines = content.split("\n");
    const result: unknown[] = [];
    let currentObj: Record<string, unknown> | null = null;
    let currentKey = "";
    let inList = false;
    let listTarget: unknown[] | null = null;
    let currentArrayKey = "";

    for (const rawLine of lines) {
      const line = rawLine.replace(/\r$/, "").trimEnd();
      if (line.trim().startsWith("#") || line.trim() === "" || line.trim() === "---") continue;

      const indent = line.length - line.trimStart().length;
      const trimmed = line.trim();

      // Top-level list item: "- name: ..."
      if (trimmed.startsWith("- ") && indent <= 2) {
        const inner = trimmed.slice(2);
        const colonIdx = inner.indexOf(":");
        if (colonIdx > 0) {
          currentObj = {};
          const key = inner.slice(0, colonIdx).trim().replace(/_/g, "");
          const val = inner.slice(colonIdx + 1).trim();
          currentObj[key] = this.parseYamlValue(val);
          result.push(currentObj);
        }
        inList = false;
        listTarget = null;
        continue;
      }

      if (!currentObj) continue;

      // Nested list item (e.g., "  - [task_type]")
      if (trimmed.startsWith("- ") && inList && listTarget) {
        const val = trimmed.slice(2).trim();
        listTarget.push(this.parseYamlValue(val));
        continue;
      }

      const colonIdx = trimmed.indexOf(":");
      if (colonIdx <= 0) continue;

      const key = trimmed.slice(0, colonIdx).trim().replace(/_/g, "");
      const val = trimmed.slice(colonIdx + 1).trim();

      if (val === "" || val === "[]") {
        // Could be a nested object or array
        inList = true;
        listTarget = [];
        currentArrayKey = key;
        currentObj[key] = listTarget;
        continue;
      }

      inList = false;
      listTarget = null;
      currentObj[key] = this.parseYamlValue(val);
    }

    // Wrap in { policies: [...] } structure
    if (
      result.length > 0 &&
      result[0] &&
      typeof result[0] === "object" &&
      "name" in (result[0] as Record<string, unknown>)
    ) {
      return { policies: result };
    }

    return result;
  }

  private parseYamlValue(val: string): unknown {
    if (val === "true") return true;
    if (val === "false") return false;
    if (val === "null") return null;

    // Array: "[a, b, c]"
    if (val.startsWith("[") && val.endsWith("]")) {
      const inner = val.slice(1, -1).trim();
      if (inner === "") return [];
      return inner.split(",").map((s) => this.parseYamlValue(s.trim()));
    }

    // Nested object: "{ a: b }"
    if (val.startsWith("{") && val.endsWith("}")) {
      const inner = val.slice(1, -1).trim();
      if (inner === "") return {};
      const obj: Record<string, unknown> = {};
      for (const pair of inner.split(",")) {
        const [k, v] = pair.split(":").map((s) => s.trim());
        if (k) obj[k.replace(/_/g, "")] = this.parseYamlValue(v || "");
      }
      return obj;
    }

    // Number
    if (/^\d+$/.test(val)) return parseInt(val, 10);
    if (/^\d+\.\d+$/.test(val)) return parseFloat(val);

    // Unquoted string
    return val;
  }

  getPolicyCount(): number {
    return this.policies.length;
  }
}
