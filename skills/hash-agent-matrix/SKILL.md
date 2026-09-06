---
name: hash-agent-matrix
description: Matrice officielle de l'équipe HASH Engineering. Définit pour chaque type de tâche : agents déclenchés, niveau de risque, skills requis, permissions, et niveau de validation. Utilisée par EURINHASH et le routage intelligent.
---

# Matrice HASH_AGENT_MATRIX — Équipe HASH Engineering

Cette matrice définit **quelle équipe d'agents** déclencher selon le **type de tâche**, son **niveau de risque**, et le **pipeline optimal**. Elle est utilisée par le routage intelligent (AGENTS.md) et par le superviseur `eurinhash`.

---

## 🎯 Agents Principaux (2)

| Agent | Modèle | Rôle | Activation |
|---|---|---|---|
| `@planner` | `google/gemini-2.5-flash` (FREE) | Transforme une demande en plan validé. Ne code jamais. | L2, L3, L4 |
| `@builder` | `google/gemini-2.5-flash` (FREE) | Exécute les plans, implémente, corrige, refactorise. | L1, L2, L3, L4 |

> **Règle** : `@planner` + `@builder` sont les seuls agents principaux. Les autres sont des sous-agents spécialisés appelés à la demande.

---

## 🧠 Sous-Agents Spécialisés (7)

| Agent | Modèle | Rôle | Trigger automatique | Permissions |
|---|---|---|---|---|
| `@architect` | `google/gemini-2.5-flash` | Décisions architecturales, modularité, dette technique | L3, L4, nouveau module, refonte API | `bash: deny`, `edit: deny` |
| `@design-lead` | `google/gemini-2.5-flash` | Direction visuelle, UX, design system, accessibilité | UI majeure, nouveau produit, dashboard | `bash: allow`, `edit: allow` |
| `@quality-engineer` | `google/gemini-2.5-flash` | Détecte sur-ingénierie, code IA suspect, non-maintenable | L2, L3, L4, avant commit | `bash: deny`, `edit: deny` |
| `@tester` | `google/gemini-2.5-flash` | Tests ciblés, validation fonctionnelle, régressions | Après tout code non-trivial | `bash: allow`, `edit: deny` |
| `@security` | `google/gemini-2.5-flash` | Auth, authz, input validation, secrets, config | Auth, payments, API, production | `bash: deny`, `edit: deny` |
| `@reviewer` | `google/gemini-2.5-flash` | Revue indépendante : bugs, sécurité, qualité, cohérence | Avant merge, L2-L4 | `bash: deny`, `edit: deny` |
| `@git-engineer` | `google/gemini-2.5-flash` | Git, commits, PR, CI/CD, repo hygiene | Merge prep, pipeline CI | `bash: allow`, `edit: deny` |

> **Tous les modèles sont FREE** (`google/gemini-2.5-flash` ou équivalents).

---

## 🎨 Pipeline par Niveau de Risque (Matrice de Routage)

### L1 — Simple (typo, config, bug localisé, couleur)
```
@builder  (L1)
    ↓
✅ SHIP (vérif basique)
```

| Agent | Skills | Validation |
|---|---|---|
| `@builder` | `hash-verification`, `hash-enterprise-development` | Smoke test rapide |

---

### L2 — Moyen (feature limitée, module, endpoint, business logic)
```
@planner
    ↓
@builder
    ↓
@tester (ciblé)
    ↓
@quality-engineer (code smell check)
    ↓
@reviewer (independant)
    ↓
✅ SHIP / ❌ FIX
```

| Agent | Skills | Validation |
|---|---|---|
| `@planner` | `writing-plans`, `hash-code-navigation` | Plan approuvé par utilisateur |
| `@builder` | `hash-enterprise-development`, `hash-verification` | - |
| `@tester` | `hash-verification` | Tests ciblés uniquement |
| `@quality-engineer` | `hash-enterprise-development`, `simplify` | Quality report |
| `@reviewer` | `code-review-skill`, `hash-verification` | SHIP/FIX |

---

### L3 — Complexe (nouveau module, architecture, API change, auth, payment)
```
@planner
    ↓
@architect (décision + alternatives)
    ↓
⚠️  USER APPROVAL REQUIRED
    ↓
@builder
    ↓
@security (si zone sensible)
    ↓
@tester (module + consumers)
    ↓
@quality-engineer
    ↓
@reviewer (indépendant)
    ↓
✅ SHIP / ❌ FIX
```

| Agent | Skills | Validation |
|---|---|---|
| `@planner` | `writing-plans`, `hash-code-navigation` | Plan + risques identifiés |
| `@architect` | `writing-plans` (architecture), `hash-enterprise-development` | Décision architecturale documentée |
| `@builder` | `hash-enterprise-development`, `hash-verification` | - |
| `@security` | `hash-enterprise-development`, `cybersecurity` | Security audit |
| `@tester` | `hash-verification` | Tests module + consumers |
| `@quality-engineer` | `hash-enterprise-development`, `simplify` | Quality report |
| `@reviewer` | `code-review-skill`, `hash-verification` | SHIP/FIX |

---

### L4 — Critique (production, données sensibles, migration destructive, infra)
```
@planner
    ↓
@architect (risk assessment complet)
    ↓
⚠️  USER APPROVAL REQUISE (écrite)
    ↓
@security (audit approfondi)
    ↓
@builder (exécution protégée)
    ↓
@tester (exhaustif : module + intégration + edge cases)
    ↓
@quality-engineer (deep check)
    ↓
@reviewer (indépendant + cross-check)
    ↓
@git-engineer (merge prep + CI/CD)
    ↓
✅ SHIP / ❌ FIX
```

