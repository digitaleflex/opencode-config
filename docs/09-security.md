# Documentation de Sécurité — opencode-config EURINHASH

## Table des matières
1. [Sécurité des clés API](#1-sécurité-des-clés-api)
2. [Détection des ops sensibles](#2-détection-des-ops-sensibles)
3. [Audit et traçabilité](#3-audit-et-tracabilité)
4. [Redaction des secrets](#4-redaction-des-secrets)
5. [Permissions](#5-permissions)
6. [Git et partage](#6-git-et-partage)
7. [Bonnes pratiques](#7-bonnes-pratiques)
8. [Incident response](#8-incident-response)

---

## 1. Sécurité des clés API

### 1.1 Stockage
Les clés API sont stockées dans des fichiers individuels dans `~/.config/opencode/` :
```
.groq-key       → Clé Groq
.mistral-key    → Clé Mistral
.gemini-key     → Clé Google Gemini
.zhipu-key      → Clé Zhipu
.openrouter-key → Clé OpenRouter
.hf-key         → Clé HuggingFace
.novita-key     → Clé Novita
.together-key   → Clé Together
.deepseek-key   → Clé DeepSeek (optionnel)
.mammouth-key   → Clé Mammouth (payant, fallback)
```

### 1.2 Protection
- **Jamais en clair dans le code** : Chaque clé est dans un fichier séparé
- **Jamais commitées** : `.gitignore` exclut tous les `.*-key` et `.env`
- **Permissions restrictives** : `chmod 600 ~/.config/opencode/.*-key`
- **Rotation** : Renouveler si exposition suspectée

### 1.3 Vérification
```bash
# Vérifier que les clés ne sont pas dans le git
git log --all --full-history -- "*.key" ".env"

# Vérifier le .gitignore
cat ~/.config/opencode/.gitignore

# Vérifier les permissions
ls -la ~/.config/opencode/.groq-key
```

### 1.4 Renouvellement
```bash
# Si une clé est compromise :
echo "NOUVELLE_CLE" > ~/.config/opencode/.groq-key
# Puis tester :
/host-direct --provider groq "test"
```

---

## 2. Détection des ops sensibles

### 2.1 Patterns bloqués
Le plugin `guard.ts` bloque les commandes destructives :

| Pattern | Description | Action |
|---------|-------------|--------|
| `rm -rf` | Suppression récursive | Blocage |
| `dd if=` | Écriture disque brut | Blocage |
| `mkfs` | Formatage système | Blocage |
| `:>$` | Redirection destructive | Blocage |
| `>/etc/` | Écriture dans /etc | Blocage |
| `chmod 777` | Permissions larges | Blocage |
| `sudo rm` | Suppression avec sudo | Blocage |
| `shutdown` | Arrêt système | Blocage |
| `reboot` | Redémarrage | Blocage |

### 2.2 Comment ça marche
```typescript
// Dans plugin/guard.ts
const SENSITIVE_PATTERNS = [
  /rm\s+-rf/i,
  /dd\s+if=/i,
  /mkfs/i,
  /:>$/m,
  />\s*\/etc/,
  /chmod\s+777/,
  /sudo\s+rm/,
  /shutdown/i,
  /reboot/i,
];

// Avant chaque exécution d'outil :
for (const pattern of SENSITIVE_PATTERNS) {
  if (pattern.test(command)) {
    throw new Error(`Commande bloquée : opération destructive détectée`);
  }
}
```

### 2.3 Exceptions
Pour les cas légitimes :
```bash
# Utiliser l'option --force (non recommandé)
# Ou modifier le guard.ts pour ajouter l'exception
```

### 2.4 Journalisation
Chaque op bloquée est enregistrée dans `logs/audit-YYYY-MM-DD.jsonl` :
```jsonl
{"timestamp":"2026-09-06T12:00:00Z","tool":"bash","command":"rm -rf /tmp/test","status":"blocked","reason":"ops_sensitive"}
```

---

## 3. Audit et traçabilité

### 3.1 Journal d'audit
Le plugin `audit-logger.ts` enregistre tous les événements dans `logs/audit-YYYY-MM-DD.jsonl`.

### 3.2 Événements tracés
- **tool.execute.before** : Avant chaque outil
- **tool.execute.after** : Après chaque outil
- **agent.invoked** : Quand un agent est invoqué

### 3.3 Structure de chaque entrée
```jsonl
{
  "timestamp": "2026-09-06T12:00:00Z",
  "agent": "eurinhash",
  "tool": "bash",
  "command": "ls -la",
  "status": "success",
  "duration_ms": 5,
  "model": "groq/qwen/qwen3.8-27b",
  "session_id": "ses_abc123",
  "redaction": false
}
```

### 3.4 Consultation
```bash
# Voir les logs d'aujourd'hui
/audit-log

# Voir les erreurs
/audit-log --filter error

# Voir les ops bloquées
/audit-log --filter blocked

# Statistiques
python scripts/view-audit-log.py --statistics
```

### 3.5 Rotation
- Les logs sont rotés tous les 30 jours
- Le fichier `.gz` est conservé 90 jours
- Le fichier `.jsonl` est conservé 30 jours

---

## 4. Redaction des secrets

### 4.1 Secrets détectés
Le plugin `audit-logger.ts` remplace automatiquement :
- `sk-xxxxxxxx` → `sk-****`
- `Bearer xxxxxx` → `Bearer ****`
- `password=xxxxx` → `password=****`
- `api_key=xxxxx` → `api_key=****`

### 4.2 Configuration
```typescript
const SECRET_PATTERNS = [
  /sk-\w+/gi,
  /Bearer\s+\w+/gi,
  /password\s*=\s*\w+/gi,
  /api_key\s*=\s*\w+/gi,
];
```

### 4.3 Ajouter un nouveau pattern
```typescript
// Dans audit-logger.ts
const SECRET_PATTERNS = [
  ...
  /secret_key\s*=\s*\w+/gi,  // Ajouter ici
];
```

---

## 5. Permissions

### 5.1 Configuration dans opencode.jsonc
```jsonc
"permission": {
  "bash": {
    "auto_allow": ["git status", "ls", "cat", "head", "tail", "grep", "find", "pwd", "cd", "echo", "python", "node", "npm"],
    "ask": ["rm", "dd", "mkfs", "chmod", "sudo", "curl", "wget", "pip", "cargo"],
    "deny": []
  },
  "skill": "auto_allow"
}
```

### 5.2 Explications

| Catégorie | Exemples | Action |
|-----------|----------|--------|
| `auto_allow` | ls, cat, grep, python, npm | Exécuté sans confirmation |
| `ask` | rm, dd, mkfs, sudo | Demande confirmation |
| `deny` | (aucun par défaut) | Toujours bloqué |

### 5.3 Ajouter une permission
```jsonc
"permission": {
  "bash": {
    "auto_allow": [..., "docker", "kubectl"],
    "ask": [..., "scp"]
  }
}
```

### 5.4 Règles de sécurité
- **Jamais de `auto_allow` pour rm, dd, mkfs** → Toujours `ask` ou `deny`
- **Clés API** → Toujours `ask` pour curl/wget
- **Modifications système** → Toujours `ask` pour sudo
- **Scripts personnalisés** → Évaluer au cas par cas

---

## 6. Git et partage

### 6.1 Sécurité du dépôt
Le `.gitignore` exclut les fichiers sensibles :
```gitignore
.*-key          # Clés API
.env            # Variables d'environnement
provider_*.json # Fichiers d'état
free-models.json
myfree-eurinhash-report.json
logs/           # Journaux
__pycache__/    # Cache Python
```

### 6.2 Vérification avant commit
```bash
# Vérifier qu'aucune clé n'est dans le commit
git diff --cached | grep -i "key\|secret\|token\|password"

# Vérifier l'historique
git log --all -p | grep -i "sk-\|Bearer\|password="
```

### 6.3 Push sécurisé
```bash
# Vérifier avant push
git status
git diff --cached

# Pousser
git push origin master
```

### 6.4 Accès au dépôt
Le dépôt est public sur GitHub :
🔗 https://github.com/digitaleflex/opencode-config

**Note** : Le README est public, mais les clés API ne le sont jamais (exclues par .gitignore).

---

## 7. Bonnes pratiques

### 7.1 Clés API
- **Ne jamais partager** les clés en clair
- **Rotation** : Changer les clés tous les 90 jours
- **Monitoring** : Surveiller l'utilisation des clés
- **Backup** : Stocker les clés dans un gestionnaire de mots de passe

### 7.2 Permissions
- **Principe du moindre privilège** : Auto-allow uniquement pour les commandes sûres
- **Ask pour les dangereuses** : rm, dd, mkfs, sudo
- **Deny par défaut** : Si doute, bloquer

### 7.3 Audit
- **Consulter régulièrement** les logs d'audit
- **Vérifier les patterns** bloqués
- **Documenter les exceptions** : Toute exception doit être justifiée

### 7.4 Déploiement
- **Tester d'abord** : Ne jamais déployer sans tester
- **Rollback plan** : Toujours avoir un plan de retour
- **Monitoring** : Surveiller après déploiement
- **Backup** : Sauvegarder avant modification

### 7.5 Incident response
1. **Identifier** : Voir les logs d'audit
2. **Isoler** : Bloquer les accès compromis
3. **Corriger** : Supprimer la vulnérabilité
4. **Notifier** : Informer les parties prenantes
5. **Prévenir** : Améliorer les mesures de sécurité

---

## 8. Incident response

### 8.1 Clé API compromise
```bash
# 1. Renouveler immédiatement la clé chez le provider
# 2. Mettre à jour le fichier local
echo "NOUVELLE_CLE" > ~/.config/opencode/.groq-key

# 3. Révoquer l'ancienne clé chez le provider
# 4. Vérifier les logs d'audit
/audit-log --filter groq --date 2026-09-06
```

### 8.2 Accès non autorisé suspecté
```bash
# 1. Consulter les logs d'audit
/audit-log --filter blocked

# 2. Vérifier les permissions
cat ~/.config/opencode/opencode.jsonc | grep permission

# 3. Si compromis : révoquer toutes les clés API et les renouveler
```

### 8.3 Fuite de données
```bash
# 1. Identifier la source dans les logs
/audit-log --filter "error\|blocked"

# 2. Isoler l'agent ou le provider compromis

# 3. Notifier les parties prenantes

# 4. Corriger et déployer un fix
```

### 8.4 Procédure de rollback
```bash
# 1. Restaurer la configuration précédente
git checkout HEAD~1 -- opencode.jsonc

# 2. Réinitialiser l'état
/host-direct --reset-quota
/host-direct --reset-circuit

# 3. Vérifier que tout fonctionne
/opencode /run "test"
```

### 8.5 Checklist d'incident
- [ ] Identifier l'incident
- [ ] Isoler les systèmes affectés
- [ ] Notifier les parties prenantes
- [ ] Corriger la vulnérabilité
- [ ] Vérifier les logs d'audit
- [ ] Déployer le fix
- [ ] Tester la résolution
- [ ] Documenter l'incident

---

## 9. Compliance

### 9.1 RGPD
- **Données personnelles** : Pas de stockage de PII dans les logs
- **Droit à l'oubli** : Possibilité de supprimer les logs utilisateur
- **Conservation** : Logs conservés 30 jours (configurable)
- **Traçabilité** : Tous les événements sont tracés

### 9.2 SOC 2
- **Accès** : Journalisation de tous les accès
- **Chiffrement** : Clés API chiffrées dans les fichiers
- **Monitoring** : Surveillance continue
- **Alertes** : Détection des ops sensibles

### 9.3 ISO 27001
- **Gestion des risques** : Circuit breaker, quota tracking
- **Contrôles d'accès** : Permissions bash, guard.ts
- **Audit** : Journalisation complète
- **Amélioration continue** : Reviews régulières

---

*Documentation sécurité générée le $(date)*
*Pour toute question de sécurité, contacter l'équipe EURINHASH*