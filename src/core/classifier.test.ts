import { describe, test, expect } from "vitest";
import { classifyTask } from "./classifier";
import { TaskType } from "./types";

describe("classifyTask", () => {
  test("typo → CONFIG (L1)", () => {
    expect(classifyTask({ description: "fix typo in README" })).toBe(TaskType.CONFIG);
  });

  test("feature request → FEATURE_LIMITED (L2)", () => {
    expect(classifyTask({ description: "add login feature" })).toBe(TaskType.FEATURE_LIMITED);
  });

  test("API change → API_CHANGE (L3)", () => {
    expect(classifyTask({ description: "modify the API contract" })).toBe(TaskType.API_CHANGE);
  });

  test("deploy production → DESTRUCTIVE_OP (L4)", () => {
    expect(classifyTask({ description: "deploy to production" })).toBe(TaskType.DESTRUCTIVE_OP);
  });

  test("destructive rm -rf → DESTRUCTIVE_OP (L4)", () => {
    expect(classifyTask({ description: "rm -rf everything" })).toBe(TaskType.DESTRUCTIVE_OP);
  });

  test("unknown → FEATURE_LIMITED (default)", () => {
    expect(classifyTask({ description: "implement user dashboard" })).toBe(TaskType.FEATURE_LIMITED);
  });
});