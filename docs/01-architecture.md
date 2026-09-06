# Architecture Technique — opencode-config EURINHASH

## 1. Vue d'ensemble

EURINHASH est un superviseur intelligent pour OpenCode qui garantit :
- **100% gratuit** : Aucun modèle payant par défaut
- **Jamais à l'arrêt** : Rotation automatique des providers en cas de défaillance
- **Transparent** : Logs détaillés, monitoring intégré
- **Sécurisé** : Redaction des secrets, détection des ops sensibles

---

## 2. Composants principaux

### 2.1 Configuration OpenCode
- **`opencode.jsonc`** : Configuration principale (actuelle)
- **`opencode.json`** : Configuration legacy (backup, `.bak`)
- **`opencode-mem.jsonc`** : Configuration mémoire longue
- **`tui.json`** : Personnalisation de l'interface TUI

### 2.2 Agents spécialisés (19)
- **Superviseur** : `eurinhash` (rotation des providers)
- **Planification** : `planner` (plans avant action)
- **Architecture** : `architect` (décisions architecturales)
- **Design** : `design-lead` (direction UI/UX)
- **Exécution** : `builder` (implémentation)
- **Qualité** : `quality-engineer` (qualité code)
- **Tests** : `tester` (tests automatisés)
- **Sécurité** : `security` (analyse sécurité)
- **Revue** : `reviewer` (revue de code)
- **Git** : `git-engineer` (opérations Git)
- **Docs** : `docwriter` (documentation)
- **Workers** : `worker-groq`, `worker-codestral`, `worker-google`, `worker-zhipu` (fallback ciblé)

### 2.3 Scripts Python (7)
- **`hash-direct.py`** : Wrapper principal avec circuit breaker + quota
- **`hash-direct-wrapper.py`** : Alias pour `opencode run`
- **`free-probe.py`** : Test de disponibilité des modèles gratuits
- **`quota.py`** : Gestion manuelle des quotas
- **`myfree-eurinhash.py`** : Test complet de tous les modèles
- **`view-audit-log.py`** : Affichage du journal d'audit

### 2.4 Plugins TypeScript (3)
- **`audit-logger.ts`** : Journalisation JSONL avec redaction
- **`context-summarizer.ts`** : Résumé de contexte
- **`guard.ts`** : Protection contre les commandes destructives

### 2.5 Slash Commands (8)
- **`/run`** : Wrapper hash-direct
- **`/hash-direct`** : Appel direct aux providers
- **`/audit-log`** : Affichage du journal d'audit
- **`/commit`** : Commit Git
- **`/review`** : Revue de code
- **`/quota`** : Gestion des quotas
- **`/myfree-eurinhash`** : Test des modèles gratuits

### 2.6 Skills personnalisées (5)
- **`hash-agent-matrix`** : Routage L1-L4 par complexité
- **`hash-token-efficiency`** : Optimisation des tokens
- **`hash-code-navigation`** : Navigation efficace dans le codebase
- **`hash-verification`** : Vérification proportionnée au risque
- **`hash-enterprise-development`** : Développement enterprise

---

## 3. Flux de données

```
┌─────────────────────────────────────────────────────────────┐
│                      UTILISATEUR                           │
│                  opencode "prompt"                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   OPENCODE (TUI)                            │
│              agent: eurinhash (défaut)                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
┌──────────────────┐    ┌──────────────────┐
│  opencode run    │    │  hash-direct     │
│  (NATIVE - bug)  │    │  wrapper.py     │
│  (Windows SDK)   │    │  (WORKAROUND)   │
└──────────────────┘    └────────┬─────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │   hash-direct.py       │
                    │  ┌─────────────────┐  │
                    │  │ Circuit Breaker │  │
                    │  │ provider_circuit│  │
                    │  └────────┬────────┘  │
                    │  ┌─────────────────┐  │
                    │  │ Quota Tracking  │  │
                    │  │provider_usage   │  │
                    │  └────────┬────────┘  │
                    │  ┌─────────────────┐  │
                    │  │ Auto-Fallback   │  │
                    │  │ Groq→Mistral→..│  │
                    │  └────────┬────────┘  │
                    └───────────┼───────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
    ┌──────────┐         ┌──────────┐         ┌──────────┐
    │   GROQ   │         │  MISTRAL │         │  ZHIPU   │
    │  (qwen)  │         │(codestral│         │ (glm-4)  │
    └──────────┘         └──────────┘         └──────────┘
```

---

## 4. Modèles par provider

### 4.1 Groq (clé: `.groq-key`)
| Modèle | Type | Taille | Spécialité |
|--------|------|--------|------------|
| `qwen/qwen3.8-27b` | MoE | 8B actifs | Code, reasoning |
| `openai/gpt-oss-120b` | MoE | 120B | Code complexe |
| `openai/gpt-oss-20b` | MoE | 20B | Code léger |
| `qwen/qwen3.6-27b` | MoE | 8B actifs | Code, reasoning |

