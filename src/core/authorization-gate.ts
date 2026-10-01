// src/core/authorization-gate.ts — Execution Authorization Gate
// Canonical gate that must approve every protected repository, filesystem, command
// and cross-repository operation before execution.

import { RepositoryRegistry, CrossRepoWriteRequest, AuthorityResolution, getRegistry } from "./registry";
import { GuardOverrides } from "./guard-overrides";
import { TaskSpec, PolicyDecision, ProofChain, TaskType, RiskLevel, OperationType } from "./types";
import { createHash, randomUUID } from "node:crypto";

export type AuthorizationDecision = "ALLOW" | "DENY" | "REQUIRES_APPROVAL" | "UNKNOWN";

export interface AuthorizationInput {
  issue_id: string;
  plan_id?: string;
  plan_version?: string;
  task_id?: string;
  repository: string;           // target repository identity
  branch: string;               // target branch
  target_paths: string[];       // target path(s)
  operation: OperationType;     // must match registry OperationType
  tool_command: string;         // tool/command being executed
  risk: RiskLevel;
  actor_agent: string;          // agent/actor identity
  requested_capability: string; // capability being requested
  working_tree_state: WorkingTreeState;
  policy_decision?: PolicyDecision;  // from policy engine
  proof_chain?: ProofChain;          // from proof verifier
  guard_decision?: "BLOCKED" | "ALLOWED" | "WARN";  // from guard overrides
}

export interface WorkingTreeState {
  clean: boolean;
  dirty_files: string[];
  untracked_files: string[];
  conflicted_files: string[];
}

export interface AuthorizationResult {
  decision: AuthorizationDecision;
  reason: string;
  policy_rule_ref?: string;
  scope: AuthorizationScope;
  expiry?: number;           // context expiry (ms since epoch)
  conditions?: string[];     // conditions for REQUIRE_APPROVAL
  audit_id: string;          // correlation ID for audit trail
}

export interface AuthorizationScope {
  repository: string;
  branch: string;
  paths: string[];
  operations: OperationType[];
}

export interface AuditRecord {
  audit_id: string;
  timestamp: number;
  input: AuthorizationInput;
  result: AuthorizationResult;
  // Secret material is NEVER included - redacted at source
}

export class AuthorizationGate {
  private registry: RepositoryRegistry;
  private guards: GuardOverrides;
  private auditLog: AuditRecord[] = [];
  private maxAuditSize = 10000;

  constructor(registry?: RepositoryRegistry, guards?: GuardOverrides) {
    this.registry = registry || getRegistry();
    this.guards = guards || new GuardOverrides();
  }

