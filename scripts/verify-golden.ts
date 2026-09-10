// scripts/verify-golden.ts — Golden attack corpus gate.
//
// Every attack case in tests/fixtures/attacks.jsonl must produce its
// expected verdict. A fresh orchestrator is used per case so results are
// deterministic and attributable (no cross-case anomaly accumulation).
// Exit code 1 on any mismatch — this is a CI gate.
//
// Run: bun run scripts/verify-golden.ts  (or: bun run test:golden)

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GovernanceOrchestrator } from "../src/core/orchestrator";

interface GoldenCase {
  description: string;
  operation?: string;
  expect: "BLOCKED" | "APPROVED";
  note?: string;
}

async function main(): Promise<void> {
  const file = join(__dirname, "..", "tests", "fixtures", "attacks.jsonl");
  const raw = readFileSync(file, "utf8").split("\n");

  let pass = 0;
  let fail = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (let i = 0; i < raw.length; i++) {
    const line = raw[i].trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) {
      skipped++;
      continue;
    }

    let c: GoldenCase;
    try {
      c = JSON.parse(line) as GoldenCase;
    } catch (e) {
      fail++;
      failures.push(`line ${i + 1}: invalid JSON (${(e as Error).message})`);
      console.log(`FAIL [${i + 1}] invalid JSON`);
      continue;
    }

    if (c.expect !== "BLOCKED" && c.expect !== "APPROVED") {
      fail++;
      failures.push(
        `line ${i + 1}: bad expect value ${JSON.stringify((c as { expect: unknown }).expect)}`
      );
      console.log(`FAIL [${i + 1}] bad expect value`);
      continue;
    }

    const orchestrator = new GovernanceOrchestrator();
    const task: { description: string; operation?: string } = { description: c.description };
    if (c.operation !== undefined) task.operation = c.operation;

    const result = await orchestrator.execute(task);
    const short = c.description.slice(0, 64);
    if (result.verdict === c.expect) {
      pass++;
      console.log(`ok   [${i + 1}] ${c.expect.padEnd(8)} :: ${short}`);
    } else {
      fail++;
      failures.push(
        `line ${i + 1}: expected ${c.expect}, got ${result.verdict} :: ${short} (${c.note ?? "no note"})`
      );
      console.log(`FAIL [${i + 1}] expected ${c.expect}, got ${result.verdict} :: ${short}`);
    }
  }

  console.log(`\ngolden: ${pass} pass, ${fail} fail, ${skipped} skipped`);
  if (fail > 0) {
    console.log("failures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("verify-golden fatal:", e);
  process.exit(1);
});
