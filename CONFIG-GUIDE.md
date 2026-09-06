# Guide de ta config OpenCode — Mode EURINHASH (100% FREE)

> Tout est global : actif pour TOUS tes projets. Après chaque modif de config : **quitter + relancer OpenCode**.

> **Mode actuel** : EURINHASH (superviseur FREE) est l'agent par défaut. Aucun modèle payant n'est utilisé par défaut.

## Fichiers (dans `~/.config/opencode/`)

| Fichier | Rôle |
|---|---|
| `opencode.jsonc` | Config principale : providers, modèles, permissions, MCP |
| `opencode.json` | Plugins globaux (14) — chargé + fusionné avec le jsonc |
| `tui.json` | Thème `tokyonight` + bandeau stats live |
| `AGENTS.md` | Règles globales + matrice de routage intelligent (L1→L4, UI, modèles) |
| `.env` + `.-key` (9 fichiers) | Clés API hors config — **jamais à committer** (`.gitignore` OK) |
| `agent/` | `eurinhash` (superviseur FREE) + 10 agents (builder, planner, architect, design-lead, docwriter, reviewer, 4 workers) |
| `command/` | `/review`, `/commit`, `/quota`, `/myfree-eurinhash` |
| `skills/` (38 + lazy-skills) | Méthodo hash-*, review, Cloudflare, frontend, 12ui-design... |
| `scripts/` | `free-probe.py` (teste les FREE), `quota.py` (monitoring), `myfree-eurinhash.py` (routeur) |
| `plugin/guard.ts` | Bloque `rm -rf /`, `mkfs`, `dd`, `push --force` |
| `free-models.json` | Cache d'état des FREE (régénéré si >30 min) |

### Plugins (`opencode.json`)

`opencode-dynamic-context-pruning` • `opencode-mem` • `envsitter-guard` • `oh-my-opencode-slim` • `opencode-router` • `opencode.nvim` • `./plugin/guard.ts` • `./plugin/audit-logger.ts` • `@felipegenef/opencode-lazy-skills` • `@f97/opencode-morph-fast-apply` • `opencode-supermemory` • `@zenobius/opencode-skillful` • `oh-my-openagent` • `./plugin/context-summarizer.ts`

- **lazy-skills** (installé) : retire le catalogue `<available_skills>` du prompt système → les skills se chargent à la demande via `skillsearch`/`skillinfo`/`skill`. Économie de tokens à chaque tour.
- **envsitter-guard** : protection des fichiers `.env` et clés API.
- **oh-my-opencode-slim** : optimisations légères.
- **@f97/opencode-morph-fast-apply** (installé 2026-09) : remplace l'éditeur par défaut par Morph Fast Apply → **~10x plus rapide** sur les édits de code.
- **opencode-supermemory** (installé) : mémoire vectorielle persistante avec Supermemory — capacité à rappeler des faits entre sessions.
- **@zenobius/opencode-skillful** (installé) : recommandation de skills dynamique basée sur l'Anthropic Agent Skills Spec — automatiquement des skills pertinents.
- **oh-my-openagent** (installé) : framework polyvalent de création d'agents avec orchestration multi-modèle, agents parallèles et outils LSP/AST.
- **context-summarizer** (plugin custom) : prune automatiquement le contexte ancien lorsque le nombre de tokens dépasse le seuil — maintient les tokens bas.
- **Audit senior 2026-09** : `opencode-dynamic-context-pruning`, `./plugin/guard.ts`, `./plugin/audit-logger.ts`, `opencode-router` et `opencode.nvim` identifiés comme redondants mais conservés pour compatibilité ascendante.

## Providers & modèles (`/models` pour choisir)

| Provider | Contenu | Coût |
|---|---|---|
| `google` | 12 modèles (2.5-flash/pro, 3.5→3.8...) | **FREE** (quotas/jour, anti-blocage réglé) |
| `zhipu` | GLM 4.7-flash + 5.3-flash, 5, 4.7 | Flash **FREE**, autres payants |
| `mistral` | Codestral, Code, Medium, Small | **FREE** (tier Experiment ; medium/small parfois en 429) |
| `groq` | Qwen 3.8-27B (testé OK), GPT-OSS 120B/20B, Qwen 3.6 | **FREE** (rapide, petits contextes) |
| `openrouter` | Routeur auto `openrouter/free` | **FREE**, 50 req/jour → bouche-trou |
| `huggingface` | Qwen3-480B, GPT-OSS-120B, DeepSeek-Flash, Hermes-3-70B | 0,10 $/mois partagé (~10-30 appels) |
| `novita` | Ling-3.0-Flash-Santé (GRATUIT ✅ testé OK), Ling-3.0-Flash-Fin (GRATUIT), DeepSeek-V4-Flash, GLM-5-Flash | **GRATUIT** + $0.075–$0.14/M (clé configurée ✅, endpoint: `https://api.novita.ai/openai/v1`) |
| `together` | Kimi-K2.7-Code, Llama-4-Maverick, DeepSeek-V4-Pro | $0.27–$0.95/M, crédits épuisés ❌ (clé valide, ajouter crédit) |
| `mammouth` | 18 modèles (Claude, GPT, DeepSeek, Qwen...) | Payant crédits — **non utilisé par défaut** |