  /**
   * Main authorization decision point.
   * Evaluates all inputs and returns a structured decision.
   */
  authorize(input: AuthorizationInput): AuthorizationResult {
    const auditId = this.generateAuditId();
    const startTime = Date.now();

    // Hard deny conditions (checked in order)
    const denyResult = this.checkHardDenyConditions(input);
    if (denyResult) {
      const result = { ...denyResult, audit_id: auditId };
      this.recordAudit(auditId, input, result);
      return result;
    }

    // Resolve repository authority
    const authority = this.resolveAuthority(input);
    if (authority.decision === "DENY" || authority.decision === "UNKNOWN") {
      const result: AuthorizationResult = {
        decision: authority.decision,
        reason: authority.reason,
        policy_rule_ref: "registry.authority",
        scope: this.buildScope(input),
        conditions: authority.approval_conditions.map(c => c.description),
        audit_id: auditId,
      };
      this.recordAudit(auditId, input, result);
      return result;
    }

    // Check guard overrides
    const guardResult = this.checkGuards(input);
    if (guardResult.decision === "BLOCKED") {
      const result: AuthorizationResult = {
        decision: "DENY",
        reason: `Guard: ${guardResult.reason}`,
        policy_rule_ref: "guard-overrides",
        scope: this.buildScope(input),
        audit_id: auditId,
      };
      this.recordAudit(auditId, input, result);
      return result;
    }

    // Check policy decision
    const policyResult = this.checkPolicy(input);
    if (policyResult.decision === "BLOCKED") {
      const result: AuthorizationResult = {
        decision: "DENY",
        reason: `Policy: ${policyResult.reason}`,
        policy_rule_ref: "policy-engine",
        scope: this.buildScope(input),
        audit_id: auditId,
      };
      this.recordAudit(auditId, input, result);
      return result;
    }

    // Check proof chain (for L3/L4 tasks)
    const proofResult = this.checkProofChain(input);
    if (proofResult.decision === "BLOCKED") {
      const result: AuthorizationResult = {
        decision: "DENY",
        reason: `Proof: ${proofResult.reason}`,
        policy_rule_ref: "proof-verifier",
        scope: this.buildScope(input),
        audit_id: auditId,
      };
      this.recordAudit(auditId, input, result);
      return result;
    }

    // Determine final decision based on authority + policy + proofs
    let finalDecision: AuthorizationDecision = authority.decision;
    let finalReason = authority.reason;
    const conditions: string[] = [];

    // If authority requires approval, honor it
    if (authority.decision === "REQUIRES_APPROVAL") {
      finalDecision = "REQUIRES_APPROVAL";
      finalReason = "Cross-repository write requires human approval";
      conditions.push(...authority.approval_conditions.map(c => c.description));
    }

    // If policy requires human approval, escalate
    if (input.policy_decision?.humanApproval && finalDecision !== "DENY" && finalDecision !== "UNKNOWN") {
      finalDecision = "REQUIRES_APPROVAL";
      finalReason = "Policy requires human approval";
      conditions.push("Policy human_approval=true");
    }

    // If guard warns, note it but don't block (unless policy says otherwise)
    if (guardResult.decision === "WARN") {
      conditions.push(`Guard WARN: ${guardResult.reason}`);
    }

    const result: AuthorizationResult = {
      decision: finalDecision,
      reason: finalReason,
      policy_rule_ref: this.getPrimaryRuleRef(authority, input),
      scope: this.buildScope(input),
      conditions: conditions.length > 0 ? conditions : undefined,
      expiry: Date.now() + 5 * 60 * 1000, // 5 minute validity
      audit_id: auditId,
    };

    this.recordAudit(auditId, input, result);
    return result;
  }

  /**
   * Hard deny conditions - these always result in DENY regardless of other factors
   */
  private checkHardDenyConditions(input: AuthorizationInput): AuthorizationResult | null {
    // 1. Ambiguous repository or branch
    if (!input.repository || input.repository === "UNKNOWN") {
      return {
        decision: "DENY",
        reason: "Ambiguous repository identity",
        policy_rule_ref: "hard-deny.ambiguous-repo",
        scope: this.buildScope(input),
        audit_id: "", // filled by caller
      };
    }

    if (!input.branch || input.branch === "UNKNOWN") {
      return {
        decision: "DENY",
        reason: "Ambiguous branch",
        policy_rule_ref: "hard-deny.ambiguous-branch",
        scope: this.buildScope(input),
        audit_id: "",
      };
    }

    // 2. Path outside approved scope
    for (const path of input.target_paths) {
      const auth = this.registry.resolveAuthority({
        source_repo: "config", // originating repo
        target_repo: input.repository,
        target_branch: input.branch,
        target_path: path,
        operation: input.operation,
        issue_ref: input.issue_id,
      });
      if (auth.decision === "DENY") {
        return {
          decision: "DENY",
          reason: auth.reason,
          policy_rule_ref: "hard-deny.path-scope",
          scope: this.buildScope(input),
          audit_id: "",
        };
      }
    }

    // 3. Missing permission (not in write_allowed)
    if (!this.registry.canWrite(input.repository)) {
      return {
        decision: "DENY",
        reason: `Repository ${input.repository} not write-allowed`,
        policy_rule_ref: "hard-deny.write-permission",
        scope: this.buildScope(input),
        audit_id: "",
      };
    }

    // 4. Unexpected dirty/conflicted state for protected execution
    if (!input.working_tree_state.clean) {
      if (input.operation !== "READ") {
        return {
          decision: "DENY",
          reason: `Dirty working tree: ${input.working_tree_state.dirty_files.length} modified, ${input.working_tree_state.untracked_files.length} untracked, ${input.working_tree_state.conflicted_files.length} conflicted`,
          policy_rule_ref: "hard-deny.dirty-tree",
          scope: this.buildScope(input),
          audit_id: "",
        };
      }
    }

    // 5. Unauthorized tool/command
    if (!this.isToolAuthorized(input.tool_command, input.requested_capability)) {
      return {
        decision: "DENY",
        reason: `Unauthorized tool/command: ${input.tool_command}`,
        policy_rule_ref: "hard-deny.unauthorized-tool",
        scope: this.buildScope(input),
        audit_id: "",
      };
    }

    // 6. Missing issue/plan authorization
    if (!input.issue_id) {
      return {
        decision: "DENY",
        reason: "Missing issue/plan authorization",
        policy_rule_ref: "hard-deny.missing-issue",
        scope: this.buildScope(input),
        audit_id: "",
      };
    }

    // 7. Security policy violation (delegated to guards/policy)
    // Handled by guard and policy checks below

    return null;
  }

