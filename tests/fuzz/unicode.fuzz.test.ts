// tests/fuzz/unicode.fuzz.test.ts — Deterministic fuzzing of Unicode
// normalization (ROADMAP #10).
//
// Property: homoglyph / invisible / fullwidth mutations of a destructive
// description must still classify as DESTRUCTIVE_OP (or at minimum be
// BLOCKED by the guards).
//
// Deterministic: seeded LCG, no Math.random.

import { describe, test, expect } from "bun:test";
import { classifyTask, TaskType } from "../../src/core/classifier";
import { GuardOverrides } from "../../src/core/guard-overrides";

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// Latin -> confusable (reverse of the transliteration table)
const CONFUSABLES: Record<string, string> = {
  a: "\u0430", // Cyrillic а
  e: "\u0435", // Cyrillic е
  o: "\u043E", // Cyrillic о
  p: "\u0440", // Cyrillic р
  c: "\u0441", // Cyrillic с
  y: "\u0443", // Cyrillic у
  x: "\u0445", // Cyrillic х
  k: "\u043A", // Cyrillic к
  m: "\u043C", // Cyrillic м
  t: "\u0442", // Cyrillic т
  h: "\u043D", // Cyrillic н
};

const ZERO_WIDTH = ["\u200B", "\u200C", "\u200D", "\uFEFF", "\u2060"];
const FULLWIDTH = (c: string) => String.fromCharCode(0xff01 + (c.charCodeAt(0) - 0x21));

function mutate(text: string, rng: () => number): string {
  const roll = rng();
  const chars = [...text];

  if (roll < 0.4) {
    // Replace some confusable letters
    return chars
      .map((c) => {
        const lower = c.toLowerCase();
        if (CONFUSABLES[lower] && rng() < 0.6) {
          return CONFUSABLES[lower];
        }
        return c;
      })
      .join("");
  }
  if (roll < 0.65) {
    // Insert zero-width characters
    return chars
      .map((c) => {
        if (rng() < 0.3) {
          return ZERO_WIDTH[Math.floor(rng() * ZERO_WIDTH.length)] + c;
        }
        return c;
      })
      .join("");
  }
  if (roll < 0.85) {
    // Fullwidth a run of letters
    return chars.map((c) => (/[a-z]/i.test(c) && rng() < 0.5 ? FULLWIDTH(c) : c)).join("");
  }
  // Mixed: confusable + zero-width
  return chars
    .map((c) => {
      const lower = c.toLowerCase();
      let out = c;
      if (CONFUSABLES[lower] && rng() < 0.5) out = CONFUSABLES[lower];
      if (rng() < 0.2) out = ZERO_WIDTH[Math.floor(rng() * ZERO_WIDTH.length)] + out;
      return out;
    })
    .join("");
}

const DESTRUCTIVE_BASES = [
  "deploy to production",
  "delete the database",
  "drop the production table",
  "destroy the cluster",
];

describe("fuzz: Unicode homoglyph resistance", () => {
  const guards = new GuardOverrides();
  const rng = makeRng(0xbadf00d);
  const iterationsPerBase = 150;
  let checked = 0;

  for (const base of DESTRUCTIVE_BASES) {
    test(`mutations of "${base}" stay destructive/blocked`, () => {
      const counterExamples: string[] = [];
      for (let i = 0; i < iterationsPerBase; i++) {
        const mutated = mutate(base, rng);
        checked++;
        const classified = classifyTask({ description: mutated });
        const guard = guards.check({ description: mutated });
        const ok = classified === TaskType.DESTRUCTIVE_OP || guard.decision === "BLOCKED";
        if (!ok) {
          counterExamples.push(`${JSON.stringify(mutated)} -> ${classified} / ${guard.decision}`);
        }
      }
      if (counterExamples.length > 0) {
        throw new Error(
          `homoglyph bypass for base "${base}" (${counterExamples.length} counter-examples):\n` +
            counterExamples.slice(0, 10).join("\n")
        );
      }
      expect(counterExamples.length).toBe(0);
    });
  }

  test("coverage sanity", () => {
    expect(checked).toBe(DESTRUCTIVE_BASES.length * iterationsPerBase);
  });
});
