import { describe, test, expect } from "vitest";
import { PolicyEngine } from "./policy-engine";
import { TaskType, RiskLevel } from "./types";

describe("PolicyEngine", () => {
  const engine = new PolicyEngine();

  test("loads 4 default policies", () => {
    expect(engine.getPolicyCount()).toBe(4);
  });

  test("L1 task → APPROVED with L1-SIMPLE policy", () => {
    const result = engine.evaluatePolicy({
      description: "fix typo",
      taskType: TaskType.CONFIG,
      risk: RiskLevel.LOW,
    });
    expect(result.decision).toBe("APPROVED");
    expect(result.policy?.name).toBe("L1-SIMPLE");
    expect(result.humanApproval).toBe(false);
  });

  test("L3 task → APPROVED with human approval", () => {
    const result = engine.evaluatePolicy({
      description: "modify API",
      taskType: TaskType.API_CHANGE,
      risk: RiskLevel.HIGH,
    });
    expect(result.decision).toBe("APPROVED");
    expect(result.policy?.name).toBe("L3-COMPLEX");
    expect(result.humanApproval).toBe(true);
  });

  test("no taskType → BLOCKED", () => {
    const result = engine.evaluatePolicy({
      description: "something",
    });
    expect(result.decision).toBe("BLOCKED");
  });

  test("unknown taskType → BLOCKED", () => {
    const result = engine.evaluatePolicy({
      description: "unknown",
      taskType: "UNKNOWN" as TaskType,
      risk: RiskLevel.LOW,
    });
    expect(result.decision).toBe("BLOCKED");
  });
});