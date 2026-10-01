// src/core/registry.ts — Repository Authority Registry
// Machine-readable registry parser, validator, and resolver for cross-repository orchestration

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

export interface RepositoryEntry {
  id: string;
  name: string;
  full_name: string;
  url: string;
  default_branch: string;
  role: RepositoryRole;
  status: RepositoryStatus;
  authority_domains: string[];
  read_paths: string[];
  write_paths: string[];
  allowed_operations: OperationType[];
  documentation_entry_points: string[];
  validation_commands: string[];
  runtime_product_relationship: RuntimeRelationship;
  metadata: RepositoryMetadata;
}

export type RepositoryRole = "specification" | "orchestration" | "product" | "other";
export type RepositoryStatus = "active" | "planned" | "deprecated" | "archived";
export type OperationType = "CREATE" | "UPDATE" | "DELETE";
export type RuntimeRelationship = "upstream" | "middleware" | "downstream" | "independent";

export interface RepositoryMetadata {
  description: string;
  contact: string;
}

export interface ResolutionConfig {
  explicit_selection_required: boolean;
  fail_on_unknown: boolean;
  fail_on_conflict: boolean;
}

export interface PermissionsConfig {
  read_allowed: string[];
  write_allowed: string[];
  write_path_allowlist: WritePathRule[];
  operation_allowlist: OperationAllowRule[];
  requires_approval: ApprovalCondition[];
}

export interface WritePathRule {
  repo: string;
  paths: string[];
}

export interface OperationAllowRule {
  repo: string;
  operations: OperationType[];
}

export interface ApprovalCondition {
  condition: string;
  description: string;
}

export interface ExtensibilityConfig {
  required_fields_for_new_repo: string[];
  fail_safe_on_incomplete: boolean;
  validate_new_entry: string;
}

export interface FixturesConfig {
  valid_entries: string[];
  missing_metadata: { repo: string; missing: string[] }[];
  conflicting_metadata: { repo: string; conflict: string }[];
  unknown_repository: string[];
}

export interface RegistrySchema {
  schema_version: string;
  updated: string;
  repositories: RepositoryEntry[];
  resolution: ResolutionConfig;
  permissions: PermissionsConfig;
  extensibility: ExtensibilityConfig;
  fixtures: FixturesConfig;
}

export interface AuthorityResolution {
  repository: RepositoryEntry | null;
  decision: "ALLOW" | "DENY" | "REQUIRES_APPROVAL" | "UNKNOWN";
  reason: string;
  matched_paths: string[];
  matched_operations: OperationType[];
  requires_approval: boolean;
  approval_conditions: ApprovalCondition[];
}

export interface CrossRepoWriteRequest {
  source_repo: string;
  target_repo: string;
  target_branch: string;
  target_path: string;
  operation: OperationType;
  issue_ref: string;
}

export class RepositoryRegistry {
  private schema: RegistrySchema | null = null;
  private repoById: Map<string, RepositoryEntry> = new Map();

  constructor(private registryPath?: string) {}

  /**
   * Load and parse the registry from YAML file
   */
  load(): RegistrySchema {
    const path = this.registryPath || join(process.cwd(), "orchestration", "repositories", "repository-map.yaml");
    const content = readFileSync(path, "utf-8");
    const parsed = parseYaml(content) as RegistrySchema;

    // Validate schema version
    if (!parsed.schema_version) {
      throw new Error("Registry missing schema_version");
    }

    // Build lookup map
    this.repoById.clear();
    for (const repo of parsed.repositories) {
      this.repoById.set(repo.id, repo);
    }

    this.schema = parsed;
    return parsed;
  }

  /**
   * Get the loaded schema (loads if not already loaded)
   */
  getSchema(): RegistrySchema {
    if (!this.schema) {
      this.load();
    }
    return this.schema!;
  }

  /**
   * Get repository by ID
   */
  getRepository(id: string): RepositoryEntry | undefined {
    if (!this.schema) this.load();
    return this.repoById.get(id);
  }

  /**
   * Get all repositories
   */
  getAllRepositories(): RepositoryEntry[] {
    if (!this.schema) this.load();
    return this.schema!.repositories;
  }

  /**
   * Get repositories by role
   */
  getRepositoriesByRole(role: RepositoryRole): RepositoryEntry[] {
    return this.getAllRepositories().filter((r) => r.role === role);
  }

  /**
   * Get repositories allowed for reading
   */
  getReadAllowedRepositories(): RepositoryEntry[] {
    const schema = this.getSchema();
    return schema.permissions.read_allowed
      .map((id) => this.getRepository(id))
      .filter((r): r is RepositoryEntry => r !== undefined);
  }

