# MASTER ROADMAP — EURINHASH Agent Governance Engine

## Vision
Devenir la couche de gouvernance indépendante pour tous les agents IA — déterminant QUAND, POURQUOI et COMMENT utiliser les agents, pas juste fournir des agents.

## Stratégie Globale
KEEP-INTEGRATE-BUILD :
- **KEEP** : Ce qui fonctionne et est unique (supervisor, matrice L1→L4, sécurité)
- **INTEGRER** : Ce qui existe mieux ailleurs (Oh My OpenCode, Rate Limit Fallback, etc.)
- **BUILD** : Ce qui est notre vraie différenciation (Governance Layer)

## Phases du projet

### Phase 0 : Fondation (Terminée)
- Audit complet du projet actuel ✅
- Recherche paysage open source ✅
- Analyse des gaps ✅
- Validation de la proposition de valeur ✅

### Phase 1 : Architecture de gouvernance (En cours/Terminée)
- Modèle de gouvernance (L1→L4 workflows) ✅
- Modèle de preuve (DONE ≠ CODE GENERATED) ✅
- Architecture cible ✅
- Décision policy engine (YAML + TS) ✅

### Phase 2 : Définition MVP (En cours/Terminée)
- Périmètre MVP défini ✅
- User stories ✅
- Architecture MVP ✅
- Stratégie de développement ✅

### Phase 3 : Implémentation MVP (À venir)
**Objectif** : Livrer un gouvernance engine fonctionnel qui prouve la valeur

#### Livrables Phase 3
1. **Core Governance Engine**
   - Task classifier (L1→L4)
   - Risk assessor (LOW/HIGH/CRITICAL)
   - Policy engine (YAML policies + TS evaluation)
   - Proof verifier (tests + review + chain)
   - Guard overrides (dangerous ops blocking)

2. **Intégration avec existant**
   - Wrapper autour de eurinhash agent
   - Utilisation des 4 workers FREE validés
   - Intégration avec audit-logger.ts
   - Respect de la matrice L1→L4 existante

3. **Tests et documentation**
   - Tests unitaires pour chaque composant
   - Tests d'intégration end-to-end
   - Documentation d'utilisation
   - Exemples concrets

#### Critères de succès Phase 3
- [ ] Classification précise (>90%)
- [ ] Politiques appliquées correctement
- [ ] Preuves générées et validées
- [ ] Ops dangereuses bloquées à 100%
- [ ] Modèles gratuits utilisés par défaut
- [ ] Documentation complète
- [ ] Code propre et testé

### Phase 4 : Écosystème et intégrations (Post-MVP)
**Objectif** : Étendre l'utilisabilité et l'adoption

#### Livrables Phase 4
1. **Multi-runtime adapter**
   - Abstraction vers OpenCode TUI
   - Abstraction vers Claude Code SDK
   - Abstraction vers OpenHands
   - Interface commune pour l'exécution

2. **Intégrations externes**
   - Oh My OpenCode (agents + LSP + AST + MCP)
   - Rate Limit Fallback (fallback + circuit breaker)
   - LiteLLM (model routing avancé)
   - Guardrails AI (security scanning)
   - OpenCode Swarm (circuit breakers + workflow)

3. **Observabilité et dashboard**
   - Visualisation des preuves
   - Métriques de gouvernance
   - Audit trail interactif
   - Reporting de conformité

4. **Expérience développeur**
   - Installateur npx create-eurinhash-agent
   - CLI pour gérer les politiques
   - Templates de politiques pré-définis
   - Extension VS Code

### Phase 5 : Enterprise et échelle (Long terme)
**Objectif** : Préparer l'adoption en entreprise

#### Livrables Phase 5
1. **Sécurité avancée**
   - SSO integration
   - RBAC pour les politiques
   - Audit export (SIEM, Splunk, etc.)
   - Chiffrement des preuves

2. **Gestion d'équipe**
   - Workspaces partagés
   - Approval workflows en équipe
   - Politique d'équipe vs personnelle
   - Delegation d'approbation

3. **Deployment options**
   - Self-hosted Docker
   - Kubernetes operator
   - Cloud service option
   - Air-gapped support

4. **Compliance**
   - Templates SOC 2, ISO 27001, HIPAA
   - Rapports de conformité automatisés
   - Intégration avec GRC tools

