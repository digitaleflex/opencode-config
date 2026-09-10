// tests/fuzz/shell-canonicalizer.fuzz.test.ts — Deterministic fuzzing of the
// shell canonicalizer / guard bypass surface (ROADMAP #10).
//
// Property: any mutation of a destructive base command must still be BLOCKED
// by GuardOverrides.check(). Mutations cover $IFS forms, backslash escapes,
// $()/backticks, quoted concatenation and whitespace variants.
//
// Deterministic: a seeded LCG drives the mutators, no Math.random.

import { describe, test, expect } from "bun:test";
import { GuardOverrides } from "../../src/core/guard-overrides";

// --- Deterministic PRNG (LCG) ---
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const BASE_COMMANDS = [
  "rm -rf /",
  "rm -rf /*",
  "rm -rf *",
  "dd if=/dev/zero of=/dev/sda",
  "mkfs.ext4 /dev/sda",
  "shutdown -h now",
];

const SPACE_FORMS = [" ", "$IFS", "${IFS}", "${IFS:0:1}", "\\ ", "\t"];

function mutate(command: string, rng: () => number): string {
  const roll = rng();
  let out = command;

  if (roll < 0.35) {
    // Replace some spaces with an IFS/escape variant
    const parts = out.split(" ");
    out = parts
      .map((p, i) => {
        if (i === 0) return p;
        return (rng() < 0.7 ? SPACE_FORMS[Math.floor(rng() * SPACE_FORMS.length)] : " ") + p;
      })
      .join("");
  } else if (roll < 0.5) {
    // Backslash-escape a random character
    const idx = 1 + Math.floor(rng() * (out.length - 1));
    out = out.slice(0, idx) + "\\" + out.slice(idx);
  } else if (roll < 0.65) {
    // Inject a command substitution
    const idx = out.indexOf(" ");
    const at = idx > 0 ? idx : Math.floor(out.length / 2);
    out = out.slice(0, at) + "$(echo x)" + out.slice(at);
  } else if (roll < 0.78) {
    // Backtick substitution
    const idx = out.indexOf(" ");
    const at = idx > 0 ? idx : Math.floor(out.length / 2);
    out = out.slice(0, at) + "`echo x`" + out.slice(at);
  } else if (roll < 0.9) {
    // Quote one token
    const parts = out.split(" ");
    const i = Math.floor(rng() * parts.length);
    parts[i] = `"${parts[i]}"`;
    out = parts.join(" ");
  } else {
    // Mixed case
    out = out
      .split("")
      .map((c) => (rng() < 0.5 ? c.toUpperCase() : c.toLowerCase()))
      .join("");
  }

  return out;
}

describe("fuzz: shell canonicalizer bypass resistance", () => {
  const guards = new GuardOverrides();
  const rng = makeRng(0xc0ffee);
  const iterationsPerBase = 120;
  let checked = 0;

  for (const base of BASE_COMMANDS) {
    test(`all mutations of "${base}" stay BLOCKED`, () => {
      const counterExamples: string[] = [];
      for (let i = 0; i < iterationsPerBase; i++) {
        const mutated = mutate(base, rng);
        const result = guards.check({ description: mutated });
        checked++;
        if (result.decision !== "BLOCKED") {
          counterExamples.push(
            `${JSON.stringify(mutated)} -> ${result.decision} (${result.reason})`
          );
        }
      }
      if (counterExamples.length > 0) {
        throw new Error(
          `bypass found for base "${base}" (${counterExamples.length} counter-examples):\n` +
            counterExamples.slice(0, 10).join("\n")
        );
      }
      expect(counterExamples.length).toBe(0);
    });
  }

  test("coverage sanity", () => {
    expect(checked).toBe(BASE_COMMANDS.length * iterationsPerBase);
  });
});