| Agent | Skills | Validation |
|---|---|---|
| `@planner` | `writing-plans`, `hash-code-navigation` | Plan complet + risques |
| `@architect` | `writing-plans`, `hash-enterprise-development`, `simplify` | Risk assessment écrit |
| `@security` | `cybersecurity`, `hash-enterprise-development` | Security audit complet |
| `@builder` | `hash-enterprise-development`, `hash-verification`, `verification-before-completion` | - |
| `@tester` | `hash-verification`, `systematic-debugging` | Tests exhaustifs |
| `@quality-engineer` | `hash-enterprise-development`, `simplify` | Quality report deep |
| `@reviewer` | `code-review-skill`, `hash-verification`, `systematic-debugging` | SHIP/FIX + independent |
| `@git-engineer` | `git-commit`, `verification-before-completion` | Pipeline CI/CD clean |

---

## 🎨 Pipeline UI/UX

### UI Mineure (bouton, padding, typo, couleur)
```
@builder
    ↓
@tester (smoke)
    ↓
✅ SHIP
```

### UI Majeure / Nouvelle Interface / Dashboard / SaaS
```
@design-lead
    ↓ (décision UX, direction visuelle)
12ui-design (si design system / composants complexes)
    ↓
@builder
    ↓
@quality-engineer (UI quality check)
    ↓
@reviewer (design review)
    ↓
✅ SHIP / ❌ FIX
```

---

## 🔐 Pipeline Zone Sensible (auth, payments, API security, infra)
```
@security (audit automatique)
    ↓
@planner (si nouveau)
    ↓
@architect (si L3/L4)
    ↓
@builder
    ↓
@tester (ciblé + security cases)
    ↓
@quality-engineer
    ↓
@reviewer
    ↓
✅ SHIP / ❌ FIX
```

---

## 🌿 Pipeline Merge / GitHub Preparation
```
@quality-engineer
    ↓
@tester (regression check)
    ↓
@reviewer (final)
    ↓
@git-engineer (commit message, PR, CI)
    ↓
🚀 MERGE
```

---

## 🧬 Règles d'Activation (Avant d'appeler un spécialiste)

Pour CHAQUE sous-agent, demande-toi :

1. **Dépasse-t-il `@builder` ?** Si NON → n'active pas.
2. **Risque spécifique ?** Si NON → n'active pas.
3. **Vraie valeur ajoutée ?** Si NON → n'active pas.
4. **Coût de contexte justifié ?** Si NON → n'active pas.

---

## 📋 Escalade de Modèles (Ordre)

```
1. FREE / Flash (exploration, docs, simple tasks, planning)
   → google/gemini-2.5-flash
   → mistral/codestral-latest (code)
   → groq/qwen/qwen3.8-27b (rapide)
   → zhipu/glm-4.7-flash (générique)

2. Strong reasoning (architecture, complex bugs, deep analysis)
   → Mammouth models (seulement si free/strong failed)

3. Premium (critical, error cost high, explicit user approval)
   → mammouth/claude-sonnet-4-6, mammouth/claude-opus-5, etc.

JAMAIS premium par défaut.
```

---

## 📊 Résumé — Quick Reference Card

| Task | Pipeline | Est. Context | Time |
|---|---|---|---|
| Typo / config / small fix | `@builder` | Low | 1-5 min |
| New endpoint / module | `@planner` → `@builder` → `@tester` → `@quality-engineer` → `@reviewer` | Medium | 15-60 min |
| Auth / Payment / Security | `@security` → `@planner` → `@architect` → `@builder` → `@tester` → `@quality-engineer` → `@reviewer` | High | 30-120 min |
| Architecture / New module | `@planner` → `@architect` → approval → `@builder` → `@security` → `@tester` → `@quality-engineer` → `@reviewer` | High | 60-180 min |
| Production migration | `@planner` → `@architect` → risk assess → approval → `@security` → `@builder` → `@tester` → `@quality-engineer` → `@reviewer` → `@git-engineer` | Very High | 2-8h |
| UI minor | `@builder` | Low | 5-15 min |
| UI major / Dashboard | `@design-lead` → `12ui-design` → `@builder` → `@quality-engineer` → `@reviewer` | High | 2-4h |
| Merge prep | `@quality-engineer` → `@tester` → `@reviewer` → `@git-engineer` | Medium | 15-30 min |

---

## 🔑 Usage dans EURINHASH

Le superviseur `eurinhash` utilise cette matrice pour :
1. Classifier la tâche entrante
2. Déclencher le pipeline approprié
3. Ordonner les workers gratuits (`worker-*`)
4. Rebasculer en cas de quota/erreur

---

## 🛠️ Skills requis par agent

| Agent | Skills principaux | Skills optionnels |
|---|---|---|
| `@planner` | `writing-plans`, `hash-code-navigation` | `verification-planning` |
| `@architect` | `writing-plans`, `hash-enterprise-development` | `simplify` |
| `@design-lead` | `12ui-design`, `web-design-guidelines` | `frontend-design` |
| `@builder` | `hash-enterprise-development`, `hash-verification`, `hash-code-navigation` | `systematic-debugging` |
| `@quality-engineer` | `hash-enterprise-development`, `simplify`, `hash-code-navigation` | `code-review-skill` |
| `@tester` | `hash-verification`, `systematic-debugging` | `verification-before-completion` |
| `@security` | `cybersecurity`, `hash-enterprise-development` | `systematic-debugging` |
| `@reviewer` | `code-review-skill`, `hash-verification` | `systematic-debugging` |
| `@git-engineer` | `git-commit`, `verification-before-completion` | `hash-verification` |

---

*Dernière mise à jour : auto-générée depuis la configuration opencode*
*Stockée dans : `~/.config/opencode/skills/hash-agent-matrix/SKILL.md`*