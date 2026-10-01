# EurinHash Cross-Repository Orchestration Architecture

## Overview

This document defines the canonical architecture for cross-repository orchestration across the EurinHash system. Three repositories participate in one system with explicit authority boundaries.

## Canonical Three-Repository Model

```
EURINHASH-ENGINEERING
  specification / UX / architecture / acceptance
              ↓
OPENCODE-CONFIG
  orchestration / agents / commands / rules / routing
              ↓
EURINHASH-OPENCODE
  product / TUI / runtime integration / presentation
              ↓
VALIDATION
              ↓
ISSUE REPORT / CLOSURE
```

### Repository Roles

| Repository | Role | Authority Domains |
|------------|------|-------------------|
| `digitaleflex/eurinhash-engineering` | Specification | Product vision, UX specification, Architecture contract, Acceptance criteria |
| `digitaleflex/opencode-config` | Orchestration | Orchestration, Agent/rule/command config, Validation evidence |
| `digitaleflex/eurinhash-opencode` | Product/Runtime | Runtime/product behavior, UI presentation |

## Authority Matrix

| Concern | Authority | Read By | Write Target |
|---------|-----------|---------|--------------|
| Product vision | engineering | all | engineering |
| UX specification | engineering | config + product | engineering |
| Architecture contract | engineering | all | engineering |
| Acceptance criteria | engineering/issue | all | issue/engineering |
| Orchestration | opencode-config | product + agents | opencode-config |
| Agent/rule/command config | opencode-config | runtime/config agents | opencode-config |
| Runtime/product behavior | eurinhash-opencode | orchestration + UI | eurinhash-opencode |
| UI presentation | eurinhash-opencode | orchestration | eurinhash-opencode |
| Validation evidence | orchestration/reporting | all | orchestration/issue |

## Mandatory Decision Rules

1. **Specification is not implementation** — Engineering owns what; Config/Product own how
2. **Configuration is not a substitute for product code** — Config drives behavior, doesn't replace it
3. **Product UI is not an orchestration engine** — TUI presents, doesn't decide routing
4. **Backend/runtime capability gaps become explicit issues** — No silent fallbacks
5. **Every cross-repository write must identify** repository, branch, path, and issue
6. **Unknown authority blocks automatic write** — Fail closed on ambiguity

## Cross-Repository Lifecycle

```
issue → context → authority resolution → routing → plan → approval → execution → validation → report
```

### Detailed Flow

1. **Issue** — Canonical issue created in appropriate repository (see issue specification)
2. **Context** — Relevant specs, architecture, registry entries fetched
3. **Authority Resolution** — Registry consulted to determine read/write permissions per repository
4. **Routing** — Work routed to correct repository based on authority matrix
5. **Plan** — Implementation plan created with explicit repository/path/operation targets
6. **Approval** — Authorization gate evaluates plan (ALLOW/DENY/REQUIRES_APPROVAL/UNKNOWN)
7. **Execution** — Work executed in target repositories with attestation
8. **Validation** — Evidence collected, proofs verified
9. **Report** — Results recorded, issue updated, cross-repo traceability maintained

## Required Artifacts

| Artifact | Location | Purpose |
|----------|----------|---------|
| Architecture document | `docs/architecture.md` | This file — canonical reference |
| Repository/authority registry | `orchestration/repositories/repository-map.yaml` | Machine-readable authority map |
| Change-routing rules | `src/core/registry.ts` | Code that enforces routing |
| Issue contract references | `orchestration/issues/issue-schema.json` | Canonical issue specification |
| Boundary/security rules | `src/core/authorization-gate.ts` | Execution authorization gate |

## Cross-Repository Write Protocol

Every write to a repository other than the originating one MUST include:

```yaml
cross_repo_write:
  source_repo: "opencode-config"      # Where the write originates
  target_repo: "eurinhash-opencode"   # Where the write goes
  target_branch: "main"               # Explicit branch
  target_path: "src/components/X.tsx" # Explicit path
  operation: "CREATE|UPDATE|DELETE"   # Operation type
  issue_ref: "eurinhash-engineering#123"  # Originating issue
  authorization: "ALLOWED"            # Gate decision
  attestation: "att-..."              # Tool attestation token
```

## Security Boundaries

### Read Boundaries
- Any repository MAY be read if listed in registry
- Read does not imply write permission
- Private/internal paths marked in registry

### Write Boundaries
- Write permission is explicit per repository/path/operation
- Cross-repo writes require authorization gate approval
- Dirty/untracked/conflicted working tree blocks protected writes
- Secret material never crosses repository boundaries

### Prohibited Actions
- Fork OpenCode merely to obtain UI data
- Create duplicate state/event sources
- Infer authority from filenames
- Silently broaden repository scope
- Copy secrets across repositories

## Validation Evidence Requirements

Each cross-repository operation must produce:
- Architecture document review record
- Registry validation result
- Routing fixture results
- Wrong-target rejection evidence
- Cross-repository dry-run results
- Authorization decision audit trail
- Secret redaction verification

## Extensibility

New repositories must declare:
- Stable repository ID and full name
- Canonical URL and default branch
- Role (specification/orchestration/product/other)
- Authority domains
- Read paths/entry points
- Write paths/allowed operations
- Documentation entry points
- Validation commands
- Runtime/product relationship
- Status and metadata availability

Before becoming routable, new entries must pass registry validation. Existing workflows must fail safely when an entry is incomplete.

## Example Routing Decisions

| Change Type | Originates In | Authority Resolution | Routed To |
|-------------|---------------|---------------------|-----------|
| New UX spec | engineering | engineering owns UX | engineering (write), config+product (read) |
| New agent config | opencode-config | config owns orchestration | opencode-config (write) |
| UI bug fix | eurinhash-opencode | product owns UI | eurinhash-opencode (write) |
| Architecture change | engineering | engineering owns arch | engineering (write), all (read) |
| Security policy | opencode-config | config owns security rules | opencode-config (write), all (read) |
| Runtime capability gap | eurinhash-opencode | product identifies gap | engineering (issue), config (routing) |

---

*This architecture is the single source of truth for cross-repository authority. All orchestration code, issue templates, and authorization logic must align with this document.*