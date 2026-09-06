# Documentation des Scripts — opencode-config EURINHASH

## Table des matières
1. [hash-direct.py](#hash-directpy)
2. [hash-direct-wrapper.py](#hash-direct-wrapperpy)
3. [free-probe.py](#free-probepy)
4. [quota.py](#quotapy)
5. [myfree-eurinhash.py](#myfree-eurinhashpy)
6. [view-audit-log.py](#view-audit-logpy)
7. [Fichiers d'état](#fichiers-détat)
8. [Windows fixes](#windows-fixes)

---

## 1. hash-direct.py — Wrapper principal

### Description
Script central qui contourne le bug `opencode run` sous Windows. Appelle directement les providers via leurs APIs avec fallback automatique, circuit breaker et quota tracking.

### Installation
```bash
# Le script est déjà dans le dépôt
ls scripts/hash-direct.py
```

### CLI Reference complète

```
Usage: python hash-direct.py [prompt] [options]

Options:
  --model, -m MODEL       Modèle spécifique
  --provider, -p PROVIDER Provider spécifique (groq, mistral, zhipu, etc.)
  --task-type TYPE        Type: code, chat, auto (défaut: auto)
  --max-tokens N          Max tokens (défaut: 2048)
  --temperature F         Température (défaut: 0.2)
  --json                  Sortie JSON brute
  --list                  Liste les modèles disponibles
  --list-providers        Liste les providers avec clés
  --status                Affiche l'état du quota et circuit breakers
  --reset-quota           Réinitialise les compteurs
  --reset-circuit         Réinitialise les circuit breakers
```

### Exemples d'utilisation

```bash
# Appel automatique avec fallback
python scripts/hash-direct.py "Explique la loi d'Ohm"

# Forcer un provider spécifique
python scripts/hash-direct.py --provider groq "Analyse ce code"

# Forcer un modèle spécifique
python scripts/hash-direct.py --model "codestral-latest" "Que fait cette fonction ?"

# Sortie JSON pour traitement automatique
python scripts/hash-direct.py --json "test"

# Voir les modèles disponibles
python scripts/hash-direct.py --list

# Voir les providers configurés
python scripts/hash-direct.py --list-providers

# État du système
python scripts/hash-direct.py --status

# Réinitialiser les quotas
python scripts/hash-direct.py --reset-quota

# Réinitialiser les circuit breakers
python scripts/hash-direct.py --reset-circuit
```

### Structure du code

```python
# ============================================================================
# PARAMÈTRES GLOBAUX & CHEMINS
# ============================================================================
CONFIG_DIR = Path.home() / ".config" / "opencode"
USAGE_FILE = CONFIG_DIR / "provider_usage.json"
CIRCUIT_FILE = CONFIG_DIR / "provider_circuit.json"

# ============================================================================
# CIRCUIT BREAKER
# ============================================================================
def check_circuit(provider: str) -> bool    # Vérifie si le provider est accessible
def record_success(provider: str) -> None    # Enregistre un succès
def record_failure(provider: str) -> None    # Enregistre un échec

# ============================================================================
# QUOTA TRACKING
# ============================================================================
def check_quota(provider: str, model: str) -> bool   # Vérifie le quota
def record_usage(provider: str, model: str) -> None   # Enregistre l'usage

# ============================================================================
# APPELS PROVIDERS
# ============================================================================
def call_provider(provider, model, messages) -> Dict   # Appel unique API
def auto_fallback_chat(messages) -> Dict               # Fallback automatique
def detect_provider(model: str) -> Optional[str]       # Détection par modèle

# ============================================================================
# MAIN
# ============================================================================
def main() -> None    # Point d'entrée CLI
```

### Circuit breaker en détail

| État | Conditions | Action |
|------|------------|--------|
| CLOSED | Failures < 3 | Appels autorisés |
| OPEN | Failures ≥ 3, timeout < 60s | Appels bloqués |
| HALF_OPEN | Timeout ≥ 60s | 1 requête de test |

Fichier : `~/.config/opencode/provider_circuit.json`
```json
{
  "groq": {"state": "CLOSED", "failures": 0, "last_failure": 0},
  "zhipu": {"state": "OPEN", "failures": 3, "last_failure": 1725563400}
}
```

### Quota tracking en détail

Fichier : `~/.config/opencode/provider_usage.json`
```json
{
  "groq:qwen/qwen3.8-27b:2026-09-06": 12,
  "mistral:codestral-latest:2026-09-06": 3
}
```

Limites par provider :
```python
QUOTA_LIMITS = {
    "groq": 50, "mistral": 30, "google": 20, "zhipu": 20,
    "openrouter": 30, "huggingface": 20, "novita": 30, "together": 20,
}
```

### Fallback chain

```python
CODE_ORDER = ["groq", "mistral", "zhipu", "openrouter", "novita", "together"]
CHAT_ORDER = ["groq", "zhipu", "mistral", "openrouter", "novita", "together"]
```

### Dépendances Python
```bash
pip install requests
```

### Extending with new providers
```python
# 1. Ajouter dans ENDPOINTS
ENDPOINTS["newprovider"] = "https://api.newprovider.com/v1/chat"

# 2. Ajouter dans MODELS
MODELS["newprovider"] = ["model1", "model2"]

# 3. Ajouter dans KEY_FILES
KEY_FILES["newprovider"] = CONFIG_DIR / ".newprovider-key"

# 4. Ajouter dans QUOTA_LIMITS
QUOTA_LIMITS["newprovider"] = 30

# 5. Ajouter dans la chaine
CODE_ORDER.append("newprovider")
```

---

## 2. hash-direct-wrapper.py — Alias opencode run

### Description
Transforme `opencode run "prompt"` en appel direct hash-direct. Contourne le bug Windows SDK.

### Utilisation
```bash
# Au lieu de :
opencode run "Explicate la récursivité"

# Utiliser :
python scripts/hash-direct-wrapper.py run "Explicate la récursivité"

# Ou via la commande /run :
opencode /run "Explicate la récursivité"
```

### Structure
```python
def main():
    if len(sys.argv) <= 1:
        subprocess.run(["opencode"])  # Passe à opencode natif
        return
    
    if sys.argv[1] in ("run", "r"):
        prompt = " ".join(sys.argv[2:])
        subprocess.run([sys.executable, HASH_DIRECT, prompt])
        return
    
    subprocess.run(["opencode"] + sys.argv[1:])  # Commande native
```

### Pourquoi ce wrapper ?
Le bug `opencode run` sous Windows (SDK) échoue silencieusement. Ce wrapper fournit un chemin alternatif directement vers les APIs des providers, contournant le bug.

---

## 3. free-probe.py — Test de disponibilité

### Description
Teste tous les modèles gratuits et crée le cache `free-models.json`.

### Utilisation
```bash
python scripts/free-probe.py
```

### Sortie
Crée `~/.config/opencode/free-models.json` avec le statut de chaque modèle :
```json
{
  "groq/qwen/qwen3.8-27b": "ok",
  "mistral/codestral-latest": "ok",
  "zhipu/glm-4.7-flash": "error",
  ...
}
```

### Quand relancer
- Fichier absent ou >30min
- Changement de clé API
- Ajout de nouveau provider

### Résultats typiques
| Provider | Statut |
|----------|--------|
| Groq | ✅ OK |
| Mistral | ✅ OK |
| Google | ⚠️ rate_limited |
| Zhipu | ❌ 429 (quota) |
| OpenRouter | ✅ OK |
| HuggingFace | ✅ OK |
| Novita | ✅ OK |
| Together | ✅ OK |

---

## 4. quota.py — Gestion manuelle des quotas

### Description
Script de gestion manuelle des quotas. Permet de voir, réinitialiser et forcer les quotas.

### Utilisation
```bash
# Voir les quotas actuels
python scripts/quota.py status

# Réinitialiser
python scripts/quota.py reset

# Forcer un usage spécifique
python scripts/quota.py add groq 5
```

---

## 5. myfree-eurinhash.py — Test complet des modèles

### Description
Test complet de tous les modèles gratuits. Génère un rapport `myfree-eurinhash-report.json`.

### Utilisation
```bash
python scripts/myfree-eurinhash.py
```

### Sortie
Crée `~/.config/opencode/myfree-eurinhash-report.json` avec les résultats détaillés de chaque modèle.

### Structure du rapport
```json
{
  "timestamp": "2026-09-06T12:00:00Z",
  "total_models": 17,
  "working": 12,
  "broken": 5,
  "results": [
    {"model": "groq/qwen/qwen3.8-27b", "status": "ok", "latency": 1500},
    {"model": "zhipu/glm-4.7-flash", "status": "error", "error": "429"}
  ]
}
```

---

## 6. view-audit-log.py — Affichage du journal

### Description
Affiche le journal d'audit au format lisible. Corrige le problème cp1252 de Windows.

### Utilisation
```bash
python scripts/view-audit-log.py
python scripts/view-audit-log.py --date 2026-09-06
python scripts/view-audit-log.py --filter tool.execute
```

### Options
```
--date YYYY-MM-DD   Filtrer par date
--filter PATTERN     Filtrer par pattern
--json               Sortie JSON
```

### Windows cp1252 fix
Le script force UTF-8 sur stdout :
```python
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
```

Les emojis sont remplacés par des marqueurs ASCII :
- `[OK]` au lieu de ✅
- `[NO]` au lieu de ❌
- `[R]` au lieu de 🔄
- `[ERR]` au lieu de ⚠️

---

## 7. Fichiers d'état

### free-models.json
Cache de disponibilité des modèles. Mis à jour par `free-probe.py`.

```json
{
  "groq/qwen/qwen3.8-27b": "ok",
  "mistral/codestral-latest": "ok",
  "zhipu/glm-4.7-flash": "error",
  "google/gemini-2.5-flash": "ok",
  ...
}
```

### provider_usage.json
Compteurs de quota journaliers. Mis à jour automatiquement par `hash-direct.py`.

```json
{
  "groq:qwen/qwen3.8-27b:2026-09-06": 12,
  "mistral:codestral-latest:2026-09-06": 3,
  "zhipu:glm-4.7-flash:2026-09-06": 0
}
```

### provider_circuit.json
État des circuit breakers. Mis à jour automatiquement par `hash-direct.py`.

```json
{
  "groq": {"state": "CLOSED", "failures": 0, "last_failure": 0},
  "zhipu": {"state": "OPEN", "failures": 3, "last_failure": 1725563400},
  "mistral": {"state": "CLOSED", "failures": 0, "last_failure": 0}
}
```

### myfree-eurinhash-report.json
Rapport de test complet des modèles. Génénéré par `myfree-eurinhash.py`.

### logs/audit-YYYY-MM-DD.jsonl
Journal d'audit détaillé. Génénéré par le plugin audit-logger.ts.

```jsonl
{"timestamp": "...", "tool": "bash", "command": "rm -rf /", "status": "blocked", "redaction": true}
{"timestamp": "...", "tool": "tool.execute", "model": "groq/qwen/qwen3.8-27b", "status": "success", "duration_ms": 1500}
```

---

## 8. Windows fixes

### Problème cp1252
Windows utilise par défaut le codage cp1252 pour stdout. Les emojis et caractères Unicode posent problème.

**Solution** : Forcer UTF-8 dans tous les scripts Python :
```python
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
```

### Problème opencode run hang
Le bug Windows SDK fait que `opencode run` ne parvient pas à appeler les providers malgré des clés valides.

**Solution** : Utiliser `hash-direct-wrapper.py` ou `/run` ou `/hash-direct`.

### Problème permission task denied
L'ancien `opencode.json` avait `"permission": {"task": "deny"}` qui bloquait la création de session.

**Solution** : Renommer en `.bak` et utiliser `opencode.jsonc`.

---

*Documentation scripts générée le $(date)*