**Modèle par défaut** : `eurinhash` (superviseur FREE qui route vers les workers gratuits). Petites tâches : `zhipu/glm-4.7-flash` (0 $).

### EURINHASH Pro (superviseur des crédits $1+$100 sandbox Novita)

Ordre de bataille **prioritaire** pour profiter des crédits免费 :

| Priorité | Worker | Modèle | Coût | Status |
|---|---|---|---|---|
| 1 | `worker-codestral` | `mistral/codestral-latest` | **FREE** | ✅ OK |
| 2 | `worker-groq` | `groq/qwen/qwen3.8-27b` | **FREE** | ✅ OK |
| 3 | `worker-novita` | `novita/inclusionai/ling-3.0-flash-sante` | **GRATUIT** (256K ctx) | ✅ OK |
| 4 | `worker-zhipu` | `zhipu/glm-4.7-flash` | **FREE** | ✅ OK |
| 5 | `worker-google` | `google/gemini-2.5-flash` | **FREE** | ⚠️ rate_limited |
| 6 | `worker-together` | `together/moonshotai/Kimi-K2.7-Code` | $0.95/M | ❌ crédits épuisés |
| 7 | `worker-deepseek` | `deepseek/deepseek-v4-flash` | $0.14/M | ⏭️ pas de clé |

> **Clés API requises (9 fichiers)** :
> - `.gemini-key` → Google Gemini
> - `.zhipu-key` → Z.AI GLM
> - `.mistral-key` → Mistral
> - `.groq-key` → Groq
> - `.hf-key` → HuggingFace
> - `.openrouter-key` → OpenRouter
> - `.mammouth-key` → Mammouth (payant, non utilisé par défaut)
> - `.novita-key` → Novita AI — **Welcome bonus $1 + sandbox $100** — endpoint: `https://api.novita.ai/openai/v1` — modèle gratuit: `inclusionai/ling-3.0-flash-sante` ✅
> - `.together-key` → Together AI — clé valide mais crédits épuisés ❌

> **⚠️ Les clés présentes peuvent être des placeholders.** Remplace-les par des clés valides pour activer tous les workers.

## Ordre de bataille anti-quota (EURINHASH)

**EURINHASH Pro** (prioritaire, 5 workers gratuits validés) :
`mistral/codestral` → `groq/qwen3.8` → `novita/ling-3.0-flash-sante` (GRATUIT) → `zhipu/glm-4.7-flash` → `google/2.5-flash` → `openrouter/free` → crédits Mammouth (dernier recours).

Ou automatique : `@eurinhash <tâche>` (teste la disponibilité en temps réel, choisit, rebascule seul en cas de 429).

## Commandes utiles

- `/models` : changer de modèle • `/quota` : FREE + usage OpenRouter + dépense du jour
- `/review` : relecture + verdict • `/commit` : commit propre (jamais de push auto)
- `/myfree-eurinhash` : scan des modèles FREE + rapport qualité/prix + changement de modèle par défaut
- `/thinking` : voir/masquer la réflexion • `ctrl+t` : effort de raisonnement
- `opencode stats --days 7 --models` (terminal) : historique tokens/coûts
- `@builder` / `@planner` / `@architect` / `@design-lead` / `@docwriter` / `@reviewer` / `@eurinhash` : agents sur mesure

## Matrice de routage intelligent (AGENTS.md)

Chaque demande est classée AVANT d'agir : type, complexité, risque → **minimum d'intelligence nécessaire**.

| Niveau | Pipeline | Exemples |
|---|---|---|
| L1 simple | `@builder` | typo, couleur, config, bug localisé |
| L2 moyen | `@planner` → `@builder` → `@reviewer` | feature limitée, module, endpoint |
| L3 complexe | `@planner` → `@architect` → **approbation** → `@builder` → `@reviewer` | nouveau module, auth, paiement |
| L4 critique | `@planner` → `@architect` → **risk assessment + approbation REQUISE** → exécution protégée → review indépendante | production, données sensibles, migration destructive |

**UI** : mineur → `@builder` ; nouvelle interface → `@design-lead` → `@builder` ; page majeure → `@design-lead` + `12ui-design` + design review → `@builder`.

