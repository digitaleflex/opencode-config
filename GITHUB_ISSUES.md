# GITHUB ISSUES — EURINHASH Agent Governance Engine

## Comment utiliser ce fichier

Ces issues peuvent être créées manuellement sur GitHub ou via `gh issue create` :

```bash
gh issue create --title "feat: implement task classifier" --body "$(cat issue-001.md)"
```

## Phase 3 : MVP Core Engine

---

### issue-001.md — Task Classifier

**Title:** `feat: implement task classifier (L1-L4)`

**Body:**
```markdown
## Description
Implement a task classifier that automatically determines the complexity level (L1-L4) of a user task.

## Requirements
- Accept a task description as input
- Classify into: L1 (Simple), L2 (Standard), L3 (Complex), L4 (Critical)
- Return TaskType enum value
- Support keywords detection
- Be extensible for new task types

## Task Types to support
- TYPO, CONFIG, FORMAT, DOC_READ, DOC_WRITE → L1
- BUG_LOCALIZED, FEATURE_LIMITED, REFACTOR_MODULE → L2
- API_CHANGE, ARCH_DESIGN, SECURITY → L3
- PRODUCTION_DEPLOY, SENSITIVE_DATA, DESTRUCTIVE_OP → L4

## Acceptance Criteria
- [ ] Classification accuracy > 90%
- [ ] Response time < 100ms
- [ ] All task types supported
- [ ] Unit tests passing
- [ ] TypeScript with proper types

## Labels
- feature, core-engine, phase-3
```

---

### issue-002.md — Risk Assessor

**Title:** `feat: implement risk assessor (LOW/HIGH/CRITICAL)`

**Body:**
```markdown
## Description
Assess the risk level of a classified task based on multiple factors.

## Requirements
- Accept TaskSpec (type + scope + blast radius)
- Evaluate risk factors: file count, destructive potential, production impact
- Return RiskLevel: LOW | HIGH | CRITICAL
- Consider guard.ts overrides
- Support custom risk weights

## Risk Factors
- File count modified
- Destructive operations
- Production environment
- Sensitive data access
- Network modifications
- Security implications

## Acceptance Criteria
- [ ] Risk assessment accuracy > 90%
- [ ] Response time < 50ms
- [ ] All risk factors evaluated
- [ ] guard.ts overrides respected
- [ ] Unit tests passing

## Labels
- feature, core-engine, phase-3
```

---

### issue-003.md — Policy Engine

**Title:** `feat: implement policy engine (YAML + TS)`

**Body:**
```markdown
## Description
Implement a policy engine that evaluates tasks against declared policies and returns a PolicySpec.

## Requirements
- Parse YAML policies from `policies/default.yaml`
- Evaluate task against policies
- Return PolicySpec: agents[], modelPlan, proofsRequired[], humanApproval
- Support policy overrides from guard.ts
- Support custom policy loading

## Policy Structure (YAML)
```yaml
policies:
  - name: "L1-SIMPLE"
    complexity: L1
    task_types: [TYPO, CONFIG]
    risk: LOW
    agents: [builder]
    model: free
    proofs_required: 0
    human_approval: false
```

## Acceptance Criteria
- [ ] YAML parsing works correctly
- [ ] Policy matching is accurate
- [ ] PolicySpec returned correctly
- [ ] guard.ts overrides respected
- [ ] Custom policies loadable
- [ ] Unit tests passing

## Labels
- feature, core-engine, phase-3
```

---

### issue-004.md — Proof Verifier

**Title:** `feat: implement proof verifier (tests + review + hash chain)`

**Body:**
```markdown
## Description
Implement a proof verifier that generates and validates proof chains for completed tasks.

## Requirements
- Generate proof chain for each completed task
- Support proof types: tests, code_review, security_scan, human_approval, build_verification
- Hash each proof with SHA-256
- Verify proofs meet PolicySpec requirements
- Return VERDICT: PASS | FAIL | BLOCKED

## Proof Chain Structure
```json
{
  "task_id": "abc123",
  "timestamp": "2026-09-06T00:00:00Z",
  "proofs": [
    {
      "type": "tests",
      "status": "PASS",
      "hash": "sha256:abc123",
      "evidence": {}
    }
  ],
  "verdict": "PASS"
}
```

## Acceptance Criteria
- [ ] Proof chain generated for each task
- [ ] SHA-256 hashes correct
- [ ] All proof types supported
- [ ] Verdict logic correct (L1=1proof, L4=4proofs+human+security)
- [ ] Chain integrity verifiable
- [ ] Unit tests passing

## Labels
- feature, core-engine, phase-3
```

---

### issue-005.md — Guard Overrides

**Title:** `feat: implement guard overrides (dangerous ops blocking)`

