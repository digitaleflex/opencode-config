// src/core/semantic-judge.ts — Heuristic semantic intent scoring (zero-dep).
// Complements pattern-based injection detection: instead of fixed phrases,
// it scores linguistic signals of instruction-hijack intent (override
// language, persona reassignment, hypothetical framing, directive density,
// fake conversation turns). Catches novel phrasings that regex lists miss,
// without spending a model call. A JudgeProvider interface is exposed so a
// model-backed judge (e.g. a free-tier model, à la
// remorses/opencode-injection-guard) can be plugged in later.

export interface SemanticJudgment {
  score: number; // 0-1, higher = stronger hijack intent
  reasons: string[];
  action: "ALLOW" | "WARN" | "BLOCK";
}

export interface JudgeProvider {
  judge(text: string): Promise<{ flagged: boolean; confidence: number; reason?: string }>;
}

/** No-op provider used when no model-backed judge is configured. */
export class NoopJudgeProvider implements JudgeProvider {
  async judge(_text: string): Promise<{ flagged: boolean; confidence: number; reason?: string }> {
    return { flagged: false, confidence: 0, reason: "no judge configured" };
  }
}

const BLOCK_THRESHOLD = 0.7;
const WARN_THRESHOLD = 0.4;

// Imperative verbs that carry instruction intent (not benign task verbs
// like run/fix/update/refactor, which are deliberately excluded).
const IMPERATIVES = [
  "answer",
  "respond",
  "reveal",
  "ignore",
  "forget",
  "pretend",
  "behave",
  "summarize",
  "summarise",
  "send",
  "execute",
  "disclose",
  "provide",
  "disregard",
  "override",
  "obey",
  "comply",
];

interface Signal {
  name: string;
  weight: number;
  test: (text: string) => boolean;
}

const SIGNALS: Signal[] = [
  {
    name: "override-language",
    weight: 0.5,
    test: (t) =>
      /\b(disregard|override|bypass|circumvent|lift|suspend|drop|disable)\b.{0,40}\b(constraints?|restrictions?|guidelines?|polic(y|ies)|rules?|guardrails?|limits?|filters?)\b/i.test(
        t
      ),
  },
  {
    name: "unrestricted-persona",
    weight: 0.4,
    test: (t) =>
      /\b(unrestricted|unfiltered|uncensored|without (rules|limits|restrictions|constraints))\b/i.test(
        t
      ),
  },
  {
    name: "scope-shift",
    weight: 0.15,
    test: (t) => /\bfrom now on\b|\bfrom this point (forward|on)\b/i.test(t),
  },
  {
    name: "role-reassignment",
    weight: 0.3,
    test: (t) => /\b(answer|act|behave|respond)\b.{0,30}\b(as if|like)\b/i.test(t),
  },
  {
    name: "hypothetical-framing",
    weight: 0.3,
    test: (t) => /\bpretend\b.{0,40}\b(were|was|are|lifted|gone|removed|suspended)\b/i.test(t),
  },
  {
    name: "safety-term-targeting",
    weight: 0.25,
    test: (t) =>
      /\b(safety|security)\b.{0,40}\b(guidelines?|polic(y|ies)|rules?|filters?|constraints?)\b/i.test(
        t
      ),
  },
  {
    name: "fake-conversation",
    weight: 0.5,
    test: (t) => /(^|\n)\s*(user|assistant|system|human)\s*:/i.test(t),
  },
  {
    name: "sensitive-targeting",
    weight: 0.3,
    test: (t) => /\b(secrets?|credentials?|api[_-]?keys?|passwords?|tokens?)\b/i.test(t),
  },
];

function imperativeDensity(text: string): number {
  const words = text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  if (words.length === 0) return 0;
  let hits = 0;
  for (const w of words) {
    if (IMPERATIVES.includes(w)) hits++;
  }
  // Density per 20 words, capped.
  return Math.min((hits / Math.max(words.length, 1)) * 20 * 0.15, 0.3);
}

export function judgeSemantic(text: string): SemanticJudgment {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { score: 0, reasons: [], action: "ALLOW" };
  }

  const reasons: string[] = [];
  let score = 0;

  for (const signal of SIGNALS) {
    try {
      if (signal.test(text)) {
        score += signal.weight;
        reasons.push(signal.name);
      }
    } catch {
      // a broken signal must never fail the whole judgment
    }
  }

  const density = imperativeDensity(text);
  if (density > 0) {
    score += density;
    reasons.push("imperative-density");
  }

  score = Math.min(score, 1);

  let action: SemanticJudgment["action"] = "ALLOW";
  if (score >= BLOCK_THRESHOLD) action = "BLOCK";
  else if (score >= WARN_THRESHOLD) action = "WARN";

  return { score, reasons, action };
}
