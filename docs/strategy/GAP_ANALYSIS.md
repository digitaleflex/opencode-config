# GAP ANALYSIS — EURINHASH

## 1. Méthodologie

Comparaison :
- **CE QUE NOUS AVONS** (projet actuel)
- **CE QUE NOUS AVONS BESOIN** (vision EURINHASH Agent Governance Engine)
- **CE QUI EXISTE** (open source landscape)

## 2. Commodity — Fonctionnalités déjà disponibles partout

| Fonctionnalité | Disponible chez | Notre action |
|---|---|---|
| Multi-agent orchestration | Oh My OpenCode, Cline, AutoGen | **INTÉGRER** — ne pas reconstruire |
| Circuit Breakers | OpenCode Swarm, Rate Limit Fallback | **INTÉGRER** |
| Fallback automatique | Rate Limit Fallback | **INTÉGRER** |
| LSP/AST tools | Oh My OpenCode, Continue | **INTÉGRER** |
| MCP integration | OpenCode, Cline, OpenHands | **INTÉGRER** |
| Skills | Cline, Continue, OpenCode | **INTÉGRER** |
| Background agents | Cline, OpenCode, OpenHands | **INTÉGRER** |
| Security scanning | Guardrails AI, Inline | **INTÉGRER** |
| Model routing | LiteLLM, OpenRouter | **INTÉGRER** |
| Policy engine | OPA, Cedar | **INTÉGRER** |
| Observability | Cline, OpenHands | **INTÉGRER** |
| Agent monitoring | Cline, OpenCode | **INTÉGRER** |

**Règle :** Ne pas reconstruire ce qui est disponible ailleurs. **INTÉGRER** est la réponse par défaut.

## 3. Integration Opportunity — Fonctionnalités existantes mais intégrables

| Fonctionnalité | Existant chez nous | Solution externe | Action |
|---|---|---|---|
| Fallback modèle | Basique (manual) | Rate Limit Fallback | **INTÉGRER** |
| Agents spécialisés | 9 agents maison | Oh My OpenCode agents | **INTÉGRER** |
| Circuit breaker | Basique | OpenCode Swarm | **INTÉGRER** |
| Quota tracking | Basique | Rate Limit Fallback | **INTÉGRER** |
| LSP/AST | Oh My OpenCode | Oh My OpenCode | **INTÉGRER** |
| MCP | Basique | Cline | **INTÉGRER** |
| Security scanning | audit-logger | Guardrails AI | **INTÉGRER** |
| Model routing | free-probe.py | LiteLLM | **INTÉGRER** |
| Hooks | Basique | OpenCode hooks | **INTÉGRER** |

## 4. Differentiation Opportunity — Notre vraie valeur

| Problème | État du marché | Notre solution | Priorité |
|---|---|---|---|
| Gouvernance des agents par risque | ❌ Aucun produit | **EURINHASH Governance Layer** | 🔥 HAUTE |
| Classification tâche → policy → agents → preuve | ❌ Aucun produit | **Policy Engine L1→L4** | 🔥 HAUTE |
| Proof model (DONE ≠ CODE GENERATED) | ❌ Rare | **Proof Verifier + chaîne hash** | 🔥 HAUTE |
| Runtime agnostic (OpenCode + Claude Code + Codex) | ❌ Aucun | **Runtime Adapter** | 🟠 MOYENNE |
| Installation 1-commande | ❌ Aucun | **npx create-eurinhash-agent** | 🟠 MOYENNE |
| Windows-first experience | ❌ Peu | **hash-direct wrapper** | 🟠 MOYENNE |
| 100% gratuit workflow | ⚠️ Dépend des clés | **4 workers FREE validés** | 🟢 EXISTANT |

## 5. Matrice KEEP / INTEGRATE / REMOVE

### 🟢 KEEP (ce qui fonctionne et est unique)

| Composant | Raison |
|---|---|
| **EURINHASH Supervisor** | Identité unique, orchestration simple |
| **Matrice L1→L4** | Gouvernance claire des tâches |
| **Sécurité intégrée** | envsitter-guard + guard.ts + audit-logger |
| **Windows wrapper** | hash-direct, optimisation Windows |
| **4 workers FREE validés** | Valeur immédiate |
| **Documentation** | CONFIG-GUIDE.md + AGENTS.md + eurinhash.md |
| **audit-logger.ts** | Journalisation + redaction secrets |

### 🟡 INTEGRATE (mieux ailleurs)

| Composant | Action | Cible |
|---|---|---|
| Fallback | Remplacer par | opencode-rate-limit-fallback |
| Agents | Étendre avec | Oh My OpenCode agents |
| Circuit Breakers | Ajouter | OpenCode Swarm |
| LSP/AST | Activer via | Oh My OpenCode |
| MCP | Activer via | Cline |
| Model routing | Étendre avec | LiteLLM |
| Security scanning | Ajouter | Guardrails AI |

### 🔴 REMOVE (supprimer)

| Composant | Raison |
|---|---|
| ~~fallback maison~~ | Remplacé par Rate Limit Fallback |
| ~~circuit breaker maison~~ | Remplacé par OpenCode Swarm |
| ~~agents maison~~ | Remplacé par Oh My OpenCode |
| ~~manual routing~~ | Automatisé par EURINHASH Governance |

## 6. Résumé des gaps

| Gap | Sévérité | Solution |
|---|---|---|
| Pas de Policy Engine | 🔴 CRITIQUE | Construire (Phase 3) |
| Pas de Proof Model | 🔴 CRITIQUE | Construire (Phase 3) |
| Fallback basique | 🟠 MOYEN | Intégrer Rate Limit Fallback |
| Circuit breaker basique | 🟠 MOYEN | Intégrer OpenCode Swarm |
| Pas de runtime agnostic | 🟡 MOYENNE | Construire Runtime Adapter |
| Pas d'installateur | 🟡 MOYENNE | Construire npx create-eurinhash-agent |
| Observabilité basique | 🟢 FAIBLE | Étendre audit-logger |
| Pas de dashboard | 🟢 FAIBLE | Post-MVP |

## 7. Décisions architecturales

### Ce que nous BÂTIRONS (uniquement) :
1. **Governance Layer** — Classification + Risk + Policy + Proof
2. **Runtime Adapter** — Abstraction vers OpenCode / Claude Code / Codex
3. **Installer** — npx create-eurinhash-agent

### Ce que nous INTÉGRERON :
1. Oh My OpenCode (agents + LSP + AST + MCP)
2. Rate Limit Fallback (fallback + circuit breaker)
3. LiteLLM (model routing)
4. Guardrails AI (security scanning)

### Ce que nous GARDERONS :
1. EURINHASH Supervisor
2. Matrice L1→L4
3. Sécurité intégrée
4. Windows wrapper
5. 4 workers FREE

## 8. Conclusion

**La vraie différenciation est dans la couche de gouvernance, pas dans l'orchestration.**

EURINHASH ne doit pas concurrencer Oh My OpenCode ou Cline sur l'orchestration. Il doit les utiliser et ajouter une couche de gouvernance au-dessus qui détermine QUAND, POURQUOI et COMMENT utiliser les agents.

C'est là que réside la valeur unique du projet.