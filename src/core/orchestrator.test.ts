import { describe, test, expect } from "vitest";
import { GovernanceOrchestrator } from "./orchestrator";
import { TaskType } from "./types";

describe("GovernanceOrchestrator", () => {
  const orchestrator = new GovernanceOrchestrator();

  test("returns version info", () => {
    const summary = orchestrator.getSummary();
    expect(summary.version).toBe("0.10.0");
    expect(summary.policiesLoaded).toBeGreaterThan(0);
  });

  test("L1 task → APPROVED", async () => {
    const result = await orchestrator.execute({
      description: "fix typo in README",
    });
    expect(result.verdict).toBe("APPROVED");
    expect(result.taskType).toBeDefined();
  });

  test("destructive task → BLOCKED", async () => {
    const result = await orchestrator.execute({
      description: "rm -rf /important/data",
    });
    expect(result.verdict).toBe("BLOCKED");
  });

  test("empty description → BLOCKED (fail-closed)", async () => {
    const result = await orchestrator.execute({
      description: "",
    });
    expect(result.verdict).toBe("BLOCKED");
  });

  test("null task → BLOCKED (fail-closed)", async () => {
    const result = await orchestrator.execute(null as any);
    expect(result.verdict).toBe("BLOCKED");
  });

  test("D1: stub executor → output+provider intégrés, verdict intact", async () => {
    const withExec = new GovernanceOrchestrator(undefined, null, async (prompt: string) => ({
      success: true,
      output: `stubbed:${prompt.slice(0, 8)}`,
      provider: "stub-worker",
    }));
    const result = await withExec.execute({ description: "fix typo in README" });
    expect(result.verdict).toBe("APPROVED");
    expect(result.output).toBe("stubbed:fix typo");
    expect(result.provider).toBe("stub-worker");
  });

  test("D1: sans exécuteur → pas d'output, verdict intact (hermétique)", async () => {
    const result = await orchestrator.execute({ description: "fix typo in README" });
    expect(result.verdict).toBe("APPROVED");
    expect(result.output).toBeUndefined();
    expect(result.provider).toBeUndefined();
  });

  test("D1: exécuteur en échec → verdict APPROVED conservé, pas d'output", async () => {
    const failing = new GovernanceOrchestrator(undefined, null, async () => ({
      success: false,
      error: "quota épuisé",
      provider: "stub-worker",
    }));
    const result = await failing.execute({ description: "fix typo in README" });
    expect(result.verdict).toBe("APPROVED");
    expect(result.output).toBeUndefined();
  });

  test("D1: exécuteur qui throw → verdict APPROVED conservé", async () => {
    const throwing = new GovernanceOrchestrator(undefined, null, async () => {
      throw new Error("boom réseau");
    });
    const result = await throwing.execute({ description: "fix typo in README" });
    expect(result.verdict).toBe("APPROVED");
    expect(result.output).toBeUndefined();
  });

  test("D1: tâche BLOCKED → exécuteur jamais appelé", async () => {
    let called = 0;
    const o = new GovernanceOrchestrator(undefined, null, async () => {
      called++;
      return { success: true, output: "x", provider: "stub" };
    });
    const result = await o.execute({ description: "rm -rf /important/data" });
    expect(result.verdict).toBe("BLOCKED");
    expect(called).toBe(0);
    expect(result.output).toBeUndefined();
  });
});