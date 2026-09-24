import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logGovernanceEvent } from "./governance-events";

const tick = () => new Promise((r) => setTimeout(r, 50));

describe("governance-events", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "gov-ev-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function lines(): Promise<string[]> {
    await tick(); // laisse l'écriture fire-and-forget se terminer
    const file = join(dir, `audit-${new Date().toISOString().split("T")[0]}.jsonl`);
    const raw = await readFile(file, "utf-8");
    return raw.split("\n").filter(Boolean);
  }

  test("écrit un event governance.* corrélable par taskId", async () => {
    logGovernanceEvent(
      "governance.policy",
      { taskId: "task-test-1", decision: "APPROVED", policy: "L1-SIMPLE" },
      dir
    );
    const [line] = await lines();
    const e = JSON.parse(line);
    expect(e.event).toBe("governance.policy");
    expect(e.taskId).toBe("task-test-1");
    expect(e.policy).toBe("L1-SIMPLE");
    expect(typeof e.ts).toBe("string");
  });

  test("redacte les secrets sans casser l'écriture", async () => {
    logGovernanceEvent(
      "governance.guard",
      { taskId: "t2", decision: "BLOCKED", apiKey: "sk-live-123", reason: "x" },
      dir
    );
    const [line] = await lines();
    expect(line).not.toContain("sk-live-123");
    expect(JSON.parse(line).decision).toBe("BLOCKED");
  });

  test("flag sensitive sur pattern dangereux", async () => {
    logGovernanceEvent(
      "governance.classify",
      { taskId: "t3", decision: "APPROVED", taskType: "CONFIG", description: "DROP TABLE users" },
      dir
    );
    const [line] = await lines();
    expect(JSON.parse(line).sensitive).toBe(true);
  });

  test("ne throw jamais (dir inexistant/invalide)", () => {
    expect(() =>
      logGovernanceEvent("governance.risk", { taskId: "t4", decision: "APPROVED" }, "\0invalid")
    ).not.toThrow();
  });
});