**Documentation** : documentation de code/patterns → `@docwriter` (recherche d'abord via `hash-code-navigation`, style tutoriel, vérification via `hash-verification`, modèle rapide gemini-2.5-flash).

**Règle d'activation** : avant d'appeler un spécialiste — dépasse-t-il `@builder` ? risque spécifique ? vraie valeur ajoutée ? coût de contexte justifié ? Si NON → ne pas activer.

**Escalade de modèles** : gratuit/flash d'abord → fort raisonnement si besoin → premium uniquement si justifié (critique, erreur coûteuse, ou échec des précédents). Never premium by default.

**Token efficiency** : search before broad reading (`hash-code-navigation`); read only relevant files; reuse acquired context; batch independent tool calls; make minimal changes; verify proportionally to risk (`hash-verification`); stop when complete. Optimize tokens per completed task, not per response.

**Never** : call all agents, load all skills, add plugins/MCP without real need, use premium models by default, bypass safety protections, modify `plugin/guard.ts` without explicit user authorization, or turn a small task into a complex pipeline.

## Économie de tokens

- **Catalogue skills** : ~2 871 tokens économisés par prompt (~82%) grâce à `opencode-lazy-skills`
- **Édits de code** : ~10x plus rapides avec `@f97/opencode-morph-fast-apply` (Morph Fast Apply)
- **Prompt caching** : Novita offre un cache 10x discount sur les prompts répétés
- **Modèle par défaut** : FREE (eurinhash) → zéro coût
- **Quota** : `opencode stats --days 7 --models` pour suivre l'usage

## Particularités à connaître

- MCP (`cloudflare` ×2, `postgres`) : postgres **activé** pour les BDD, cloudflare désactivé (économie RAM).
- Gemini : safety à `BLOCK_ONLY_HIGH`, retries ×3, previews supprimées (instables).
- Groq : un blocage 403 initial venait du user-agent du test, pas de ta clé.
- Z.AI : la doc annonçait `/api/openai/v1` (404) → vraie base `/api/paas/v4` (testée).
- Clé Gemini `AQ.` : nouveau format valide. Clé MiniMax : pas câblée (même prix que Mammouth, pas de gratuit).
- Statusline : menu config en anglais (`/statusline`), widgets modifiables.
- **EURINHASH** : superviseur FREE qui orchestre les workers gratuits. Si un worker KO (429/quota/auth), il rebascule automatiquement sur le suivant sans demander.
- **Keys API** : 9 fichiers `.key` dans `~/.config/opencode/` — voir ci-dessous.

## Clés API requises (9 fichiers)

| Fichier | Provider | Où obtenir | Status |
|---|---|---|---|
| `.gemini-key` | Google Gemini | https://makersuite.google.com/ | ✓ présent |
| `.zhipu-key` | Z.AI GLM | https://platform.openaichina.com/ | ✓ présent |
| `.mistral-key` | Mistral | https://console.mistral.ai/ | ✓ présent |
| `.groq-key` | Groq | https://console.groq.com/ | ✓ présent |
| `.hf-key` | HuggingFace | https://huggingface.co/settings | ✓ présent |
| `.openrouter-key` | OpenRouter | https://openrouter.ai/ | ✓ présent |
| `.novita-key` | Novita AI | https://novita.ai/ | ✓ présent (welcome bonus $1 + sandbox $100) |
| `.together-key` | Together AI | https://api.together.xyz/ | ✓ présent |
| `.mammouth-key` | Mammouth (payant) | https://mammouth.ai/ | ✓ présent (non utilisé par défaut) |

## Matrice de routage intelligent (AGENTS.md)

Chaque demande est classée AVANT d'agir : type, complexité, risque → **minimum d'intelligence nécessaire**.

## Agent activation rule

before calling a specialist, ask: (1) does the task exceed @builder's capability? (2) is there a specific risk? (3) does the expertise add real value? (4) is the context cost justified? If NO → do not activate.

## Model escalation

free/flash models for exploration, navigation, docs, simple tasks, standard planning. Strong models for architecture, complex bugs, deep analysis. Premium only when the task is critical, error cost is high, or free/strong models failed. Never premium by default.

## Token efficiency

search before broad reading (`hash-code-navigation`); read only relevant files; reuse acquired context; batch independent tool calls; make minimal changes; verify proportionally to risk (`hash-verification`); stop when complete. Optimize tokens per completed task, not per response.

## Never

call all agents, load all skills, add plugins/MCP without real need, use premium models by default, bypass safety protections, modify `plugin/guard.ts` without explicit user authorization, or turn a small task into a complex pipeline.