import { TaskType, TaskSpec } from "./types";

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