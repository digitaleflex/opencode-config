import { describe, expect, it } from "vitest";
import {
  PresetResolutionError,
  mergePresetMaps,
  resolveActivePreset,
  resolvePreset,
} from "./preset";

describe("resolvePreset", () => {
  it("resolves inherited presets with child precedence", () => {
    const result = resolvePreset("focused", {
      base: {
        agents: {
          planner: { model: "cheap", skills: ["planning"] },
        },
      },
      focused: {
        extends: "base",
        agents: {
          planner: { model: "strong" },
        },
      },
    });

    expect(result.agents.planner).toEqual({
      model: "strong",
      skills: ["planning"],
    });
  });

  it("rejects inheritance cycles", () => {
    expect(() =>
      resolvePreset("a", {
        a: { extends: "b", agents: {} },
        b: { extends: "a", agents: {} },
      }),
    ).toThrow(PresetResolutionError);
  });

  it("rejects a missing parent", () => {
    expect(() =>
      resolvePreset("child", {
        child: { extends: "missing", agents: {} },
      }),
    ).toThrow(PresetResolutionError);
  });
});

describe("mergePresetMaps", () => {
  it("lets project preset declarations override user declarations", () => {
    const merged = mergePresetMaps(
      {
        balanced: {
          agents: { planner: { model: "user" } },
        },
      },
      {
        balanced: {
          agents: { planner: { skills: ["project"] } },
        },
      },
    );

    expect(resolvePreset("balanced", merged!)).toEqual({
      agents: {
        planner: { model: "user", skills: ["project"] },
      },
    });
  });
});

describe("resolveActivePreset", () => {
  it("records the highest-precedence layer that selected the preset", () => {
    const result = resolveActivePreset("secure", [
      { source: "user", presets: { secure: { agents: { security: { model: "a" } } } } },
      { source: "project", presets: { secure: { agents: { security: { model: "b" } } } } },
    ]);

    expect(result.source).toBe("project");
    expect(result.definition?.agents.security).toEqual({ model: "b" });
  });
});
