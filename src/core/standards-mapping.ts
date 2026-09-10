// src/core/standards-mapping.ts — Compliance Standards Mapping
// Maps governance decisions to OWASP Agentic Top 10, EU AI Act, NIST AI RMF, ISO 42001.
// Inspired by governance-sdk (Lua) and AGT (Microsoft).

import { TaskSpec, RiskLevel, TaskType } from "./types";

export interface ComplianceMapping {
  standard: string;
  article: string;
  control: string;
  description: string;
  status: "COVERED" | "PARTIAL" | "NOT_COVERED";
  evidence: string;
}

export interface ComplianceReport {
  timestamp: string;
  taskId: string;
  riskLevel: RiskLevel;
  mappings: ComplianceMapping[];
  overallCompliance: number; // 0-100
  gaps: string[];
}

// OWASP Agentic AI Top 10 (2025)
const OWASP_AGENTIC_TOP10 = [
  { id: "AA01", name: "Agentic Goal Misalignment", controls: ["classifyTask", "policy-engine", "guard-overrides"] },
  { id: "AA02", name: "Tool Abuse", controls: ["guard-overrides", "policy-engine", "risk-assessor"] },
  { id: "AA03", name: "Autonomous Repetition", controls: ["risk-assessor", "circuit-breaker"] },
  { id: "AA04", name: "Agent-to-Agent Exploitation", controls: ["guard-overrides", "proof-verifier"] },
  { id: "AA05", name: "Context Poisoning", controls: ["unicode-normalize", "guard-overrides", "injection-detection"] },
  { id: "AA06", name: "Information Exfiltration", controls: ["guard-overrides", "policy-engine", "anomaly-detection"] },
  { id: "AA07", name: "Privilege Escalation", controls: ["policy-engine", "risk-assessor", "guard-overrides"] },
  { id: "AA08", name: "Unreliable Agent Actions", controls: ["proof-verifier", "merkle-audit", "policy-engine"] },
  { id: "AA09", name: "Cross-Session Contamination", controls: ["guard-overrides", "unicode-normalize"] },
  { id: "AA10", name: "Lack of Audit Trail", controls: ["merkle-audit", "proof-verifier", "audit-logger"] },
];

// EU AI Act — Key Articles for AI Agent Governance
const EU_AI_ACT = [
  { id: "Art.9", name: "Risk Management System", riskLevels: ["HIGH", "CRITICAL"], controls: ["risk-assessor", "policy-engine"] },
  { id: "Art.11", name: "Technical Documentation", riskLevels: ["LOW", "HIGH", "CRITICAL"], controls: ["merkle-audit", "proof-verifier"] },
  { id: "Art.12", name: "Record Keeping / Logging", riskLevels: ["HIGH", "CRITICAL"], controls: ["merkle-audit", "audit-logger"] },
  { id: "Art.13", name: "Transparency & Information", riskLevels: ["LOW", "HIGH", "CRITICAL"], controls: ["merkle-audit"] },
  { id: "Art.14", name: "Human Oversight", riskLevels: ["HIGH", "CRITICAL"], controls: ["policy-engine", "proof-verifier"] },
  { id: "Art.15", name: "Accuracy, Robustness, Cybersecurity", riskLevels: ["CRITICAL"], controls: ["guard-overrides", "anomaly-detection", "injection-detection"] },
];

// NIST AI RMF — Govern/Map/Measure/Manage
const NIST_AI_RMF = [
  { id: "GOVERN-1", name: "AI Risk Management Strategy", controls: ["policy-engine", "risk-assessor"] },
  { id: "GOVERN-2", name: "Roles & Responsibilities", controls: ["policy-engine"] },
  { id: "GOVERN-3", name: "AI Risk Tolerance", controls: ["risk-assessor", "policy-engine"] },
  { id: "MAP-1", name: "Intended Purpose Identified", controls: ["classifier"] },
  { id: "MAP-2", name: "Intended Users Identified", controls: ["policy-engine"] },
  { id: "MAP-3", name: "Impact to Individuals & Communities", controls: ["risk-assessor", "policy-engine"] },
  { id: "MEASURE-1", name: "Approaches for Measurement", controls: ["proof-verifier", "merkle-audit"] },
  { id: "MEASURE-2", name: "Measurement Methods", controls: ["merkle-audit", "anomaly-detection"] },
  { id: "MANAGE-1", name: "Risk Response Plan", controls: ["guard-overrides", "policy-engine"] },
  { id: "MANAGE-2", name: "Monitoring & Improvement", controls: ["merkle-audit", "anomaly-detection"] },
];

