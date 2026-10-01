// tests/fixtures/cross-repo-orchestration.fixtures.ts — Cross-repository orchestration test fixtures

import { ParsedIssue } from "../../src/core/issue-parser";

export const validFeatureIssue: ParsedIssue = {
  identity: {
    issue_number: 42,
    title: "Implement permission control and execution authorization gate",
    type: "feature",
    priority: "high",
    status: "open",
  },
  objective: {
    problem: "No authorization gate exists for cross-repository writes, allowing unauthorized modifications",
    desired_outcome: "Every protected cross-repository write passes through an authorization gate with ALLOW/DENY/REQUIRES_APPROVAL/UNKNOWN decisions",
    user_system_impact: "Prevents unauthorized writes, enables audit trail, blocks secret leakage",
  },
  source_of_truth: {
    engineering_specs: ["https://github.com/digitaleflex/eurinhash-engineering/blob/main/specs/security.md"],
    architecture_refs: ["https://github.com/digitaleflex/opencode-config/blob/main/docs/architecture.md"],
    ux_refs: [],
    existing_decisions: ["https://github.com/digitaleflex/opencode-config/issues/23"],
  },
  repository_scope: {
    read_repositories: ["engineering", "config", "product"],
    write_repositories: ["config"],
  },
  implementation_boundary: {
    must_change: [
      { repository: "config", path: "src/core/authorization-gate.ts", operation: "CREATE", reason: "Core authorization logic" },
      { repository: "config", path: "src/core/registry.ts", operation: "UPDATE", reason: "Add gate integration" },
    ],
    may_change: [
      { repository: "config", path: "tests/authorization-gate.test.ts", operation: "CREATE", reason: "Unit tests" },
    ],
    must_not_change: [
      { repository: "config", path: "src/core/types.ts", reason: "Core type definitions must remain stable" },
    ],
  },
  data_contract: {
    inputs: [
      { name: "issue_id", type: "string", source: "engineering", required: true, description: "Originating issue identifier" },
      { name: "task_spec", type: "TaskSpec", source: "config", required: true, description: "Task to authorize" },
    ],
    outputs: [
      { name: "decision", type: "AuthorizationDecision", destination: "config", description: "ALLOW/DENY/REQUIRES_APPROVAL/UNKNOWN" },
    ],
    entities: [
      { name: "AuthorizationDecision", definition_source: "config", schema_ref: "https://eurinhash.dev/schemas/authorization-decision.json" },
    ],
    fact_sources: [
      { fact: "Cross-repo writes require approval", source: "https://github.com/digitaleflex/opencode-config/docs/architecture.md", authority: "config" },
    ],
  },
  event_contract: {
    consumed_events: [
      { event_type: "issue.created", source: "engineering", correlation_id: "issue-42", payload_schema: "https://eurinhash.dev/schemas/issue-created.json" },
    ],
    emitted_events: [
      { event_type: "authorization.decided", destination: "config", correlation_id: "auth-42", payload_schema: "https://eurinhash.dev/schemas/auth-decision.json" },
    ],
    correlation_ids: ["issue-42", "auth-42"],
  },
  state_contract: {
    lifecycle_states: ["PENDING", "AUTHORIZED", "EXECUTING", "COMPLETED", "FAILED", "BLOCKED"],
    transitions: [
      { from: "PENDING", to: "AUTHORIZED", trigger: "gate_evaluation", guard: "decision != DENY" },
      { from: "AUTHORIZED", to: "EXECUTING", trigger: "execution_start", guard: "working_tree_clean" },
      { from: "EXECUTING", to: "COMPLETED", trigger: "execution_end", guard: "all_proofs_pass" },
      { from: "EXECUTING", to: "FAILED", trigger: "execution_error", guard: "any_proof_fail" },
      { from: "*", to: "BLOCKED", trigger: "gate_evaluation", guard: "decision == DENY" },
    ],
    unknown_semantics: "BLOCK",
  },
  dependencies: {
    blocking_issues: [
      { issue_ref: "#23", repository: "engineering", reason: "Architecture must be defined first" },
      { issue_ref: "#24", repository: "config", reason: "Registry must exist for authority resolution" },
    ],
    required_capabilities: [
      { capability: "YAML registry parser", repository: "config", available: true },
      { capability: "Authorization gate implementation", repository: "config", available: false, gap_issue_ref: "#42" },
    ],
  },
  implementation_steps: [
    { step: 1, repository: "config", action: "Create authorization-gate.ts with decision model", owner: "architect", depends_on: [], validation: "Types compile" },
    { step: 2, repository: "config", action: "Implement repository/path/branch scope checking", owner: "builder", depends_on: [1], validation: "Unit tests pass" },
    { step: 3, repository: "config", action: "Integrate with registry resolver", owner: "builder", depends_on: [2], validation: "Integration test passes" },
    { step: 4, repository: "config", action: "Add audit logging for decisions", owner: "builder", depends_on: [2], validation: "Log output verified" },
    { step: 5, repository: "config", action: "Write fixtures for allowed/denied/approval/unknown", owner: "reviewer", depends_on: [2], validation: "Fixtures validate" },
  ],
  validation: {
    commands: [
      { command: "npm run test:authorization-gate", repository: "config", expected_result: "All tests pass" },
      { command: "npm run verify", repository: "config", expected_result: "Types + lint + tests pass" },
    ],
    runtime_checks: [
      { check: "Authorization gate blocks wrong-repo write", repository: "config", pass_criteria: "Decision = DENY with reason" },
      { check: "Authorization gate allows valid cross-repo write", repository: "config", pass_criteria: "Decision = ALLOW/REQUIRES_APPROVAL" },
    ],
    integration_ui_checks: [
      { check: "UI shows authorization state correctly", repository: "product", pass_criteria: "No bypass possible" },
    ],
    evidence: [
      { type: "test_output", source: "ci", location: "https://github.com/digitaleflex/opencode-config/actions/runs/..." },
      { type: "review_hash", source: "human", location: "https://github.com/digitaleflex/opencode-config/pull/..." },
    ],
  },
  acceptance_criteria: [
    { criterion: "Typed authorization decision model exists", testable: true, mapped_to_evidence: "test_output" },
    { criterion: "Repository/path/branch scope is checked", testable: true, mapped_to_evidence: "test_output" },
    { criterion: "Read and write permissions are distinct", testable: true, mapped_to_evidence: "test_output" },
    { criterion: "Ambiguity defaults to deny or review", testable: true, mapped_to_evidence: "test_output" },
    { criterion: "Every protected execution path passes the gate", testable: true, mapped_to_evidence: "integration_check" },
    { criterion: "UI cannot bypass authorization", testable: true, mapped_to_evidence: "integration_ui_check" },
    { criterion: "Secret material never enters decision logs", testable: true, mapped_to_evidence: "test_output" },
    { criterion: "Fixtures cover allowed, denied, approval-required, unknown", testable: true, mapped_to_evidence: "test_output" },
  ],
  failure_stop_conditions: [
    { condition: "Ambiguous repository identity", action: "BLOCK", reason: "Cannot resolve target repository" },
    { condition: "Missing issue/plan authorization", action: "BLOCK", reason: "No valid authorization context" },
    { condition: "Security policy violation", action: "BLOCK", reason: "Hard deny condition" },
    { condition: "Unexpected dirty tree state", action: "STOP", reason: "Working tree protection" },
  ],
  documentation_reporting: {
    update_docs: [
      { document: "docs/architecture.md", repository: "config", section: "Security Boundaries" },
      { document: "orchestration/repositories/repository-map.yaml", repository: "config", section: "Permissions" },
    ],
    report_format: "markdown",
    audit_trail: true,
  },
  raw: {},
  parse_errors: [],
  parse_warnings: [],
};

