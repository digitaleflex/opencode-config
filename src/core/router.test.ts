import { describe, expect, it } from "vitest";
import { Router } from "./router";
import { RiskLevel, TaskComplexity, TaskType } from "./types";

describe("Router", () => {
  it("routes localized bugs toward builder", () => {
    const result = new Router().route({
      task: {
        description: "fix the localized bug in the login form",
        taskType: TaskType.BUG_LOCALIZED,
        complexity: TaskComplexity.L2,
      },
    });

    expect(result.resolved).toBe(true);
    expect(result.agent).toBe("builder");
    expect(result.risk).toBe(RiskLevel.LOW);
  });

  it("routes security work to security when candidates are constrained", () => {
    const result = new Router().route({
      task: {
        description: "perform a security assessment",
        taskType: TaskType.SECURITY,
        complexity: TaskComplexity.L3,
        risk: RiskLevel.HIGH,
      },
      availableAgents: [
        { id: "builder", taskTypes: [TaskType.FEATURE_LIMITED] },
        { id: "security", taskTypes: [TaskType.SECURITY], minComplexity: TaskComplexity.L3 },
      ],
    });

    expect(result.agent).toBe("security");
    expect(result.agentCandidates).toEqual(["security"]);
  });

  it("preserves preferred agent only when it is compatible", () => {
    const result = new Router().route({
      task: {
        description: "design the API boundary",
        taskType: TaskType.API_CHANGE,
        complexity: TaskComplexity.L3,
        risk: RiskLevel.HIGH,
      },
      preferredAgent: "architect",
    });

    expect(result.agent).toBe("architect");
  });

  it("fails closed when no compatible agent exists", () => {
    const result = new Router().route({
      task: {
        description: "deploy to production",
        taskType: TaskType.PRODUCTION_DEPLOY,
        complexity: TaskComplexity.L4,
        risk: RiskLevel.CRITICAL,
      },
      availableAgents: [{ id: "builder", taskTypes: [TaskType.FEATURE_LIMITED] }],
    });

    expect(result.resolved).toBe(false);
    expect(result.agent).toBeUndefined();
  });
});
