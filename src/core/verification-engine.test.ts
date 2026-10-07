import { describe, expect, test } from "vitest";
import { VerificationEngine } from "./verification-engine";
import { ProofType, RiskLevel, TaskComplexity } from "./types";

const policy = {
  name: "verification-test",
  complexity: TaskComplexity.L2,
  taskTypes: [],
  risk: RiskLevel.LOW,
  agents: [],
  modelPlan: { primary: [], fallback: [] },
  proofsRequired: [ProofType.TESTS, ProofType.CODE_REVIEW],
  humanApproval: false,
  securityScan: false,
};

describe("VerificationEngine", () => {
  const engine = new VerificationEngine();

  test("does not fabricate missing evidence", () => {
    const result = engine.verify(
      { id: "task-1", description: "change code" },
      policy,
      undefined,
    );

    expect(result.status).toBe("PENDING");
    expect(result.missing).toEqual([ProofType.TESTS, ProofType.CODE_REVIEW]);
  });

  test("passes only with required evidence", () => {
    const result = engine.verify(
      { id: "task-1", description: "change code" },
      policy,
      {
        taskId: "task-1",
        collectedAt: Date.now(),
        tests: { passed: 4, failed: 0, outputHash: "sha256:test-output" },
        reviewHash: "sha256:review",
      },
    );

    expect(result.status).toBe("PASS");
    expect(result.failures).toEqual([]);
  });

  test("fails when test evidence reports failures", () => {
    const result = engine.verify(
      { id: "task-1", description: "change code" },
      policy,
      {
        taskId: "task-1",
        collectedAt: Date.now(),
        tests: { passed: 3, failed: 1, outputHash: "sha256:test-output" },
        reviewHash: "sha256:review",
      },
    );

    expect(result.status).toBe("FAIL");
    expect(result.failures).toContain(ProofType.TESTS);
  });
});
