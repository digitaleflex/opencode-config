import { describe, expect, it } from "vitest";
import { resolveAgentOverride, resolveLayers } from "./layered";

describe("resolveLayers", () => {
  it("applies layers from lowest to highest precedence", () => {
    const result = resolveLayers([
      { name: "defaults", value: { model: "free", agent: { explorer: { model: "a" } } } },
      { name: "project", value: { agent: { explorer: { model: "b" } } } },
    ]);

    expect(result.value).toEqual({
      model: "free",
      agent: { explorer: { model: "b" } },
    });
    expect(result.sources["agent.explorer.model"]).toBe("project");
  });

  it("replaces arrays instead of merging them", () => {
    const result = resolveLayers([
      { name: "defaults", value: { skills: ["a", "b"] } },
      { name: "project", value: { skills: ["c"] } },
    ]);

    expect(result.value.skills).toEqual(["c"]);
  });
});

describe("resolveAgentOverride", () => {
  it("prefers canonical agent values over aliases", () => {
    const result = resolveAgentOverride(
      {
        explore: { model: "legacy", skills: ["legacy"] },
        explorer: { model: "canonical" },
      },
      "explorer",
      { explore: "explorer" },
    );

    expect(result).toEqual({
      model: "canonical",
      skills: ["legacy"],
    });
  });
});
