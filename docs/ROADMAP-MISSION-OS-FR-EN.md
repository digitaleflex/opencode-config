# EURINHASH — Mission OS Roadmap

> FR/EN — v1.0 — 2026-09-19

## FR — Ordre de construction

### Phase 0 — Architecture Freeze

Verrouiller les contrats de Mission, Task, Context, Capability, Model, Provider, Account, Gateway, Agent, Tool, Budget, Event, State, Validation, Evidence, Verification et Proof.

### Phase 1 — Control Plane Foundation

Issues existantes : #23–#34.

Objectif : orchestration cross-repository sûre et déterministe.

### Phase 2 — Core Engines

Issues : #35–#49.

Objectif : issue/task/event/state/session/agent/tool/permission/workspace/model/MCP/LSP/Git/command/telemetry.

### Phase 3 — Command Center

Issues : #50–#66.

Objectif : interface mission-centered, activity, task, issue, command, Git, MCP/LSP, observability, modes, navigation, focus, notifications et recovery.

### Phase 4 — Integration & Proof

Issues : #67–#72.

Objectif : adapter d'état UI, vertical slice réel, intégration complète, budgets de performance, sécurité adversariale et product-readiness.

### Phase 5 — Mission Intelligence Expansion

Propositions à formaliser :

- M73 Model Intelligence Architecture
- M74 models.dev Adapter
- M75 Capability Matching
- M76 Intelligent Model Router
- M77 Free/Subscription Resource Strategy
- M78 Token Economy Engine
- M79 Provider/Gateway Failover
- M80 Mission Contract Engine
- M81 Mission Verifier
- M82 Multi-Model Review
- M83 Gateway Abstraction
- M84 Mission Budget Engine
- M85 Decision Explainability Engine
- M86 Evidence & Proof Engine
- M87 Mission Replay Engine
- M88 Agent Evaluation Engine
- M89 Mission Learning Engine

Ces références sont des **propositions d'architecture** tant qu'elles ne sont pas créées et vérifiées dans GitHub.

## Dépendances conceptuelles

```text
Architecture
 ↓
Contracts
 ↓
Context + Routing
 ↓
Planning
 ↓
Secure Execution
 ↓
Validation
 ↓
Command Center
 ↓
Real Vertical Slice
 ↓
Security + Performance
 ↓
Mission Intelligence
 ↓
Learning
```

La sécurité est transversale et doit protéger l'exécution avant toute capacité autonome supplémentaire.

## Critère de succès

Le système est réussi lorsqu'une mission réelle peut être :

1. comprise ;
2. contractualisée ;
3. décomposée ;
4. dotée en ressources ;
5. exécutée ;
6. observée ;
7. validée ;
8. vérifiée ;
9. prouvée ;
10. rejouée ou auditée.

---

## EN — Build order

### Phase 0 — Architecture Freeze

Lock the contracts for Mission, Task, Context, Capability, Model, Provider, Account, Gateway, Agent, Tool, Budget, Event, State, Validation, Evidence, Verification and Proof.

### Phase 1 — Control Plane Foundation

Existing issues #23–#34 establish safe deterministic cross-repository orchestration.

### Phase 2 — Core Engines

Issues #35–#49 establish issue/task/event/state/session/agent/tool/permission/workspace/model/MCP/LSP/Git/command/telemetry foundations.

### Phase 3 — Command Center

Issues #50–#66 establish the mission-centered product interface and operational UX.

### Phase 4 — Integration & Proof

Issues #67–#72 establish UI state integration, the real vertical slice, regression, performance, adversarial security and release readiness.

### Phase 5 — Mission Intelligence Expansion

Proposed architecture work: model intelligence, catalog adapter, capability matching, intelligent routing, resource economy, failover, mission contracts, verifier, multi-model review, gateway abstraction, budgets, explainability, evidence/proof, replay, evaluation and learning.

These M73–M89 identifiers are architectural proposals until actually created and verified in GitHub.

### Success criterion

A real mission must be understandable, contractualized, decomposed, resourced, executed, observed, validated, verified, proven and auditable/replayable.