**Limite quota** : 50 req/jour

### 4.2 Mistral (clé: `.mistral-key`)
| Modèle | Type | Taille | Spécialité |
|--------|------|--------|------------|
| `codestral-latest` | Dense | - | Code, completion |
| `mistral-code-latest` | Dense | - | Code |

**Limite quota** : 30 req/jour

### 4.3 Google (clé: `.gemini-key`)
| Modèle | Type | Contexte | Spécialité |
|--------|------|----------|------------|
| `gemini-2.5-flash` | Flash | 1M | Polyvalent |
| `gemini-3.8-flash` | Flash | 1M | Reasoning |
| `gemini-3.7-flash` | Flash | 1M | Reasoning |
| `gemini-3.6-flash` | Flash | 1M | Reasoning |
| `gemini-3.5-flash` | Flash | 1M | Polyvalent |
| `gemini-flash-latest` | Flash | 1M | Polyvalent |

**Limite quota** : 20 req/jour
**Note** : 20 req/min sur le tier gratuit

### 4.4 Zhipu (clé: `.zhipu-key`)
| Modèle | Type | Contexte | Spécialité |
|--------|------|----------|------------|
| `glm-4.7-flash` | Flash | 128K | Chat |
| `glm-5.3-flash` | Flash | 128K | Chat |

**Limite quota** : 20 req/jour
**Note** : Retourne 429 dans certains cas (clé invalide/quota épuisé)

### 4.5 OpenRouter (clé: `.openrouter-key`)
| Modèle | Type | Spécialité |
|--------|------|------------|
| `openrouter/free` | Free | Polyvalent |

**Limite quota** : 30 req/jour

### 4.6 HuggingFace (clé: `.hf-key`)
| Modèle | Type | Spécialité |
|--------|------|------------|
| `Qwen/Qwen3-Coder-480B-A35B-Instruct:cheapest` | Code | Code |
| `deepseek-ai/DeepSeek-V4-Flash:cheapest` | Chat | Chat |

**Limite quota** : 20 req/jour

### 4.7 Novita (clé: `.novita-key`)
| Modèle | Type | Contexte | Spécialité |
|--------|------|----------|------------|
| `deepseek-ai/DeepSeek-V4-Flash` | Flash | 128K+ | Code, chat |
| `inclusionai/ling-3.0-flash-fin` | Flash | 256K | Chat |
| `inclusionai/ling-3.0-flash-sante` | Flash | 256K | Chat |

**Limite quota** : 30 req/jour
**Note** : Gratuit avec clé API

### 4.8 Together (clé: `.together-key`)
| Modèle | Type | Spécialité |
|--------|------|------------|
| `moonshotai/Kimi-K2.7-Code` | Code | Code |
| `meta-llama/Llama-4-Maverick` | Chat | Chat |

**Limite quota** : 20 req/jour

---

## 5. Protocole EURINHASH (6 étapes)

### Étape 1 : Probe (Vérification)
```
Lire free-models.json (>30min = re-probe via free-probe.py)
Marquer les providers OK/KO
```

### Étape 2 : Pick (Sélection de l'ordre)
```
Code : groq → mistral → zhipu → openrouter → novita → together
Chat : groq → zhipu → mistral → openrouter → novita → together
```

### Étape 3 : Delegate (Délégation)
```
Envoyer la tâche complète + contexte au 1er worker disponible
Inclure instructions EURINHASH
```

### Étape 4 : Rotate (Rotation sur erreur)
```
Si 429/quota/auth/timeout :
  - Marquer provider KO dans circuit breaker
  - Passer au provider suivant
  - Réessayer avec le même prompt
```

### Étape 5 : Stop (Arrêt conditionnel)
```
Si tous les providers KO :
  - Résumer ce qui est fait / ce qui bloque
  - Proposer fallback payant (mammouth)
  - Demander validation explicite
```

### Étape 6 : No Paid (Aucun payé par défaut)
```
Jamais de modèle payant sans accord explicite
EURINHASH Pro = only if user explicitly approves
```

---

## 6. Circuit Breaker

### 6.1 États
| État | Description | Action |
|------|-------------|--------|
| `CLOSED` | Fonctionne normalement | Appels autorisés |
| `OPEN` | Défaillant (3+ échecs) | Appels bloqués 60s |
| `HALF_OPEN` | Test après timeout | 1 requête de test |

### 6.2 Transitions d'état
```
CLOSED ──[3 failures]──► OPEN
  ▲                       │
  │                   [60s timeout]
  │                       │
  └────[success]──── HALF_OPEN ──[failure]──► OPEN
                └────[success]────► CLOSED
```

### 6.3 Fichier d'état
```json
// ~/.config/opencode/provider_circuit.json
{
  "groq": {"state": "CLOSED", "failures": 0, "last_failure": 0},
  "mistral": {"state": "CLOSED", "failures": 0, "last_failure": 0},
  "zhipu": {"state": "OPEN", "failures": 3, "last_failure": 1725563400},
  ...
}
```

