# Global instructions — Cloudflare Workers + Python/Data + EURINHASH (FREE)

## Provider
- **Small model**: `mistral/mistral-code-latest` (385ms, qualité 0.85)

- **Default agent**: `eurinhash` (superviseur FREE, route vers workers gratuits)
- **Small model**: `mistral/mistral-code-latest` (385ms, qualité 0.85)
- **EURINHASH Pro** : superviseur prioritaire pour les crédits $1+$100 sandbox Novita. Orchestre `worker-novita` → `worker-codestral` → `worker-groq` → `worker-zhipu` → `worker-google`. Bascule automatique si un worker échoue.
- Escalate to Mammouth models ONLY when: all FREE workers exhausted (429/quota/auth), task is critical, explicit user approval.

## Methodology (skills installed globally)
- Non-trivial change → invoke `writing-plans` first, validate the plan before editing.
- Bug → `systematic-debugging` (logs first, no guessing).
- Before handing back → `verification-before-completion` (run tests/build yourself).
- Before any git commit → `code-review-skill`, then `git-commit` for the message (Conventional Commits).
- UI visible to users → `frontend-design` + `web-design-guidelines`; never ship generic AI-looking UI.
- Never commit secrets (`.env` is git-ignored globally).

## Cloudflare Workers
- Follow the `cloudflare`, `workers-best-practices` and `wrangler` skills.
- Use `wrangler` CLI for dev/deploy; validate `wrangler.jsonc` before deploy.
- Prefer Workers + KV/R2/Durable Objects over external infra when it fits.

## Python / Data
- Type hints everywhere, `ruff` clean, no bare `except`.
- Virtualenv per project, never install packages globally.
- SQL via parameterized queries only; migrations must be reversible.

## EURINHASH — Mode FREE par défaut

**L'agent par défaut est `eurinhash`** : un superviseur qui NE s'arrête jamais, teste la disponibilité en temps réel, et rebascule automatiquement sur les workers gratuits en cas de quota/erreur.

### Protocole EURINHASH (obligatoire)
1. **Vérification temps réel** : lire `~/.config/opencode/free-models.json` ; s'il manque ou date de +30 min → lancer `python ~/.config/opencode/scripts/free-probe.py` (bash) pour rafraîchir. Ne JAMAIS tester HuggingFace (crédit payant).
2. **Ordre selon la tâche** (statuts live dans `free-models.json`, sauter tout worker ≠ `ok`) :
   - Code → `worker-codestral` → `worker-groq` → `worker-novita` → `worker-zhipu` → `worker-sambanova` → `worker-google` → `worker-cerebras` → `worker-cohere` → `worker-ollama` → `worker-pollinations`
   - Discussion/Résumé/Rédaction → `worker-groq` → `worker-zhipu` → `worker-novita` → `worker-codestral` → `worker-sambanova` → `worker-google` → `worker-cohere` → `worker-ollama` → `worker-pollinations`
3. **Délégation complète** : donner TOUTE la tâche + contexte au 1er worker disponible via subagent.
4. **Rebasculement automatique** : si un worker échoue (429, quota, auth, timeout répété) → marquer KO, reprendre avec le suivant EN LUI TRANSMETTANT LE PROGRÈS ACCUMULÉ. Ne JAMAIS redemander à l'utilisateur en cours de chaîne.
5. **Arrêt conditionnel** : ne s'arrête que si TOUS les workers gratuits sont KO → résumer ce qui est fait / ce qui bloque, proposer le fallback payant (`mammouth/...`) et demander validation explicite.
6. **INTERDIT** : utiliser un modèle payant sans accord explicite.

### Workers disponibles (statuts live : `free-models.json`, `python scripts/free-probe.py`)
| Worker | Modèle | Spécialité | Coût réel |
|---|---|---|---|
| `worker-codestral` | `mistral/codestral-latest` | Code | FREE tier (quotas stricts) |
| `worker-groq` | `groq/qwen/qwen3.8-27b` | Rapide | FREE tier (1K req/jour chat-models) |
| `worker-zhipu` | `zhipu/glm-4.7-flash` | Générique | FREE tier |
| `worker-novita` | `novita/inclusionai/ling-3.0-flash-sante` | **GRATUIT** (256K ctx) | Gratuit |
| `worker-google` | `google/gemini-2.5-flash` | Polyvalent costaud | FREE tier |
| `worker-sambanova` | `sambanova/DeepSeek-V3.1` | Gros modèles | FREE (20 req/jour) |
| `worker-pollinations` | `pollinations/openai` | Secours sans clé | Gratuit (1 req/15s) |
| `worker-cerebras` | `cerebras/gpt-oss-120b` | Vitesse | TRIAL $5 |
| `worker-ollama` | `ollama/devstral` | Local | 100% gratuit offline |
| `worker-cohere` | `cohere/command-a-03-2025` | Trial | 1000 appels/mois, non-commercial |

### Note
« Gratuit » = free tier à quotas stricts, jamais illimité — sauf Novita Ling,
Pollinations anonyme et Ollama local. Les autres sont des clés personnelles
avec free tier, trial ou crédits. Détail par provider : `docs/02-configuration.md` §3.

### Workers désactivés (crédits épuisés ou clé manquante)
| Worker | Raison |
|---|---|
| `worker-together` | Clé valide mais crédits épuisés (402 Credit limit exceeded) |
| `worker-deepseek` | Pas de clé API (placeholder) |

> **NOTE (2026-09) :** Ordre de fallback : `codestral → groq → novita → zhipu → sambanova → google → cerebras → cohere → ollama → pollinations → mammouth (payant, sur validation)`.

## Intelligent Routing Matrix

| Level | Type | Pipeline | Skills | Validation |
|---|---|---|---|---|
| L1 simple | typo, color, config, localized bug | `@builder` | hash-verification | targeted |
| L2 medium | limited feature, module, endpoint, business logic | `@planner` → `@builder` → `@reviewer` | hash-enterprise-development, hash-verification | reviewer |
| L3 complex | new module, architecture, API change, auth, payment | `@planner` → `@architect` → user approval → `@builder` → `@reviewer` | enterprise + verification | reviewer |
| L4 critical | production, sensitive data, destructive migration, infra | `@planner` → `@architect` → risk assessment → **user approval required** → `@builder` → `@reviewer` | enterprise + verification | independent review, SHIP/FIX |

**UI/UX routing:** minor UI tweak → @builder. New interface → @design-lead → @builder. Major page → @design-lead → `12ui-design` → design review → @builder. New product/SaaS/dashboard → @planner → @architect → @design-lead → `12ui-design` → user validation when required → @builder.

**Agent activation rule:** before calling a specialist, ask: (1) does the task exceed @builder's capability? (2) is there a specific risk? (3) does the expertise add real value? (4) is the context cost justified? If NO → do not activate.

**Model escalation:** free/flash models for exploration, navigation, docs, simple tasks, standard planning. Strong models for architecture, complex bugs, deep analysis. Premium only when the task is critical, error cost is high, or free/strong models failed. Never premium by default.

**Token efficiency:** search before broad reading (`hash-code-navigation`); read only relevant files; reuse acquired context; batch independent tool calls; make minimal changes; verify proportionally to risk (`hash-verification`); stop when complete. Optimize tokens per completed task, not per response.

**Never:** call all agents, load all skills, add plugins/MCP without real need, use premium models by default, bypass safety protections, modify `plugin/guard.ts` without explicit user authorization, or turn a small task into a complex pipeline.