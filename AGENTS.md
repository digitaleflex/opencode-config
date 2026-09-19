# Global instructions — Cloudflare Workers + Python/Data + EURINHASH (FREE)

## Provider

- **Default agent**: `eurinhash` (superviseur FREE, route vers workers gratuits)
- **Small model**: `google/gemini-2.5-flash` (FREE) — ex-`mistral/mistral-code-latest`, retiré le **2026-09-12** (Mistral renvoyait « Payment Required »)
- **Modèle par défaut des agents** : `google/gemini-2.5-flash` (FREE, 1M ctx). Tous les rôles ont été basculés le **2026-09-12** : `mistral/*` = paiement requis, `groq/qwen/qwen3.8-27b` = free tier mais **ITPM 7000** (inutilisable dès que le contexte dépasse ~26k tokens).
- **EURINHASH Pro** : superviseur prioritaire pour les crédits $1+$100 sandbox Novita. Orchestre `worker-novita` → `worker-codestral` → `worker-groq` → `worker-zhipu` → `worker-google`. Bascule automatique si un worker échoue.
- Escalate to Mammouth models ONLY when: all FREE workers exhausted (429/quota/auth), task is critical, explicit user approval.

## Git workflow (2026-09-12 — leçon de la session EPIC #112)

- **TOUJOURS Already up to date. avant de créer une branche** : les merges
  GitHub ne sont pas automatiquement tirés localement ; une branche créée sur
  un main périmé perd les fixes déjà mergés (test manquant, conflits).
- Après chaque merge de PR : Your branch is up to date with 'origin/main'.
Already up to date. avant la branche suivante.
- Ne jamais éditer un fichier avec l'outil edit si le repo est en CRLF et que
  le formateur est actif : préférer les scripts Python ciblés (newline='
').

## Methodology (skills installed globally)

- Non-trivial change → invoke `writing-plans` first, validate the plan before editing.
- Bug → `systematic-debugging` (logs first, no guessing).
- Before handing back → `verification-before-completion` (run tests/build yourself).
- Before any git commit → `code-review-skill`, then `git-commit` for the message (Conventional Commits).
- UI visible to users → `frontend-design` + `web-design-guidelines`; never ship generic AI-looking UI.
- Never commit secrets (`.env` is git-ignored globally).

## Vérification — le gate obligatoire (2026-09-13)

**Mesuré sur une session d'unification réelle : 10 bugs trouvés, 0 par les agents qui
écrivaient le code.** Plusieurs passaient `tsc` ET `eslint` (directive `"use client"`
supprimée, route privée renvoyant 200, test qui se sautait tout seul).

**Règle : aucun commit sans passage par le gate.**

| Outil | Rôle |
|---|---|
| `npm run verify` | Gate déterministe : types → lint → prisma → **sondes HTTP live** → E2E |
| `npm run verify:fast` | Types + lint + prisma (sans réseau) |
| `@verifier` | Agent qui exécute le gate **et** conçoit les sondes runtime propres au changement |

Un changement qui **compile** n'est pas un changement qui **marche**.

- Un test **sauté** doit être annoncé à voix haute — jamais absorbé silencieusement.
- `@verifier` retourne des **preuves brutes** (commande + sortie), jamais « ça devrait marcher ».
- **`@integrator`** est le spécialiste de l'absorption inter-repos (encode les pièges Next 16 :
  `"use client"`, `proxy.ts` vs `middleware.ts`, `params` en Promise, dossiers `_` privés,
  routes privées hors `PROTECTED_PATHS`).

### Modèles — échelle d'escalade par coût croissant (2026-09-14)

**Principe : on ne monte d'un niveau que si le précédent échoue ou n'est pas à la hauteur.**
Le coût dominant n'est pas le tarif du modèle mais **la taille du contexte transmis**.