**Body:**
```markdown
## Description
Implement guard overrides that block dangerous operations regardless of task complexity.

## Requirements
- Block dangerous commands: rm -rf /, mkfs, dd, DROP DATABASE
- Warn on risky commands: git push --force, rm -rf node_modules
- Override policy when dangerous ops detected
- Log all guard events
- Support custom guard rules

## Guard Rules
```typescript
const GUARD_OVERRIDES = {
  'rm -rf /': { action: 'BLOCK', policy: 'HUMAN_ONLY' },
  'git push --force': { action: 'WARN', policy: 'REVIEW_REQUIRED' },
  'DROP DATABASE': { action: 'BLOCK', policy: 'HUMAN_ONLY' },
  'curl | sh': { action: 'BLOCK', policy: 'HUMAN_ONLY' },
};
```

## Acceptance Criteria
- [ ] All dangerous commands blocked at 100%
- [ ] Warning system works for risky commands
- [ ] Policy overridden correctly
- [ ] Guard events logged
- [ ] Custom rules loadable
- [ ] Unit tests passing

## Labels
- feature, core-engine, security, phase-3
```

---

## Phase 3 : Integration

---

### issue-006.md — Eurinhash Wrapper

**Title:** `feat: wrap eurinhash agent with governance engine`

**Body:**
```markdown
## Description
Wrap the existing eurinhash agent with the governance engine to provide governance for all agent invocations.

## Requirements
- Wrap existing eurinhash agent
- Apply governance to all task invocations
- Pass PolicySpec to agent
- Collect proofs from agent execution
- Return result + proof chain

## Integration Points
- Task Classifier → before agent invocation
- Risk Assessor → after classification
- Policy Engine → determines agent + model
- Guard Overrides → before execution
- Agent Execution → with PolicySpec
- Proof Verifier → after execution

## Acceptance Criteria
- [ ] All eurinhash tasks go through governance
- [ ] PolicySpec passed to agent
- [ ] Proof chain returned
- [ ] Guard overrides applied
- [ ] Backward compatible with existing usage
- [ ] Integration tests passing

## Labels
- feature, integration, phase-3
```

---

### issue-007.md — Audit Logger Integration

**Title:** `feat: integrate with existing audit-logger.ts`

**Body:**
```markdown
## Description
Integrate the governance engine with the existing audit-logger.ts for consistent logging.

## Requirements
- Use existing audit-logger.ts infrastructure
- Log governance events: classification, risk, policy, proof
- Redact sensitive data
- Support existing log format
- Extend with governance-specific fields

## Acceptance Criteria
- [ ] Existing audit-logger.ts used
- [ ] Governance events logged
- [ ] Sensitive data redacted
- [ ] Existing format preserved
- [ ] Integration tests passing

## Labels
- feature, integration, phase-3
```

---

### issue-008.md — FREE Workers

**Title:** `feat: use FREE workers as default`

**Body:**
```markdown
## Description
Ensure the governance engine uses FREE workers by default, following the EURINHASH strategy.

## Requirements
- Use FREE workers as default: codestral, groq, zhipu, novita
- Fallback to other workers if FREE unavailable
- Never use paid models without explicit user consent
- Log worker selection decisions

## Worker Priority
1. codestral (mistral/codestral-latest) - Code specialty
2. groq (groq/qwen/qwen3.8-27b) - Speed
3. zhipu (zhipu/glm-4.7-flash) - Generic
4. novita (ling-3.0-flash-sante) - Free tier

## Acceptance Criteria
- [ ] FREE workers used by default
- [ ] Fallback works correctly
- [ ] No paid models without consent
- [ ] Selection logged
- [ ] Integration tests passing

## Labels
- feature, integration, phase-3
```

---

## Phase 3 : Tests

---

### issue-009.md — Unit Tests Classifier

**Title:** `test: unit tests for task classifier`

**Body:**
```markdown
## Description
Write comprehensive unit tests for the task classifier.

## Test Cases
- All task types classified correctly
- Unknown tasks handled gracefully
- Edge cases: empty input, very long input, special characters
- Performance: < 100ms response time

## Coverage Target
- > 90% code coverage
- All branches covered
- Edge cases tested

## Labels
- test, core-engine, phase-3
```

---

### issue-010.md — Unit Tests Risk Assessor

**Title:** `test: unit tests for risk assessor`

**Body:**
```markdown
## Description
Write comprehensive unit tests for the risk assessor.

## Test Cases
- All risk factors evaluated correctly
- Risk levels assigned correctly
- guard.ts overrides respected
- Edge cases: missing data, extreme values

## Coverage Target
- > 90% code coverage
- All branches covered
- Edge cases tested

## Labels
- test, core-engine, phase-3
```

---

### issue-011.md — Integration Tests

**Title:** `test: integration tests end-to-end`

**Body:**
```markdown
## Description
Write end-to-end integration tests for the governance engine.

## Test Scenarios
1. L1 task: typo fix → L1 classification → L1 policy → proof chain
2. L2 task: feature add → L2 classification → L2 policy → proof chain
3. L3 task: API change → L3 classification → L3 policy + human approval → proof chain
4. L4 task: production deploy → L4 classification → L4 policy + human + security → proof chain
5. Dangerous op: rm -rf / → BLOCKED

## Coverage Target
- All user stories covered
- All acceptance criteria tested
- Real-world scenarios

## Labels
- test, integration, phase-3
```

