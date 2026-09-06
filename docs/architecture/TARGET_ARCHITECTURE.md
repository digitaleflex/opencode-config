# EURINHASH Target Architecture

Couche de gouvernance **indépendante** des runtimes d'agents IA. Elle orchestre la prise de décision, le routage multi-provider, et la chaîne de preuve, sans dépendre d'un runtime en particulier (OpenCode, Claude Code, Cursor, etc.).

## 1. Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────────┐
│                       EURINHASH GOVERNANCE ENGINE                    │
│                                                                       │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Task Classifier│  │ Risk Assessor│  │ Policy Engine│             │
│  │ (classify)     │  │ (score)      │  │ (decide)     │             │
│  └───────┬────────┘  └───────┬──────┘  └──────┬───────┘             │
│          │                   │                │                      │
│          ▼                   │                │                      │
│  ┌──────────────┐            │                │                      │
│  │ Agent Selector│            │                │                      │
│  │ (orchestrate)│◄───────────┼────────────────┼──────────────────────│
│  └───────┬──────┘            │                │                      │
│          │                   │                │                      │
│          ▼                   ▼                ▼                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Model Router  │  │ Proof Verifier│ │  Registry    │             │
│  │ (fallback)    │  │ (verify)      │ │ (policies,   │             │
│  └───────┬──────┘  └───────┬──────┘ │  skills)     │             │
│          │                     ▲      └──────────────┘             │
│          ▼                     │                                  │
│  ┌──────────────────────────────────────────┐                     │
│  │           Runtime Adapter                │                     │
│  │    (OpenCode | Claude Code | SDK | CLI)   │                     │
│  └───────────────────┬──────────────────────┘                     │
└─────────────────────┼────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│                       AGENT RUNTIME                          │
│                                                               │
│   OpenCode (TUI)  |  Claude Code (SDK)  |  CLI / SDK bridge   │
│                                                               │
│   Workers:                                                   │
│   worker-codestral | worker-groq | worker-zhipu |            │
│   worker-novita | worker-google | (mammouth: payant)        │
└──────────────────────────────────────────────────────────────┘
```

Les flux traversent d'abord toute la couche **Governance Engine**, puis délèguent l'exécution concrète au runtime via un **adapter** standardisé. Aucun worker gratuit n'est invoqué tant que la gouvernance n'a pas validé la politique.

---

## 2. Modules de gouvernance

### 2.1 Task Classifier

- **Responsabilité** : analyser la demande (prompt + contexte de workspace) ; produire un `TaskSpec` avec `TaskType` et `Scope`.
- **Entrées** :
  - `prompt` (string)
  - `workspace` (tree, file list, git diff si présent)
  - `user_profile` (rôles, préférences, projets favoris)
- **Sorties** :
  - `TaskSpec { id, type, scope, touched_files[], blast_radius, complexity_hint }`
- **Dépendances** : vocabulaire `docs/architecture/GOVERNANCE_MODEL.md §2-3` ; heuristiques NLP légères (regex patterns).
- **Implémentation inspirée de** : `skills/hash-code-navigation` (analyse tree), `plugin/guard.ts` (patterns destructeurs).

### 2.2 Risk Assessor

- **Responsabilité** : établir `RiskLevel ∈ {LOW, HIGH, CRITICAL}` à partir des facteurs de risque.
- **Entrées** :
  - `TaskSpec` (type, scope, touched_files)
  - `workspace_secrets` (détectés par scan statique)
  - `env_policy` (production? CI? données PII?)
- **Sorties** :
  - `RiskAssessment { level, factors[], justification }`
- **Facteurs** (`docs/09-security.md §2`) : `writes_to_production`, `touches_donnees_sensibles`, `operation_destructive`, `change_auth`, `change_payment`, `blast_radius_system`, `deploiement`, `provider_payant`.
- **Dépendances** : `plugin/guard.ts` patterns, `plugin/audit-logger.ts` secret patterns, env vars du workspace.

### 2.3 Policy Engine

- **Responsabilité** : combiner `Complexity` + `Risk` → `PolicySpec` (quels agents, quel modèle, quelles preuves, quelles approbations). Implémente la matrice `GOVERNANCE_MODEL.md §5` et la grille `PROOF_MODEL.md §3.1`.
- **Entrées** :
  - `TaskSpec`, `RiskAssessment`
  - `policy_registry` (fichiers `policy/*.yaml` versionnés)
  - `user_overrides` (waivers, urgences)
- **Sorties** :
  - `PolicySpec { agents[], model_plan, proofs_required[], human_approval_required, security_scan_level }`
- **Logique clé** :
  - `guard-detected → complexity bump + human_approval mandatory`
  - `provider_payant dans TaskSpec → model router locked on free; escalade bloquée sans validation`
  - `risk=CRITICAL → complexity ≥ L3, proofs ≥ 3, security_scan=full`
- **Dépendances** : `free-models.json`, `provider_circuit.json`, `docs/architecture/PROOF_MODEL.md`.

### 2.4 Agent Selector

- **Responsabilité** : traduire `PolicySpec.agents` en séquence d'invocation concrète via le runtime (subagent / delegation).
- **Entrées** :
  - `PolicySpec`
  - `availability_matrix` (agents disponibles dans le runtime)
  - `skills_registry` (skills installées)
- **Sorties** :
  - `AgentPlan { pipeline[], current_agent }` + événement `agent.invoked` vers audit.
- **Ordonnancement** : L1 → `builder` seul ; L2 → `planner → builder → reviewer` ; L3 → `planner → architect → [design-lead?] → builder → reviewer` (approval gate après architect) ; L4 → pipeline L3 + `security` + gate `risk-assessment` + relecture indépendante.
- **Dépendances** : `agent/*.md` (définitions d'agents), `skills/*/` (compétences).

### 2.5 Model Router

- **Responsabilité** : garantir le **FREE-first** (jamais de modèle payant sans accord) et gérer le fallback automatique (`codestral → groq → zhipu → novita → google → mammouth`).
- **Entrées** :
  - `PolicySpec.model_plan` (exigence de spécialité : code vs chat)
  - `free-models.json` (disponibilité, max-30min staleness)
  - `provider_circuit.json` (état circuit breaker : CLOSED/OPEN/HALF_OPEN)
  - `provider_usage.json` (quota quotidien)
- **Sorties** :
  - `ModelPlan { selected_provider, fallback_chain[], rationale }`
- **Invariants** :
  - Staleness > 30 min → trigger `scripts/free-probe.py` (refresh) avant décision.
  - `OPEN` → skip provider ; `HALF_OPEN` → mode test 1 req.
  - Quota épuisé → skip ; tous KO → signaler `@eurinhash` pour escalade mammouth (nécessite validation explicite).
- **Dépendances** : `hash-direct.py` wrapper, `scripts/free-probe.py`, `AGENTS.md` protocole (§1-6).

### 2.6 Proof Verifier

- **Responsabilité** : collecter, valider l'intégrité et exiger les preuves définies par `PolicySpec.proofs_required`. Décide `DONE` ou `BLOCKED`.
- **Entrées** :
  - `PolicySpec.proofs_required`
  - Résultats d'exécution (tests, lint, scans, builds)
  - `ProofReport` des runtimes (sorties Outil standardisées)
- **Sorties** :
  - `ProofReport { task_id, status: PASS|FAIL|BLOCKED, passed[], failed[], blocked[], chain_hash }`
- **Critère DONE** : `status == PASS` **et** intégrité de chaîne (`_chain.json` vérifié).
- **Dépendances** : `docs/architecture/PROOF_MODEL.md` (taxonomie + niveaux), `plugin/audit-logger.ts` (traçabilité), `plugin/guard.ts` (scan).

---

## 3. Runtime Adapter (abstraction runtime)

- **Responsabilité** : normaliser l'interface vers les runtimes hétérogènes (OpenCode TUI, Claude Code SDK, CLI, SDK custom). Le runtime exécute ce que la gouvernance a décidé, mais **n'override jamais** une décision de gouvernance.
- **Interface unifiée** :
  - `invoke_agent(agent_id, payload)` → délègue un subagent
  - `run_tool(tool, args)` → exécute un outil (gardé par `guard.ts`)
  - `submit_proof(proof_type, result)` → envoie au Proof Verifier
  - `request_approval(task_id, reason)` → déclenche une approbation humaine
  - `emit_event(event)` → journalise vers `logs/audit-*.jsonl`
- **Implémentations connues** :
  - `adapter/opencode.ts` — OpenCode plugin bridge (`opencode.jsonc`).
  - `adapter/claude-code.ts` — Claude Code SDK bridge.
  - `adapter/cli.ts` — wrapper `hash-direct-wrapper.py`-like pour CLI.

---

## 4. Cross-coupe: provenance des données

| Module | Source de vérité |
|---|---|
| Task Classifier | prompt + `agent/*` + `skills/hash-code-navigation` |
| Risk Assessor | `plugin/guard.ts` patterns + `plugin/audit-logger.ts` secrets + env runtime |
| Policy Engine | `docs/architecture/*` + `policy/*.yaml` + `AGENTS.md` (intelligent routing matrix) |
| Agent Selector | `agent/*.md` + `skills/*/` + routing matrix `AGENTS.md` |
| Model Router | `free-models.json`, `provider_circuit.json`, `provider_usage.json`, `scripts/free-probe.py` |
| Proof Verifier | `docs/architecture/PROOF_MODEL.md` + `plugin/guard.ts` + `plugin/audit-logger.ts` |
| Runtime Adapter | OpenCode plugins (`plugin/`), scripts Python (`scripts/`) |

---

## 5. Invariants d'architecture (garanties)

1. **FREE-first** : le Model Router ne sélectionne jamais un provider payant (mammouth) sans validation explicite enregistrée (`logs/approvals/<id>.json`).
2. **Never-stop** : si tous les workers FREE sont KO, le pipeline signale `@eurinhash` et s'arrête en demandant validation — **jamais d'appel silencieux à un provider payant**.
3. **Governance-first** : aucune exécution concrète (outil `bash`, modification production) n'a lieu avant validation de `PolicySpec` et `ProofReport PASS`.
4. **Chain-of-proof** : un `task_id` est `DONE` ssi toutes les preuves requises sont présentes, valides et chaînées par hash.
5. **Separation of concerns** : le runtime n'évalue ni ne contredit la classification/risk/policy ; il exécute.

---

## 6. Roadmap évolutive

| Échéance | Capability | Modules impactés |
|---|---|---|
| V1 | Gouvernance au-dessus d'OpenCode | Classique: Classifier→Risk→Policy→Selector→Router→Verifier |
| V2 | Support multi-runtime (Claude Code, Cursor) | Abstraction Runtime Adapter |
| V3 | Autonomous recovery (retry loop) | Model Router + Proof Verifier (loop) |
| V4 | Learning loop drift (réajuste L-niveau) | Policy Engine + feedback `logs/policies/<id>.feedback.json` |

---

## 7. Annexes

- `AGENTS.md` — protocole EURINHASH, workers FREE, routing matrix.
- `docs/01-architecture.md` — composants OpenCode existants.
- `docs/09-security.md` — détection ops sensibles, redaction secrets, permissions.
- `docs/architecture/GOVERNANCE_MODEL.md` — pipeline décisionnel + matrice TASK→COMPLEXITY→RISK→POLICY.
- `docs/architecture/PROOF_MODEL.md` — taxonomie & niveaux de preuves, chaîne d'intégrité.
- `plugin/guard.ts`, `plugin/audit-logger.ts` — implémentations concrètes sécurité/audit.
- `scripts/free-probe.py`, `scripts/hash-direct.py` — probe disponibilité + fallback.
