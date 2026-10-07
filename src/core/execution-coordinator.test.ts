import { describe, expect, it, vi } from "vitest";
import { AuthorizationGate } from "./authorization-gate";
import { DecisionEngine } from "./decision-engine";
import { ExecutionCoordinator } from "./execution-coordinator";
import { TaskType } from "./types";

describe("ExecutionCoordinator", () => {
  it("stops before authorization when the decision is denied", async () => {
    const coordinator = new ExecutionCoordinator();
    const adapter = { execute: vi.fn() };

    const result = await coordinator.execute({
      issueId: "issue-1",
      task: { id: "task-1", description: "Fix bug", taskType: TaskType.BUG_LOCALIZED },
      repository: "config",
      branch: "refactor/slim-integration",
      targetPaths: ["src/example.ts"],
      operation: "UPDATE",
      toolCommand: "edit:src/example.ts",
      decision: { requiredSkill: "missing-skill", configLayers: [{ source: "default", agents: { planner: { skills: [] } } }] },
    }, adapter);

    expect(result.phase).toBe("BLOCKED");
    expect(adapter.execute).not.toHaveBeenCalled();
  });

  it("waits for human approval when policy requires it", async () => {
    const result = await new ExecutionCoordinator().execute({
      issueId: "issue-2",
      task: { id: "task-2", description: "Change API", taskType: TaskType.API_CHANGE },
      repository: "config",
      branch: "refactor/slim-integration",
      targetPaths: ["src/api.ts"],
      operation: "UPDATE",
      toolCommand: "edit:src/api.ts",
    }, { execute: vi.fn() });

    expect(result.phase).toBe("WAITING_APPROVAL");
  });

  it("runs the adapter only after an explicit authorization result", async () => {
    const gate = new AuthorizationGate();
    vi.spyOn(gate, "authorize").mockReturnValue({
      decision: "ALLOW",
      reason: "test authorization",
      scope: { repository: "config", branch: "refactor/slim-integration", paths: ["src/example.ts"], operations: ["UPDATE"] },
      audit_id: "audit-test",
    });

    const adapter = { execute: vi.fn().mockResolvedValue({ output: "ok" }) };
    const coordinator = new ExecutionCoordinator(new DecisionEngine(), gate);

    const result = await coordinator.execute({
      issueId: "issue-3",
      task: { id: "task-3", description: "Fix localized bug", taskType: TaskType.BUG_LOCALIZED },
      repository: "config",
      branch: "refactor/slim-integration",
      targetPaths: ["src/example.ts"],
      operation: "UPDATE",
      toolCommand: "edit:src/example.ts",
      decision: {
        agent: "planner",
        configLayers: [{ source: "default", agents: { planner: { model: "planner", skills: ["debug"] } } }],
        requiredSkill: "debug",
      },
    }, adapter);

    expect(adapter.execute).toHaveBeenCalledOnce();
    expect(result.phase).toBe("COMPLETED");
    expect(result.verification).toBe("PASS");
  });
});