  /**
   * Resolve authority using the repository registry
   */
  private resolveAuthority(input: AuthorizationInput): AuthorityResolution {
    // For cross-repo writes, check each target path
    for (const path of input.target_paths) {
      const auth = this.registry.resolveAuthority({
        source_repo: "config",
        target_repo: input.repository,
        target_branch: input.branch,
        target_path: path,
        operation: input.operation,
        issue_ref: input.issue_id,
      });
      if (auth.decision !== "ALLOW") {
        return auth;
      }
    }
    return {
      repository: this.registry.getRepository(input.repository) || null,
      decision: "ALLOW",
      reason: "Authority resolved",
      matched_paths: input.target_paths,
      matched_operations: [input.operation],
      requires_approval: false,
      approval_conditions: [],
    };
  }

  /**
   * Check guard overrides
   */
  private checkGuards(input: AuthorizationInput): { decision: "BLOCKED" | "ALLOWED" | "WARN"; reason: string } {
    const task: TaskSpec = {
      description: input.tool_command,
      operation: input.tool_command,
    };
    const result = this.guards.check(task);
    return {
      decision: result.decision,
      reason: result.reason,
    };
  }

  /**
   * Check policy engine decision
   */
  private checkPolicy(input: AuthorizationInput): { decision: "BLOCKED" | "ALLOWED"; reason: string } {
    if (!input.policy_decision) {
      return { decision: "ALLOWED", reason: "No policy decision (not a governed task)" };
    }
    if (input.policy_decision.decision === "BLOCKED") {
      return { decision: "BLOCKED", reason: input.policy_decision.reason || "Policy blocked" };
    }
    return { decision: "ALLOWED", reason: "Policy approved" };
  }

  /**
   * Check proof chain verification
   */
  private checkProofChain(input: AuthorizationInput): { decision: "BLOCKED" | "ALLOWED"; reason: string } {
    if (!input.proof_chain) {
      // No proof chain required for this task
      return { decision: "ALLOWED", reason: "No proof chain required" };
    }

    // Verify proof chain - would need actual verification logic
    // For now, check if all required proofs are present and not FAIL
    if (input.policy_decision?.proofsRequired) {
      // This would call ProofVerifier.checkMinimumProofs in real implementation
      // Simplified check:
      const hasFailures = input.proof_chain.proofs.some(p => p.status === "FAIL");
      if (hasFailures) {
        return { decision: "BLOCKED", reason: "Proof chain contains FAIL status" };
      }
      const hasPending = input.proof_chain.proofs.some(p => p.status === "PENDING");
      if (hasPending) {
        return { decision: "BLOCKED", reason: "Proof chain contains PENDING status - evidence not yet provided" };
      }
    }
    return { decision: "ALLOWED", reason: "Proof chain verified" };
  }

