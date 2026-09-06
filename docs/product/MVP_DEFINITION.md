# MVP DEFINITION — EURINHASH Agent Governance Engine

## 1. Définition MVP

**MVP = Minimum Viable Product**

Le MVP doit prouver **UNE chose** :

> La gouvernance (classification + policy + proof) améliore significativement l'utilisation d'agents IA par rapport à l'exécution directe.

## 2. Périmètre MVP

### ✅ INCLUS dans le MVP

```
INPUT
  ↓
TASK CLASSIFICATION (L1-L4)
  ↓
RISK ASSESSMENT (LOW/HIGH/CRITICAL)
  ↓
POLICY ENGINE (agents + model + proofs)
  ↓
HUMAN APPROVAL (pour L3-L4)
  ↓
AGENT EXECUTION (via eurinhash)
  ↓
PROOF VERIFICATION (tests + review)
  ↓
OUTPUT + PROOF CHAIN
```

### ❌ EXCLUS du MVP

- Multi-runtime adapter (OpenCode + Claude Code + Codex)
- Dashboard / UI
- Plugin marketplace
- Enterprise features (SSO, audit export)
- Cloud deployment
- Team features
- Custom policy editor UI

## 3. User Stories MVP

### US1 : Développeur utilise le système de classification

```
En tant que développeur,
Je veux que le système classifie automatiquement ma tâche,
Afin de savoir quel niveau de gouvernance est appliqué.

Critères d'acceptation :
- Une tâche "corrige ce typo" → L1
- Une tâche "ajoute une feature" → L2
- Une tâche "refactorise l'architecture" → L3
- Une tâche "déploie en production" → L4
```

### US2 : Le système applique la bonne politique

```
En tant que développeur,
Je veux que le système applique la politique appropriée,
Afin de garantir la qualité sans surcroît de gouvernance.

Critères d'acceptation :
- L1 : pas de review, pas d'approbation
- L2 : review automatique
- L3 : review + approbation humaine
- L4 : review + approbation humaine + security scan
```

### US3 : Le système génère une preuve de travail

```
En tant que développeur,
Je veux que le système génère une preuve de travail,
Afin de prouver que la tâche est terminée correctement.

Critères d'acceptation :
- Les tests passent
- Le code est reviewé
- La preuve est chaînée (hash)
```

### US4 : Le système protège contre les ops dangereuses

```
En tant que développeur,
Je veux que le système bloque les ops dangereuses,
Afin de protéger mon projet.

Critères d'acceptation :
- `rm -rf /` → BLOCKED
- `git push --force` → WARN + REVIEW
- `DROP DATABASE` → BLOCKED
```

### US5 : Le système utilise les modèles gratuits

```
En tant que développeur,
Je veux que le système utilise les modèles gratuits par défaut,
Afin de ne pas dépasser mon budget.

Critères d'acceptation :
- L1-L2 : modèle gratuit uniquement
- L3-L4 : modèle gratuit → fallback si indisponible
- Aucun modèle payant sans accord explicite
```

## 4. Critères de succès MVP

### Métriques quantitatives

| Métrique | Objectif |
|---|---|
| Temps de classification | < 1 seconde |
| Précision de classification | > 90% |
| Temps d'exécution L1 | < 2 minutes |
| Temps d'exécution L4 | < 30 minutes |
| Taux de preuves valides | 100% |
| Taux de blocked dangerous ops | 100% |

### Critères qualitatifs

| Critère | Définition |
|---|---|
| **Utile** | Le développeur comprend pourquoi la gouvernance est appliquée |
| **Non intrusif** | L1-L2 ne nécessitent aucune action manuelle |
| **Protecteur** | Les ops dangereuses sont toujours bloquées |
| **Économe** | Les modèles gratuits sont toujours utilisés en premier |
| **Prouvable** | Chaque tâche terminée a une preuve chaîne |

## 5. Architecture MVP

```
eurinhash-mvp/
├── src/
│   ├── classifier.ts        # Task classification
│   ├── risk-assessor.ts    # Risk assessment
│   ├── policy-engine.ts    # Policy evaluation
│   ├── proof-verifier.ts   # Proof generation & verification
│   ├── guard-overrides.ts  # Dangerous ops blocking
│   └── index.ts            # Entry point
├── policies/
│   └── default.yaml        # Default policies
├── tests/
│   ├── classifier.test.ts
│   ├── risk-assessor.test.ts
│   ├── policy-engine.test.ts
│   └── proof-verifier.test.ts
├── package.json
└── README.md
```

## 6. Stratégie de développement MVP

### Phase 1 : Core (1-2 jours)

- [ ] Task classifier
- [ ] Risk assessor
- [ ] Policy engine
- [ ] Guard overrides

### Phase 2 : Proof (1 jour)

- [ ] Proof verifier
- [ ] Chain generation
- [ ] Tests

### Phase 3 : Integration (1 jour)

- [ ] Intégration eurinhash
- [ ] Tests end-to-end
- [ ] Documentation

## 7. Definition of Done

Le MVP est terminé quand :

- [ ] Toutes les user stories sont implémentées
- [ ] Tous les tests passent
- [ ] La preuve chaîne est générée pour chaque tâche
- [ ] Les ops dangereuses sont bloquées
- [ ] Les modèles gratuits sont utilisés par défaut
- [ ] La documentation est complète
- [ ] Le code est pushé sur GitHub

## 8. Estimation

| Phase | Jours | Total |
|---|---|---|
| Core | 2 | 2 |
| Proof | 1 | 3 |
| Integration | 1 | 4 |

**Total MVP : ~4 jours de développement**

## 9. Prochaines étapes après MVP

1. **Multi-runtime adapter** : Support Claude Code + Codex
2. **Dashboard** : UI pour visualiser les preuves
3. **Custom policies** : Éditeur de politiques
4. **Team features** : SSO, audit export
5. **Cloud deployment** : Service hébergé