---

## Phase 3 : Documentation

---

### issue-012.md — Usage Guide

**Title:** `docs: MVP usage guide`

**Body:**
```markdown
## Description
Write a comprehensive usage guide for the MVP.

## Content
- Quick start guide
- Task classification explanation
- Policy engine overview
- Proof verification guide
- Guard overrides documentation
- Examples: L1, L2, L3, L4 tasks
- Troubleshooting

## Labels
- documentation, phase-3
```

---

### issue-013.md — Policy Syntax Reference

**Title:** `docs: policy syntax reference`

**Body:**
```markdown
## Description
Write a complete reference for the policy YAML syntax.

## Content
- Policy structure
- All available fields
- Examples for each complexity level
- Custom policy creation guide
- Best practices
- Troubleshooting

## Labels
- documentation, phase-3
```

---

### issue-014.md — Examples

**Title:** `docs: examples (typo fix → L1, feature add → L2, etc.)`

**Body:**
```markdown
## Description
Provide concrete examples of governance in action.

## Examples to include
1. Typo fix → L1 → builder only → 0 proofs
2. Config change → L1 → builder only → 0 proofs
3. Bug fix → L2 → planner + builder + reviewer → 2 proofs
4. Feature add → L2 → planner + builder + reviewer → 2 proofs
5. API change → L3 → architect + builder + reviewer + human → 3 proofs
6. Security fix → L3 → security + architect + builder + reviewer + human → 3 proofs
7. Production deploy → L4 → security + architect + human + security scan → 4 proofs
8. Dangerous op → BLOCKED

## Labels
- documentation, phase-3
```

---

## Phase 3 : CI/CD

---

### issue-015.md — GitHub Actions

**Title:** `chore: setup GitHub Actions for testing`

**Body:**
```markdown
## Description
Set up GitHub Actions CI/CD pipeline for the MVP.

## Workflows
- Test: run unit + integration tests on PR/push
- Lint: run ESLint + Prettier on PR/push
- Build: verify TypeScript compilation
- Coverage: generate coverage report

## Triggers
- On: push to main
- On: pull request

## Labels
- ci-cd, phase-3
```

---

### issue-016.md — Linting

**Title:** `chore: setup linting and formatting`

**Body:**
```markdown
## Description
Set up ESLint + Prettier for consistent code quality.

## Requirements
- ESLint with TypeScript support
- Prettier for formatting
- GitHub Actions integration
- Pre-commit hook (optional)

## Rules
- No unused variables
- Proper error handling
- TypeScript strict mode
- Consistent formatting

## Labels
- ci-cd, phase-3
```

---

## Phase 4 : Post-MVP (Future)

---

### issue-017.md — Multi-runtime Adapter

**Title:** `feat: multi-runtime adapter (OpenCode + Claude Code + Codex)`

**Body:**
```markdown
## Description
Create an abstraction layer that allows EURINHASH to work with multiple agent runtimes.

## Supported Runtimes
- OpenCode TUI
- Claude Code SDK
- OpenHands

## Interface
```typescript
interface AgentRuntime {
  invoke(task: TaskSpec, policy: PolicySpec): Promise<Result>;
  validate(): Promise<boolean>;
}
```

## Labels
- feature, phase-4
```

---

### issue-018.md — Oh My OpenCode Integration

**Title:** `feat: integrate oh-my-open-code agents`

**Body:**
```markdown
## Description
Integrate with Oh My OpenCode for enhanced agents, LSP, AST, and MCP support.

## Integration Points
- Oh My OpenCode agents → our agent pool
- LSP/AST tools → enhanced code analysis
- MCP integration → extended capabilities

## Labels
- feature, integration, phase-4
```

---

### issue-019.md — Dashboard

**Title:** `feat: dashboard for proof visualization`

**Body:**
```markdown
## Description
Create a dashboard to visualize governance metrics and proof chains.

## Features
- Proof chain viewer
- Governance metrics (L1-L4 distribution, approval rates)
- Audit trail explorer
- Security event dashboard

## Labels
- feature, phase-4
```

---

### issue-020.md — npx Installer

**Title:** `feat: npx create-eurinhash-agent installer`

**Body:**
```markdown
## Description
Create a one-command installer for EURINHASH.

## Usage
```bash
npx create-eurinhash-agent my-project
cd my-project
eurinhash "add login feature"
```

## Features
- Template project generation
- Default policies setup
- Worker configuration
- First-run experience

## Labels
- feature, developer-experience, phase-4
```

---

## Summary

| Phase | Issues | Status |
|---|---|---|
| Phase 3 (MVP Core) | #001-005 | To do |
| Phase 3 (Integration) | #006-008 | To do |
| Phase 3 (Tests) | #009-011 | To do |
| Phase 3 (Docs) | #012-014 | To do |
| Phase 3 (CI/CD) | #015-016 | To do |
| Phase 4 (Future) | #017-020 | Backlog |

**Total: 20 issues**
- Phase 3 MVP: 16 issues (~2-3 sprints)
- Phase 4 Future: 4 issues (post-MVP)