  /**
   * Check if tool/command is authorized for the requested capability
   */
  private isToolAuthorized(toolCommand: string, capability: string): boolean {
    // Allowlist of authorized tool/command patterns per capability
    // This is a simplified version - real implementation would be more granular
    const authorizedPatterns: Record<string, RegExp[]> = {
      "filesystem.write": [
        /^edit:/,
        /^write:/,
        /^apply_patch:/,
      ],
      "filesystem.read": [
        /^read:/,
        /^glob:/,
        /^grep:/,
        /^ast_grep_search:/,
      ],
      "git": [
        /^git\s+/,
      ],
      "shell": [
        /^shell:/,
      ],
      "cross_repo_write": [
        /^write:/,
        /^edit:/,
        /^apply_patch:/,
      ],
    };

    const patterns = authorizedPatterns[capability] || [];
    return patterns.some(p => p.test(toolCommand));
  }

  /**
   * Build authorization scope from input
   */
  private buildScope(input: AuthorizationInput): AuthorizationScope {
    return {
      repository: input.repository,
      branch: input.branch,
      paths: input.target_paths,
      operations: [input.operation],
    };
  }

  /**
   * Get primary policy rule reference for audit
   */
  private getPrimaryRuleRef(authority: AuthorityResolution, input: AuthorizationInput): string {
    if (authority.decision === "REQUIRES_APPROVAL") return "registry.requires_approval";
    if (input.policy_decision?.humanApproval) return "policy.human_approval";
    return "registry.allow";
  }

  /**
   * Generate audit ID
   */
  private generateAuditId(): string {
    return `auth-${Date.now().toString(36)}-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }

  /**
   * Record audit entry (secret material redacted)
   */
  private recordAudit(auditId: string, input: AuthorizationInput, result: AuthorizationResult): void {
    // Redact sensitive fields
    const redactedInput = this.redactSecrets(input);
    
    const record: AuditRecord = {
      audit_id: auditId,
      timestamp: Date.now(),
      input: redactedInput,
      result,
    };

    this.auditLog.push(record);
    
    // Trim audit log if too large
    if (this.auditLog.length > this.maxAuditSize) {
      this.auditLog = this.auditLog.slice(-this.maxAuditSize);
    }
  }

  /**
   * Redact secret material from input before audit logging
   */
  private redactSecrets(input: AuthorizationInput): AuthorizationInput {
    const redacted = { ...input };
    
    // Redact potential secrets in tool command
    redacted.tool_command = this.redactString(redacted.tool_command);
    
    // Redact paths that might contain secrets
    redacted.target_paths = redacted.target_paths.map(p => this.redactString(p));
    
    // Working tree state paths might contain secrets
    redacted.working_tree_state = {
      ...redacted.working_tree_state,
      dirty_files: redacted.working_tree_state.dirty_files.map(f => this.redactString(f)),
      untracked_files: redacted.working_tree_state.untracked_files.map(f => this.redactString(f)),
      conflicted_files: redacted.working_tree_state.conflicted_files.map(f => this.redactString(f)),
    };

    return redacted;
  }

  private redactString(str: string): string {
    return str
      .replace(/sk-[a-zA-Z0-9]{20,}/g, "sk-****")
      .replace(/Bearer\s+[a-zA-Z0-9._-]+/g, "Bearer ****")
      .replace(/password[=:]\s*[^\s]+/gi, "password=****")
      .replace(/token[=:]\s*[^\s]+/gi, "token=****")
      .replace(/key[=:]\s*[^\s]+/gi, "key=****")
      .replace(/secret[=:]\s*[^\s]+/gi, "secret=****")
      .replace(/api[_-]?key[=:]\s*[^\s]+/gi, "api_key=****");
  }

  /**
   * Get audit log (for external consumption)
   */
  getAuditLog(): AuditRecord[] {
    return [...this.auditLog];
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }
}

// Singleton
let gateInstance: AuthorizationGate | null = null;

export function getAuthorizationGate(): AuthorizationGate {
  if (!gateInstance) {
    gateInstance = new AuthorizationGate();
  }
  return gateInstance;
}

export function resetAuthorizationGate(): void {
  gateInstance = null;
}