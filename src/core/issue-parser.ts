// src/core/issue-parser.ts — Canonical Issue Parser
// Parses GitHub issues as executable engineering specifications per the canonical schema

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { validate as validateJson } from "jsonschema";

export interface ParsedIssue {
  identity: IssueIdentity;
  objective: IssueObjective;
  source_of_truth: IssueSourceOfTruth;
  repository_scope: IssueRepositoryScope;
  implementation_boundary: IssueImplementationBoundary;
  data_contract: IssueDataContract;
  event_contract: IssueEventContract;
  state_contract: IssueStateContract;
  dependencies: IssueDependencies;
  implementation_steps: IssueImplementationStep[];
  validation: IssueValidation;
  acceptance_criteria: IssueAcceptanceCriterion[];
  failure_stop_conditions: IssueFailureStopCondition[];
  documentation_reporting: IssueDocumentationReporting;
  raw: unknown;
  parse_errors: string[];
  parse_warnings: string[];
}

export interface IssueIdentity {
  issue_number: number;
  title: string;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
}

export type IssueType = "feature" | "bug" | "ux" | "architecture" | "configuration" | "maintenance" | "security" | "performance" | "capability-gap";
export type IssuePriority = "critical" | "high" | "medium" | "low";
export type IssueStatus = "open" | "in_progress" | "blocked" | "review" | "closed";

export interface IssueObjective {
  problem: string;
  desired_outcome: string;
  user_system_impact: string;
}

export interface IssueSourceOfTruth {
  engineering_specs: string[];
  architecture_refs: string[];
  ux_refs: string[];
  existing_decisions: string[];
}

export interface IssueRepositoryScope {
  read_repositories: RepositoryId[];
  write_repositories: RepositoryId[];
}

export type RepositoryId = "engineering" | "config" | "product";

export interface IssueImplementationBoundary {
  must_change: IssueChange[];
  may_change: IssueChange[];
  must_not_change: IssueProtectedPath[];
}

export interface IssueChange {
  repository: RepositoryId;
  path: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  reason: string;
}

export interface IssueProtectedPath {
  repository: RepositoryId;
  path: string;
  reason: string;
}

export interface IssueDataContract {
  inputs: IssueDataField[];
  outputs: IssueDataField[];
  entities: IssueEntity[];
  fact_sources: IssueFactSource[];
}

export interface IssueDataField {
  name: string;
  type: string;
  source: "engineering" | "config" | "product" | "external" | "user";
  required: boolean;
  description: string;
}

export interface IssueEntity {
  name: string;
  definition_source: "engineering" | "config" | "product" | "external";
  schema_ref?: string;
}

export interface IssueFactSource {
  fact: string;
  source: string;
  authority: "engineering" | "config" | "product";
}

export interface IssueEventContract {
  consumed_events: IssueEvent[];
  emitted_events: IssueEvent[];
  correlation_ids: string[];
}

export interface IssueEvent {
  event_type: string;
  source: "engineering" | "config" | "product" | "external";
  correlation_id: string;
  payload_schema?: string;
}

export interface IssueStateContract {
  lifecycle_states: string[];
  transitions: IssueTransition[];
  unknown_semantics: "BLOCK" | "ESCALATE" | "DEFAULT_TO_SAFE";
}

export interface IssueTransition {
  from: string;
  to: string;
  trigger: string;
  guard: string;
}

export interface IssueDependencies {
  blocking_issues: IssueBlockingIssue[];
  required_capabilities: IssueRequiredCapability[];
}

export interface IssueBlockingIssue {
  issue_ref: string;
  repository: RepositoryId;
  reason: string;
}

export interface IssueRequiredCapability {
  capability: string;
  repository: RepositoryId;
  available: boolean;
  gap_issue_ref?: string;
}

export interface IssueImplementationStep {
  step: number;
  repository: RepositoryId;
  action: string;
  owner: "planner" | "architect" | "builder" | "reviewer" | "security" | "human";
  depends_on: number[];
  validation?: string;
}

export interface IssueValidation {
  commands: IssueValidationCommand[];
  runtime_checks: IssueRuntimeCheck[];
  integration_ui_checks: IssueRuntimeCheck[];
  evidence: IssueEvidence[];
}

