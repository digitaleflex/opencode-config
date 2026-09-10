# Analyse Comparative : OpenCode EURINHASH vs Concurrents (Sept 2026)

> **Note (2026-09-10)** : analyse datée — les effectifs cités (« 4 workers »)
> ont grandi depuis (voir `free-models.json` et `CONFIG-GUIDE.md` pour le
> roster actuel). Contenu conservé tel quel.

## 1. Agents de codage IA

### Marché actuel (basé sur GitHub + recherches web)

| Agent | Type | Provider principal | Modèle | Prix |
|-------|------|-------------------|--------|------|
| **Cursor** | IDE intégré + agent CLI | Mixte (OpenAI, Anthropic, Claude) | Propriétaire | Payant (abonnement) |
| **Claude Code** | Agent terminal | Anthropic | Claude 3.5 Sonnet/Opus | Payant |
| **GitHub Copilot** | Extension VS Code/IDE | OpenAI | GPT-4/4o/4o mini | Payant (par utilisation) |
| **Cline** | Extension VS Code | Multi (OpenAI, Anthropic, Claude, Google) | Variable | Payant / gratuit selon provider |
| **Roo Code** | Extension VS Code (fork de Cline) | Multi | Variable | Gratuit / payant selon provider |
| **Sourcegraph Cody** | IDE intégrée | Mixte (OpenAI, Anthropic, Claude) | Variable | Payant (Copilot + Cody) |
| **OpenCode (anomalyco)** | Agent terminal open source | Multi-gratuits | Groq, Mistral, Zhipu, OpenRouter, etc. | **Gratuit** (configurable) |
| **OpenCode EURINHASH** | Agent terminal configuré | 7 providers gratuits | Groq/Mistral/Zhipu/OpenRouter/HuggingFace/Novita/Together | **Gratuit** |

### Points communs :
- Tous opèrent en mode terminal/IDE
- Support du "tool use" (fichiers, shell, git)
- Interface en langage naturel
- Capacité d'édition de code et exécution de commandes

### Différences clés :
- **Cursor/Claude Code/Copilot** : Expérience "clé en main", UI soignée, mais coût élevé
- **OpenCode/EURINHASH** : Configurable, open source, gratuit, mais nécessite configuration
- **Cline/Roo Code** : Plus légers, multi-providers, mais moins de fonctionnalités "integrated"

---

## 2. Routers/Orchestrateurs de modèles IA (multi-providers gratuits)

### Solutions existantes sur GitHub

| Outil | Stars | Models supportés | Type | Gratuit ?
|-------|-------|-----------------|------|--------|
| **hkqr/my-free-code** | 626 | 100+ providers (OpenRouter, Groq, OpenAI, xAI, DeepSeek, Mistral, etc.) | API gateway Python | **Oui** (self-hosted) |
| **shofer-dev/llm-local-router** | 1 | 24 providers, 72 models (via VS Code LM API) | Extension VS Code | **Oui** (auto-hébergé) |
| **kaiban-ai/kaiban-llm-proxy** | 5 | OpenAI, Anthropic, Google, Mistral | Proxy Next.js | Partiellement |
| **NodeNestor/CodeGate** | 7 | Routage Any Agent → Any LLM Provider | API gateway TypeScript | **Oui** (failover auto) |
| **khanglvm/llm-router** | 1 | Unified gateway multi-providers | Node.js | **Oui** |
| **shahzain-al/claude-code-llm-router-setup** | 0 | Routage Claude Code via multiples providers | Guide de setup | **Oui** |
| **elara-labs/code-context-engine** | 410 | Optimisation tokens, recherche dans codebase | Python | **Oui** |
| **OpenCode EURINHASH** | 0 | 7 providers gratuits + circuit breaker | Config OpenCode | **Oui** |

### Pattern EURINHASH (notre config) :
- **4 workers gratuits** : Groq (qwen3.8-27b), Mistral (codestral), Zhipu (glm-4.7-flash), OpenRouter (catch-all)
- **Rotation automatique** en cas de quota/erreur (429, timeout)
- **Tracking local des quotas** dans `provider_usage.json`
- **Circuit breakers** (état CLOSED/OPEN/HALF_OPEN) pour éviter les boucles
- **Wrapper hash-direct** pour contourner le bug Windows `opencode run`

