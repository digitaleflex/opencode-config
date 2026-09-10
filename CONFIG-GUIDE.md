# Guide de ta config OpenCode — Mode EURINHASH (100% FREE)

> Tout est global : actif pour TOUS tes projets. Après chaque modif de config : **quitter + relancer OpenCode**.

> **Mode actuel** : EURINHASH (superviseur FREE) est l'agent par défaut. Aucun modèle payant n'est utilisé par défaut.

## Fichiers (dans `~/.config/opencode/`)

| Fichier | Rôle |
|---|---|
| `opencode.jsonc` | Config principale : providers, modèles, permissions, MCP |
| `opencode.jsonc` | Config principale + 14 plugins (canonique) |
| `opencode.json` | Stub legacy vide (compatibilité uniquement) |
| `tui.json` | Thème `tokyonight` + bandeau stats live |
| `AGENTS.md` | Règles globales + matrice de routage intelligent (L1→L4, UI, modèles) |
| `.env` + `.-key` (15 fichiers) | Clés API hors config — **jamais à committer** (`.gitignore` OK) |
| `agent/` | `eurinhash` (superviseur FREE) + 10 agents rôle + 11 workers (builder, planner, architect, design-lead, docwriter, reviewer…) |
| `command/` | `/review`, `/commit`, `/quota`, `/myfree-eurinhash` |
| `skills/` (14 + preload-skills, `arkcli-*` archivés) | Méthodo hash-*, review, Cloudflare, frontend, 12ui-design... |
| `scripts/` | `free-probe.py` (teste les FREE), `quota.py` (monitoring), `myfree-eurinhash.py` (routeur) |
| `plugin/guard.ts` | Bloque `rm -rf /`, `mkfs`, `dd`, `push --force` |
| `free-models.json` | Cache d'état des FREE (régénéré si >30 min) |

### Plugins (`opencode.jsonc` — canonique, curés 2026-09-10 : un seul système par rôle)

`better-compact` • `opencode-mem` • `envsitter-guard` • `oh-my-opencode-slim` • `./plugin/guard.ts` • `./plugin/audit-logger.ts` • `opencode-plugin-preload-skills`

