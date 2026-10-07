import { describe, expect, it } from "vitest";
import { DecisionEngine } from "./decision-engine";
import { TaskType } from "./types";

describe("DecisionEngine", () => {
  it("selects a policy-approved agent and model chain", () => {
    const result = new DecisionEngine().decide({
      task: { description: "Fix a localized bug", taskType: TaskType.BUG_LOCALIZED },
      configLayers: [{
        source: "default",
        agents: {
          planner: { model: ["planner-primary", "planner-fallback"], skills: ["debug"] },
          builder: { model: ["builder-primary"], skills: ["debug"] },
        },
      }],
      requiredSkill: "debug",
    });

    expect(result.verdict).toBe("ALLOW");
    expect(result.selectedAgent).toBe("planner");
    expect(result.modelChain.primary?.id).toBe("planner-primary");
    expect(result.skills).toContain("debug");
  });

  it("fails closed when the requested capability is unavailable", () => {
    const result = new DecisionEngine().decide({
      task: { description: "Fix a localized bug", taskType: TaskType.BUG_LOCALIZED },
      requiredSkill: "security-scan",
      configLayers: [{
        source: "default",
        agents: { planner: { skills: [] }, builder: { skills: [] } },
      }],
    });

    expect(result.verdict).toBe("DENY");
    expect(result.reason).toContain("capabilities");
  });

  it("returns ASK when policy requires human approval", () => {
    const result = new DecisionEngine().decide({
      task: { description: "Change the API", taskType: TaskType.API_CHANGE },
      configLayers: [{ source: "default", agents: { planner: { model: "planner" } } }],
    });

    expect(result.verdict).toBe("ASK");
  });
});