### 6.4 Commandes
```bash
# Voir l'état
opencode /run --status

# Réinitialiser
opencode /hash-direct --reset-circuit
```

---

## 7. Quota Tracking

### 7.1 Structure
```json
// ~/.config/opencode/provider_usage.json
{
  "groq:qwen/qwen3.8-27b:2026-09-06": 12,
  "mistral:codestral-latest:2026-09-06": 3,
  "zhipu:glm-4.7-flash:2026-09-06": 0,
  ...
}
```

### 7.2 Limites par provider
| Provider | Limite/jour |
|----------|-------------|
| Groq | 50 |
| Mistral | 30 |
| Google | 20 |
| Zhipu | 20 |
| OpenRouter | 30 |
| HuggingFace | 20 |
| Novita | 30 |
| Together | 20 |

### 7.3 Commandes
```bash
# Voir l'état
opencode /run --status

# Réinitialiser
opencode /hash-direct --reset-quota
```

---

## 8. Fichiers d'état

| Fichier | Emplacement | Usage |
|---------|-------------|-------|
| `free-models.json` | `~/.config/opencode/` | Cache de disponibilité des modèles |
| `provider_usage.json` | `~/.config/opencode/` | Compteurs de quota |
| `provider_circuit.json` | `~/.config/opencode/` | État des circuit breakers |
| `myfree-eurinhash-report.json` | `~/.config/opencode/` | Rapport de test des modèles |
| `logs/audit-YYYY-MM-DD.jsonl` | `~/.config/opencode/logs/` | Journal d'audit détaillé |

---

## 9. Sécurité

### 9.1 Exclusion des fichiers sensibles
```gitignore
# .gitignore
.*-key          # Toutes les clés API
.env            # Variables d'environnement
provider_*.json # Fichiers d'état
free-models.json
myfree-eurinhash-report.json
logs/           # Journaux
__pycache__/    # Cache Python
```

### 9.2 Redaction des secrets
L'audit logger remplace automatiquement :
- `sk-xxxx` → `sk-****`
- `Bearer xxxx` → `Bearer ****`
- Mots de passe dans les URLs

### 9.3 Détection des ops sensibles
Surveillance des commandes :
```typescript
const SENSITIVE_PATTERNS = [
  /rm\s+-rf/i,
  /dd\s+if=/i,
  /mkfs/i,
  /:>$/m,  // Redirection destructive
  />\s*\/etc/,
  /chmod\s+777/,
  /sudo\s+rm/,
  /shutdown/i,
  /reboot/i,
];
```

---

## 10. Points d'extensibilité

### 10.1 Ajouter un nouveau provider
1. Ajouter la clé API : `echo "KEY" > .newprovider-key`
2. Ajouter dans `hash-direct.py` :
   - Endpoint dans `ENDPOINTS`
   - Modèles dans `MODELS`
   - Fonction d'appel
   - Limite dans `QUOTA_LIMITS`
3. Ajouter dans `MODELS` (keys.py)
4. Tester avec `python scripts/hash-direct.py --provider newprovider "test"`

### 10.2 Ajouter un nouvel agent
1. Créer `agent/nouveau-agent.md`
2. Définir le modèle et les instructions
3. Ajouter dans `opencode.jsonc` si nécessaire
4. Mettre à jour `skills/hash-agent-matrix/SKILL.md`

### 10.3 Ajouter une nouvelle skill
1. Créer `skills/nouvelle-skill/SKILL.md`
2. Définir le workflow et les conditions
3. Ajouter dans la liste des skills disponibles

---

## 11. Performance

### 11.1 Latence moyenne
| Étape | Latence |
|-------|---------|
| hash-direct-wrapper → hash-direct | ~0ms |
| Circuit breaker check | ~1ms |
| Quota check | ~1ms |
| API Groq (qwen-32b) | ~500-2000ms |
| API Mistral (codestral) | ~500-2000ms |
| API Zhipu | ~500-1500ms |

### 11.2 Optimisations
- Cache `free-models.json` : Évite les probes réseau
- Circuit breaker : Évite les appels inutiles aux providers défaillants
- Quota tracking : Évite les dépassements de limite
- Fallback rapide : Bascule en ~100ms sur erreur

---

## 12. Monitoring

### 12.1 Commandes de diagnostic
```bash
# État global
opencode /run --status

# Modèles disponibles
opencode /hash-direct --list

# Providers configurés
opencode /hash-direct --list-providers

# Logs d'audit
opencode /audit-log
```

### 12.2 Alertes
| Condition | Action |
|-----------|--------|
| Tous les providers KO | Proposer fallback payant |
| Circuit OPEN | Afficher timeout restant |
| Quota proche limite | Afficher warn dans logs |
| Erreur d'auth | Afficher instruction de renouvellement |

---

*Document généré le $(date)*
*Pour toute question, ouvrir une issue sur GitHub*