## GitHub Issues à créer (Phase 3 MVP)

Voici les issues GitHub recommandées pour le développement du MVP :

### Core Engine
- `feat: implement task classifier (L1-L4)`
- `feat: implement risk assessor (LOW/HIGH/CRITICAL)`
- `feat: implement policy engine (YAML parser + TS evaluator)`
- `feat: implement proof verifier (tests + review + hash chain)`
- `feat: implement guard overrides (dangerous ops blocking)`

### Integration
- `feat: wrap eurinhash agent with governance engine`
- `feat: integrate with existing audit-logger.ts`
- `feat: respect existing L1-L4 matrix from AGENTS.md`
- `feat: use FREE workers as default (codestral, groq, zhipu, novita)`

### Tests
- `test: unit tests for task classifier`
- `test: unit tests for risk assessor`
- `test: unit tests for policy engine`
- `test: unit tests for proof verifier`
- `test: integration tests end-to-end`
- `test: test dangerous ops blocking`

### Documentation
- `docs: MVP usage guide`
- `docs: policy syntax reference`
- `docs: proof chain explanation`
- `docs: examples (typo fix → L1, feature add → L2, etc.)`
- `docs: contribution guidelines`

### CI/CD
- `chore: setup GitHub Actions for testing`
- `chore: setup linting and formatting`
- `chore: setup automatic versioning`

## Dépendances et intégrations recommandées

### À intégrer (Phase 4)
| Projet | Objectif | Issue |
|---|---|---|
| Oh My OpenCode | Agents spécialisés + LSP + AST + MCP | `feat: integrate oh-my-open-code agents` |
| Rate Limit Fallback | Fallback sophistiqué + circuit breaker | `feat: integrate rate-limit-fallback` |
| LiteLLM | Model routing avancé | `feat: integrate liteLLM for model routing` |
| Guardrails AI | Security scanning | `feat: integrate guardrails for security` |
| OpenCode Swarm | Circuit breakers + workflow | `feat: integrate open-code-swarm` |

### À garder (Phase 1-5)
| Composant | Raison |
|---|---|
| eurinhash supervisor | Identité unique, orchestration simple |
| Matrice L1→L4 | Gouvernance claire des tâches |
| Sécurité intégrée | envsitter-guard + guard.ts + audit-logger |
| Windows wrapper | hash-direct, optimisation Windows |
| 4 workers FREE validés | Valeur immédiate |
| Documentation | CONFIG-GUIDE.md + AGENTS.md + eurinhash.md |

## Métriques de suivi

### Durant le développement (Phase 3)
- Vélocité : issues complétées / sprint
- Qualité : couverture de tests (>80%)
- Stabilité : build passing (%)
- Rapidité : temps de feedback (CI)

### Post-MVP (Adoption)
- Activation : nombre d'installations npx
- Rétention : % d'utilisateurs actifs après 30 jours
- Valeur : % de tâches utilisant gouvernance vs directe
- Satisfaction : NPS score
- Sécurité : nombre d'ops dangereuses bloquées

## Timeline estimée

| Phase | Durée | Livrable clé |
|---|---|---|
| Phase 0-2 (Foundation) | 4 semaines | Terminé |
| Phase 3 (MVP) | 2-3 semaines | Governance Engine fonctionnel |
| Phase 4 (Écosystème) | 6-8 semaines | Multi-runtime + intégrations |
| Phase 5 (Enterprise) | 3-4 mois | Features entreprise |

## Success Criteria définitif

Le projet sera considéré comme un succès quand :

1. **Adoption** : >1000 développeurs utilisent eurinhash pour la gouvernance
2. **Valeur** : >50% des tâches utilisent au moins une gouvernance (L2+)
3. **Sécurité** : 100% des ops dangereuses sont bloquées
4. **Preuves** : 100% des tâches terminées ont une preuve chaîne vérifiable
5. **Gratuité** : >90% des tâches utilisent exclusivement les modèles gratuits
6. **Satisfaction** : NPS > 50 parmi les utilisateurs actifs

## Appel à l'action

**Prochaine étape immédiate** : Commencer l'implémentation du MVP (Phase 3) en créant le repository GitHub et en démarrant le développement du core engine.

---
*Document généré le : 2026-09-06*
*Basé sur les travaux des Phases 0-2 : audit, recherche, stratégie, architecture*