### Points forts EURINHASH comme router :
- Setup minimal (8 fichiers .key à créer)
- Pas de dépendance à un service tiers pour le routing
- Métriques journalières dans `provider_usage.json`
- Fallback vers Mammouth (payant) uniquement si tous les 4 KO

---

## 3. Plateformes qui combinent : agents + plugins + modèles gratuits

### Solutions identifiées

| Plateforme | Agents | Plugins | Modèles gratuits | Étoiles GitHub |
|------------|--------|---------|-----------------|---------------|
| **OpenCode (anomalyco)** | 2 (build, plan) + general | Divers (envsitter, audit-logger, etc.) | 75+ providers configurables | 205k |
| **OpenCode EURINHASH** | 9 spécialisés (planner, architect, design-lead, builder, quality-engineer, tester, security, reviewer, git-engineer) | 7 plugins (@felipegenef/opencode-lazy-skills, envsitter-guard, guard.ts, audit-logger.ts, etc.) | 7 gratuits (Groq/Mistral/Zhipu/OpenRouter/HuggingFace/Novita/Together) | 0 (personnel) |
| **agentes-roues / multica** | Divers via orchestrateur | Variable | Variable | Varie |
| **herdr** | Multi-agents (Codex, Claude, OpenCode, etc.) | Plugin ecosystem | Multi-provider via adapters | 34k |
| **Orca** | Flotte d'agents parallèle | Worktree management | Multi-models | 58k |

