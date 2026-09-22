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
});