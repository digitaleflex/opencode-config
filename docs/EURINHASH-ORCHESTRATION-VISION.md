# EURINHASH — Orchestration & Control Plane

> Version 1.0 — 2026-09-19
> FR/EN canonical operational document

## FR

`opencode-config` est le **control plane** d'EurinHash. Il ne doit pas devenir le produit UI ni le runtime de code lui-même. Il coordonne les missions, tâches, ressources, agents, outils, permissions, événements, états, validations et preuves.

### Flux canonique

```text
ISSUE / INTENTION
      ↓
CONTEXT
      ↓
ROUTING
      ↓
PLAN
      ↓
RESOURCE DECISION
      ↓
EXECUTION
      ↓
EVENTS
      ↓
STATE
      ↓
VALIDATION
      ↓
MISSION VERIFICATION
      ↓
PROOF
      ↓
REPORT
```

### Principe fondamental

> Le système ne doit pas seulement choisir un modèle et exécuter une requête. Il doit choisir les ressources suffisantes, contrôler leur consommation, gérer les défaillances et déterminer avec des preuves si la mission est réellement terminée.

### Control plane cible

```text
Mission Engine
Task Engine
Context Engine
Capability Analyzer
Model Intelligence
Model Router
Economy Engine
Agent Control
Tool Control
Permission Control
Workspace/Git Control
Provider/Gateway Control
Event Bus
State Engine
Validation Engine
Mission Verifier
Evidence/Proof Engine
Decision Explainability
Evaluation/Learning
```

### Règles de vérité

`CONFIGURED ≠ DISCOVERED ≠ AVAILABLE ≠ AUTHORIZED ≠ HEALTHY ≠ CAPABLE ≠ ELIGIBLE ≠ ACTIVE ≠ USED`

`REQUESTED ≠ RUNNING ≠ COMPLETED ≠ VALIDATED ≠ VERIFIED`

`UNKNOWN ≠ ZERO` et `SKIPPED ≠ PASSED`.

### Routage

Le routeur sélectionne la ressource **suffisante**, pas nécessairement la plus puissante. Il doit considérer : capacité, contexte, outils, santé, quota, politique, latence, fiabilité, coût et budget de mission.

Le système doit pouvoir expliquer :

- pourquoi une ressource a été sélectionnée ;
- pourquoi une autre a été rejetée ;
- pourquoi un fallback a eu lieu ;
- quelles données étaient connues ou inconnues.

### Économie

Le coût effectif d'une mission inclut : prix API, tokens gaspillés, retries, échecs, latence, reconstruction de contexte, intervention humaine et coût de vérification.

### Vérification

`agent says done` n'est jamais une preuve suffisante.

Une mission est `VERIFIED` uniquement lorsque son contrat, ses critères d'acceptation et ses preuves permettent de l'établir. Sinon elle reste `UNVERIFIED`, `FAILED`, `BLOCKED` ou `NEEDS_REVIEW`.

### Sécurité

Toute écriture doit avoir : repository explicite, branche explicite, chemin autorisé, acteur/agent autorisé, issue et étape de plan identifiables. Un working tree inattendu, une identité ambiguë ou une permission manquante bloque l'écriture.

Les secrets ne doivent jamais être copiés dans issues, plans, événements, logs ou rapports.

### Responsabilités des trois repos

- `eurinhash-engineering` : définition et source de vérité produit/architecture.
- `opencode-config` : orchestration et control plane.
- `eurinhash-opencode` : expérience terminal et intégration produit.

## EN

`opencode-config` is the **EurinHash control plane**. It must not become the product UI or replace the execution runtime. It coordinates missions, tasks, resources, agents, tools, permissions, events, state, validation and proof.

### Canonical flow

```text
ISSUE / INTENT
      ↓
CONTEXT
      ↓
ROUTING
      ↓
PLAN
      ↓
RESOURCE DECISION
      ↓
EXECUTION
      ↓
EVENTS
      ↓
STATE
      ↓
VALIDATION
      ↓
MISSION VERIFICATION
      ↓
PROOF
      ↓
REPORT
```

### Core principle

> The system must not merely choose a model and execute a request. It must select sufficient resources, control their consumption, recover from failures, and determine with evidence whether the mission is actually complete.

### Target control plane

Mission Engine, Task Engine, Context Engine, Capability Analyzer, Model Intelligence, Model Router, Economy Engine, Agent/Tool/Permission Control, Workspace/Git Control, Provider/Gateway Control, Event Bus, State Engine, Validation Engine, Mission Verifier, Evidence/Proof Engine, Decision Explainability, Evaluation and Learning.

### Truth rules

`CONFIGURED ≠ DISCOVERED ≠ AVAILABLE ≠ AUTHORIZED ≠ HEALTHY ≠ CAPABLE ≠ ELIGIBLE ≠ ACTIVE ≠ USED`

`REQUESTED ≠ RUNNING ≠ COMPLETED ≠ VALIDATED ≠ VERIFIED`

`UNKNOWN ≠ ZERO`; `SKIPPED ≠ PASSED`.

### Routing and economy

Routing selects the least costly sufficient resource subject to task capability, context, tools, health, quota, policy, latency, reliability and mission budget. Decisions must be explainable.

Effective cost includes API price, wasted tokens, retries, failed execution, latency, context reconstruction, human intervention and verification cost.

### Verification

An agent's “done” statement is not sufficient evidence. A mission becomes `VERIFIED` only when its contract, acceptance criteria and concrete evidence establish completion.

### Security

Every write requires explicit repository, branch, authorized path, actor/agent, issue and plan-step identity. Unexpected working trees, ambiguous identity or missing permission block writes. Secrets must never enter issues, plans, events, logs or reports.

### Repository boundaries

- `eurinhash-engineering`: product and architecture authority.
- `opencode-config`: orchestration/control-plane authority.
- `eurinhash-opencode`: terminal/product experience and runtime-facing integration.
