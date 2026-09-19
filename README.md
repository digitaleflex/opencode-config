# opencode-config

Configuration EURINHASH pour OpenCode — 100% gratuit, agents spécialisés, circuit breaker, quota tracking et sécurité renforcée.

> **EURINHASH** : votre superviseur d'orchestration IA. Il ne s'arrête jamais, teste la disponibilité en temps réelle et rebascule automatiquement sur les workers gratuits en cas de quota/erreur.

---

## 📋 Table des matières

1. [Fonctionnalités](#-fonctionnalités)
2. [Architecture](#-architecture)
3. [Installation](#-installation)
4. [Utilisation](#-utilisation)
5. [Sécurité](#-sécurité)
6. [Monitoring](#-monitoring)
7. [Configuration avancée](#-configuration-avancée)
8. [Dépannage](#-dépannage)
9. [Documentation](#-documentation)
10. [Contribution](#-contribution)
11. [Licence](#-licence)

---

## ✨ Fonctionnalités

- **Modèles (free tiers, quotas stricts)** : Groq, Google, Zhipu, Novita AI (**GRATUIT**, 256K ctx), SambaNova, Pollinations (sans clé), Cerebras (essai), Ollama (local), Cohere (essai) — voir `docs/02-configuration.md` §3
- **Superviseur EURINHASH** : Rotation automatique des providers sur quota/erreur
- **21 agents** : 11 agents rôle (planner, architect, design-lead, builder, quality-engineer, tester, security, reviewer, git-engineer, docwriter) + 10 workers gratuits
- **Circuit breaker** : Protection contre les providers défaillants (état CLOSED/OPEN/HALF_OPEN)
- **Suivi de quota local** : Compteur quotidien par provider/modèle pour éviter le dépassement
- **Wrapper hash-direct** : Contournement du bug `opencode run` (Windows SDK, optionnel sur macOS/Linux)
- **Journal d'audit** : Journalisation JSONL des appels d'outils avec détection et masquage des opérations sensibles
- **Commandes personnalisées** : `/run`, `/hash-direct`, `/audit-log`, `/commit`, `/review`
- **Plugins** : `better-compact`, `opencode-mem`, `envsitter-guard`, `oh-my-opencode-slim`, `opencode-plugin-preload-skills`, guard.ts, audit-logger.ts
- **Matrice de compétences** : Routage intelligent des tâches par complexité (L1-L4)

---

## 🏗️ Architecture

```
~/.config/opencode/
├── 📄 opencode.jsonc              # Configuration principale OpenCode
├── 📄 opencode.json               # Configuration legacy (backup)
├── 📄 opencode-mem.jsonc          # Configuration mémoire longue
├── 📄 tui.json                    # Configuration TUI
├── 📄 AGENTS.md                   # Instructions par défaut des agents
├── 📄 CONFIG-GUIDE.md            # Guide de configuration rapide
├── 📄 .gitignore                 # Exclusions des fichiers sensibles
├── 📁 agent/                     # 21 agents spécialisés
│   ├── eurinhash.md              # Superviseur principal
│   ├── planner.md                # Planification de tâches
│   ├── architect.md              # Architecture technique
│   ├── design-lead.md            # Direction design
│   ├── builder.md                # Exécution de code
│   ├── quality-engineer.md       # Qualité et tests
│   ├── tester.md                 # Tests automatisés
│   ├── security.md               # Sécurité
│   ├── reviewer.md               # Revue de code
│   ├── git-engineer.md           # Gestion Git
│   ├── docwriter.md              # Documentation
│   └── worker-*.md              # Workers de fallback (10)
├── 📁 command/                   # 8 slash commands
│   ├── audit-log.md              # Journal d'audit
│   ├── commit.md                 # Commit Git
│   ├── hash-direct.md            # Appel direct aux providers
│   ├── myfree-eurinhash.md       # Test des modèles free
│   ├── quota.md                  # Gestion des quotas
│   ├── review.md                 # Revue de code
│   └── run.md                    # Wrapper opencode run
├── 📁 plugin/                    # 3 plugins TypeScript
│   ├── audit-logger.ts           # Journalisation JSONL
│   ├── guard.ts                  # Protection destructive + redaction secrets
│   └── auto-compact.ts           # Compaction intelligente
├── 📁 scripts/                   # 10 scripts (Python, Node, PowerShell)
│   ├── hash-direct.py            # Wrapper principal (circuit breaker + quota)
│   ├── hash-direct-wrapper.py    # Alias opencode run
│   ├── free-probe.py             # Test de disponibilité des modèles
│   ├── quota.py                  # Gestion des quotas
│   ├── myfree-eurinhash.py       # Test complet des modèles
│   ├── view-audit-log.py         # Affichage du journal d'audit
│   ├── route.py                  # Routage EV + feedback bayésien
│   ├── models-free.py            # Inventaire des modèles free
│   ├── patch-better-compact.py   # Patch Windows fsync
│   ├── session-review.mjs        # Revue de session
│   ├── cleanup-opencode-db.mjs   # Nettoyage base de données
│   ├── verify-golden.ts          # Vérification golden tests
│   └── windows/                  # Scripts PowerShell (Windows-only)
│       ├── compact-docker-vhdx.ps1
│       └── finish-cleanup.ps1
├── 📁 skills/                    # 20+ compétences
│   ├── hash-agent-matrix/        # Routage L1-L4
│   ├── hash-code-navigation/     # Navigation efficace
│   ├── hash-token-efficiency/    # Optimisation des tokens
│   ├── hash-verification/        # Vérification proportionnée
│   └── hash-enterprise-development/ # Développement enterprise
├── 📁 docs/                      # Documentation technique (FR/EN)
├── 📁 logs/                      # Journaux d'audit (JSONL)
└── 📁 node_modules/              # Dépendances installées
```

### Flux de données

```
Utilisateur
    │
    ├─ opencode run "prompt" ──► hash-direct-wrapper.py ──► hash-direct.py
    │                                                                    │
    │                                                                    ├─► Circuit breaker (provider_circuit.json)
    │                                                                    ├─► Quota tracking (provider_usage.json)
    │                                                                    └─► API calls (Groq, Google, Zhipu, etc.)
    │
    └─ opencode agent "task" ──► Agent (eurinhash/planner/etc.)
                                    │
                                    ├─► opencode run (si bug) ──► hash-direct.py
                                    └─► opencode native (si fonctionnel)
```

### Matrice des agents

| Agent | Rôle | Modèle | Provider |
|-------|------|--------|----------|
| **eurinhash** | Superviseur | `google/gemini-2.5-flash` | Google (FREE) |
| **planner** | Planification | `google/gemini-2.5-flash` | Google (FREE) |
| **architect** | Architecture | `google/gemini-2.5-flash` | Google (FREE) |
| **design-lead** | Design | `google/gemini-2.5-flash` | Google (FREE) |
| **builder** | Exécution | `google/gemini-2.5-flash` | Google (FREE) |
| **quality-engineer** | Qualité | `google/gemini-2.5-flash` | Google (FREE) |
| **tester** | Tests | `google/gemini-2.5-flash` | Google (FREE) |
| **security** | Sécurité | `google/gemini-2.5-flash` | Google (FREE) |
| **reviewer** | Revue | `google/gemini-2.5-flash` | Google (FREE) |
| **git-engineer** | Git | `google/gemini-2.5-flash` | Google (FREE) |
| **docwriter** | Docs | `google/gemini-2.5-flash` | Google (FREE) |
| **worker-opencode** | Worker | `opencode/deepseek-v4-flash-free` | Intégré (0 quota) |
| **worker-opencode-heavy** | Worker | `opencode/glm-5-free` | Intégré (0 quota) |
| **worker-codestral** | Worker | `openrouter/poolside/laguna-s-2.1:free` | OpenRouter (FREE) |
| **worker-groq** | Worker | `groq/qwen/qwen3.8-27b` | Groq (FREE tier) |
| **worker-novita** | Worker | `novita/inclusionai/ling-3.0-flash-sante` | Novita (GRATUIT) |
| **worker-zhipu** | Worker | `zhipu/glm-4.7-flash` | Zhipu (FREE tier) |
| **worker-google** | Worker | `google/gemini-2.5-flash` | Google (FREE tier) |
| **worker-pollinations** | Worker | `pollinations/openai` | Pollinations (sans clé) |
| **worker-ollama** | Worker | `ollama/devstral` | Local (offline) |
| **worker-zenmux** | Worker | `zenmux/anthropic/claude-sonnet-5-free` | ZenMux (PAYG) |

---

## 🛠️ Installation

### Prérequis

- [OpenCode installé](https://opencode.ai/) (v0.10.0+)
- Python 3.8+ (pour les scripts)
- Node.js 18+ ou [Bun](https://bun.sh) (pour les plugins)
- Clés API pour les providers gratuits (voir ci-dessous)
- `bash` (disponible nativement sur macOS/Linux, via WSL/Git Bash sur Windows)

### Étapes

1. **Clonez le dépôt** vers `~/.config/opencode` :
   ```bash
   git clone https://github.com/digitaleflex/opencode-config.git ~/.config/opencode
   ```

2. **Installez les dépendances** :
   ```bash
   cd ~/.config/opencode
   npm install  # ou bun install
   ```

3. **Créez les fichiers de clés API** dans `~/.config/opencode/` :
   ```bash
   # Provider gratuit (requis pour l'orchestration)
   echo "YOUR_GROQ_KEY" > ~/.config/opencode/.groq-key
   echo "YOUR_GEMINI_KEY" > ~/.config/opencode/.gemini-key
   echo "YOUR_OPENROUTER_KEY" > ~/.config/opencode/.openrouter-key
   echo "YOUR_NOVITA_KEY" > ~/.config/opencode/.novita-key
   echo "YOUR_ZHIPU_KEY" > ~/.config/opencode/.zhipu-key
   echo "YOUR_HF_KEY" > ~/.config/opencode/.hf-key

   # Providers optionnels
   echo "YOUR_MISTRAL_KEY" > ~/.config/opencode/.mistral-key
   echo "YOUR_TOGETHER_KEY" > ~/.config/opencode/.together-key
   echo "YOUR_DEEPSEEK_KEY" > ~/.config/opencode/.deepseek-key
   echo "YOUR_ZENMUX_KEY" > ~/.config/opencode/.zenmux-key
   echo "YOUR_MAMMOUTH_KEY" > ~/.config/opencode/.mammouth-key
   ```

4. **Vérifiez la configuration** :
   ```bash
   opencode /run "test"
   ```

### Installation sur différents OS

| OS | Shell | Notes |
|----|-------|-------|
| **Windows** | WSL2 / Git Bash / PowerShell | Le wrapper `hash-direct.py` contourne un bug SDK. Scripts PowerShell dans `scripts/windows/`. |
| **macOS** | bash / zsh | Tout fonctionne nativement. `opencode run` fonctionne sans wrapper. |
| **Linux** | bash | Tout fonctionne nativement. Aucun workaround nécessaire. |

---

## 🚀 Utilisation

### Commandes personnalisées

- `/run "votre prompt"` → Utilise le wrapper hash-direct avec fallback automatique
- `/hash-direct [options] "prompt"` → Accès direct aux providers avec contrôle fin
- `/audit-log` → Affiche le journal d'audit (JSONL)
- `/commit` → Commit Git intelligent
- `/review` → Revue de code
- `/quota` → Gestion des quotas
- `/mode` → Changer le mode (FREE/PRO)
- `/myfree-eurinhash` → Test complet des modèles gratuits

### Options de hash-direct

```bash
--model SPECIFIC    Utiliser un modèle spécifique
--provider SPECIFIC Forcer un provider (groq, mistral, zhipu, etc.)
--task-type TYPE    Type de tâche (code|chat|auto)
--max-tokens N      Nombre max de tokens (défaut: 2048)
--temperature F     Température (défaut: 0.2)
--json              Sortie JSON brute
--reset-quota       Réinitialiser les compteurs de quota
--reset-circuit     Réinitialiser les circuit breakers
--status            Afficher l'état des quotas + circuit
--list              Lister tous les modèles disponibles
--list-providers    Lister les providers configurés
```

### Routage intelligent (EURINHASH)

```bash
# Trouver le meilleur worker pour un type de tâche
python ~/.config/opencode/scripts/route.py code

# Trouver le worker de secours (fallback)
python ~/.config/opencode/scripts/route.py code --next

# Lister tous les workers avec leur statut
python ~/.config/opencode/scripts/route.py list

# Enregistrer un résultat (feedback bayésien)
python ~/.config/opencode/scripts/route.py record worker-groq success
```

---

## 🔒 Sécurité

- **Clés API exclues** : Tous les fichiers `.*-key`, `.env`, `provider_*.json` sont dans `.gitignore`
- **Masquage des secrets** : Le journal d'audit masque automatiquement les tokens, mots de passe, etc.
- **Détection des opérations sensibles** : Surveillance des commandes dangereuses (rm, dd, mkfs, etc.)
- **Rotation des logs** : Fichiers d'audit tournés tous les 30 jours
- **Aucune donnée sensible versionnée** : Seulement le code de configuration est public

---

## 📊 Monitoring

### Fichiers d'état

- `provider_usage.json` : Compteur d'appels quotidien
- `provider_circuit.json` : État du circuit breaker
- `logs/audit-YYYY-MM-DD.jsonl` : Journal d'audit détaillé
- `free-models.json` : Statut en temps réel des workers
- `route-usage.json` : Historique des succès/échecs (feedback bayésien)

### Commandes utiles

```bash
# Voir l'état du système
opencode /run --status

# Tester un provider spécifique
opencode /hash-direct --provider groq "explique la récursion"

# Lister les modèles disponibles
opencode /hash-direct --list

# Réinitialiser les quotas (pour les tests)
opencode /hash-direct --reset-quota

# Afficher le journal d'audit
opencode /audit-log

# Tester tous les modèles gratuits
opencode /myfree-eurinhash
```

---

## ⚙️ Configuration avancée

### opencode.jsonc

La configuration principale définit :
- `default_agent`: "eurinhash"
- `small_model`: "google/gemini-2.5-flash"
- Permissions bash et skills
- Providers gratuits par défaut, entrées payantes clairement marquées (Mammouth en fallback optionnel)
- Serveurs MCP (Postgres pour la mémoire)

### Compétences personnalisées

- `hash-agent-matrix` : Routage L1-L4 par complexité
- `hash-token-efficiency` : Optimisation des tokens
- `hash-code-navigation` : Recherche efficace dans le code
- `hash-verification` : Vérification proportionnelle au risque
- `hash-enterprise-development` : Développement enterprise
- `hash-verification` : Vérification avant completion

---

## 🆘 Dépannage

### Problèmes courants

1. **"Creating a session failed"** → Vérifiez que `opencode.json` (legacy) n'a pas `permission.task: "deny"` (renommez en `.bak`)
2. **Opencode run plante** → Utilisez `/run` ou `/hash-direct` (contournement du bug Windows SDK — macOS/Linux : `opencode run` fonctionne nativement)
3. **Quota épuisé** → Le circuit breaker bascule automatiquement vers le provider suivant
4. **Erreur provider 429** → Vérifiez `provider_circuit.json` et attendez la fin du timeout
5. **Clé API manquante** → Créez le fichier `.xxx-key` correspondant
6. **Plugin qui ne charge pas** → Vérifiez que `node_modules` est installé (`npm install`)

### Logs

- Consultez `logs/audit-YYYY-MM-DD.jsonl` pour voir tous les appels d'outils
- Les erreurs de provider sont journalisées avec le contexte pour le débogage

---

## 📚 Documentation

La documentation complète est disponible dans `docs/` (en français et en anglais) :

| Document | Description |
|----------|-------------|
| [Architecture](docs/01-architecture.md) | Architecture technique, providers, protocole EURINHASH |
| [Configuration](docs/02-configuration.md) | Guide de configuration complète |
| [Agents](docs/03-agents.md) | Tous les 21 agents documentés |
| [Scripts](docs/04-scripts.md) | Référence des scripts Python |
| [Plugins](docs/05-plugins.md) | Plugins TypeScript |
| [Commands](docs/06-commands.md) | Slash commands |
| [Skills](docs/07-skills.md) | Compétences personnalisées |
| [Dépannage](docs/08-troubleshooting.md) | Problèmes courants et solutions |
| [Sécurité](docs/09-security.md) | Bonnes pratiques de sécurité |
| [Exemples](docs/11-examples.md) | Exemples de gouvernance |

---

## 🤝 Contribution

Les améliorations sont les bienvenues ! Pour contribuer :

1. Fork le dépôt
2. Créez une branche pour votre fonctionnalité
3. Commit vos changements
4. Ouvrez une Pull Request

---

## 📄 Licence

Configuration personnelle — adaptez selon vos besoins.

---

## 🙏 Remerciements

- OpenCode team pour l'excellent outil
- Providers gratuits (Groq, Mistral, etc.) pour leurs APIs
- Communauté open source pour l'inspiration

---

*Configuration maintenue avec amour par EurinHash*
*Dernière mise à jour : 2026-09-19*

---

## 🔗 Liens utiles

- [OpenCode](https://opencode.ai/) — L'outil d'IA pour le code
- [OpenCode GitHub](https://github.com/sst/opencode) — Dépôt source
- [Groq](https://groq.com/) — API gratuite (free tier)
- [Google AI Studio](https://aistudio.google.com/) — Gemini gratuit
- [Novita AI](https://novita.ai/) — API gratuite (256K ctx)
- [Zhipu AI](https://open.bigmodel.cn/) — GLM gratuit
- [OpenRouter](https://openrouter.ai/) — Accès aux modèles gratuits
- [Hugging Face](https://huggingface.co/) — Modèles open source
- [Ollama](https://ollama.com/) — Modèles locaux
- [Pollinations](https://pollinations.ai/) — API sans clé
- [ZenMux](https://zenmux.ai/) — Claude Sonnet 5 gratuit
- [Bun](https://bun.sh/) — Runtime JavaScript rapide
- [Node.js](https://nodejs.org/) — Environnement JavaScript