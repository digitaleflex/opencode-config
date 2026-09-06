# Guide de Configuration — opencode-config EURINHASH

## Table des matières
1. [Installation rapide](#1-installation-rapide)
2. [Configuration OpenCode](#2-configuration-opencode)
3. [Clés API](#3-clés-api)
4. [Agents](#4-agents)
5. [Plugins](#5-plugins)
6. [Commands](#6-commands)
7. [Skills](#7-skills)
8. [MCP Servers](#8-mcp-servers)
9. [Migration](#9-migration)

---

## 1. Installation rapide

### 1.1 Prérequis
- OpenCode installé : https://opencode.ai/
- Python 3.8+ (pour les scripts)
- Git (pour le versionnage)

### 1.2 Installation
```bash
# Option 1 : Cloner le dépôt
git clone https://github.com/digitaleflex/opencode-config.git ~/.config/opencode

# Option 2 : Copier manuellement les fichiers
cp -r opencode-config/* ~/.config/opencode/

# Option 3 : Déployer sur une nouvelle machine
cd ~/.config/opencode
git pull origin master  # Si déjà cloné
```

### 1.3 Après installation
```bash
# 1. Créer les fichiers de clés API (voir section 3)
echo "votre-cle-groq" > .groq-key
echo "votre-cle-mistral" > .mistral-key
# ... autres clés

# 2. Vérifier l'installation
python scripts/hash-direct.py --list-providers

# 3. Tester
opencode /run "test"
```

---

## 2. Configuration OpenCode

### 2.1 opencode.jsonc (configuration principale)
```jsonc
{
  // Agent par défaut
  "default_agent": "eurinhash",

  // Modèle pour les tâches simples
  "small_model": "groq/qwen/qwen3.8-27b",

  // Plugins actifs
  "plugins": [
    "@felipegenef/opencode-lazy-skills",
    "envsitter-guard",
    "./plugin/guard.ts",
    "./plugin/audit-logger.ts"
  ],

  // Configuration des providers (clés API)
  "providers": {
    "groq": {
      "api_key": "file:.groq-key",
      "base_url": "https://api.groq.com/openai/v1",
      "models": ["qwen/qwen3.8-27b", "qwen/qwen3.6-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"]
    },
    "mistral": {
      "api_key": "file:.mistral-key",
      "base_url": "https://api.mistral.ai/v1",
      "models": ["codestral-latest", "mistral-code-latest"]
    },
    "google": {
      "api_key": "file:.gemini-key",
      "base_url": "https://generativelanguage.googleapis.com/v2beta",
      "models": ["gemini-2.5-flash", "gemini-3.8-flash"]
    },
    "zhipu": {
      "api_key": "file:.zhipu-key",
      "base_url": "https://open.bigmodel.cn/api/paas/v4",
      "models": ["glm-4-flash", "glm-4-plus"]
    },
    "openrouter": {
      "api_key": "file:.openrouter-key",
      "base_url": "https://openrouter.ai/api/v1",
      "models": ["openrouter/free"]
    },
    "huggingface": {
      "api_key": "file:.hf-key",
      "base_url": "https://router.huggingface.co/v1",
      "models": ["Qwen/Qwen3-Coder-480B-A35B-Instruct"]
    },
    "novita": {
      "api_key": "file:.novita-key",
      "base_url": "https://api.novita.ai/v3/openai",
      "models": ["deepseek-ai/DeepSeek-V4-Flash", "inclusionai/ling-3.0-flash-sante"]
    },
    "together": {
      "api_key": "file:.together-key",
      "base_url": "https://api.together.xyz/v1",
      "models": ["moonshotai/Kimi-K2.7-Code", "meta-llama/Llama-4-Maverick"]
    }
  },

  // Permissions bash
  "permission": {
    "bash": {
      "auto_allow": ["git status", "ls", "cat", "head", "tail", "grep", "find", "pwd", "cd", "echo", "python", "node", "npm"],
      "ask": ["rm", "dd", "mkfs", "chmod", "sudo", "curl", "wget", "pip", "cargo"],
      "deny": []
    },
    "skill": "auto_allow"
  },

  // MCP servers
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost:5432/opencode"]
    }
  }
}
```

### 2.2 opencode-mem.jsonc (mémoire longue)
```jsonc
{
  "context_window": 200000,
  "summarize_after": 150000,
  "strategy": "auto"
}
```

### 2.3 tui.json (interface)
```jsonc
{
  "theme": "default",
  "keybinds": {
    "tab": "switch_mode",
    "ctrl+c": "interrupt",
    "ctrl+z": "undo"
  }
}
```

---

## 3. Clés API

### 3.1 Emplacement
Toutes les clés API sont dans `~/.config/opencode/` avec le format `.<provider>-key` :
```
.groq-key       # Groq API key
.mistral-key    # Mistral API key
.gemini-key     # Google Gemini API key
.zhipu-key      # Zhipu AI API key
.openrouter-key # OpenRouter API key
.hf-key         # HuggingFace API key
.novita-key     # Novita AI API key
.together-key   # Together AI API key
.deepseek-key   # DeepSeek API key (optionnel)
.mammouth-key   # Mammouth API key (fallback payant)
```

### 3.2 Format des fichiers
```bash
# Le fichier contient uniquement la clé, sans guillemets ni espaces
cat .groq-key
# gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3.3 Obtention des clés

| Provider | URL d'inscription | Tier gratuit |
|----------|-------------------|-------------|
| Groq | https://console.groq.com/ | 30 req/min, 14400 req/jour |
| Mistral | https://console.mistral.ai/ | 30M tokens/mois |
| Google | https://aistudio.google.com/ | 20 req/min |
| Zhipu | https://bigmodel.cn/ | 200 req/jour |
| OpenRouter | https://openrouter.ai/keys | Variable selon modèle |
| HuggingFace | https://huggingface.co/settings/api | Rate limiting gratuit |
| Novita | https://novita.ai/ | API gratuite |
| Together | https://api.together.xyz/ | $1 gratuit |

### 3.4 Sécurité
- Les fichiers `.*-key` sont dans `.gitignore` (jamais commités)
- Ne jamais partager les clés dans les logs ou les erreurs
- Renouveler les clés exposées immédiatement

---

## 4. Agents

### 4.1 Liste des agents
| Agent | Modèle | Rôle |
|-------|--------|------|
| eurinhash | groq/qwen/qwen3.8-27b | Superviseur, rotation providers |
| planner | groq/qwen/qwen3.8-27b | Plans avant action |
| architect | groq/qwen/qwen3.8-27b | Décisions architecturales |
| design-lead | groq/qwen/qwen3.8-27b | Direction UI/UX |
| builder | mistral/codestral-latest | Implémentation code |
| quality-engineer | mistral/codestral-latest | Qualité, linting |
| tester | mistral/codestral-latest | Tests automatisés |
| security | mistral/codestral-latest | Analyse sécurité |
| reviewer | mistral/codestral-latest | Revue de code |
| git-engineer | mistral/codestral-latest | Opérations Git |
| docwriter | groq/qwen/qwen3.8-27b | Documentation |

### 4.2 Structure d'un agent
```markdown
---
description: Description courte du rôle de l'agent
model: groq/qwen/qwen3.8-27b
tools: read_files, write_files, bash, web_fetch, search
---

# Instructions de l'agent

Vous êtes [nom de l'agent]. Votre rôle est de...

## Capacités
- Capacité 1
- Capacité 2

## Limitations
- Limitation 1
- Limitation 2

## Workflow
1. Première étape
2. Deuxième étape
3. Troisième étape
```

### 4.3 Ajouter un nouvel agent
```bash
# 1. Créer le fichier
cat > agent/mon-agent.md << 'EOF'
---
description: Mon agent personnalisé
model: groq/qwen/qwen3.8-27b
tools: read_files, write_files, bash
---

# Mon Agent

Instructions détaillées...
EOF

# 2. Optionnel : Ajouter au routing dans hash-agent-matrix
# Éditer skills/hash-agent-matrix/SKILL.md
```

### 4.4 Invoquer un agent spécifique
Dans OpenCode, vous pouvez invoquer un agent spécifique :
```bash
# Via le TUI
/agent planner "planifie cette tâche"

/# Via le prompt
@planner Planifie cette tâche : ...
```

---

## 5. Plugins

### 5.1 Plugins installés
| Plugin | Fichier | Fonction |
|--------|---------|----------|
| opencode-lazy-skills | node_modules | Chargement paresseux des skills |
| envsitter-guard | (npm) | Protection des variables d'environnement |
| guard.ts | plugin/guard.ts | Blocage commandes destructives |
| audit-logger.ts | plugin/audit-logger.ts | Journalisation JSONL |

### 5.2 Configuration des plugins
```jsonc
// Dans opencode.jsonc
"plugins": [
  "@felipegenef/opencode-lazy-skills",
  "envsitter-guard",
  "./plugin/guard.ts",
  "./plugin/audit-logger.ts"
]
```

### 5.3 Ajouter un plugin
```bash
# 1. Plugin npm
npm install @mon/plugin

# 2. Plugin local
cp mon-plugin.ts plugin/

# 3. Ajouter dans opencode.jsonc
"plugins": [
  ...
  "@mon/plugin"
]
```

---

## 6. Commands

### 6.1 Liste des commands
| Command | Description |
|---------|-------------|
| `/run` | Wrapper hash-direct avec fallback automatique |
| `/hash-direct` | Appel direct aux providers |
| `/audit-log` | Affichage du journal d'audit |
| `/commit` | Commit Git avec Conventional Commits |
| `/review` | Revue de code |
| `/quota` | Gestion des quotas |
| `/myfree-eurinhash` | Test de tous les modèles gratuits |

### 6.2 Structure d'une command
```markdown
---
description: Description courte de la command
agent: eurinhash
---

Commande à exécuter
$ARG = argument passé par l'utilisateur

Exemples :
- /command arg1
- /command "prompt complet"
```

### 6.3 Créer une nouvelle command
```bash
# 1. Créer le fichier
cat > command/ma-commande.md << 'EOF'
---
description: Ma commande personnalisée
agent: builder
---

python scripts/mon-script.py $ARG

## Exemples
- /ma-commande argument1
- /ma-commande "prompt complet"
EOF

# 2. La command est automatiquement disponible
```

---

## 7. Skills

### 7.1 Skills personnalisées
| Skill | Description |
|-------|-------------|
| `hash-agent-matrix` | Routage des tâches L1-L4 |
| `hash-token-efficiency` | Optimisation des tokens |
| `hash-code-navigation` | Recherche efficace dans le code |
| `hash-verification` | Vérification proportionnée |
| `hash-enterprise-development` | Développement enterprise |

### 7.2 Structure d'une skill
```markdown
# Skill Name

## Description
Description de la skill...

## Activation
Quand utiliser cette skill :
- Condition 1
- Condition 2

## Workflow
1. Étape 1
2. Étape 2
3. Étape 3

## Validation
Comment valider le résultat...
```

### 7.3 Créer une nouvelle skill
```bash
# 1. Créer le répertoire et le fichier
mkdir -p skills/ma-skill
cat > skills/ma-skill/SKILL.md << 'EOF'
# Ma Skill

Description...
EOF

# 2. La skill est automatiquement disponible
```

---

## 8. MCP Servers

### 8.1 Configuration
```jsonc
// Dans opencode.jsonc
"mcpServers": {
  "postgres": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost:5432/opencode"]
  }
}
```

### 8.2 Ajouter un MCP server
```jsonc
"mcpServers": {
  "mon-server": {
    "command": "npx",
    "args": ["-y", "@mcp/server", "arg1", "arg2"]
  }
}
```

---

## 9. Migration

### 9.1 De opencode.json vers opencode.jsonc
Si vous aviez `opencode.json`, migratez vers `opencode.jsonc` :
```bash
# 1. Sauvegarder l'ancienne config
cp opencode.json opencode.json.bak

# 2. Convertir en JSONC (ajouter // commentaires)
# 3. Ajouter les nouvelles fonctionnalités
```

### 9.2 Problèmes de migration courants
| Problème | Solution |
|----------|----------|
| "Creating a session failed" | Vérifier que `permission.task` n'est pas `"deny"` |
| Permission denied | Vérifier `permission.bash` dans `opencode.jsonc` |
| Plugins ne chargent pas | Vérifier le chemin des plugins locaux |

### 9.3 Rollback
```bash
# Revenir à l'ancienne configuration
mv opencode.json.bak opencode.jsonc
```

---

## 10. Checklist post-installation

- [ ] Clés API créées (`.groq-key`, `.mistral-key`, etc.)
- [ ] `python scripts/hash-direct.py --list-providers` → OK
- [ ] `opencode /run "test"` → OK
- [ ] `opencode /audit-log` → fonctionne
- [ ] Git initialisé (si souhaité)
- [ ] `.gitignore` vérifié (clés exclues)

---

*Document généré le $(date)*
*Pour toute question, ouvrir une issue sur GitHub*