// ISO 42001 — AI Management System
const ISO_42001 = [
  { id: "6.1.2", name: "Risk Assessment", controls: ["risk-assessor", "policy-engine"] },
  { id: "7.3", name: "Awareness & Competence", controls: ["classifier", "guard-overrides"] },
  { id: "8.1", name: "Operational Planning & Control", controls: ["policy-engine", "orchestrator"] },
  { id: "8.2", name: "AI Risk Assessment", controls: ["risk-assessor", "anomaly-detection"] },
  { id: "9.1", name: "Monitoring, Measurement & Evaluation", controls: ["merkle-audit", "anomaly-detection"] },
  { id: "9.3", name: "Management Review", controls: ["merkle-audit"] },
  { id: "10.1", name: "Nonconformity & Corrective Action", controls: ["guard-overrides", "policy-engine"] },
];

export class StandardsMapper {
  /**
   * Map a task's governance controls to applicable compliance standards.
   */
  mapTask(task: TaskSpec, riskLevel: RiskLevel): ComplianceMapping[] {
    const mappings: ComplianceMapping[] = [];
    const usedControls = this.getControlsForTask(task, riskLevel);

    // Map OWASP Agentic
    for (const owasp of OWASP_AGENTIC_TOP10) {
      const hasControl = owasp.controls.some((c) => usedControls.includes(c));
      mappings.push({
        standard: "OWASP Agentic Top 10",
        article: owasp.id,
        control: owasp.controls.join(", "),
        description: owasp.name,
        status: hasControl ? "COVERED" : "NOT_COVERED",
        evidence: hasControl ? `Controlled by: ${owasp.controls.filter((c) => usedControls.includes(c)).join(", ")}` : "No control mapping found",
      });
    }

    // Map EU AI Act
    for (const article of EU_AI_ACT) {
      const riskApplies = article.riskLevels.includes(riskLevel);
      if (!riskApplies) continue;
      const hasControl = article.controls.some((c) => usedControls.includes(c));
      mappings.push({
        standard: "EU AI Act",
        article: article.id,
        control: article.controls.join(", "),
        description: article.name,
        status: hasControl ? "COVERED" : "NOT_COVERED",
        evidence: hasControl ? `Controlled by: ${article.controls.filter((c) => usedControls.includes(c)).join(", ")}` : "No control mapping found",
      });
    }

    // Map NIST AI RMF
    for (const nist of NIST_AI_RMF) {
      const hasControl = nist.controls.some((c) => usedControls.includes(c));
      mappings.push({
        standard: "NIST AI RMF 1.0",
        article: nist.id,
        control: nist.controls.join(", "),
        description: nist.name,
        status: hasControl ? "COVERED" : "NOT_COVERED",
        evidence: hasControl ? `Controlled by: ${nist.controls.filter((c) => usedControls.includes(c)).join(", ")}` : "No control mapping found",
      });
    }

    // Map ISO 42001
    for (const iso of ISO_42001) {
      const hasControl = iso.controls.some((c) => usedControls.includes(c));
      mappings.push({
        standard: "ISO 42001",
        article: iso.id,
        control: iso.controls.join(", "),
        description: iso.name,
        status: hasControl ? "COVERED" : "NOT_COVERED",
        evidence: hasControl ? `Controlled by: ${iso.controls.filter((c) => usedControls.includes(c)).join(", ")}` : "No control mapping found",
      });
    }

    return mappings;
  }

  /**
   * Generate a full compliance report for a task.
   */
  generateReport(task: TaskSpec, riskLevel: RiskLevel): ComplianceReport {
    const mappings = this.mapTask(task, riskLevel);
    const covered = mappings.filter((m) => m.status === "COVERED").length;
    const partial = mappings.filter((m) => m.status === "PARTIAL").length;
    const total = mappings.length;

    const overallCompliance = total > 0 ? Math.round(((covered + partial * 0.5) / total) * 100) : 0;

    const gaps = mappings
      .filter((m) => m.status === "NOT_COVERED")
      .map((m) => `${m.standard} ${m.article}: ${m.description}`);

    return {
      timestamp: new Date().toISOString(),
      taskId: task.id || "unknown",
      riskLevel,
      mappings,
      overallCompliance,
      gaps,
    };
  }

  private getControlsForTask(task: TaskSpec, riskLevel: RiskLevel): string[] {
    const controls: string[] = ["classifier", "policy-engine", "guard-overrides", "risk-assessor"];

    if (task.risk === RiskLevel.CRITICAL || riskLevel === RiskLevel.CRITICAL) {
      controls.push("proof-verifier", "merkle-audit", "anomaly-detection");
    }

    if (riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL) {
      controls.push("proof-verifier", "merkle-audit");
    }

    if (task.taskType === TaskType.DESTRUCTIVE_OP || task.taskType === TaskType.PRODUCTION_DEPLOY) {
      controls.push("audit-logger");
    }

    if (task.operation?.includes("rm -rf") || task.operation?.includes("DROP")) {
      controls.push("injection-detection");
    }

    return [...new Set(controls)];
  }
}
