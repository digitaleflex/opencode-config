import { TaskType, TaskSpec } from "./types";
import { stripInvisibleChars, transliterateToAscii, normalizeForMatching, normalizeForMatchingVariants } from "./unicode-normalize";

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
  // NFC normalization + strip invisible chars. Transliteration happens in
  // classifyTask via normalizeForMatchingVariants so ambiguous homoglyphs
  // (Cyrillic er) can be matched in both readings.
  desc = stripInvisibleChars(desc.normalize("NFC"));
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
  const raw = validateAndNormalize(task);

  // Match against every plausible homoglyph normalization (Cyrillic er is
  // ambiguous between p/r) so a mutated keyword cannot slip through.
  const variants = normalizeForMatchingVariants(raw).map((v) => v.toLowerCase());
  const primary = variants[0];
  const has = (kw: string) => variants.some((v) => v.includes(kw));

  // R-004: Reject ambiguous descriptions (only very short generic ones)
  if (isAmbiguous(primary)) {
    throw new Error("Ambiguous task description: cannot classify safely — please provide specific intent");
  }

  // Destructive/critical keywords must be checked FIRST — a destructive task
  // mentioning "fix"/"config" would otherwise be misclassified as L1 and under-governed
  if (
    has("deploy") ||
    has("production") ||
    has("drop database") ||
    has("drop table") ||
    has("delete") ||
    has("rm -rf") ||
    has("destroy") ||
    has("truncate") ||
    has("wipe") ||
    has("erase") ||
    has("destructive")
  ) {
    return TaskType.DESTRUCTIVE_OP;
  }

  // L3 - Complex (check BEFORE L2 to catch "design", "architecture", "api" in complex tasks)
  if (
    has("api") ||
    has("design") ||
    has("architecture") ||
    has("integrate") ||
    has("microservice") ||
    has("boundary") ||
    has("system design")
  ) {
    return TaskType.API_CHANGE;
  }

  // L1 - Simple
  if (
    has("typo") ||
    has("fix") ||
    has("config") ||
    has("format") ||
    has("readme")
  ) {
    return TaskType.CONFIG;
  }

  // L2 - Standard
  if (
    has("bug") ||
    has("feature") ||
    has("refactor") ||
    has("add") ||
    has("fix") ||
    has("change")
  ) {
    return TaskType.FEATURE_LIMITED;
  }

  // Default
  return TaskType.FEATURE_LIMITED;
}