export const wrongRepoFixture = {
  description: "Attempt to write to unknown repository",
  request: {
    source_repo: "config",
    target_repo: "unknown-repo",
    target_branch: "main",
    target_path: "src/test.ts",
    operation: "CREATE" as const,
    issue_ref: "issue-123",
  },
  expected: "DENY",
  reason: "Unknown target repository",
};

export const dirtyTreeFixture = {
  description: "Protected execution with dirty working tree",
  input: {
    issue_id: "issue-123",
    repository: "config",
    branch: "main",
    target_paths: ["src/test.ts"],
    operation: "UPDATE" as const,
    tool_command: "edit:src/test.ts",
    risk: "HIGH" as const,
    actor_agent: "builder",
    requested_capability: "filesystem.write",
    working_tree_state: {
      clean: false,
      dirty_files: ["src/modified.ts"],
      untracked_files: ["src/new.ts"],
      conflicted_files: [],
    },
  },
  expected: "DENY",
  reason: "Dirty working tree",
};

export const unauthorizedToolFixture = {
  description: "Unauthorized tool command for capability",
  input: {
    issue_id: "issue-123",
    repository: "config",
    branch: "main",
    target_paths: ["src/test.ts"],
    operation: "UPDATE" as const,
    tool_command: "rm -rf /",
    risk: "CRITICAL" as const,
    actor_agent: "builder",
    requested_capability: "filesystem.write",
    working_tree_state: {
      clean: true,
      dirty_files: [],
      untracked_files: [],
      conflicted_files: [],
    },
  },
  expected: "DENY",
  reason: "Unauthorized tool/command or guard blocked",
};

