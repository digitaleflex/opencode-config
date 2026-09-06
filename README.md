# opencode-config

Configuration EURINHASH pour OpenCode - 100% modèles gratuits, agents spécialisés, et renforcement de sécurité.

## 🚀 Fonctionnalités

- **Modèles 100% gratuits** : Groq, Mistral, Zhipu, OpenRouter, HuggingFace, Novita, Together
- **Superviseur EURINHASH** : Rotation automatique des providers en cas de quota/erreur
- **9 agents spécialisés** : planner, architect, design-lead, builder, quality-engineer, tester, security, reviewer, git-engineer
- **Circuit breaker** : Protection contre les providers défaillants (état CLOSED/OPEN/HALF_OPEN)
- **Quota tracking local** : Comptage journalier par provider/modèle pour éviter les dépassements
- **Wrapper hash-direct** : Contournement du bug `opencode run` sous Windows
- **Audit logger** : Journalisation JSONL des appels d'outils avec détection ops sensibles et redaction
- **Commandes personnalisées** : `/run`, `/hash-direct`, `/audit-log`
- **Plugins** : `@felipegenef/opencode-lazy-skills`, `envsitter-guard`, guard.ts, audit-logger.ts
- **Skill matrix** : Routage intelligent des tâches selon leur complexité (L1-L4)

## 🏗️ Architecture

```
opencode
├── agent/              # 9 agents spécialisés avec modèles dédiés
├── command/            # Slash commands personnalisées
├── plugin/             # Audit logger, guard, context summarizer
├── scripts/            # hash-direct.py (wrapper), quota tracking, circuit breaker
├── skills/             # Compétences personnalisées (hash-agent-matrix, etc.)
└── config/             # opencode.jsonc (configuration principale)
```

### Modèles par agent

| Agent | Modèle | Provider |
|-------|--------|----------|
| eurinhash (superviseur) | `groq/qwen/qwen3.8-27b` | Groq |
| planner, architect, design-lead, docwriter | `groq/qwen/qwen3.8-27b` | Groq |
| builder, quality-engineer, tester, security, reviewer, git-engineer | `mistral/codestral-latest` | Mistral |
| worker-* | Divers selon fallback | Gratuit/Pro |

## 🔧 Installation

### Prérequis
- [OpenCode installé](https://opencode.ai/)
- Clés API pour les providers gratuits (voir `.gitignore` pour les noms de fichiers)

### Étapes
1. Cloner ce dépôt :
   ```bash
   git clone https://github.com/digitaleflex/opencode-config.git %USERPROFILE%\.config\opencode
   ```

2. Créer les fichiers de clés API dans `%USERPROFILE%\.config\opencode\` :
   - `.groq-key`
   - `.mistral-key`
   - `.gemini-key`
   - `.zhipu-key`
   - `.openrouter-key`
   - `.hf-key`
   - `.novita-key`
   - `.together-key`
   - `.deepseek-key` (optionnel)

3. Vérifier la configuration :
   ```bash
   opencode /run "test"
   ```

## 💡 Utilisation

### Commandes personnalisées
- `/run "votre prompt"` → Utilise le wrapper hash-direct avec fallback automatique
- `/hash-direct [options] "prompt"` → Accès direct aux providers avec contrôle fin
- `/audit-log` → Affiche le journal d'audit (JSONL)
- `/hash-direct --status` → État du quota et des circuit breakers
- `/hash-direct --list` → Liste tous les modèles disponibles
- `/hash-direct --list-providers` → Affiche quels providers ont des clés configurées

### Options hash-direct
```
--model SPECIFIC    Utiliser un modèle spécifique
--provider SPECIFIC Forcer un provider (groq, mistral, zhipu, etc.)
--task-type TYPE    Type de tâche (code|chat|auto)
--max-tokens N      Nombre max de tokens (défaut: 2048)
--temperature F     Température (défaut: 0.2)
--json              Sortie JSON brute
--reset-quota       Réinitialiser les compteurs de quota
--reset-circuit     Réinitialiser les circuit breakers
--status            Afficher l'état quota + circuit
--list              Lister tous les modèles disponibles
--list-providers    Lister les providers configurés
```

## 🔐 Sécurité

- **Clés API exclues** : Tous les `.*-key`, `.env`, `provider_*.json` sont dans `.gitignore`
- **Redaction des secrets** : L'audit logger masque automatiquement les tokens, mots de passe, etc.
- **Détection ops sensibles** : Surveillance des commandes dangereuses (rm, dd, mkfs, etc.)
- **Rotation de logs** : Les fichiers d'audit sont rotés tous les 30 jours
- **Aucun données sensibles versionnées** : Seul le code de configuration est public

## 📊 Monitoring

### Fichiers d'état
- `provider_usage.json` : Comptage journalier des appels
- `provider_circuit.json` : État des circuit breakers
- `logs/audit-YYYY-MM-DD.jsonl` : Journal d'audit détaillé

### Commandes utiles
```bash
# Voir l'état du système
opencode /run --status

# Forcer un test avec un provider spécifique
opencode /hash-direct --provider mistral "explique la récursivité"

# Voir les modèles disponibles
opencode /hash-direct --list

# Réinitialiser les quotas (utile pour tester)
opencode /hash-direct --reset-quota
```

## ⚙️ Configuration avancée

### opencode.jsonc
La configuration principale définit :
- `default_agent`: "eurinhash"
- `small_model`: "groq/qwen/qwen3.8-27b"
- Permissions bash et skills
- Providers gratuits uniquement (Mammouth en fallback optionnel)
- MCP servers (Postgres pour la mémoire)

### Compétences personnalisées
- `hash-agent-matrix` : Routage L1-L4 selon complexité
- `hash-token-efficiency` : Optimisation des tokens
- `hash-code-navigation` : Recherche efficace dans le codebase
- `hash-verification` : Vérification proportionnée au risque

## 🐛 Dépannage

### Problèmes courants
1. **"Creating a session failed"** → Vérifier que `opencode.json` (legacy) n'a pas `permission.task: "deny"` (renommer en `.bak`)
2. **Opencode run qui hang** → Utiliser `/run` ou `/hash-direct` à la place (contournement du bug Windows SDK)
3. **Quota épuisé** → Le circuit breaker bascule automatiquement vers le provider suivant
4. **Provider en erreur 429** → Vérifier `provider_circuit.json` et attendre la fin du timeout

### Logs
- Consulter `logs/audit-YYYY-MM-DD.jsonl` pour voir tous les appels d'outils
- Les erreurs de provider sont enregistrées avec contexte pour le debug

## 🤝 Contribution

Les améliorations sont les bienvenues ! Pour contribuer :

1. Fork le repository
2. Créer une branche pour votre fonctionnalité
3. Commiter vos changements
4. Ouvrir une Pull Request

## 📜 Licence

Configuration personnelle - à adapter selon vos besoins.

## 🙏 Remerciements

- Équipe OpenCode pour l'excellent outil
- Les providers gratuits (Groq, Mistral, etc.) pour leurs APIs
- Communauté open source pour l'inspiration

---
*Configuration maintenue avec ♥ par digitalefish*
*Dernière mise à jour : $(date)*