export interface IssueValidationCommand {
  command: string;
  repository: RepositoryId;
  expected_result: string;
}

export interface IssueRuntimeCheck {
  check: string;
  repository: RepositoryId;
  pass_criteria: string;
}

export interface IssueEvidence {
  type: "test_output" | "review_hash" | "scan_report" | "approval_token" | "build_artifact";
  source: "ci" | "human" | "scanner" | "orchestrator";
  location: string;
}

export interface IssueAcceptanceCriterion {
  criterion: string;
  testable: boolean;
  mapped_to_evidence: string;
}

export interface IssueFailureStopCondition {
  condition: string;
  action: "STOP" | "ESCALATE" | "BLOCK" | "REQUIRE_HUMAN";
  reason: string;
}

export interface IssueDocumentationReporting {
  update_docs: IssueDocUpdate[];
  report_format: "markdown" | "json" | "yaml";
  audit_trail: boolean;
}

export interface IssueDocUpdate {
  document: string;
  repository: RepositoryId;
  section: string;
}

export interface IssueSchema {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  type: "object";
  required: string[];
  properties: Record<string, unknown>;
  additionalProperties: boolean;
}

export class IssueParser {
  private schema: IssueSchema | null = null;

  constructor(private schemaPath?: string) {}

  /**
   * Load the JSON schema for validation
   */
  loadSchema(): IssueSchema {
    const path = this.schemaPath || join(process.cwd(), "orchestration", "issues", "issue-schema.json");
    const content = readFileSync(path, "utf-8");
    this.schema = JSON.parse(content) as IssueSchema;
    return this.schema;
  }

  /**
   * Parse a GitHub issue body (from YAML form data) into a structured issue
   */
  parseIssueBody(issueBody: string): ParsedIssue {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Parse YAML front-matter / form data
    let raw: Record<string, unknown>;
    try {
      raw = parseYaml(issueBody) as Record<string, unknown>;
    } catch (e) {
      errors.push(`YAML parse error: ${e}`);
      raw = {};
    }

    // Validate against JSON schema if available
    if (this.schema) {
      const validation = validateJson(raw, this.schema);
      if (!validation.valid) {
        for (const err of validation.errors) {
          errors.push(`Schema validation: ${err.property} - ${err.message}`);
        }
      }
    }

    // Extract and normalize each section
    const parsed: ParsedIssue = {
      identity: this.parseIdentity(raw, errors, warnings),
      objective: this.parseObjective(raw, errors, warnings),
      source_of_truth: this.parseSourceOfTruth(raw, errors, warnings),
      repository_scope: this.parseRepositoryScope(raw, errors, warnings),
      implementation_boundary: this.parseImplementationBoundary(raw, errors, warnings),
      data_contract: this.parseDataContract(raw, errors, warnings),
      event_contract: this.parseEventContract(raw, errors, warnings),
      state_contract: this.parseStateContract(raw, errors, warnings),
      dependencies: this.parseDependencies(raw, errors, warnings),
      implementation_steps: this.parseImplementationSteps(raw, errors, warnings),
      validation: this.parseValidation(raw, errors, warnings),
      acceptance_criteria: this.parseAcceptanceCriteria(raw, errors, warnings),
      failure_stop_conditions: this.parseFailureStopConditions(raw, errors, warnings),
      documentation_reporting: this.parseDocumentationReporting(raw, errors, warnings),
      raw,
      parse_errors: errors,
      parse_warnings: warnings,
    };

    return parsed;
  }