export const malformedIssueFixture = {
  description: "Issue with missing mandatory fields",
  issueBody: `
title: "Incomplete issue"
# missing: type, priority, status, problem, desired_outcome, etc.
`,
  expectedExecutable: false,
  expectedErrors: ["Missing issue type", "Problem statement too short or missing"],
};

export const bypassPathFixture = {
  description: "Attempt to bypass authorization via path traversal",
  request: {
    source_repo: "config",
    target_repo: "config",
    target_branch: "main",
    target_path: "../../../etc/passwd",
    operation: "CREATE" as const,
    issue_ref: "issue-123",
  },
  expected: "DENY",
  reason: "Path traversal blocked or path outside approved scope",
};

export const auditRedactionFixture = {
  description: "Secret redaction in audit logs",
  input: {
    issue_id: "issue-123",
    repository: "config",
    branch: "main",
    target_paths: ["src/test.ts"],
    operation: "UPDATE" as const,
    tool_command: 'write:src/test.ts with api_key=sk-abcdef1234567890',
    risk: "HIGH" as const,
    actor_agent: "builder",
    requested_capability: "filesystem.write",
    working_tree_state: {
      clean: true,
      dirty_files: [],
      untracked_files: [],
      conflicted_files: [],
    },
  },
  expectedRedactions: ["OPENAI_KEY", "GENERIC_CREDENTIAL"],
};

export const crossRepoWriteFixtures = [
  {
    name: "allowed-cross-repo-write",
    description: "Valid cross-repo write from config to product",
    request: {
      source_repo: "config",
      target_repo: "product",
      target_branch: "main",
      target_path: "src/components/AuthGate.tsx",
      operation: "CREATE" as const,
      issue_ref: "issue-42",
    },
    expected: "REQUIRES_APPROVAL",
  },
  {
    name: "allowed-same-repo-write",
    description: "Valid same-repo write within config",
    request: {
      source_repo: "config",
      target_repo: "config",
      target_branch: "main",
      target_path: "src/core/authorization-gate.ts",
      operation: "CREATE" as const,
      issue_ref: "issue-42",
    },
    expected: "ALLOW",
  },
  {
    name: "denied-wrong-path",
    description: "Cross-repo write to unallowed path",
    request: {
      source_repo: "config",
      target_repo: "engineering",
      target_branch: "main",
      target_path: "src/internal/secret.ts",
      operation: "CREATE" as const,
      issue_ref: "issue-42",
    },
    expected: "DENY",
  },
];

export const authorizationDecisionFixtures = [
  {
    name: "allow-decision",
    input: {
      issue_id: "issue-42",
      repository: "config",
      branch: "main",
      target_paths: ["src/core/authorization-gate.ts"],
      operation: "CREATE" as const,
      tool_command: "write:src/core/authorization-gate.ts",
      risk: "HIGH" as const,
      actor_agent: "architect",
      requested_capability: "filesystem.write",
      working_tree_state: { clean: true, dirty_files: [], untracked_files: [], conflicted_files: [] },
    },
    expected: "ALLOW",
  },
  {
    name: "deny-decision",
    input: {
      issue_id: "issue-42",
      repository: "config",
      branch: "main",
      target_paths: ["../../../etc/passwd"],
      operation: "CREATE" as const,
      tool_command: "write:../../../etc/passwd",
      risk: "CRITICAL" as const,
      actor_agent: "builder",
      requested_capability: "filesystem.write",
      working_tree_state: { clean: true, dirty_files: [], untracked_files: [], conflicted_files: [] },
    },
    expected: "DENY",
  },
  {
    name: "requires-approval-decision",
    input: {
      issue_id: "issue-42",
      repository: "product",
      branch: "main",
      target_paths: ["src/components/AuthGate.tsx"],
      operation: "CREATE" as const,
      tool_command: "write:src/components/AuthGate.tsx",
      risk: "HIGH" as const,
      actor_agent: "builder",
      requested_capability: "cross_repo_write",
      working_tree_state: { clean: true, dirty_files: [], untracked_files: [], conflicted_files: [] },
    },
    expected: "REQUIRES_APPROVAL",
  },
  {
    name: "unknown-decision",
    input: {
      issue_id: "issue-42",
      repository: "UNKNOWN",
      branch: "main",
      target_paths: ["src/test.ts"],
      operation: "CREATE" as const,
      tool_command: "write:src/test.ts",
      risk: "HIGH" as const,
      actor_agent: "builder",
      requested_capability: "filesystem.write",
      working_tree_state: { clean: true, dirty_files: [], untracked_files: [], conflicted_files: [] },
    },
    expected: "DENY",
  },
];