### L'originalité EURINHASH :
- **9 agents spécialisés** avec modèles dédiés (contrairement aux 2 d'OpenCode classique)
- **Matrix de compétences L1-L4** pour routage intelligent des tâches
- **14 plugins** (dont envsitter-guard pour la sécurité des .env, audit-logger pour la journalisation)
- **Circuit breaker** intégré (unique parmi les configs OpenCode légères)
- **Quota tracking journalier** par provider/modèle

---

## 4. Outils similaires à "opencode-provider-config" ou "llmhub-configs" sur GitHub

### Résultats de recherche (34 résultats pour "opencode-provider-config")

#### Repos pertinents trouvés :

| Outil | Stars | Description | Gratuit ?
|-------|-------|-------------|--------|
| **torquemad/opencode-provider-config** | 2 | Outil Go pour générer config OpenCode en interrogeant des API endpoints compatibles OpenAI | **Oui** (outil en ligne de commande) |
| **nguyenngothuong/opencode-configs** | 15 | Config OpenCode - Antigravity, GLM, Multi-provider setup pour free Claude & Gemini | **Oui** |
| **iamcheyan/pi-opencode-config-reader** | 9 | Extension pi qui lit config OpenCode et enregistre providers | **Oui** |
| **TheStonedGamer/opencode-provider-configurator** | 0 | Configurateur en PowerShell | Inconnu |
| **Sujan-6905/opencode-global-configs** | 4 | Configs globaux deprecated pour OpenCode avec Copilot comme provider | **Non** (dépéciated) |
| **Pacotacou/omniroute-for-opencode-linux** | 0 | Ajoute Omniroute comme provider dans config OpenCode | **Oui** |
| **peheje/opencode-models-fetcher** | 0 | Fetch model lists et génère config OpenCode | **Oui** |
| **SYKhayyat/opencode-config** | 0 | Config OpenCode et notes pour free-tier LLM providers | **Oui** |
| **redstone-md/ConfAI** | 3 | Éditeur unique pour config de tous les AI coding agents (Codex, Claude Code, opencode) | **Oui** |
| **leic8959-sudo/llmhub-configs** | 1 | Recettes OpenAI-compatible pour Codex, Cursor, Cline, Dify, n8n | **Partiellement** ($0.50 credit) |

#### Notre config EURINHASH vs ces outils :
- **Supérieur** : Circuit breaker, quota tracking journalier, 9 agents spécialisés, audit logger
- **Similaire** : Le but est le même (gérer providers multiples gratuits)
- **Moins complexe** que llmhub-configs (qui inclut Dify, n8n payants)

---

## 5. Forces et faiblesses vs EURINHASH (4 workers gratuits + 14 plugins + 12 agents)

### Forces EURINHASH

| Domaine | Forces |
|---------|--------|
| **Coût** | 100% gratuit (7 providers) + fallback Mammouth optionnel |
| **Disponibilité** | Rotation automatique des 4 workers principaux ; circuit breakers évitent les boucles infinies |
| **Spécialisation** | 9 agents dédiés par rôle (planner → architect → builder → tester...) avec modèles adaptés |
| **Sécurité** | envsitter-guard pour éviter l'exposition des clés, audit logger avec redaction de secrets |
| **Productivité** | Matrix L1-L4 pour routage selon complexité ; optimisation des tokens (hash-token-efficiency) |
| **Portabilité** | Wrapper hash-direct pour bug Windows `opencode run` ; configuration portable via fichiers .key |
| **Monitoring** | Fichiers `provider_usage.json`, `provider_circuit.json`, `logs/audit-YYYY-MM-DD.jsonl` |
| **Extensibilité** | Architecture plugin-based (7 plugins actuels, facile d'en ajouter) |
| **Open source** | Total transparence, pas de lock-invendor |

### Faiblesses EURINHASH (par rapport aux alternatives)

| Domaine | Limitations |
|---------|-------------|
| **Expérience utilisateur** | Configuration requise (8 fichiers .key) ; pas "clé en main" comme Cursor/Claude Code |
| **UI/UX** | Interface terminale brute ; pas de tableau de bord web visuel (contrairement à llm-local-router ou CodeGate) |
| **Modèles de pointe** | Les 4 workers gratuits sont moins puissants que GPT-4o/Turbo ou Claude 3.5 Opus payants |
| **Écosystème IDE** | Intégration VS Code/IDE limitée comparée à Cline/Roo Code / GitHub Copilot |
| **Support communautaire** | Plus petit écosystème que les solutions commerciales (pas de support dédié) |
| **Fonctionnalités avancées** | Pas de features avancées type "autonomous loops", "worktrees parallèles" qu'offrent Orca, Multica |
| **Modèles propriétaires** | Aucun accès direct aux modèles propriétaires (OpenAI, Anthropic) sans passer par OpenRouter qui peut avoir des restrictions |

### Tableau comparatif complet

| Critère | EURINHASH | Cursor | Claude Code | Copilot | Cline/Roo Code |
|---------|-----------|--------|-------------|---------|----------------|
| **Prix** | **Gratuit** | Payant | Payant | Payant | Gratuit (selon provider) |
| **Workers gratuits** | **4 (Groq/Mistral/Zhipu/OpenRouter)** | 0 | 0 | 0 | Variables |
| **Agents spécialisés** | **9 (planner→git-engineer)** | 2 (build, plan) | 1 (code) | 1 (code complet) | 1 ou multi via prompts |
| **Plugins** | **14 (envsitter, audit, guard, etc.)** | Limités | Limités | Limited | Variables |
| **Circuit breaker** | **Oui** | Non | Non | Non | Variables |
| **Quota tracking** | **Journalier par provider** | Non | Non | Non | Variables |
| **Modèles inclus** | 7 gratuits + OpenRouter | OpenAI uniquement | Anthropic uniquement | OpenAI uniquement | Multi-provider |
| **Installation** | 8 fichiers .key | Installer VS Code extension | Installer Claude Code | Installer Copilot | Installer extension |
| **UI moderne** | Terminale | IDE intégré | Terminal/IDE | IDE intégré | Extension VS Code |
| **Sécurité secrets** | **envsitter + redaction** | Variable | Variable | Variable | Variable |

### Conclusion

**EURINHASH se distingue par :**
1. **Le seul modèle 100% gratuit avec routing automatique** parmi les agents de codage sérieux
2. **La spécialisation par 9 agents** dédiés à des rôles précis (pas généraliste)
3. **L'infrastructure de sécurité** (envsitter, audit logger, circuit breakers)
4. **La transparence totale** (open source, configs visibles, pas de lock-in)

**Les alternatives commerciales (Cursor, Claude Code, Copilot) l'emportent sur :**
- Expérience utilisateur "clé en main"
- Qualités des modèles (GPT-4o, Claude 3.5 Opus)
- Intégration IDE fluide
- Support et stabilité

**EURINHASH est idéal pour :** développeurs budgets-serrés, projets open source, entreprises souhaitant éviter les coûts d'API propriétaires, utilisateurs confortables en ligne de commande.

**EURINHASH est moins adapté pour :** équipes nécessitant des modèles de pointe payants, utilisateurs préférant une interface graphique, workflows nécessitant des agents autonomes à très haut niveau de sophistication.