  /**
   * Get repositories allowed for writing
   */
  getWriteAllowedRepositories(): RepositoryEntry[] {
    const schema = this.getSchema();
    return schema.permissions.write_allowed
      .map((id) => this.getRepository(id))
      .filter((r): r is RepositoryEntry => r !== undefined);
  }

  /**
   * Resolve authority for a cross-repository write request
   * This is the core authorization decision point
   */
  resolveAuthority(request: CrossRepoWriteRequest): AuthorityResolution {
    const schema = this.getSchema();
    const targetRepo = this.getRepository(request.target_repo);

    // Unknown repository
    if (!targetRepo) {
      return {
        repository: null,
        decision: schema.resolution.fail_on_unknown ? "DENY" : "UNKNOWN",
        reason: `Unknown target repository: ${request.target_repo}`,
        matched_paths: [],
        matched_operations: [],
        requires_approval: true,
        approval_conditions: schema.permissions.requires_approval.filter(
          (c) => c.condition === "unknown_authority"
        ),
      };
    }

    // Repository not write-allowed
    if (!schema.permissions.write_allowed.includes(request.target_repo)) {
      return {
        repository: targetRepo,
        decision: "DENY",
        reason: `Repository ${request.target_repo} is not write-allowed`,
        matched_paths: [],
        matched_operations: [],
        requires_approval: false,
        approval_conditions: [],
      };
    }

    // Check path allowlist
    const pathRule = schema.permissions.write_path_allowlist.find(
      (r) => r.repo === request.target_repo
    );
    let pathMatched = false;
    let matchedPaths: string[] = [];

    if (pathRule) {
      for (const pattern of pathRule.paths) {
        if (this.matchGlob(request.target_path, pattern)) {
          pathMatched = true;
          matchedPaths.push(pattern);
        }
      }
    }

    if (!pathMatched) {
      return {
        repository: targetRepo,
        decision: "DENY",
        reason: `Path ${request.target_path} not allowed for repository ${request.target_repo}`,
        matched_paths: [],
        matched_operations: [],
        requires_approval: false,
        approval_conditions: [],
      };
    }

    // Check operation allowlist
    const opRule = schema.permissions.operation_allowlist.find(
      (r) => r.repo === request.target_repo
    );
    let opMatched = false;
    let matchedOps: OperationType[] = [];

    if (opRule) {
      if (opRule.operations.includes(request.operation)) {
        opMatched = true;
        matchedOps.push(request.operation);
      }
    }

    if (!opMatched) {
      return {
        repository: targetRepo,
        decision: "DENY",
        reason: `Operation ${request.operation} not allowed for repository ${request.target_repo}`,
        matched_paths: [],
        matched_operations: [],
        requires_approval: false,
        approval_conditions: [],
      };
    }

    // Check if approval required
    const approvalConditions = schema.permissions.requires_approval.filter((c) => {
      if (c.condition === "cross_repo_write" && request.source_repo !== request.target_repo) {
        return true;
      }
      if (c.condition === "destructive_operation" && request.operation === "DELETE") {
        return true;
      }
      // Other conditions would need more context
      return false;
    });

    const requiresApproval = approvalConditions.length > 0;

    return {
      repository: targetRepo,
      decision: requiresApproval ? "REQUIRES_APPROVAL" : "ALLOW",
      reason: requiresApproval ? "Cross-repository write requires human approval" : "Authority resolved",
      matched_paths: matchedPaths,
      matched_operations: matchedOps,
      requires_approval: requiresApproval,
      approval_conditions: approvalConditions,
    };
  }

  /**
   * Check if a repository can be read
   */
  canRead(repoId: string): boolean {
    const schema = this.getSchema();
    return schema.permissions.read_allowed.includes(repoId);
  }

  /**
   * Check if a repository can be written to
   */
  canWrite(repoId: string): boolean {
    const schema = this.getSchema();
    return schema.permissions.write_allowed.includes(repoId);
  }

  /**
   * Validate a repository entry for completeness
   */
  validateEntry(entry: Partial<RepositoryEntry>): { valid: boolean; missing: string[] } {
    const schema = this.getSchema();
    const required = schema.extensibility.required_fields_for_new_repo;
    const missing = required.filter((field) => !(field in entry));
    return { valid: missing.length === 0, missing };
  }

  /**
   * Simple glob matching (supports **, *, ?)
   */
  private matchGlob(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\./g, "\\.")
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, "[^/]");
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Get fixtures for testing
   */
  getFixtures(): FixturesConfig {
    return this.getSchema().fixtures;
  }
}

// Singleton instance
let registryInstance: RepositoryRegistry | null = null;

export function getRegistry(registryPath?: string): RepositoryRegistry {
  if (!registryInstance) {
    registryInstance = new RepositoryRegistry(registryPath);
  }
  return registryInstance;
}

export function resetRegistry(): void {
  registryInstance = null;
}