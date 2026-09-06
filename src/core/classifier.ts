export enum TaskComplexity {
  L1 = "L1",
  L2 = "L2",
  L3 = "L3",
  L4 = "L4",
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
  risk?: "LOW" | "HIGH" | "CRITICAL";
  scope?: string[];
  operation?: string;
  environment?: "development" | "staging" | "production";
  data?: Record<string, unknown>;
}

export function classifyTask(task: TaskSpec): TaskType {
  const desc = task.description.toLowerCase();
  const scope = task.scope?.join(" ").toLowerCase() || "";

  // L1 - Simple
  if (
    desc.includes("typo") ||
    desc.includes("fix") ||
    desc.includes("config") ||
    desc.includes("format") ||
    desc.includes("readme")
  ) {
    return TaskType.CONFIG;
  }

  // L2 - Standard
  if (
    desc.includes("bug") ||
    desc.includes("feature") ||
    desc.includes("refactor") ||
    desc.includes("add") ||
    desc.includes("fix") ||
    desc.includes("change")
  ) {
    return TaskType.FEATURE_LIMITED;
  }

  // L3 - Complex
  if (
    desc.includes("api") ||
    desc.includes("change") ||
    desc.includes("design") ||
    desc.includes("architecture") ||
    desc.includes("integrate")
  ) {
    return TaskType.API_CHANGE;
  }

  // L4 - Critical
  if (
    desc.includes("deploy") ||
    desc.includes("production") ||
    desc.includes("drop database") ||
    desc.includes("delete") ||
    desc.includes("rm -rf") ||
    desc.includes("destructive")
  ) {
    return TaskType.DESTRUCTIVE_OP;
  }

  // Default
  return TaskType.FEATURE_LIMITED;
}