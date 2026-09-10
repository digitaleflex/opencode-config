import { TaskType, TaskSpec } from "./types";
import { stripInvisibleChars, transliterateToAscii, normalizeForMatching } from "./unicode-normalize";

export { TaskType };

function validateAndNormalize(task: TaskSpec): string {
  if (!task || typeof task !== "object") {
    throw new Error("Invalid task: not an object");
  }
  if (!task.description || typeof task.description !== "string") {
    throw new Error("Invalid task: description must be a non-empty string");
  }
  let desc = task.description.trim();
  if (desc.length === 0) {
    throw new Error("Invalid task: description cannot be empty or whitespace");
  }
  if (desc.length > 5000) {
    throw new Error("Invalid task: description too long (max 5000 chars)");
  }
  // NFC normalization + strip invisible chars + transliterate confusables
  desc = normalizeForMatching(desc);
  return desc.toLowerCase();
}

/**
 * Checks if description is too ambiguous to classify safely.
 * Returns true if the task should be rejected (BLOCKED).
 * Only matches very short, generic descriptions (3 words or less, no specific nouns)
 */
function isAmbiguous(desc: string): boolean {
  const words = desc.split(/\s+/);
  if (words.length > 4) return false; // Specific tasks have more words
  
  const ambiguousPatterns = [
    /^make things? (better|good|work)$/i,
    /^improve (it|things?|code|system)$/i,
    /^help$/i,
    /^please (help|fix|improve)(\s+\w+)?$/i,  // allow one extra word
    /^do (it|this|something)$/i,
    /^fix (it|this|stuff|things?)$/i,
    /^make it (work|better|fast)$/i,
    /^optimize$/i,
    /^refactor$/i,
    /^clean up$/i,
  ];
  return ambiguousPatterns.some((p) => p.test(desc));
}

export function classifyTask(task: TaskSpec): TaskType {
  // R-001: Validate input first (fail-closed)
  const desc = validateAndNormalize(task);

  // R-004: Reject ambiguous descriptions (only very short generic ones)
  if (isAmbiguous(desc)) {
    throw new Error("Ambiguous task description: cannot classify safely — please provide specific intent");
  }

  // Destructive/critical keywords must be checked FIRST — a destructive task
  // mentioning "fix"/"config" would otherwise be misclassified as L1 and under-governed
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

  // L3 - Complex (check BEFORE L2 to catch "design", "architecture", "api" in complex tasks)
  if (
    desc.includes("api") ||
    desc.includes("design") ||
    desc.includes("architecture") ||
    desc.includes("integrate") ||
    desc.includes("microservice") ||
    desc.includes("boundary") ||
    desc.includes("system design")
  ) {
    return TaskType.API_CHANGE;
  }

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

  // Default
  return TaskType.FEATURE_LIMITED;
}
