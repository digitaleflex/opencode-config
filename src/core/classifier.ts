import { TaskType, TaskSpec } from "./types";
import { stripInvisibleChars, transliterateToAscii, normalizeForMatching } from "./unicode-normalize";

export { TaskType };

/**
 * Validates task input and returns normalized description.
 * Throws on invalid input (fail-closed).
 */
/** Strip zero-width and other invisible Unicode characters that can bypass detection. */
function stripInvisibleChars(str: string): string {
  // Zero-width space, zero-width non-joiner, zero-width joiner,
  // zero-width no-break space, word joiner, function application, etc.
  return str.replace(/[\u200B-\u200F\uFEFF\u034F\u180E\u200B\u2060\uFE00-\uFE0F]/g, "");
}

/** Transliterate confusable Unicode to ASCII equivalents. */
function transliterateToAscii(str: string): string {
  // Common confusables: Cyrillic → Latin, Greek → Latin
  const confusables: Record<string, string> = {
    // Cyrillic that looks like Latin
    "\u0430": "a", // Cyrillic а → a
    "\u0435": "e", // Cyrillic е → e
    "\u043E": "o", // Cyrillic о → o
    "\u0440": "p", // Cyrillic р → p
    "\u0441": "c", // Cyrillic с → c
    "\u0443": "y", // Cyrillic у → y
    "\u0445": "x", // Cyrillic х → x
    "\u0432": "B", // Cyrillic в → B
    "\u043C": "M", // Cyrillic м → M
    "\u043D": "H", // Cyrillic н → H
    "\u0442": "T", // Cyrillic т → T
    "\u0433": "r", // Cyrillic г → r
    "\u0438": "u", // Cyrillic и → u
    "\u043A": "k", // Cyrillic к → k
    "\u043B": "b", // Cyrillic л → b
    "\u0434": "g", // Cyrillic д → d
    "\u0436": "w", // Cyrillic ж → w
    "\u0437": "z", // Cyrillic з → z
    "\u0439": "u", // Cyrillic й → u
    "\u0444": "A", // Cyrillic ф → A
    "\u0449": "W", // Cyrillic ш → W
    "\u0449": "w", // Cyrillic щ → w
    "\u044A": "b", // Cyrillic ъ → b
    "\u044B": "b", // Cyrillic ы → b
    "\u044C": "b", // Cyrillic ь → b
    "\u044D": "e", // Cyrillic э → e
    "\u044E": "o", // Cyrillic ю → o
    "\u044F": "q", // Cyrillic я → q
    // Fullwidth Latin
    "\uFF21": "A", // Ａ → A
    "\uFF22": "B", // Ｂ → B
    "\uFF23": "C", // Ｃ → C
    "\uFF24": "D", // Ｄ → D
    "\uFF25": "E", // Ｅ → E
    "\uFF26": "F", // Ｆ → F
    "\uFF27": "G", // Ｇ → G
    "\uFF28": "H", // Ｈ → H
    "\uFF29": "I", // Ｉ → I
    "\uFF2A": "J", // Ｊ → J
    "\uFF2B": "K", // Ｋ → K
    "\uFF2C": "L", // Ｌ → L
    "\uFF2D": "M", // Ｍ → M
    "\uFF2E": "N", // Ｎ → N
    "\uFF2F": "O", // Ｏ → O
    "\uFF30": "P", // Ｐ → P
    "\uFF31": "Q", // Ｑ → Q
    "\uFF32": "R", // Ｒ → R
    "\uFF33": "S", // Ｓ → S
    "\uFF34": "T", // Ｔ → T
    "\uFF35": "U", // Ｕ → U
    "\uFF36": "V", // Ｖ → V
    "\uFF37": "W", // Ｗ → W
    "\uFF38": "X", // Ｘ → X
    "\uFF39": "Y", // Ｙ → Y
    "\uFF3A": "Z", // Ｚ → Z
    "\uFF41": "a", // ａ → a
    "\uFF42": "b", // ｂ → b
    "\uFF43": "c", // ｃ → c
    "\uFF44": "d", // ｄ → d
    "\uFF45": "e", // ｅ → e
    "\uFF46": "f", // ｆ → f
    "\uFF47": "g", // ｇ → g
    "\uFF48": "h", // ｈ → h
    "\uFF49": "i", // ｉ → i
    "\uFF4A": "j", // ｊ → j
    "\uFF4B": "k", // ｋ → k
    "\uFF4C": "l", // ｌ → l
    "\uFF4D": "m", // ｍ → m
    "\uFF4E": "n", // ｎ → n
    "\uFF4F": "o", // ｏ → o
    "\uFF50": "p", // ｐ → p
    "\uFF51": "q", // ｑ → q
    "\uFF52": "r", // ｒ → r
    "\uFF53": "s", // ｓ → s
    "\uFF54": "t", // ｔ → t
    "\uFF55": "u", // ｕ → u
    "\uFF56": "v", // ｖ → v
    "\uFF57": "w", // ｗ → w
    "\uFF58": "x", // ｘ → x
    "\uFF59": "y", // ｙ → y
    "\uFF5A": "z", // ｚ → z
    // Greek that looks like Latin
    "\u0391": "A", // Α → A
    "\u0392": "B", // Β → B
    "\u0395": "E", // Ε → E
    "\u0397": "H", // Η → H
    "\u0399": "I", // Ι → I
    "\u039A": "K", // Κ → K
    "\u039C": "M", // Μ → M
    "\u039D": "N", // Ν → N
    "\u039F": "O", // Ο → O
    "\u03A1": "P", // Ρ → P
    "\u03A4": "T", // Τ → T
    "\u03A5": "Y", // Υ → Y
    "\u0396": "Z", // Ζ → Z
    "\u0393": "r", // Γ → r
    "\u0394": "d", // Δ → d
    "\u039B": "A", // Λ → A
    "\u039E": "E", // Ξ → E
    "\u03A0": "n", // Π → n
    "\u03A3": "E", // Σ → E
    "\u03A7": "X", // Χ → X
    "\u03A8": "Y", // Ψ → Y
    "\u03A9": "O", // Ω → O
    "\u03B1": "a", // α → a
    "\u03B2": "B", // β → B
    "\u03B5": "e", // ε → e
    "\u03B7": "n", // η → n
    "\u03B9": "i", // ι → i
    "\u03BA": "k", // κ → k
    "\u03BC": "u", // μ → u
    "\u03BD": "v", // ν → v
    "\u03BF": "o", // ο → o
    "\u03C1": "p", // ρ → p
    "\u03C4": "t", // τ → t
    "\u03C5": "u", // υ → u
    "\u03C7": "x", // χ → x
    "\u03B3": "r", // γ → r
    "\u03B4": "d", // δ → d
    "\u03BB": "A", // λ → A
    "\u03BE": "E", // ξ → E
    "\u03C0": "n", // π → n
    "\u03C3": "o", // σ → o
    "\u03C4": "t", // τ → t
    "\u03C6": "p", // φ → p
    "\u03C8": "Y", // ψ → Y
    "\u03C9": "w", // ω → w
    "\u03D5": "p", // ϕ → p (Greek phi symbol)
    "\u03D6": "n", // ϖ → n (Greek pi symbol)
    // Mongolian vowel separator → nothing
    "\u180E": "",
    // Various invisible/formatting characters
    "\u061C": "", // Arabic letter mark
    "\u200E": "", // Left-to-right mark
    "\u200F": "", // Right-to-left mark
    "\u2028": " ", // Line separator
    "\u2029": " ", // Paragraph separator
    "\u202A": "", // Left-to-right embedding
    "\u202B": "", // Right-to-left embedding
    "\u202C": "", // Pop directional formatting
    "\u202D": "", // Left-to-right override
    "\u202E": "", // Right-to-left override
    "\u2060": "", // Word joiner
    "\u2061": "", // Function application
    "\u2062": "", // Invisible times
    "\u2063": "", // Invisible separator
    "\u2064": "", // Invisible plus
    "\u2066": "", // Left-to-right isolate
    "\u2067": "", // Right-to-left isolate
    "\u2068": "", // First strong isolate
    "\u2069": "", // Pop directional isolate
  };

  let result = str;
  for (const [from, to] of Object.entries(confusables)) {
    result = result.split(from).join(to);
  }
  return result;
}

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