  /**
   * Check if issue is executable (all mandatory fields complete and unambiguous)
   */
  isExecutable(issue: ParsedIssue): { executable: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // Check mandatory sections
    if (issue.parse_errors.length > 0) {
      reasons.push(`Parse errors: ${issue.parse_errors.join("; ")}`);
    }

    // Identity must be complete
    if (!issue.identity.issue_number || issue.identity.issue_number < 1) {
      reasons.push("Missing or invalid issue_number");
    }
    if (!issue.identity.title || issue.identity.title.length < 5) {
      reasons.push("Title too short or missing");
    }
    if (!issue.identity.type) {
      reasons.push("Missing issue type");
    }

    // Objective must be complete
    if (!issue.objective.problem || issue.objective.problem.length < 20) {
      reasons.push("Problem statement too short or missing");
    }
    if (!issue.objective.desired_outcome || issue.objective.desired_outcome.length < 20) {
      reasons.push("Desired outcome too short or missing");
    }

    // Repository scope must be explicit
    if (!issue.repository_scope.read_repositories || issue.repository_scope.read_repositories.length === 0) {
      reasons.push("No read repositories specified");
    }
    if (!issue.repository_scope.write_repositories || issue.repository_scope.write_repositories.length === 0) {
      reasons.push("No write repositories specified");
    }

    // Implementation boundary must have at least MUST CHANGE
    if (!issue.implementation_boundary.must_change || issue.implementation_boundary.must_change.length === 0) {
      reasons.push("No MUST CHANGE entries — nothing to implement");
    }

    // Implementation steps required
    if (!issue.implementation_steps || issue.implementation_steps.length === 0) {
      reasons.push("No implementation steps defined");
    }

    // Validation required
    if (!issue.validation.commands || issue.validation.commands.length === 0) {
      reasons.push("No validation commands defined");
    }

    // Acceptance criteria required
    if (!issue.acceptance_criteria || issue.acceptance_criteria.length === 0) {
      reasons.push("No acceptance criteria defined");
    }

    // Check for UNKNOWN values (represented as "UNKNOWN" strings)
    const unknownFields = this.findUnknownValues(issue);
    if (unknownFields.length > 0) {
      reasons.push(`UNKNOWN values in: ${unknownFields.join(", ")}`);
    }

    return {
      executable: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Extract repository/path/operation targets for routing
   */
  extractWriteTargets(issue: ParsedIssue): IssueChange[] {
    return issue.implementation_boundary.must_change;
  }

  /**
   * Extract read repositories for context fetching
   */
  extractReadRepositories(issue: ParsedIssue): RepositoryId[] {
    return issue.repository_scope.read_repositories;
  }

  // --- Private parsing helpers ---

  private parseIdentity(raw: Record<string, unknown>, errors: string[], warnings: string[]): IssueIdentity {
    return {
      issue_number: this.asNumber(raw.issue_number, 0),
      title: this.asString(raw.title, "UNKNOWN"),
      type: this.asIssueType(raw.type, errors),
      priority: this.asIssuePriority(raw.priority, "medium"),
      status: this.asIssueStatus(raw.status, "open"),
    };
  }

  private parseObjective(raw: Record<string, unknown>, errors: string[], warnings: string[]): IssueObjective {
    return {
      problem: this.asString(raw.problem, "UNKNOWN"),
      desired_outcome: this.asString(raw.desired_outcome, "UNKNOWN"),
      user_system_impact: this.asString(raw.user_system_impact, "UNKNOWN"),
    };
  }

  private parseSourceOfTruth(raw: Record<string, unknown>, errors: string[], warnings: string[]): IssueSourceOfTruth {
    return {
      engineering_specs: this.asStringArray(raw.engineering_specs),
      architecture_refs: this.asStringArray(raw.architecture_refs),
      ux_refs: this.asStringArray(raw.ux_refs),
      existing_decisions: this.asStringArray(raw.existing_decisions),
    };
  }

  private parseRepositoryScope(raw: Record<string, unknown>, errors: string[], warnings: string[]): IssueRepositoryScope {
    const read = this.asRepoArray(raw.read_repositories, errors, "read_repositories");
    const write = this.asRepoArray(raw.write_repositories, errors, "write_repositories");

    // Warn if write repos not subset of read repos (unusual but not invalid)
    for (const w of write) {
      if (!read.includes(w)) {
        warnings.push(`Write repository ${w} not in read repositories`);
      }
    }

    return { read_repositories: read, write_repositories: write };
  }

  private parseImplementationBoundary(raw: Record<string, unknown>, errors: string[], warnings: string[]): IssueImplementationBoundary {
    return {
      must_change: this.asChangeArray(raw.must_change, true, errors),
      may_change: this.asChangeArray(raw.may_change, false, errors),
      must_not_change: this.asProtectedArray(raw.must_not_change, errors),
    };
  }

  private parseDataContract(raw: Record<string, unknown>, errors: string[], warnings: string[]): IssueDataContract {
    return {
      inputs: this.asDataFieldArray(raw.inputs, errors),
      outputs: this.asDataFieldArray(raw.outputs, errors),
      entities: this.asEntityArray(raw.entities, errors),
      fact_sources: this.asFactSourceArray(raw.fact_sources, errors),
    };
  }

  private parseEventContract(raw: Record<string, unknown>, errors: string[], warnings: string[]): IssueEventContract {
    return {
      consumed_events: this.asEventArray(raw.consumed_events, errors),
      emitted_events: this.asEventArray(raw.emitted_events, errors),
      correlation_ids: this.asStringArray(raw.correlation_ids),
    };
  }

  private parseStateContract(raw: Record<string, unknown>, errors: string[], warnings: string[]): IssueStateContract {
    return {
      lifecycle_states: this.asStringArray(raw.lifecycle_states),
      transitions: this.asTransitionArray(raw.transitions, errors),
      unknown_semantics: this.asUnknownSemantics(raw.unknown_semantics, "BLOCK"),
    };
  }

  private parseDependencies(raw: Record<string, unknown>, errors: string[], warnings: string[]): IssueDependencies {
    return {
      blocking_issues: this.asBlockingIssueArray(raw.blocking_issues, errors),
      required_capabilities: this.asRequiredCapabilityArray(raw.required_capabilities, errors),
    };
  }

  private parseImplementationSteps(raw: Record<string, unknown>, errors: string[], warnings: string[]): IssueImplementationStep[] {
    const steps = this.asStringArray(raw.implementation_steps);
    return steps.map((s, i) => this.parseStepLine(s, i + 1, errors));
  }

  private parseValidation(raw: Record<string, unknown>, errors: string[], warnings: string[]): IssueValidation {
    return {
      commands: this.asValidationCommandArray(raw.validation_commands, errors),
      runtime_checks: this.asRuntimeCheckArray(raw.runtime_checks, errors),
      integration_ui_checks: this.asRuntimeCheckArray(raw.integration_ui_checks, errors),
      evidence: this.asEvidenceArray(raw.evidence, errors),
    };
  }

  private parseAcceptanceCriteria(raw: Record<string, unknown>, errors: string[], warnings: string[]): IssueAcceptanceCriterion[] {
    const criteria = this.asStringArray(raw.acceptance_criteria);
    return criteria.map((c) => this.parseCriterionLine(c, errors));
  }

  private parseFailureStopConditions(raw: Record<string, unknown>, errors: string[], warnings: string[]): IssueFailureStopCondition[] {
    const conditions = this.asStringArray(raw.failure_stop_conditions);
    return conditions.map((c) => this.parseConditionLine(c, errors));
  }

  private parseDocumentationReporting(raw: Record<string, unknown>, errors: string[], warnings: string[]): IssueDocumentationReporting {
    return {
      update_docs: this.asDocUpdateArray(raw.update_docs, errors),
      report_format: this.asReportFormat(raw.report_format, "markdown"),
      audit_trail: this.asBoolean(raw.audit_trail, true),
    };
  }

  // --- Line parsers for multi-line fields ---

  private parseStepLine(line: string, lineNum: number, errors: string[]): IssueImplementationStep {
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 5) {
      errors.push(`Step ${lineNum}: expected 5+ fields, got ${parts.length}: "${line}"`);
      return { step: lineNum, repository: "config", action: line, owner: "builder", depends_on: [], validation: "" };
    }
    return {
      step: parseInt(parts[0], 10) || lineNum,
      repository: this.asRepoId(parts[1], errors),
      action: parts[2] || "UNKNOWN",
      owner: this.asOwner(parts[3], errors),
      depends_on: parts[4] ? parts[4].split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n)) : [],
      validation: parts[5] || "",
    };
  }

  private parseCriterionLine(line: string, errors: string[]): IssueAcceptanceCriterion {
    const parts = line.split("|").map((p) => p.trim());
    return {
      criterion: parts[0] || "UNKNOWN",
      testable: parts[1]?.toLowerCase() === "true",
      mapped_to_evidence: parts[2] || "UNKNOWN",
    };
  }

  private parseConditionLine(line: string, errors: string[]): IssueFailureStopCondition {
    const parts = line.split("|").map((p) => p.trim());
    return {
      condition: parts[0] || "UNKNOWN",
      action: this.asStopAction(parts[1], "BLOCK"),
      reason: parts[2] || "UNKNOWN",
    };
  }

  // --- Type coercion helpers ---

  private asString(val: unknown, fallback: string): string {
    if (typeof val === "string" && val.trim()) return val.trim();
    return fallback;
  }

  private asNumber(val: unknown, fallback: number): number {
    if (typeof val === "number" && !isNaN(val)) return val;
    if (typeof val === "string") {
      const n = parseInt(val, 10);
      if (!isNaN(n)) return n;
    }
    return fallback;
  }

  private asBoolean(val: unknown, fallback: boolean): boolean {
    if (typeof val === "boolean") return val;
    if (typeof val === "string") return val.toLowerCase() === "true";
    return fallback;
  }

  private asStringArray(val: unknown): string[] {
    if (Array.isArray(val)) return val.map((v) => String(v).trim()).filter((v) => v);
    if (typeof val === "string") return val.split("\n").map((v) => v.trim()).filter((v) => v);
    return [];
  }

  private asRepoArray(val: unknown, errors: string[], fieldName: string): RepositoryId[] {
    const arr = this.asStringArray(val);
    const valid: RepositoryId[] = [];
    for (const v of arr) {
      if (["engineering", "config", "product"].includes(v)) {
        valid.push(v as RepositoryId);
      } else {
        errors.push(`${fieldName}: invalid repository "${v}"`);
      }
    }
    return valid;
  }

  private asRepoId(val: string, errors: string[]): RepositoryId {
    if (["engineering", "config", "product"].includes(val)) return val as RepositoryId;
    errors.push(`Invalid repository: ${val}`);
    return "config";
  }

  private asIssueType(val: unknown, errors: string[]): IssueType {
    const types: IssueType[] = ["feature", "bug", "ux", "architecture", "configuration", "maintenance", "security", "performance", "capability-gap"];
    if (typeof val === "string" && types.includes(val as IssueType)) return val as IssueType;
    errors.push(`Invalid issue type: ${val}`);
    return "feature";
  }

  private asIssuePriority(val: unknown, fallback: IssuePriority): IssuePriority {
    const priorities: IssuePriority[] = ["critical", "high", "medium", "low"];
    if (typeof val === "string" && priorities.includes(val as IssuePriority)) return val as IssuePriority;
    return fallback;
  }

  private asIssueStatus(val: unknown, fallback: IssueStatus): IssueStatus {
    const statuses: IssueStatus[] = ["open", "in_progress", "blocked", "review", "closed"];
    if (typeof val === "string" && statuses.includes(val as IssueStatus)) return val as IssueStatus;
    return fallback;
  }

  private asChangeArray(val: unknown, required: boolean, errors: string[]): IssueChange[] {
    const lines = this.asStringArray(val);
    if (required && lines.length === 0) {
      errors.push("must_change: at least one entry required");
    }
    return lines.map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        repository: this.asRepoId(parts[0] || "", errors),
        path: parts[1] || "UNKNOWN",
        operation: (["CREATE", "UPDATE", "DELETE"].includes(parts[2]) ? parts[2] : "CREATE") as "CREATE" | "UPDATE" | "DELETE",
        reason: parts[3] || "UNKNOWN",
      };
    });
  }

  private asProtectedArray(val: unknown, errors: string[]): IssueProtectedPath[] {
    const lines = this.asStringArray(val);
    return lines.map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        repository: this.asRepoId(parts[0] || "", errors),
        path: parts[1] || "UNKNOWN",
        reason: parts[2] || "UNKNOWN",
      };
    });
  }

  private asDataFieldArray(val: unknown, errors: string[]): IssueDataField[] {
    const lines = this.asStringArray(val);
    return lines.map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        name: parts[0] || "UNKNOWN",
        type: parts[1] || "UNKNOWN",
        source: this.asDataSource(parts[2], errors),
        required: parts[3]?.toLowerCase() === "true",
        description: parts[4] || "UNKNOWN",
      };
    });
  }

  private asDataSource(val: string, errors: string[]): "engineering" | "config" | "product" | "external" | "user" {
    const sources = ["engineering", "config", "product", "external", "user"];
    if (sources.includes(val)) return val as "engineering" | "config" | "product" | "external" | "user";
    errors.push(`Invalid data source: ${val}`);
    return "config";
  }

  private asEntityArray(val: unknown, errors: string[]): IssueEntity[] {
    const lines = this.asStringArray(val);
    return lines.map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        name: parts[0] || "UNKNOWN",
        definition_source: this.asDefSource(parts[1], errors),
        schema_ref: parts[2],
      };
    });
  }

  private asDefSource(val: string, errors: string[]): "engineering" | "config" | "product" | "external" {
    const sources = ["engineering", "config", "product", "external"];
    if (sources.includes(val)) return val as "engineering" | "config" | "product" | "external";
    errors.push(`Invalid definition source: ${val}`);
    return "config";
  }

  private asFactSourceArray(val: unknown, errors: string[]): IssueFactSource[] {
    const lines = this.asStringArray(val);
    return lines.map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        fact: parts[0] || "UNKNOWN",
        source: parts[1] || "UNKNOWN",
        authority: this.asAuthority(parts[2], errors),
      };
    });
  }

  private asAuthority(val: string, errors: string[]): "engineering" | "config" | "product" {
    const authorities = ["engineering", "config", "product"];
    if (authorities.includes(val)) return val as "engineering" | "config" | "product";
    errors.push(`Invalid authority: ${val}`);
    return "config";
  }

  private asEventArray(val: unknown, errors: string[]): IssueEvent[] {
    const lines = this.asStringArray(val);
    return lines.map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        event_type: parts[0] || "UNKNOWN",
        source: this.asEventSource(parts[1], errors),
        correlation_id: parts[2] || "UNKNOWN",
        payload_schema: parts[3],
      };
    });
  }

  private asEventSource(val: string, errors: string[]): "engineering" | "config" | "product" | "external" {
    const sources = ["engineering", "config", "product", "external"];
    if (sources.includes(val)) return val as "engineering" | "config" | "product" | "external";
    errors.push(`Invalid event source: ${val}`);
    return "config";
  }

  private asTransitionArray(val: unknown, errors: string[]): IssueTransition[] {
    const lines = this.asStringArray(val);
    return lines.map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        from: parts[0] || "UNKNOWN",
        to: parts[1] || "UNKNOWN",
        trigger: parts[2] || "UNKNOWN",
        guard: parts[3] || "UNKNOWN",
      };
    });
  }

  private asUnknownSemantics(val: unknown, fallback: "BLOCK" | "ESCALATE" | "DEFAULT_TO_SAFE"): "BLOCK" | "ESCALATE" | "DEFAULT_TO_SAFE" {
    const valid: ("BLOCK" | "ESCALATE" | "DEFAULT_TO_SAFE")[] = ["BLOCK", "ESCALATE", "DEFAULT_TO_SAFE"];
    if (typeof val === "string" && valid.includes(val as "BLOCK" | "ESCALATE" | "DEFAULT_TO_SAFE")) {
      return val as "BLOCK" | "ESCALATE" | "DEFAULT_TO_SAFE";
    }
    return fallback;
  }

  private asBlockingIssueArray(val: unknown, errors: string[]): IssueBlockingIssue[] {
    const lines = this.asStringArray(val);
    return lines.map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        issue_ref: parts[0] || "UNKNOWN",
        repository: this.asRepoId(parts[1] || "", errors),
        reason: parts[2] || "UNKNOWN",
      };
    });
  }

  private asRequiredCapabilityArray(val: unknown, errors: string[]): IssueRequiredCapability[] {
    const lines = this.asStringArray(val);
    return lines.map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        capability: parts[0] || "UNKNOWN",
        repository: this.asRepoId(parts[1] || "", errors),
        available: parts[2]?.toLowerCase() === "true",
        gap_issue_ref: parts[3],
      };
    });
  }

  private asValidationCommandArray(val: unknown, errors: string[]): IssueValidationCommand[] {
    const lines = this.asStringArray(val);
    return lines.map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        command: parts[0] || "UNKNOWN",
        repository: this.asRepoId(parts[1] || "", errors),
        expected_result: parts[2] || "UNKNOWN",
      };
    });
  }

  private asRuntimeCheckArray(val: unknown, errors: string[]): IssueRuntimeCheck[] {
    const lines = this.asStringArray(val);
    return lines.map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        check: parts[0] || "UNKNOWN",
        repository: this.asRepoId(parts[1] || "", errors),
        pass_criteria: parts[2] || "UNKNOWN",
      };
    });
  }

  private asEvidenceArray(val: unknown, errors: string[]): IssueEvidence[] {
    const lines = this.asStringArray(val);
    return lines.map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        type: this.asEvidenceType(parts[0], errors),
        source: this.asEvidenceSource(parts[1], errors),
        location: parts[2] || "UNKNOWN",
      };
    });
  }

  private asEvidenceType(val: string, errors: string[]): "test_output" | "review_hash" | "scan_report" | "approval_token" | "build_artifact" {
    const types = ["test_output", "review_hash", "scan_report", "approval_token", "build_artifact"];
    if (types.includes(val)) return val as "test_output" | "review_hash" | "scan_report" | "approval_token" | "build_artifact";
    errors.push(`Invalid evidence type: ${val}`);
    return "test_output";
  }

  private asEvidenceSource(val: string, errors: string[]): "ci" | "human" | "scanner" | "orchestrator" {
    const sources = ["ci", "human", "scanner", "orchestrator"];
    if (sources.includes(val)) return val as "ci" | "human" | "scanner" | "orchestrator";
    errors.push(`Invalid evidence source: ${val}`);
    return "ci";
  }

  private asOwner(val: string, errors: string[]): "planner" | "architect" | "builder" | "reviewer" | "security" | "human" {
    const owners = ["planner", "architect", "builder", "reviewer", "security", "human"];
    if (owners.includes(val)) return val as "planner" | "architect" | "builder" | "reviewer" | "security" | "human";
    errors.push(`Invalid owner: ${val}`);
    return "builder";
  }

  private asStopAction(val: string, fallback: "STOP" | "ESCALATE" | "BLOCK" | "REQUIRE_HUMAN"): "STOP" | "ESCALATE" | "BLOCK" | "REQUIRE_HUMAN" {
    const actions = ["STOP", "ESCALATE", "BLOCK", "REQUIRE_HUMAN"];
    if (actions.includes(val)) return val as "STOP" | "ESCALATE" | "BLOCK" | "REQUIRE_HUMAN";
    return fallback;
  }

  private asDocUpdateArray(val: unknown, errors: string[]): IssueDocUpdate[] {
    const lines = this.asStringArray(val);
    return lines.map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        document: parts[0] || "UNKNOWN",
        repository: this.asRepoId(parts[1] || "", errors),
        section: parts[2] || "UNKNOWN",
      };
    });
  }

  private asReportFormat(val: unknown, fallback: "markdown" | "json" | "yaml"): "markdown" | "json" | "yaml" {
    const formats = ["markdown", "json", "yaml"];
    if (typeof val === "string" && formats.includes(val)) return val as "markdown" | "json" | "yaml";
    return fallback;
  }

  private findUnknownValues(issue: ParsedIssue): string[] {
    const unknowns: string[] = [];
    const check = (obj: unknown, path: string) => {
      if (typeof obj === "string" && obj === "UNKNOWN") {
        unknowns.push(path);
      } else if (Array.isArray(obj)) {
        obj.forEach((v, i) => check(v, `${path}[${i}]`));
      } else if (obj && typeof obj === "object") {
        for (const [k, v] of Object.entries(obj)) {
          check(v, `${path}.${k}`);
        }
      }
    };
    check(issue, "issue");
    return unknowns;
  }
}

// Singleton
let parserInstance: IssueParser | null = null;

export function getIssueParser(schemaPath?: string): IssueParser {
  if (!parserInstance) {
    parserInstance = new IssueParser(schemaPath);
  }
  return parserInstance;
}

export function resetIssueParser(): void {
  parserInstance = null;
}