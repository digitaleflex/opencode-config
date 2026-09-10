// src/core/risk-assessor.ts — Risk Assessment Engine

import { TaskSpec, RiskLevel, TaskType, TaskComplexity } from "./types";

export { RiskLevel };

export function assessRisk(task: TaskSpec): RiskLevel {
  let risk = RiskLevel.LOW;

  // Destructive operations → CRITICAL
  if (task.operation) {
    const op = task.operation.toLowerCase();
    if (
      op.includes("delete") ||
      op.includes("drop") ||
      op.includes("rm -rf") ||
      op.includes("truncate") ||
      op.includes("destroy")
    ) {
      return RiskLevel.CRITICAL;
    }
  }

  // Production environment → HIGH
  if (task.environment === "production") {
    risk = RiskLevel.HIGH;
  }

  // Sensitive data → HIGH/CRITICAL
  if (task.data) {
    const dataStr = JSON.stringify(task.data).toLowerCase();
    if (
      dataStr.includes("personal") ||
      dataStr.includes("password") ||
      dataStr.includes("secret") ||
      dataStr.includes("token") ||
      dataStr.includes("health") ||
      dataStr.includes("financial") ||
      dataStr.includes("pii")
    ) {
      risk = RiskLevel.HIGH;
    }
  }

  // Task type based risk
  const highRiskTypes = [
    TaskType.PRODUCTION_DEPLOY,
    TaskType.SECURITY,
    TaskType.DESTRUCTIVE_OP,
    TaskType.SENSITIVE_DATA,
  ];

  if (task.taskType && highRiskTypes.includes(task.taskType)) {
    risk = RiskLevel.HIGH;
  }

  const criticalRiskTypes = [TaskType.DESTRUCTIVE_OP];
  if (task.taskType && criticalRiskTypes.includes(task.taskType)) {
    risk = RiskLevel.CRITICAL;
  }

  // Blast radius
  if (task.scope) {
    if (
      task.scope.some((s) =>
        ["database", "auth", "payment", "security", "production"].some((k) =>
          s.toLowerCase().includes(k)
        )
      )
    ) {
      risk = risk === RiskLevel.LOW ? RiskLevel.HIGH : RiskLevel.CRITICAL;
    }
  }

  return risk;
}

export function getRiskFromComplexity(complexity: TaskComplexity): RiskLevel {
  switch (complexity) {
    case TaskComplexity.L1:
      return RiskLevel.LOW;
    case TaskComplexity.L2:
      return RiskLevel.LOW;
    case TaskComplexity.L3:
      return RiskLevel.HIGH;
    case TaskComplexity.L4:
      return RiskLevel.CRITICAL;
    default:
      return RiskLevel.LOW;
  }
}
