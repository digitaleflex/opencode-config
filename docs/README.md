# Documentation Technique — opencode-config EURINHASH

## 📋 Table des matières

1. [Architecture Technique](01-architecture.md)
2. [Guide de Configuration](02-configuration.md)
3. [Documentation des Agents](03-agents.md)
4. [Documentation des Scripts](04-scripts.md)
5. [Documentation des Plugins](05-plugins.md)
6. [Documentation des Slash Commands](06-commands.md)
7. [Documentation des Skills](07-skills.md)
8. [Guide de Dépannage](08-troubleshooting.md)
9. [Documentation de Sécurité](09-security.md)
10. [Exemples de gouvernance](11-examples.md)

---

## 🎯 Objectif du projet

Ce projet fournit une configuration **production-grade** pour OpenCode, un agent de codage IA open source. Il est conçu pour être :

- **100% gratuit** : Aucun modèle payant utilisé par défaut
- **Robuste** : Circuit breaker, quota tracking, fallback automatique
- **Sécurisé** : Redaction des secrets, détection des ops sensibles
- **Partageable** : Configuration versionnée, documentation complète
- **Extensible** : Architecture modulaire, agents spécialisés

---

## 🏗️ Architecture Globale

```
~/.config/opencode/
├── 📄 opencode.jsonc              # Configuration principale OpenCode
├── 📄 opencode.json               # Configuration legacy (backup)
├── 📄 opencode-mem.jsonc          # Configuration mémoire longue
├── 📄 tui.json                    # Configuration TUI
├── 📄 AGENTS.md                   # Instructions par défaut des agents
├── 📄 CONFIG-GUIDE.md            # Guide de configuration rapide
├── 📄 README.md                  # Documentation complète
├── 📄 .gitignore                 # Exclusions des fichiers sensibles
├── 📁 agent/                     # 19 agents spécialisés
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
│   └── worker-*.md              # Workers de fallback (4)
├── 📁 command/                   # 8 slash commands
│   ├── audit-log.md              # Journal d'audit
│   ├── commit.md                 # Commit Git
│   ├── hash-direct.md            # Appel direct aux providers
│   ├── myfree-eurinhash.md       # Test des modèles free
│   ├── quota.md                  # Gestion des quotas
│   ├── review.md                 # Revue de code
│   └── run.md                    # Wrapper opencode run
├── 📁 plugin/                    # 2 plugins TypeScript
│   ├── audit-logger.ts           # Journalisation JSONL
│   └── guard.ts                  # Protection destructive (+ redaction secrets)
├── 📁 scripts/                   # 7 scripts Python
│   ├── hash-direct.py            # Wrapper principal (circuit breaker + quota)
│   ├── hash-direct-wrapper.py    # Alias opencode run
│   ├── free-probe.py             # Test de disponibilité des modèles
│   ├── quota.py                  # Gestion des quotas
│   ├── myfree-eurinhash.py       # Test complet des modèles
│   └── view-audit-log.py         # Affichage du journal d'audit
├── 📁 skills/                    # 20+ compétences
│   ├── hash-agent-matrix/        # Routage L1-L4
│   ├── hash-code-navigation/     # Navigation efficace
│   ├── hash-token-efficiency/    # Optimisation des tokens
│   ├── hash-verification/        # Vérification proportionnée
│   └── hash-enterprise-development/ # Développement enterprise
├── 📁 docs/                      # Documentation technique
│   └── superpowers/plans/        # Plans de développement
├── 📁 logs/                      # Journaux d'audit (JSONL)
└── 📁 node_modules/              # Dépendances installées
```

---

## 🔄 Flux de données

```
Utilisateur
    │
    ├─ opencode run "prompt" ──► hash-direct-wrapper.py ──► hash-direct.py
    │                                                                    │
    │                                                                    ├─► Circuit breaker (provider_circuit.json)
    │                                                                    ├─► Quota tracking (provider_usage.json)
    │                                                                    └─► API calls (Groq, Mistral, Zhipu, etc.)
    │
    └─ opencode agent "task" ──► Agent (eurinhash/planner/etc.)
                                      │
                                      ├─► opencode run (si bug) ──► hash-direct.py
                                      └─► opencode native (si fonctionnel)
```

---

## 📊 État des composants

| Composant | Fichier | Statut |
|-----------|---------|--------|
| Config principale | `opencode.jsonc` | ✅ Actif |
| Config legacy | `opencode.json` | ⚠️ Backup (`.bak`) |
| Superviseur | `agent/eurinhash.md` | ✅ Actif |
| 9 agents | `agent/*.md` | ✅ Actifs |
| 4 workers | `agent/worker-*.md` | ✅ Actifs |
| 8 commands | `command/*.md` | ✅ Actives |
| 3 plugins | `plugin/*.ts` | ✅ Actifs |
| 7 scripts | `scripts/*.py` | ✅ Actifs |
| 5 hash skills | `skills/hash-*/SKILL.md` | ✅ Actifs |
| Audit logger | `logs/audit-*.jsonl` | ✅ Actif |
| Quota tracking | `provider_usage.json` | ✅ Actif |
| Circuit breaker | `provider_circuit.json` | ✅ Actif |

---

## 📚 Documentation détaillée

Pour une explication complète de chaque composant, consultez les fichiers de documentation :

- **Architecture** → [01-architecture.md](01-architecture.md)
- **Configuration** → [02-configuration.md](02-configuration.md)
- **Agents** → [03-agents.md](03-agents.md)
- **Scripts** → [04-scripts.md](04-scripts.md)
- **Plugins** → [05-plugins.md](05-plugins.md)
- **Commands** → [06-commands.md](06-commands.md)
- **Skills** → [07-skills.md](07-skills.md)
- **Dépannage** → [08-troubleshooting.md](08-troubleshooting.md)
- **Sécurité** → [09-security.md](09-security.md)

---

*Documentation générée le $(date)*
*Par l'équipe EURINHASH*