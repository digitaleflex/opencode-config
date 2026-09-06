# EURINHASH Governance Model

> Independence layer above heterogeneous agent runtimes (OpenCode, Claude Code, etc.).
> Reference: `AGENTS.md`, `docs/01-architecture.md`, `docs/02-configuration.md`, `AGENTS.md` routing matrix.

## 1. Pipeline décisionnel

```
TASK → Classification → Complexity (L1-L4) → Risk (LOW/HIGH/CRITICAL) → Policy → Agents → Models → Execution → Proof → DONE
```

| Stage | Responsable | Sortie | Persistance |
|---|---|---|---|
| Task | Task Classifier | `TaskSpec` (type, scope, files) | `logs/tasks/<id>.json` |
| Classification | Task Classifier | `TaskType` + `Scope` | — |
| Complexity | Task Classifier | `L1..L4` | — |
| Risk | Risk Assessor | `LOW/HIGH/CRITICAL` | — |
| Policy | Policy Engine | `PolicySpec` | `logs/policies/<id>.json` |
| Agents | Agent Selector | `[Agent]` | — |
| Models | Model Router | `ModelPlan` (provider order) | — |
| Execution | Runtime (OpenCode/Claude Code) | `ExecutionStatus` | `logs/audit-*.jsonl` |
| Proof | Proof Verifier | `ProofReport` | `logs/proofs/<id>.json` |

Chaque stage est une fonction `pure-ish` : entrée → décision → événement d'audit. La gouvernance est **orthogonale** au runtime : le runtime exécute, la couche EURINHASH décide *comment* et *avec quelles garanties*.

---

## 2. Classification des tâches (Task Type)

Définition normalisée, inspirée du routing matrix existant et généralisée :

| Task Type | Exemples concrets | Blast radius |
|---|---|---|
| `DOC_READ` | résumé, navigation codebase, explication existante | local |
| `CONFIG` | typo, couleur, config, setting local | local |
| `BUG_LOCALIZED` | bug localisé, fix d'une ligne, log, import cassé | local |
| `FEATURE_LIMITED` | nouvelle endpoint, module limité, business logic locale | module |
| `REFACTOR_MODULE` | refactor d'un module, rename, extraction | module |
| `API_CHANGE` | modification d'API, contrat cassant | service |
| `ARCH_DESIGN` | nouvelle architecture, infra, auth, schéma | système |
| `SECURITY` | vulnérabilités, secrets, permissions, hardening | système |
| `PRODUCTION_DEPLOY` | déploiement, migration, rollback | production |
| `SENSITIVE_DATA` | PII, secrets, données clients | donnée |
| `DESTRUCTIVE_OP` | rm -rf, mkfs, migration destructive | production |

---

## 3. Classification du risque

Matériau inspiré de `plugin/guard.ts` et `docs/09-security.md`.

| Niveau | Critères d'évaluation | Décisionnel |
|---|---|---|
| `LOW` | Aucun blast radius produit ; aucune donnée sensible ; opérations non destructrices. | Pas de blocage ; preuves L1 suffisantes. |
| `HIGH` | Impact potentiel sur un service / module ; données non critiques ; modification d'API. | Revue exigée ; preuves L2-L3. |
| `CRITICAL` | Production, données sensibles/PII, opérations destructrices, infra. | **Approbation humaine obligatoire** ; preuves L4 ; scan sécurité. |

Facteurs d'évaluation (`RiskFactor`), combinés par Policy Engine :

`- writes_to_production` `- touches_donnees_sensibles` `- operation_destructive` `- change_auth` `- change_payment` `- blast_radius_module_vs_system` `- deploiement` `- provider_payant`.

---

## 4. Niveaux de complexité & workflows

Référence : routing matrix `AGENTS.md`.

### L1 — Simple
- **Workflow** : `@builder` (exécution directe).
- **Agents** : `builder` (ou `worker-*` directement pour code).
- **Modèles** : gratuits par défaut (`worker-codestral → worker-groq → worker-zhipu → worker-novita → worker-google`); jamais mammouth sans accord.
- **Skills** : `hash-verification` (targeted).
- **Preuves** : 1 (voir PROOF_MODEL.md §3).
- **Approbation** : jamais (sauf override explicite).