```
Niveau 1  ▸ opencode/*-free          7 modèles GRATUITS intégrés      0 quota abonnement
Niveau 2  ▸ openrouter/*:free        3 modèles GRATUITS (codestral…)  0 quota abonnement
Niveau 3  ▸ workers gratuits         groq · novita · zhipu · pollinations
Niveau 4  ▸ opencode-go/*-flash      ABONNEMENT, économe  → le gros du travail
Niveau 5  ▸ opencode-go/glm-5.3      ABONNEMENT, lourd     → pointe rare
❌ JAMAIS  ▸ *-max · *-pro · kimi-k3 · grok-4.6 · gpt-5.6-luna
             huggingface/* (PAYANT) · zenmux/anthropic (PAYG hors abonnement)
```

| Agents | Modèle |
|---|---|
| `architect`, `security` | `opencode-go/glm-5.3` (niveau 5 — **rares** : L3+ et zones sensibles) |
| `builder`, `integrator`, `verifier`, `tester`, `auditor`, `quality-engineer`, `eurinhash` | `opencode-go/deepseek-v4.1-flash` (niveau 4) |
| `planner`, `reviewer` | `opencode-go/glm-5.3-flash` (niveau 4 — **fréquents**, donc flash) |
| `docwriter`, `git-engineer` | `opencode-go/qwen3.8-flash` (niveau 4) |
| `design-lead` | `opencode-go/glm-5.3-flash` (niveau 4) |

