# POLICY ENGINE DECISION — EURINHASH

## 1. Problème

Comment exprimer, stocker et appliquer les règles de gouvernance ?

## 2. Options analysées

### Option A : OPA (Open Policy Agent) — REJETÉE

| Critère | Évaluation |
|---|---|
| Maturité | ✅ Production-ready, CNCF |
| Expressivité | ✅ Rego très puissant |
| Intégration agentique | ❌ Conçu pour infrastructure, pas pour agents IA |
| Complexité | ⚠️ Stack complexe pour notre cas |
| Taille | ~50MB binaire |

**Verdict :** Trop générique. OPA est excellent pour Kubernetes, pas pour les tâches d'agents IA.

### Option B : Cedar — REJETÉE

| Critère | Évaluation |
|---|---|
| Maturité | ✅ Amazon用它 |
| Expressivité | ⚠️ Limité aux authorize/deny |
| Intégration agentique | ❌ Pas de workflow, juste authorize |
| Spécifique agent | ❌ Conçu pour IAM |

**Verdict :** Trop limité. Pas de support pour les workflows d'agents.

### Option C : Règles YAML simples — CHOISIE

| Critère | Évaluation |
|---|---|
| Maturité | ✅ Simple et éprouvé |
| Expressivité | ✅ Suffisant pour notre cas |
| Intégration agentique | ✅ Natif au domaine |
| Complexité | ✅ Zero dépendances |
| Lisibilité | ✅ Lisible par non-développeurs |
| Performance | ✅ Parsing instantané |

**Verdict :** Pas besoin d'OPA pour 4 niveaux de complexité. YAML suffit.

### Option D : Guardrails AI — ÉTUDIÉE

| Critère | Évaluation |
|---|---|
| Maturité | ✅ Production-ready |
| Expressivité | ✅ Pydantic + guards |
| Intégration agentique | ✅ Conçu pour agents IA |
| Notre cas | ✅ Utile pour les security guards |

**Verdict :** INTÉGRER pour la partie security scanning, pas pour la policy engine principale.

### Option E : Règles en TypeScript — ÉTUDIÉE

| Critère | Évaluation |
|---|---|
| Maturité | ✅ Notre stack |
| Expressivité | ✅ Maximum |
| Intégration agentique | ✅ Natif |
| Lisibilité non-dev | ❌ Nécessite un développeur |

**Verdict :** UTILISER pour la POLICY ENGINE (programmatique), YAML pour les POLICIES (déclaratives).

## 3. Architecture décidée

```
┌──────────────────────────────────────────────────────┐
│                  POLICY ENGINE                        │
│                                                      │
│  ┌─────────────────┐    ┌─────────────────────┐   │
│  │  policies.yaml   │    │   policy-engine.ts   │   │
│  │  (déclaratif)   │───→│   (exécutif)         │   │
│  └─────────────────┘    └─────────────────────┘   │
│                                    │               │
│                                    ↓               │
│  ┌─────────────────────────────────────────────┐   │
│  │         Policy Spec Output                   │   │
│  │  { agents, model_plan, proofs, human_approval } │
│  └─────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### `policies.yaml` — Declarative Policies

```yaml
policies:
  - name: "L1-SIMPLE-TYPO"
    complexity: L1
    task_types: [TYPO, CONFIG, FORMAT]
    risk: LOW
    agents: [builder]
    model: free
    proofs_required: 0
    human_approval: false

  - name: "L2-STANDARD-FEATURE"
    complexity: L2
    task_types: [FEATURE_LIMITED, REFACTOR_MODULE, BUG_LOCALIZED]
    risk: LOW
    agents: [planner, builder, reviewer]
    model: free
    proofs_required: 2
    human_approval: false

  - name: "L3-COMPLEX-API"
    complexity: L3
    task_types: [API_CHANGE, ARCH_DESIGN, SECURITY]
    risk: HIGH
    agents: [planner, architect, builder, reviewer]
    model: strong
    proofs_required: 3
    human_approval: true

  - name: "L4-CRITICAL-PRODUCTION"
    complexity: L4
    task_types: [PRODUCTION_DEPLOY, SENSITIVE_DATA, DESTRUCTIVE_OP]
    risk: CRITICAL
    agents: [planner, architect, security, builder, reviewer]
    model: strong
    proofs_required: 4
    human_approval: true
    security_scan: true
```

### `policy-engine.ts` — Executable Engine

```typescript
interface PolicySpec {
  name: string;
  agents: AgentType[];
  modelPlan: ModelPlan;
  proofsRequired: ProofType[];
  humanApproval: boolean;
  securityScan: boolean;
}

function evaluate(task: TaskSpec): PolicySpec {
  // 1. Trouver la politique correspondante
  // 2. Vérifier les overrides (guard.ts)
  // 3. Retourner le PolicySpec
}
```

## 4. Règles de Policy

### Classification Rules

```
Task Type → Complexity → Risk → Policy

TYPO / CONFIG / FORMAT → L1 → LOW → builder
DOC_READ / DOC_WRITE → L1 → LOW → builder
BUG_LOCALIZED → L2 → LOW → planner → builder → reviewer
FEATURE_LIMITED → L2 → LOW → planner → builder → reviewer
REFACTOR_MODULE → L2 → LOW → planner → builder → reviewer
API_CHANGE → L3 → HIGH → architect → builder → reviewer + HUMAN
ARCH_DESIGN → L3 → HIGH → architect → builder → reviewer + HUMAN
SECURITY → L3 → HIGH → security → architect → builder → reviewer + HUMAN
PRODUCTION_DEPLOY → L4 → CRITICAL → security → architect → HUMAN + SECURITY_SCAN
SENSITIVE_DATA → L4 → CRITICAL → security → HUMAN + SECURITY_SCAN
DESTRUCTIVE_OP → L4 → CRITICAL → HUMAN_ONLY (pas d'agent)
```

### Guard Overrides

```typescript
const GUARD_OVERRIDES = {
  'rm -rf /': { action: 'BLOCK', policy: 'HUMAN_ONLY' },
  'git push --force': { action: 'WARN', policy: 'REVIEW_REQUIRED' },
  'DROP DATABASE': { action: 'BLOCK', policy: 'HUMAN_ONLY' },
  'rm -rf node_modules': { action: 'WARN', policy: 'REVIEW_REQUIRED' },
  'curl | sh': { action: 'BLOCK', policy: 'HUMAN_ONLY' },
};
```

## 5. Décisions finales

| Question | Décision |
|---|---|
| Policy format | YAML pour les policies, TypeScript pour l'engine |
| Policy location | `policies/` folder |
| OPA | NON — trop complexe pour notre cas |
| Cedar | NON — trop limité |
| Guardrails AI | INTÉGRER pour security scanning |
| Policy overrides | `guard.ts` comme source de vérité |
| Policy versioning | Git-based |

## 6. Roadmap d'implémentation

1. Créer `policies/default.yaml`
2. Implémenter `policy-engine.ts`
3. Intégrer dans `eurinhash.md`
4. Ajouter tests
5. Documenter