### L2 — Standard
- **Workflow** : `@planner → @builder → @reviewer`.
- **Agents** : `planner` (plan), `builder` (implémentation), `reviewer` (revue).
- **Modèles** : gratuits ; `hash-enterprise-development` + `hash-verification`.
- **Preuves** : 2.
- **Approbation** : humaine optionnelle si `HIGH`.

### L3 — Complexe
- **Workflow** : `@planner → @architect → user-approval → @builder → @reviewer`.
- **Agents** : `planner`, `architect`, (optionnel `design-lead` si UI), `builder`, `reviewer`.
- **Modèles** : gratuits en priorité ; `hash-enterprise-development` + `hash-verification`; possibilité de forcer modèle plus costaud (explicite).
- **Preuves** : 3 + approbation humaine.
- **Approbation** : **obligatoire** si `HIGH/CRITICAL`.

### L4 — Critique
- **Workflow** : `@planner → @architect → risk-assessment → user-approval(required) → @builder → @reviewer → independent-review`.
- **Agents** : `planner`, `architect`, `security` (risk assessment), `builder`, `reviewer`, relecture indépendante.
- **Modèles** : gratuits par défaut ; escalade payante uniquement sur **validation explicite** (mammouth).
- **Preuves** : 4 + humain + sécurité.
- **Approbation** : **obligatoire** ; refus = arrêt du pipeline.

---

## 5. Matrice classification → politique

| Task Type | Exemple de scope | Complexity | Risk | Policy (résumé) |
|---|---|---|---|---|
| `DOC_READ` | résumé README | L1 | LOW | builder + 1 proof |
| `CONFIG` | typo couleur | L1 | LOW | builder + 1 proof |
| `BUG_LOCALIZED` | import cassé 1 ligne | L1 | LOW | builder + 1 proof |
| `BUG_LOCALIZED` | bug + risque perf | L2 | HIGH | planner→builder→reviewer + 2 proofs |
| `FEATURE_LIMITED` | endpoint CRUD | L2 | HIGH | planner→builder→reviewer + 2 proofs |
| `REFACTOR_MODULE` | extraction module | L2 | HIGH | planner→builder→reviewer + 2 proofs |
| `API_CHANGE` | contrat cassant | L3 | HIGH | planner→architect→approve→build→review + 3p |
| `ARCH_DESIGN` | nouvelle infra | L3 | CRITICAL | planner→architect→approve→build→review + 3p |
| `SECURITY` | vulnérabilité | L3 | CRITICAL | + security scan; approbation |
| `PRODUCTION_DEPLOY` | migration prod | L4 | CRITICAL | L4 full + security + independent review |
| `SENSITIVE_DATA` | PII / secrets | L4 | CRITICAL | L4 full + security + human |
| `DESTRUCTIVE_OP` | rm -rf, mkfs | L4 | CRITICAL | `guard.ts` bloque; approbation humaine exigée |

> La matrice est implémentée par le **Policy Engine** comme règles déclaratives (`policy/*.yaml`).

### 5.1 Règles de surcharge (overrides)
- `guard.ts` bloque `DESTRUCTIVE_OP` → requiert `@architect` + `@security` + approbation humaine, **quelle que soit la complexity initiale**.
- `provider_payant` détecté → escalade au **model router** ; bloque l'exécution tant qu'il n'y a pas validation explicite (conformément au protocole EURINHASH §6).
- `data_sensitive` → L4 minimal automatiquement.

---

## 6. Apprenance et drift

- Chaque tâche génère `(TaskSpec, Policy, ProofReport)` enregistrés dans `logs/`.
- Le `Skill Selector` (EURINHASH Pro / future) peut réajuster la classification L-niveau via feedback loop `logs/policies/<id>.feedback.json`.
- Les décisions anormales (ex: L1 → L4) sont signalées à `security` et journalisées (`agent.invoked`).

---

## 7. Glossaire

- **Agent** : superviseur spécialisé (planner, architect, builder, reviewer, security, etc.).
- **Worker** : provider gratuit de modèles (`worker-groq`, `worker-codestral`, `worker-google`, `worker-zhipu`, `worker-novita`).
- **Model Router** : orchestre le fallback `codestral → groq → zhipu → novita → google → mammouth`.
- **Proof** : artefact de vérification (test / review / scan / build / human) — cf. PROOF_MODEL.md.
- **DONE** : tâche achevée **avec preuves validées**, non seulement code généré.
