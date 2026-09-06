# Documentation des Slash Commands — opencode-config EURINHASH

## Table des matières
1. [/run](#run)
2. [/hash-direct](#hash-direct)
3. [/audit-log](#audit-log)
4. [/commit](#commit)
5. [/review](#review)
6. [/quota](#quota)
7. [/myfree-eurinhash](#myfree-eurinhash)
8. [Création de commandes personnalisées](#création-de-commandes-personnalisées)

---

## 1. /run — Wrapper opencode run

### Description
Contourne le bug Windows SDK de `opencode run` en appelant directement le wrapper hash-direct avec fallback automatique.

### Syntaxe
```
/run "votre prompt ici"
/run --model "codestral-latest" "votre prompt"
/run --provider groq "votre prompt"
/run --status
/run --list
/run --list-providers
```

### Options
| Option | Description |
|--------|-------------|
| `--model` | Forcer un modèle spécifique |
| `--provider` | Forcer un provider spécifique |
| `--status` | Afficher l'état du quota et circuit breakers |
| `--list` | Lister tous les modèles disponibles |
| `--list-providers` | Lister les providers configurés |

### Exemples
```bash
# Utilisation standard (recommandé)
/run "Explique la récursivité"

# Forcer Groq
/run --provider groq "Analyse ce code"

# Forcer un modèle
/run --model "qwen/qwen3.8-27b" "Que fait cette fonction ?"

# Voir l'état du système
/run --status

# Voir les modèles
/run --list
```

### Pourquoi ce command ?
Le bug `opencode run` sous Windows (SDK) échoue silencieusement. Ce command utilise notre wrapper hash-direct à la place, contournant le bug.

---

## 2. /hash-direct — Appel direct aux providers

### Description
Accès direct aux providers AI avec contrôle complet. Fallback automatique, circuit breaker, quota tracking.

### Syntaxe
```
/hash-direct "votre prompt"
/hash-direct --model "qwen/qwen3.8-27b" "votre prompt"
/hash-direct --provider mistral "votre prompt"
/hash-direct --task-type code "votre prompt"
/hash-direct --json "votre prompt"
/hash-direct --status
/run --reset-quota
/run --reset-circuit
```

### Options
| Option | Description |
|--------|-------------|
| `--model` | Modèle spécifique |
| `--provider` | Provider spécifique |
| `--task-type` | code, chat, auto |
| `--max-tokens` | Max tokens |
| `--temperature` | Température |
| `--json` | Sortie JSON brute |
| `--status` | État du système |
| `--reset-quota` | Réinitialiser quota |
| `--reset-circuit` | Réinitialiser circuit breakers |

### Exemples
```bash
# Fallback automatique
/hash-direct "Analyse ce code"

# Forcer un provider
/hash-direct --provider groq "Salut"

# Forcer un modèle
/hash-direct --model "codestral-latest" "Code review"

# JSON pour auto-traitement
/hash-direct --json "test"

# État système
/hash-direct --status
```

### Utilisation avancée
```bash
# Avec toutes les options
/hash-direct --provider mistral --task-type code --max-tokens 4096 --temperature 0.1 "Codez une fonction de tri"
```

---

## 3. /audit-log — Journal d'audit

### Description
Affiche le journal d'audit JSONL récent. Détecte les ops sensibles, montre les appels de modèles, et les succès/erreurs.

### Syntaxe
```
/audit-log
/audit-log --date 2026-09-06
/audit-log --filter tool.execute
/audit-log --json
/audit-log --help
```

### Options
| Option | Description |
|--------|-------------|
| `--date YYYY-MM-DD | Filtrer par date |
| `--filter PATTERN | Filtrer par pattern (outil, statut, modèle) |
| `--json | Sortie JSON brute |
| `--help | Aide contextuelle |

### Exemples
```bash
# Voir tous les logs d'aujourd'hui
/audit-log

# Voir seulement les erreurs
/audit-log --filter "error"

# Voir les logs d'une date précise
/audit-log --date 2026-09-05

# JSON pour traitement
/audit-log --json

# Stats rapides
/audit-log | python scripts/view-audit-log.py --statistics
```

### Structure du journal
```jsonl
{"timestamp":"2026-09-06T10:30:00Z","tool":"tool.execute","model":"groq/qwen/qwen3.8-27b","status":"success","duration_ms":1500,"provider":"groq"}
{"timestamp":"2026-09-06T10:30:01Z","tool":"bash","command":"rm -rf /test","status":"blocked","reason":"ops_sensitive","redaction":true}
{"timestamp":"2026-09-06T10:30:02Z","tool":"tool.execute","model":"zhipu/glm-4.7-flash","status":"error","error":"429","provider":"zhipu"}
```

---

## 4. /commit — Commit Git

### Description
Effectue un commit Git avec message Conventional Commits. Suit les conventions de commit pour une histoire propre.

### Syntaxe
```
/commit
/commit "message personnalisé"
/commit feat "ajout de la fonction auth"
/commit fix "correction bug connexion"
/commit docs "mise à jour README"
```

### Options
| Option | Description |
|--------|-------------|
| Message personnalisé | `/commit "mon message"` |
| Par type et scope | `/commit feat "description"` |
| Par type uniquement | `/commit feat` |

### Convention de commit
```
Types :
- feat : Nouvelle fonctionnalité
- fix : Correction de bug
- docs : Documentation
- style : Formatage, style (pas de changement fonctionnel)
- refactor : Refactoring
- test : Ajout de tests
- chore : Maintenance

Portée (optionnelle) :
- auth, core, api, ui, docs, build, ci, chore, test

Exemples :
/commit feat "ajout de l'authentification OAuth"
/commit fix "correction fuite mémoire"
/commit docs "mise à jour README"
/commit style "reformatter le code"
/commit refactor "extraction du module util"
/commit test "ajout tests unitaires"
/commit chore "mise à jour des dépendances"
```

### Utilisation
```bash
# Commit automatique avec message généré
/commit

# Commit avec message personnalisé
/commit "Refactor le module auth pour utiliser OAuth2"

/# Via le TUI OpenCode (souvent utilisé)
# OpenCode invite automatiquement
```

### Vérification
Avant le commit, vérifie :
- Aucun fichier sensible inclus (clés API, secrets)
- Message conventionnel respecté
- Fichiers stagés correctement

---

## 5. /review — Revue de code

### Description
Lance une revue de code structurée par l'agent `reviewer`. Vérifie la qualité, la sécurité, les best practices.

### Syntaxe
```
/review
/review "description du code à reviewer"
/review "fonction authenticate" 
/review "module auth.ts"
```

### Options
| Option | Description |
|--------|-------------|
| Description | Description du code à reviewer |
| Focus | Focus sur un aspect spécifique |
| Agent | Agent spécifique (reviewer par défaut) |

### Utilisation
```bash
# Revue de code automatique
/review

# Revue ciblée
/review "Fonction de connexion avec gestion d'erreur"

/# Revue avec focus sécurité
/review --security "Code de gestion des tokens"
```

### Sortie
Le reviewer produit un rapport structuré :
- Qualité du code (score sur 10)
- Problèmes détectés
- Suggestions d'amélioration
- Sécurité (OWASP Top 10)
- Best practices

---

## 6. /quota — Gestion des quotas

### Description
Affiche et gère les quotas des providers. Voir l'état, réinitialiser, forcer.

### Syntaxe
```
/quota
/quota status
/quota reset
/quota set groq 30
/quota add mistral 5
/quota status --detail
```

### Options
| Option | Description |
|--------|-------------|
| `status` | État actuel des quotas |
| `reset` | Réinitialiser tous les compteurs |
| `set fournisseur N` | Définir un quota spécifique |
| `add fournisseur N` | Ajouter au quota actuel |
| `--detail` | Détails par modèle |

### Exemples
```bash
# État actuel
/quota

# État détaillé
/quota status --detail

# Réinitialiser
/quota reset

# Forcer un quota
/quota set groq 50

# Ajouter des quotas
/quota add mistral 5
```

### Structure affichée
```text
=== Quota tracking ===
groq/qwen/qwen3.8-27b: 12/50 (12 utilisés sur 50)
mistral/codestral-latest: 3/30
google/gemini-2.5-flash: 0/20
zhipu/glm-4.7-flash: 0/20

=== Circuit breakers ===
groq: CLOSED (failures=0)
mistral: CLOSED (failures=0)
zhipu: OPEN (failures=3, timeout dans 32s)
```

---

## 7. /myfree-eurinhash — Test des modèles gratuits

### Description
Lance un test complet de tous les modèles gratuits et affiche les résultats.

### Syntaxe
```
/myfree-eurinhash
/myfree-eurinhash --quick
/myfree-eurinhash --detail
```

### Options
| Option | Description |
|--------|-------------|
| `--quick` | Test rapide (un modèle par provider) |
| `--detail` | Test détaillé (réponses complètes) |

### Exemples
```bash
# Test complet
/myfree-eurinhash

# Test rapide (1 modèle par provider)
/myfree-eurinhash --quick

# Test détaillé
/myfree-eurinhash --detail
```

### Sortie
```text
=== EURINHASH Free Models Test ===
Providers testés : 8
Modèles testés : 21
OK : 17
Erreurs : 4

[OK] groq/qwen/qwen3.8-27b - 1.2s
[OK] mistral/codestral-latest - 1.5s
[OK] openrouter/openrouter/free - 2.1s
[OK] google/gemini-2.5-flash - 850ms
[ERR] zhipu/glm-4.7-flash - 429 (Quota épuisé)
[OK] huggingface/Qwen - 3.2s
[OK] novita/DeepSeek-V4-Flash - 1.8s
[OK] together/Kimi-K2.7-Code - 2.3s
```

---

## 8. Création de commandes personnalisées

### Structure d'une command
```markdown
---
description: Description courte
agent: eurinhash
---

Commande à exécuter avec $ARG

Exemples :
- /ma-commande arg1
- /ma-commande "prompt complet"
```

### Créer une command
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

# 2. La command est automatiquement disponible via /ma-commande
```

### Ajouter dans la TUI
Les commands sont automatiquement détectées par OpenCode via le répertoire `command/`. Il suffit de créer le fichier `.md` avec la bonne structure.

---

*Documentation commands générée le $(date)*