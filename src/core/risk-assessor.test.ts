import { describe, test, expect } from "vitest";
import { assessRisk } from "./risk-assessor";
import { RiskLevel, TaskType } from "./types";

describe("assessRisk", () => {
  test("destructive operation → CRITICAL", () => {
    expect(assessRisk({
      description: "clean up",
      operation: "rm -rf /data",
    })).toBe(RiskLevel.CRITICAL);
  });

  test("production environment → HIGH", () => {
    expect(assessRisk({
      description: "update config",
      environment: "production",
    })).toBe(RiskLevel.HIGH);
  });

  test("PII data → HIGH", () => {
    expect(assessRisk({
      description: "process users",
      data: { pii: true, password: "xxx" },
    })).toBe(RiskLevel.HIGH);
  });

  test("auth scope → HIGH", () => {
    expect(assessRisk({
      description: "modify module",
      scope: ["auth", "database"],
    })).toBe(RiskLevel.HIGH);
  });

  test("simple task → LOW", () => {
    expect(assessRisk({
      description: "fix typo",
    })).toBe(RiskLevel.LOW);
  });

  test("undefined taskType does not crash", () => {
    expect(() => assessRisk({ description: "test" })).not.toThrow();
  });
});