**Workers gratuits (niveaux 1-3, 0 quota d'abonnement) :**

| Worker | Modèle | État |
|---|---|---|
| `worker-zenmux` | `zenmux/anthropic/claude-sonnet-5-free` | **Claude Sonnet 5 GRATUIT, 1M ctx** — via zenmux free tier |
| `worker-opencode` | `opencode/muse-spark-1.3-contributor-free` | modèle gratuit intégré, 1M ctx |
| `worker-codestral` | `openrouter/poolside/laguna-s-2.1:free` | code |
| `worker-novita` | `novita/inclusionai/ling-3.0-flash-sante` | **le plus rapide mesuré (168 tok/s)** |
| `worker-groq` | `groq/qwen/qwen3.8-27b` | rapide, ITPM 7000 (petit contexte) |
| `worker-zhipu` | `zhipu/glm-4.7-flash` | générique |
| `worker-pollinations` | `pollinations/openai` | sans clé, secours |
| `worker-google` | `google/gemini-2.5-flash` | ⚠️ **20 req/jour** — quasi inutilisable |
| `worker-ollama` | `ollama/devstral` | ⚠️ modèle non téléchargé (1.5B dispo = trop faible) |

### ⚠️ PRIVACY — modèles gratuits à NE PAS utiliser sur des données sensibles

La doc officielle OpenCode Zen documente des contreparties :

| Modèle | Contrepartie | Verdict |
|---|---|---|
| `muse-spark-1.2/1.3-contributor-free` | **prompts ET complétions utilisés pour entraîner les modèles Meta** | 🚫 **interdit** sur ce projet (données utilisateurs réelles) |
| `nemotron-3-ultra-free`, `nemotron-3.5-lightning-free` | NVIDIA : *trial use*, usage journalisé | ⚠️ jamais de données personnelles/confidentielles |
| `big-pickle`, `mimo-v2.5-free`, `ling-3.0-flash-fin-free` | aucune contrepartie documentée | ✅ utilisables |

**Règle projet** : les modèles `*-contributor-free` et `nemotron-*-free` sont **réservés au code
open-source / aux tâches non sensibles**. Pour tout ce qui touche aux données utilisateurs,
utiliser `opencode-go/*-flash`, `zenmux/anthropic/claude-sonnet-5-free` ou les workers
`codestral`/`novita`/`groq`.

### 💚 Coûts & garde-fous de l'abonnement (doc officielle)

- OpenCode Zen = **pay-as-you-go**, facturé au million de tokens.
- **Auto-recharge** : si le solde passe sous **$5**, recharge automatique de **$20**.
  ⚠️ si l'auto-recharge est active, elle peut dépasser la limite mensuelle.
- **Limites mensuelles** configurables par workspace et par membre → à activer.
- Frais carte : 4,4 % + $0,30 par transaction (répercutés au coût).
- Certains modèles ont des **paliers** : le prix augmente après 200K/272K tokens.

### 💰 Prix réels (source : `models.dev/api.json`, 2026-09-14)

**66 modèles GRATUITS** sont disponibles tous providers confondus
(`opencode` 31, `openrouter` 22, `zenmux` 7, `google` 2, `zhipuai` 2, `groq` 1).

**Abonnement `opencode-go` — du moins cher au plus cher ($/M tokens) :**

| Modèle | In | Out | Note |
|---|---|---|---|
| `muse-spark-1.2-contributor` | $0.10 | $0.20 | 🥇 le moins cher |
| `mimo-v2.5` | $0.14 | $0.28 | 🥈 |
| `hy3` | $0.14 | $0.58 | |
| `deepseek-v4.1-flash` | $0.15 | $0.60 | workhorse actuel |
| `qwen3.8-flash` | $0.15 | $0.47 | |
| `glm-5.3-flash` | $0.15 | $0.50 | |
| `deepseek-v4-pro` | $0.66 | $1.98 | ⚠️ cher |
| `glm-5.3` | $1.40 | $4.40 | ⚠️ **9× le flash** |
| `qwen3.8-max` · `grok-4.6` | $2.00 | $6.00 | 💸 |
| `kimi-k3` | $3.00 | $15.00 | 💸💸 **20× le flash** |

**Règle** : `*-flash` = économe · `*-max` / `*-pro` / `kimi-k3` = à éviter.
Les modèles gratuits `*-free` couvrent désormais la majorité des besoins.

**Règle d'allocation : le modèle doit être choisi selon la FRÉQUENCE d'appel, pas seulement
la difficulté.** `planner` et `reviewer` tournent à chaque tâche/commit → variante flash.
`architect` et `security` interviennent rarement → un modèle lourd y coûte peu.

**INTERDIT — modèles gourmands en tokens** (ne jamais router vers eux) :
`opencode-go/*-max` (`qwen3.7-max`, `qwen3.8-max`), `opencode-go/deepseek-v4-pro`,
`opencode-go/kimi-k3`, `opencode-go/kimi-k2.7-code`, `opencode-go/grok-4.6`,
`opencode-go/gpt-5.6-luna`, `anthropic/claude-*` (zenmux = PAYG hors abonnement).

### Le vrai levier de tokens : le contexte, pas le modèle

Le poste de dépense principal est **la taille du contexte transmis**, pas le tarif du modèle.
Règles non négociables :

1. **Chercher avant de lire** — `grep`/`glob` ciblés plutôt que lire des fichiers entiers.
2. **Ne jamais relire** un fichier déjà lu dans la session.
3. **Ne pas transmettre tout le contexte** aux sous-agents : donner le besoin, pas l'historique.
4. **Un seul écrivain à la fois** sur des fichiers qui se chevauchent.

Backup des agents : `~/.config/opencode/agent-backup-*`.

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
   - Code → `worker-codestral` → `worker-groq` → `worker-novita` → `worker-zhipu` → `worker-google` → `worker-ollama` → `worker-pollinations`
   - Discussion/Résumé/Rédaction → `worker-groq` → `worker-zhipu` → `worker-novita` → `worker-codestral` → `worker-google` → `worker-ollama` → `worker-pollinations`
3. **Délégation complète** : donner TOUTE la tâche + contexte au 1er worker disponible via subagent.
4. **Rebasculement automatique** : si un worker échoue (429, quota, auth, timeout répété) → marquer KO, reprendre avec le suivant EN LUI TRANSMETTANT LE PROGRÈS ACCUMULÉ. Ne JAMAIS redemander à l'utilisateur en cours de chaîne.
5. **Arrêt conditionnel** : ne s'arrête que si TOUS les workers gratuits sont KO → résumer ce qui est fait / ce qui bloque, proposer le fallback payant (`mammouth/...`) et demander validation explicite.
6. **INTERDIT** : utiliser un modèle payant sans accord explicite.

### Workers disponibles (statuts live : `free-models.json`, `python scripts/free-probe.py`)

| Worker                | Modèle                                    | Spécialité             | Coût réel                                                            |
| --------------------- | ----------------------------------------- | ---------------------- | -------------------------------------------------------------------- |
| `worker-codestral`    | `openrouter/poolside/laguna-s-2.1:free`   | Code                   | FREE (1M ctx) — ex-`mistral/codestral-latest`, basculé le 2026-09-12 |
| `worker-groq`         | `groq/qwen/qwen3.8-27b`                   | Rapide                 | FREE tier (1K req/jour chat-models)                                  |
| `worker-zhipu`        | `zhipu/glm-4.7-flash`                     | Générique              | FREE tier                                                            |
| `worker-novita`       | `novita/inclusionai/ling-3.0-flash-sante` | **GRATUIT** (256K ctx) | Gratuit                                                              |
| `worker-google`       | `google/gemini-2.5-flash`                 | Polyvalent costaud     | FREE tier                                                            |
| `worker-pollinations` | `pollinations/openai`                     | Secours sans clé       | Gratuit (1 req/15s)                                                  |
| `worker-ollama`       | `ollama/devstral`                         | Local                  | 100% gratuit offline                                                 |

### Note

« Gratuit » = free tier à quotas stricts, jamais illimité — sauf Novita Ling,
Pollinations anonyme et Ollama local. Les autres sont des clés personnelles
avec free tier, trial ou crédits. Détail par provider : `docs/02-configuration.md` §3.

### Workers retirés (2026-09-12 — clés mortes / crédits épuisés)

| Worker              | Raison                                        |
| ------------------- | --------------------------------------------- |
| `worker-sambanova`  | Clé 401 (à régénérer si le compte existe)     |
| `worker-cerebras`   | Clé 401 (trial $5 expiré)                     |
| `worker-cohere`     | Clé 401 (trial non-commercial)                |
| `worker-together`   | Crédits épuisés (402 Credit limit exceeded)   |
| `worker-deepseek`   | Pas de clé API (placeholder)                  |

> **NOTE (2026-09) :** Ordre de fallback : `codestral → groq → novita → zhipu → google → ollama → pollinations → mammouth (payant, sur validation)`.

## Intelligent Routing Matrix

| Level       | Type                                                     | Pipeline                                                                                            | Skills                                         | Validation                   |
| ----------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------- |
| L1 simple   | typo, color, config, localized bug                       | `@builder`                                                                                          | hash-verification                              | targeted                     |
| L2 medium   | limited feature, module, endpoint, business logic        | `@planner` → `@builder` → `@reviewer`                                                               | hash-enterprise-development, hash-verification | reviewer                     |
| L3 complex  | new module, architecture, API change, auth, payment      | `@planner` → `@architect` → user approval → `@builder` → `@reviewer`                                | enterprise + verification                      | reviewer                     |
| L4 critical | production, sensitive data, destructive migration, infra | `@planner` → `@architect` → risk assessment → **user approval required** → `@builder` → `@reviewer` | enterprise + verification                      | independent review, SHIP/FIX |

**UI/UX routing:** minor UI tweak → @builder. New interface → @design-lead → @builder. Major page → @design-lead → `12ui-design` → design review → @builder. New product/SaaS/dashboard → @planner → @architect → @design-lead → `12ui-design` → user validation when required → @builder.

**Agent activation rule:** before calling a specialist, ask: (1) does the task exceed @builder's capability? (2) is there a specific risk? (3) does the expertise add real value? (4) is the context cost justified? If NO → do not activate.

**Model escalation:** free/flash models for exploration, navigation, docs, simple tasks, standard planning. Strong models for architecture, complex bugs, deep analysis. Premium only when the task is critical, error cost is high, or free/strong models failed. Never premium by default.

**Token efficiency:** search before broad reading (`hash-code-navigation`); read only relevant files; reuse acquired context; batch independent tool calls; make minimal changes; verify proportionally to risk (`hash-verification`); stop when complete. Optimize tokens per completed task, not per response.

**Never:** call all agents, load all skills, add plugins/MCP without real need, use premium models by default, bypass safety protections, modify `plugin/guard.ts` without explicit user authorization, or turn a small task into a complex pipeline.
