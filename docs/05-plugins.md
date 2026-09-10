# Documentation des Plugins — opencode-config EURINHASH

## Table des matières
1. [audit-logger.ts](#audit-loggerts)
2. [guard.ts](#guardts)
3. [better-compact](#better-compactts)
4. [Plugins tiers](#plugins-tiers)
5. [Configuration des plugins](#configuration-des-plugins)
6. [Comment ajouter un plugin](#comment-ajouter-un-plugin)
7. [Plugins retirés](#plugins-retirés)

---

## 1. audit-logger.ts — Journalisation JSONL

### Description
Plugin de journalisation complet qui trace tous les appels d'outils et les interactions agent dans un fichier JSONL rotatif. Détecte les opérations sensibles et redaction des secrets.

### Installation
```typescript
// Dans opencode.jsonc
"plugins": [
  "./plugin/audit-logger.ts"
]
```

### Fonctionnalités

#### 1. Journalisation JSONL
- Format : `logs/audit-YYYY-MM-DD.jsonl`
- Rotation : 30 jours
- Structure par entrée :
```json
{
  "timestamp": "2026-09-06T12:00:00Z",
  "agent": "eurinhash",
  "tool": "bash",
  "command": "rm -rf /tmp/test",
  "status": "blocked",
  "duration_ms": 5,
  "model": "groq/qwen/qwen3.8-27b",
  "session_id": "ses_abc123"
}
```

#### 2. Hooks
Le plugin s'attache à 3 événements :
- `tool.execute.before` — Avant chaque exécution d'outil
- `tool.execute.after` — Après chaque exécution d'outil
- `agent.invoked` — Quand un agent est invoqué

#### 3. Détection des ops sensibles
```typescript
const SENSITIVE_PATTERNS = [
  /rm\s+-rf/i,           // Suppression récursive
  /dd\s+if=/i,            // dd (écriture disque)
  /mkfs/i,                // Formatage système
  /:>$/m,                // Redirection destructive
  />\s*\/etc/,            // Écriture dans /etc
  /chmod\s+777/,          // Permissions larges
  /sudo\s+rm/,            // Suppression avec sudo
  /shutdown/i,            // Arrêt système
  /reboot/i,              // Redémarrage
];
```

#### 4. Redaction des secrets
```typescript
const SECRET_PATTERNS = [
  /sk-\w+/gi,              // OpenAI keys
  /Bearer\s+\w+/gi,        // Authorization headers
  /password\s*=\s*\w+/gi,  // Password in config
  /api_key\s*=\s*\w+/gi,   // API keys
];
```

### Utilisation
```bash
# Voir les logs d'audit
opencode /audit-log

# Voir les logs d'aujourd'hui
cat logs/audit-2026-09-06.jsonl

# Chercher un pattern
grep "blocked" logs/audit-2026-09-06.jsonl

# Statistiques
python scripts/view-audit-log.py
```

### Structure des logs
```jsonl
// Succès
{"ts": "...", "tool": "tool.execute", "model": "...", "status": "success", "duration": 1500}

// Bloqué (ops sensible)
{"ts": "...", "tool": "tool.execute", "command": "rm -rf /", "status": "blocked", "redaction": true}

// Erreur provider
{"ts": "...", "tool": "tool.execute", "status": "error", "error": "429", "provider": "zhipu"}
```

### Rotation et nettoyage
- Rotation automatique tous les 30 jours
- Ancien fichier renommé en `.gz`
- Suppression automatique après 90 jours

---

## 2. guard.ts — Protection destructive

### Description
Plugin de sécurité qui bloque les commandes destructives avant leur exécution. Protection contre les erreurs humaines.

### Installation
```typescript
// Dans opencode.jsonc
"plugins": [
  "./plugin/guard.ts"
]
```

### Commandes bloquées

| Commande | Pattern | Action |
|----------|---------|--------|
| `rm -rf` | `/rm\s+-rf/` | Blocage |
| `dd` | `/dd\s+if=/` | Blocage |
| `mkfs` | `/mkfs/` | Blocage |
| `> /etc/` | `/>\s*\/etc/` | Blocage |
| `chmod 777` | `/chmod\s+777/` | Blocage |
| `sudo rm` | `/sudo\s+rm/` | Blocage |
| `shutdown` | `/shutdown/i` | Blocage |
| `reboot` | `/reboot/i` | Blocage |

### Configuration
```typescript
// Personnaliser dans guard.ts
const BLOCKED_COMMANDS = [
  ...SENSITIVE_PATTERNS,
  "ma_commande_personnalisee",
];
```

### Utilisation
Le plugin fonctionne automatiquement. Quand une commande bloquée est détectée :
1. L'exécution est annulée
2. Un message d'avertissement est affiché
3. L'audit logger enregistre l'événement

### Exemple de sortie
```
⚠️ Commande bloquée : rm -rf /tmp/test
Raison : Opération destructive détectée
Utilisateur : user@machine
Time : 2026-09-06T12:00:00Z
```

---

## 3. better-compact — Ladder de pruning (contexte)

### Description
Plugin tiers (`better-compact` sur npm, fork amélioré de
`@tarquinen/opencode-dcp`) : ladder de pruning — skills, dédup d'appels,
stubs d'outils, thinking, puis résumé en dernier recours. Prune **sans
dépenser d'appels modèle**, contrairement à la compaction classique.
Remplace l'ancienne entrée `opencode-dynamic-context-pruning` (nom de
paquet inexistant → 404 npm) et le stub local `context-summarizer.ts`
(supprimé : simple slice de messages, pas de vraie summarization).

### Installation
```jsonc
// Dans opencode.jsonc
"plugin": [
  "better-compact"
]
```

### Fonctionnement
- Prune d'abord sans modèle (dédup, stubs, thinking), résume en dernier
- Protège les sorties critiques (subagents, skills, todos)
- Commande manuelle pour un passage à la demande

---

## 4. Plugins tiers

### opencode-plugin-preload-skills
- **Source** : `opencode-plugin-preload-skills` (npm, v1.8.2)
- **Fonction** : Chargement smart des skills (déclencheurs, budget tokens, résumés, minification, analytics)
- **Avantage** : Remplace `lazy-skills` + `skillful` ; config `.opencode/preload-skills.json`

### opencode-mem
- **Source** : `opencode-mem` (npm)
- **Fonction** : Mémoire persistante locale (Turso/libSQL)
- **Avantage** : Alternative locale à `supermemory` (cloud) — pas d'exfiltration de données

### envsitter-guard
- **Source** : npm
- **Fonction** : Protection des variables d'environnement
- **Avantage** : Empêche l'exposition des clés API dans les logs

---

## 5. Configuration des plugins

### opencode.jsonc (curée 2026-09-10 : un seul système par rôle)
```jsonc
{
  "plugin": [
    "better-compact",
    "opencode-mem",
    "envsitter-guard",
    "oh-my-opencode-slim",
    "./plugin/guard.ts",
    "./plugin/audit-logger.ts",
    "opencode-plugin-preload-skills"
  ]
}
```

### Ordre d'initialisation
1. `opencode-plugin-preload-skills` — Chargement des skills (budget tokens)
2. `envsitter-guard` — Protection env
3. `./plugin/guard.ts` — Protection destructive
4. `./plugin/audit-logger.ts` — Journalisation
5. `better-compact` — Pruning contexte
6. `opencode-mem` — Mémoire persistante locale

### Ordre d'exécution des hooks
```
tool.execute.before → guard.ts → audit-logger.ts (before)
tool.execute.after  → guard.ts (redaction secrets) → audit-logger.ts (after)
agent.invoked       → audit-logger.ts (agent)
```

---

## 7. Plugins retirés

| Plugin | Raison du retrait |
|---|---|
| `opencode-dynamic-context-pruning` | Nom de paquet inexistant (404 npm) → remplacé par `better-compact` |
| `./plugin/context-summarizer.ts` | Stub (simple slice) → remplacé par `better-compact` |
| `opencode-supermemory` | Doublon cloud de `opencode-mem` (local) → doubles écritures |
| `@felipegenef/opencode-lazy-skills` + `@zenobius/opencode-skillful` | Deux loaders → remplacés par `opencode-plugin-preload-skills` |
| `oh-my-openagent` | Chevauchait `oh-my-opencode-slim` + le superviseur maison |
| `opencode-router` | Bridges Slack/Telegram inutilisés (pas un routeur de modèles) |
| `opencode.nvim` | Pas d'usage Neovim constaté |
| `@f97/opencode-morph-fast-apply` | Désactivé (commenté) : exige `MORPH_API_KEY` — réactiver après avoir posé la clé |

---

## 6. Comment ajouter un plugin

### Plugin local (TypeScript)
1. Créer le fichier :
```bash
cat > plugin/mon-plugin.ts << 'EOF'
export default function init() {
  return {
    name: "mon-plugin",
    hooks: {
      "tool.execute.before": async (ctx) => {
        console.log(`Avant: ${ctx.command}`);
      }
    }
  };
}
EOF
```

2. Ajouter dans `opencode.jsonc` :
```jsonc
"plugins": [
  ...
  "./plugin/mon-plugin.ts"
]
```

### Plugin npm
```bash
npm install @mon/plugin
```

```jsonc
"plugins": [
  ...
  "@mon/plugin"
]
```

### Plugin distant
```jsonc
"plugins": [
  ...
  "github:mon/repo"
]
```

### Bonnes pratiques
- Toujours tester le plugin avant production
- Vérifier les permissions (read_files, write_files, bash)
- Documenter les hooks utilisés
- Gérer les erreurs gracieusement
- Ne pas bloquer le flux principal

---

*Documentation plugins générée le $(date)*