- **better-compact** : ladder de pruning (skills → dédup → stubs → thinking → résumé en dernier recours) **sans dépenser d'appels modèle** ; remplace l'entrée morte `opencode-dynamic-context-pruning` (404 npm) et le stub local `context-summarizer.ts` (supprimé).
- **opencode-mem** : mémoire vectorielle persistante **locale** (Turso) — gardé, `opencode-supermemory` (cloud) retiré pour éviter les doubles écritures.
- **opencode-plugin-preload-skills** : chargement smart (déclencheurs type/agent/mot-clé, budget `maxTokens: 10000`, résumés, minification, analytics d'usage) — remplace `lazy-skills` + `skillful`. Config : `.opencode/preload-skills.json`.
- **envsitter-guard** : protection des fichiers `.env` et clés API (scope unique, gardé).
- **oh-my-opencode-slim** : optimisations légères (gardé ; `oh-my-openagent` retiré — chevauchait le superviseur maison).
- `./plugin/guard.ts` + `./plugin/audit-logger.ts` : garde-fou destructeur in-process et audit runtime avec rotation (gardés).
- `@f97/opencode-morph-fast-apply` : **désactivé** (commenté dans la config) — exige `MORPH_API_KEY`, réactiver après avoir posé la clé.
- Retirés (inutilisés) : `opencode-router` (bridges Slack/Telegram), `opencode.nvim` (pas d'usage Neovim).
- Skills `arkcli-*` (BytePlus) : archivés dans `skills-archive/` (hors scan, réversibles en un `mv`).

## Providers & modèles (`/models` pour choisir)

| Provider | Contenu | Coût |
|---|---|---|
| `google` | 12 modèles (2.5-flash/pro, 3.5→3.8...) | **FREE** (quotas/jour, anti-blocage réglé) |
| `zhipu` | GLM 4.7-flash + 5.3-flash, 5, 4.7 | Flash **FREE**, autres payants |
| `mistral` | Codestral, Code, Medium, Small | **FREE** (tier Experiment ; medium/small parfois en 429) |
| `groq` | Qwen 3.8-27B, GPT-OSS 120B/20B, Qwen 3.6 | **FREE** (rapide ; 1 000 req/jour sur chat-models, OK le 2026-09-05) |
| `sambanova` | DeepSeek-V3.1, Llama-3.3-70B, GPT-OSS-120B | **FREE** (20 req/jour/modèle, sans carte) |
| `pollinations` | Auto (routeur) | **FREE sans clé** (1 req/15s anonyme) |
| `cerebras` | GPT-OSS-120B, Llama-3.1-8B | **TRIAL $5/30j** (pas de free permanent) |
| `ollama` | Devstral, Qwen2.5-Coder, Llama-3.1 | **Local, 100% gratuit** (`ollama serve` + `ollama pull`) |
| `cohere` | Command A, Command R+, North Mini Code | **TRIAL 1000 appels/mois** (sans carte, non-commercial) |
| `cloudflare` | GLM-4.7-flash, Gemma, Nemotron (via REST) | **10K neurons/jour** (compte + token, provider à valider) |
| `openrouter` | Routeur auto `openrouter/free` | **FREE**, 50 req/jour → bouche-trou |
| `huggingface` | Qwen3-480B, GPT-OSS-120B, DeepSeek-Flash, Hermes-3-70B | 0,10 $/mois partagé (~10-30 appels) |
| `novita` | Ling-3.0-Flash-Santé (GRATUIT, OK le 2026-09-05), Ling-3.0-Flash-Fin (GRATUIT), DeepSeek-V4-Flash, GLM-5-Flash | **GRATUIT** + $0.075–$0.14/M (clé configurée ✅, endpoint: `https://api.novita.ai/openai/v1`) |
| `together` | Kimi-K2.7-Code, Llama-4-Maverick, DeepSeek-V4-Pro | $0.27–$0.95/M, crédits épuisés ❌ (clé valide, ajouter crédit) |
| `mammouth` | 18 modèles (Claude, GPT, DeepSeek, Qwen...) | Payant crédits — **non utilisé par défaut** |

**Modèle par défaut** : `eurinhash` (superviseur FREE qui route vers les workers gratuits). Petites tâches : `zhipu/glm-4.7-flash` (0 $).

### EURINHASH Pro (superviseur des workers gratuits)

Ordre de bataille **prioritaire** pour les workers gratuits :

| Priorité | Worker | Modèle | Coût | Status |
|---|---|---|---|---|
| 1 | `worker-codestral` | `mistral/codestral-latest` | **FREE** | ✅ OK |
| 2 | `worker-groq` | `groq/qwen/qwen3.8-27b` | **FREE** | ✅ OK |
| 3 | `worker-novita` | `novita/inclusionai/ling-3.0-flash-sante` | **GRATUIT** (256K ctx) | ✅ OK |
| 4 | `worker-zhipu` | `zhipu/glm-4.7-flash` | **FREE** | ✅ OK |
| 5 | `worker-google` | `google/gemini-2.5-flash` | **FREE** | ⚠️ rate_limited |
| 6 | `worker-together` | `together/moonshotai/Kimi-K2.7-Code` | $0.95/M | ❌ crédits épuisés |
| 7 | `worker-deepseek` | `deepseek/deepseek-v4-flash` | $0.14/M | ⏭️ pas de clé |
| 8 | `worker-sambanova` | `sambanova/DeepSeek-V3.1` | **FREE** (20 req/jour) | ❓ à prober |
| 9 | `worker-pollinations` | `pollinations/openai` | **FREE sans clé** | ❓ à prober |
| 10 | `worker-cerebras` | `cerebras/gpt-oss-120b` | **TRIAL** | ❓ à prober |
| 11 | `worker-ollama` | `ollama/devstral` | **Local gratuit** | ❓ si `ollama serve` |
| 12 | `worker-cohere` | `cohere/command-a-03-2025` | **TRIAL** (1000/mois) | ❓ à prober |
| — | `worker-cloudflare` | REST directe (pas de worker) | **10K neurons/jour** | ❓ probe OK, provider à valider |

> **Clés API requises (15 fichiers, voir table § Clés API)** :
> - `.gemini-key` → Google Gemini
> - `.zhipu-key` → Z.AI GLM
> - `.mistral-key` → Mistral
> - `.groq-key` → Groq
> - `.hf-key` → HuggingFace
> - `.openrouter-key` → OpenRouter
> - `.mammouth-key` → Mammouth (payant, non utilisé par défaut)
> - `.novita-key` → Novita AI — **Welcome bonus $1 + sandbox $100** — endpoint: `https://api.novita.ai/openai/v1` — modèle gratuit: `inclusionai/ling-3.0-flash-sante` ✅
> - `.together-key` → Together AI — clé valide, crédits à ajouter ❌
> - `.deepseek-key` → DeepSeek — clé placeholder ❌

> **⚠️ Les clés présentes sont réelles et testées.** Les workers désactivés (together, deepseek) sont marqués ❌ dans le tableau.

## Ordre de bataille anti-quota (EURINHASH)

**EURINHASH Pro** (prioritaire, workers gratuits — statuts live dans `free-models.json`) :
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

- **Catalogue skills** : chargement sous budget (`maxTokens: 10000`, résumés, minification) via `opencode-plugin-preload-skills` + analytics d'usage réel
- **Édits de code** : `@f97/opencode-morph-fast-apply` désactivé (clé manquante) — réactiver après avoir posé `MORPH_API_KEY`
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
- **Keys API** : 15 fichiers `.key` dans `~/.config/opencode/` — voir ci-dessous.

## Clés API requises (15 fichiers)

| Fichier | Provider | Où obtenir | Status | Sécurité |
|---|---|---|---|---|
| `.gemini-key` | Google Gemini | https://makersuite.google.com/ | ✓ présent | ✅ Fichier `.gitignore` + recommandé chmod 600 |
| `.zhipu-key` | Z.AI GLM | https://platform.openaichina.com/ | ✓ présent | ✅ Fichier `.gitignore` + recommandé chmod 600 |
| `.mistral-key` | Mistral | https://console.mistral.ai/ | ✓ présent | ✅ Fichier `.gitignore` + recommandé chmod 600 |
| `.groq-key` | Groq | https://console.groq.com/ | ✓ présent | ✅ Fichier `.gitignore` + recommandé chmod 600 |
| `.hf-key` | HuggingFace | https://huggingface.co/settings | ✓ présent | ✅ Fichier `.gitignore` + recommandé chmod 600 |
| `.openrouter-key` | OpenRouter | https://openrouter.ai/ | ✓ présent | ✅ Fichier `.gitignore` + recommandé chmod 600 |
| `.novita-key` | Novita AI | https://novita.ai/ | ✓ présent (welcome bonus $1 + sandbox $100) | ✅ Fichier `.gitignore` + recommandé chmod 600 |
| `.together-key` | Together AI | https://api.together.xyz/ | ✓ présent | ✅ Fichier `.gitignore` + recommandé chmod 600 |
| `.deepseek-key` | DeepSeek | https://platform.deepseek.com/ | ❌ placeholder | ✅ Fichier `.gitignore` + recommandé chmod 600 |
| `.mammouth-key` | Mammouth (payant) | https://mammouth.ai/ | ✓ présent (non utilisé par défaut) | ✅ Fichier `.gitignore` + recommandé chmod 600 |
| `.sambanova-key` | SambaNova | https://cloud.sambanova.ai/ | ❓ à créer (FREE, 20 req/jour) | ✅ Fichier `.gitignore` + recommandé chmod 600 |
| `.cerebras-key` | Cerebras | https://cloud.cerebras.ai/ | ❓ à créer (TRIAL $5) | ✅ Fichier `.gitignore` + recommandé chmod 600 |
| `.pollinations-key` | Pollinations | https://auth.pollinations.ai/ | optionnel (tier anonyme sans clé) | ✅ Fichier `.gitignore` + recommandé chmod 600 |
| `.cohere-key` | Cohere | https://dashboard.cohere.com/api-keys | ❓ à créer (trial 1000 appels/mois) | ✅ Fichier `.gitignore` + recommandé chmod 600 |
| `.cloudflare-key` + `.cloudflare-account` | Cloudflare Workers AI | https://dash.cloudflare.com/ | ❓ à créer (10K neurons/jour) | ✅ Fichier `.gitignore` + recommandé chmod 600 |

### Sécurité des secrets — multi-OS

**Principe :** Les clés sont stockées dans des fichiers séparés, **toujours hors de git**, et jamais en clair dans la configuration.

| OS | Emplacement | Permissions | Commande de restriction |
|----|-------------|-------------|------------------------|
| **Windows** | `C:\Users\<user>\.config\opencode\` | ACL NTFS = **utilisateur courant uniquement** (par défaut) | `icacls "$env:USERPROFILE\.config\opencode\.novita-key" /inheritance:r /grant:r "$env:USERNAME:R"` possible |
| **Linux** | `~/.config/opencode/` | `chmod 600` (rw owner uniquement) | `chmod 600 ~/.config/opencode/.novita-key` |
| **macOS** | `~/.config/opencode/` | `chmod 600` (rw owner uniquement) + possible FileVault | `chmod 600 ~/.config/opencode/.novita-key` |

**Points de sécurité :**

- **`.gitignore`** : tous les `.key` fichiers sont exclus → **jamais commités** sur aucun OS
- **`opencode.jsonc`** : utilise `{file:~/.config/opencode/.novita-key}` → **pas de clé en clair** dans la config
- **`envsitter-guard`** : plugin opencode qui détecte et protège les clés exposées
- **Aucun log** : aucun fichier journal ne contient les clés API
- **Chiffrement disque** : BitLocker (Windows), FileVault (macOS), LUKS (Linux) recommandés pour une sécurité maximale

**Aucune clé n'est exposée publiquement.** La configuration est sécurisée sur Windows, Linux et macOS.

## Concurrents et positionnement honnête

**Clause de sincérité :** après vérification approfondie, il existe des projets très similaires et certains sont techniquement plus avancés sur plusieurs aspects. Cette section replace EURINHASH dans son contexte réel.

### Les principaux concurrents

| Projet | Ce qu'ils font | Points forts | Lien |
|--------|---------------|--------------|------|
| **Oh My OpenAgent** | Orchestration multi-agents, Team Mode, 8 agents parallèles, Skills, MCP, LSP/AST | Le plus complet sur l'orchestration pure | [GitHub](https://github.com/docevilOck/oh-my-opencode) |
| **OpenCode Swarm** | Architect → Experts → QA/Review, Circuit Breakers, protections comportementales | Meilleurs Circuit Breakers du marché | [GitHub](https://github.com/ZaxbyHub/opencode-swarm) |
| **Rate Limit Fallback** | Détection 429, fallback auto, retry, exponential backoff, métriques | Plus sophistiqué que notre fallback actuel | [GitHub](https://github.com/azumag/opencode-rate-limit-fallback) |
| **Cline** | SDK + CLI + Extension IDE, équipes multi-agents, état persistant | Plateforme la plus complète | [GitHub](https://github.com/Cline/Cline) |
| **OpenHands** | Agents + Workflows + Cloud + Self-hosting + Gouvernance | Niveau entreprise | [Site](https://www.openhands.dev) |

### Comparaison honnête

| Fonctionnalité | EURINHASH | Oh My OpenAgent | OpenCode Swarm | Rate Limit Fallback |
|----------------|-----------|----------------|----------------|---------------------|
| Agents spécialisés | ✅ 9 agents | ✅ Très avancé | ✅ | ❌ |
| Multi-modèles | ✅ 4 gratuits | ✅ | ✅ | ✅ |
| Fallback automatique | ✅ Basique | ✅ Avancé | ✅ | ✅ Très sophistiqué |
| Circuit Breaker | ✅ Basique | ⚠️ Partiel | ✅ Très avancé | ✅ |
| Quota tracking | ✅ Journalier | ⚠️ Variable | ⚠️ Variable | ✅ Métriques complètes |
| Multi-agent parallèle | ⚠️ Limité (1 à la fois) | ✅ 8 agents | ✅ | ❌ |
| Audit logging | ✅ | ✅ | ✅ | ❌ |
| Sécurité `.env` | ✅ envsitter-guard | ⚠️ Variable | ✅ | ⚠️ Variable |
| Windows wrapper | ✅ hash-direct | ❓ | ❓ | ❌ |
| Simplicité / config | ✅ 1 config unifiée | ❌ Complexe | ❌ Complexe | ✅ Simple |
| **100% gratuit** | ✅ 10 workers FREE/trial/locaux | ⚠️ Dépend des clés | ⚠️ Dépend des clés | ✅ |

### Notre positionnement réel

**EURINHASH n'est PAS le seul ni le plus avancé** sur l'orchestration multi-agents. Oh My OpenAgent et OpenCode Swarm sont plus sophistiqués sur plusieurs points.

**Notre valeur ajoutée réelle :**

1. **Assemblage cohérent** : au lieu de configurer 5 plugins séparés, une config unifiée `~/.config/opencode/` qui fonctionne immédiatement
2. **100% gratuit prêt à l'emploi** : workers gratuits/trial/locaux sondés via `free-probe.py` (statuts dans `free-models.json`), pas de configuration nécessaire au-delà des clés
3. **Optimisé Windows** : wrapper hash-direct pour contourner les bugs Windows, chemin `%USERPROFILE%`
4. **Sécurité intégrée** : envsitter-guard + audit-logger + safety guard en une config
5. **Curated runtime** : sélection des meilleurs composants (better-compact, opencode-mem, preload-skills, oh-my-opencode-slim) intégrés intelligemment — un seul système par rôle

### Recommandation

**Ne pas réinventer ce qui existe.** EURINHASH évoluerait mieux en intégrant :
- `Oh My OpenAgent` pour l'orchestration avancée
- `Rate Limit Fallback` pour le fallback sophistiqué
- `OpenCode Swarm` pour les Circuit Breakers

plutôt que de développer ces fonctionnalités from scratch.

## Stratégie KEEP-INTEGRATE-BUILD

EURINHASH évolue selon une stratégie **composition over competition** : utiliser les meilleurs composants open source au lieu de tout reconstruire.

```
             EURINHASH
                 │
      ┌──────────┼──────────┐
      │          │          │
     KEEP     INTEGRATE    BUILD
      │          │          │
 Ce qui est   Ce qui existe  Notre vraie
 déjà bon     mieux ailleurs  innovation
```

### KEEP — Ce que nous gardons

| Composant | Raison de le garder |
|-----------|-------------------|
| **Superviseur EURINHASH** | Identité unique, orchestration simple mais efficace |
| **Matrice L1→L4** | Gouvernance claire des tâches, signature du projet |
| **Sécurité** (`envsitter-guard` + `guard.ts` + audit) | Protection essentielle, pas de doublon open source |
| **Workers gratuits validés** | Valeur immédiate, free tiers à quotas stricts (sondés via `free-probe.py`, statuts dans `free-models.json`) |

### INTEGRATE — Ce que nous intégrons

| Composant externe | Remplacé / дополнен | Source |
|-------------------|---------------------|--------|
| **Fallback EURINHASH** | → `opencode-rate-limit-fallback` | [azumag](https://github.com/azumag/opencode-rate-limit-fallback) |
| **Orchestrateur maison** | → `Oh My OpenAgent` (Team Mode, 8 agents) | [docevilOck](https://github.com/docevilOck/oh-my-opencode) |
| **Circuit Breakers** | → `OpenCode Swarm` (protection comportements) | [ZaxbyHub](https://github.com/ZaxbyHub/opencode-swarm) |

### BUILD — Ce que nous construisons

**Notre vraie innovation : EURINHASH Governance Layer**

Les autres projets disent :
> "Voici plusieurs agents. Utilisez-les."

EURINHASH dit :
> "Voici les **règles** qui déterminent **quand, pourquoi et comment** utiliser ces agents."

```yaml
# Exemple: Policy Engine
task: payment_system
  complexity: L3
  required_agents:
    - architect
    - security
    - builder
    - reviewer
  human_approval: true
  max_parallel_agents: 3
  fallback_policy: resilient
  security_level: high

task: css_button_fix
  complexity: L1
  agents:
    - builder
  human_approval: false
  max_parallel_agents: 1
  security_level: low
```

### Roadmap en 4 phases

#### Phase 1 — Simplification
**Objectif :** Supprimer les doublons avec les composants externes.

Audit de chaque agent/plugin/script :
- "Pourquoi existe-t-il ?"
- "Un projet externe le fait-il mieux ?"
- Si oui → **SUPPRIMER**

#### Phase 2 — Intégration
Installer et tester :
- `Oh My OpenAgent` comme moteur agentique principal
- `Rate Limit Fallback` pour la résilience
- `OpenCode Swarm` pour les Circuit Breakers

#### Phase 3 — EURINHASH Governance Layer
Construire uniquement :
- L1→L4 Classification Engine
- Policy Engine (règles par type de tâche)
- Agent Selection Rules
- Risk Assessment
- Human Approval Gate

#### Phase 4 — Observabilité
Vue claire de chaque session :
```
SESSION
├── Task: Build Authentication
├── Complexity: L3
├── Agents Used: 4
├── Models Used: 2
├── Fallback: Yes
├── Security Review: PASS
└── Status: SUCCESS
```

---

## Nouvelle architecture cible

```
┌─────────────────────────────────────┐
│            UTILISATEUR              │
└──────────────────┬──────────────────┘
                   ↓
┌─────────────────────────────────────┐
│      EURINHASH GOVERNANCE LAYER     │
│  • L1→L4 Classification            │
│  • Policy Engine                   │
│  • Agent Selection                 │
│  • Risk Assessment                 │
│  • Human Approval Gate             │
└──────────────────┬──────────────────┘
                   ↓
┌─────────────────────────────────────┐
│         AGENT RUNTIME               │
│     Oh My OpenCode + OpenCode       │
│  • Background agents               │
│  • Parallel execution               │
│  • Skills / MCP / LSP              │
└──────────────────┬──────────────────┘
                   ↓
┌─────────────────────────────────────┐
│         MODEL RESILIENCE            │
│  Rate Limit Fallback Plugin         │
│  • Retry + Backoff                 │
│  • Circuit Breaker                  │
│  • Dynamic priority                 │
└──────────────────┬──────────────────┘
                   ↓
┌─────────────────────────────────────┐
│          SECURITY LAYER             │
│  • Permissions + Command Guard     │
│  • Env Protection                  │
│  • Secret Redaction                │
└──────────────────┬──────────────────┘
                   ↓
┌─────────────────────────────────────┐
│          OBSERVABILITY              │
│  • Audit logs                      │
│  • Metrics / Cost tracking         │
│  • Session summary                 │
└─────────────────────────────────────┘
```

**Vision :** EURINHASH = Governance Distribution for Agentic Development

Chaque demande est classée AVANT d'agir : type, complexité, risque → **minimum d'intelligence nécessaire**.

## Agent activation rule

before calling a specialist, ask: (1) does the task exceed @builder's capability? (2) is there a specific risk? (3) does the expertise add real value? (4) is the context cost justified? If NO → do not activate.

## Model escalation

free/flash models for exploration, navigation, docs, simple tasks, standard planning. Strong models for architecture, complex bugs, deep analysis. Premium only when the task is critical, error cost is high, or free/strong models failed. Never premium by default.

## Token efficiency

search before broad reading (`hash-code-navigation`); read only relevant files; reuse acquired context; batch independent tool calls; make minimal changes; verify proportionally to risk (`hash-verification`); stop when complete. Optimize tokens per completed task, not per response.

## Never

call all agents, load all skills, add plugins/MCP without real need, use premium models by default, bypass safety protections, modify `plugin/guard.ts` without explicit user authorization, or turn a small task into a complex pipeline.