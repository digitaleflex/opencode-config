# Scripts Documentation — EURINHASH

## Table of Contents
1. [hash-direct.py](#hash-directpy)
2. [hash-direct-wrapper.py](#hash-direct-wrapperpy)
3. [free-probe.py](#free-probepy)
4. [quota.py](#quotapy)
5. [myfree-eurinhash.py](#myfree-eurinhashpy)
6. [view-audit-log.py](#view-audit-logpy)
7. [State Files](#state-files)
8. [Windows Fixes](#windows-fixes)

---

## 1. hash-direct.py — Main Wrapper

### Description
Central script that bypasses the `opencode run` bug on Windows. Calls providers directly via their APIs with automatic fallback, circuit breaker, and quota tracking.

### Installation
```bash
# The script is already in the repo
ls scripts/hash-direct.py
```

### CLI Reference

```
Usage: python hash-direct.py [prompt] [options]

Options:
  --model, -m MODEL       Specific model
  --provider, -p PROVIDER Specific provider (groq, mistral, zhipu, etc.)
  --task-type TYPE        Type: code, chat, auto (default: auto)
  --max-tokens N          Max tokens (default: 2048)
  --temperature F         Temperature (default: 0.2)
  --json                  Output raw JSON
  --list                  List available models
  --list-providers        List providers with keys
  --status                Show quota and circuit breaker status
  --reset-quota           Reset counters
  --reset-circuit         Reset circuit breakers
```

### Usage Examples

```bash
# Automatic fallback
python scripts/hash-direct.py "Explain Ohm's law"

# Force specific provider
python scripts/hash-direct.py --provider groq "Analyze this code"

# Force specific model
python scripts/hash-direct.py --model "codestral-latest" "What does this function do?"

# JSON output for automation
python scripts/hash-direct.py --json "test"

# List available models
python scripts/hash-direct.py --list

# List configured providers
python scripts/hash-direct.py --list-providers

# Show system status
python scripts/hash-direct.py --status

# Reset quotas
python scripts/hash-direct.py --reset-quota

# Reset circuit breakers
python scripts/hash-direct.py --reset-circuit
```

### Code Structure

```python
# ============================================================================
# GLOBAL PARAMETERS & PATHS
# ============================================================================
CONFIG_DIR = Path.home() / ".config" / "opencode"
USAGE_FILE = CONFIG_DIR / "provider_usage.json"
CIRCUIT_FILE = CONFIG_DIR / "provider_circuit.json"

# ============================================================================
# CIRCUIT BREAKER
# ============================================================================
def check_circuit(provider: str) -> bool    # Checks if provider is accessible
def record_success(provider: str) -> None    # Records a success
def record_failure(provider: str) -> None    # Records a failure

# ============================================================================
# QUOTA TRACKING
# ============================================================================
def check_quota(provider: str, model: str) -> bool   # Checks quota
def record_usage(provider: str, model: str) -> None   # Records usage

# ============================================================================
# PROVIDER CALLS
# ============================================================================
def call_provider(provider, model, messages) -> Dict   # Single API call
def auto_fallback_chat(messages) -> Dict               # Automatic fallback
def detect_provider(model: str) -> Optional[str]       # Detect provider by model

# ============================================================================
# MAIN
# ============================================================================
def main() -> None    # CLI entry point
```

### Circuit Breaker Details

| State | Conditions | Action |
|-------|------------|--------|
| CLOSED | Failures < 3 | Calls allowed |
| OPEN | Failures ≥ 3, timeout < 60s | Calls blocked |
| HALF_OPEN | Timeout ≥ 60s | 1 test request |

File: `~/.config/opencode/provider_circuit.json`
```json
{
  "groq": {"state": "CLOSED", "failures": 0, "last_failure": 0},
  "zhipu": {"state": "OPEN", "failures": 3, "last_failure": 1725563400}
}
```

### Quota Tracking Details

File: `~/.config/opencode/provider_usage.json`
```json
{
  "groq:qwen/qwen3.8-27b:2026-09-06": 12,
  "mistral:codestral-latest:2026-09-06": 3
}
```

Provider limits:
```python
QUOTA_LIMITS = {
    "groq": 50, "mistral": 30, "google": 20, "zhipu": 20,
    "openrouter": 30, "huggingface": 20, "novita": 30, "together": 20,
}
```

### Fallback Chain

```python
CODE_ORDER = ["groq", "mistral", "zhipu", "openrouter", "novita", "together"]
CHAT_ORDER = ["groq", "zhipu", "mistral", "openrouter", "novita", "together"]
```

### Python Dependencies
```bash
pip install requests
```

### Adding New Providers
```python
# 1. Add to ENDPOINTS
ENDPOINTS["newprovider"] = "https://api.newprovider.com/v1/chat"

# 2. Add to MODELS
MODELS["newprovider"] = ["model1", "model2"]

# 3. Add to KEY_FILES
KEY_FILES["newprovider"] = CONFIG_DIR / ".newprovider-key"

# 4. Add to QUOTA_LIMITS
QUOTA_LIMITS["newprovider"] = 30

# 5. Add to chain
CODE_ORDER.append("newprovider")
```

---

## 2. hash-direct-wrapper.py — opencode run Alias

### Description
Transforms `opencode run "prompt"` into a direct hash-direct call. Bypasses the Windows SDK bug.

### Usage
```bash
# Instead of:
opencode run "Explain recursion"

# Use:
python scripts/hash-direct-wrapper.py run "Explain recursion"

# Or via /run command:
opencode /run "Explain recursion"
```

### Structure
```python
def main():
    if len(sys.argv) <= 1:
        subprocess.run(["opencode"])  # Pass to native opencode
        return
    
    if sys.argv[1] in ("run", "r"):
        prompt = " ".join(sys.argv[2:])
        subprocess.run([sys.executable, HASH_DIRECT, prompt])
        return
    
    subprocess.run(["opencode"] + sys.argv[1:])  # Native command
```

### Why This Wrapper?
The `opencode run` bug on Windows (SDK) fails silently. This wrapper provides an alternative path directly to provider APIs, bypassing the bug.

---

## 3. free-probe.py — Availability Test

### Description
Tests all free models and creates the `free-models.json` cache.

### Usage
```bash
python scripts/free-probe.py
```

### Output
Creates `~/.config/opencode/free-models.json` with model status:
```json
{
  "groq/qwen/qwen3.8-27b": "ok",
  "mistral/codestral-latest": "ok",
  "zhipu/glm-4.7-flash": "error",
  ...
}
```

### When to Rerun
- Missing or >30min old file
- API key changes
- Adding new provider

### Typical Results
| Provider | Status |
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

## 4. quota.py — Manual Quota Management

### Description
Manual quota management script. View, reset, and force quotas.

### Usage
```bash
# View current quotas
python scripts/quota.py status

# Reset quotas
python scripts/quota.py reset

# Force specific usage
python scripts/quota.py add groq 5
```

---

## 5. myfree-eurinhash.py — Complete Model Test

### Description
Complete test of all free models. Generates `myfree-eurinhash-report.json`.

### Usage
```bash
python scripts/myfree-eurinhash.py
```

### Output
Creates `~/.config/opencode/myfree-eurinhash-report.json` with detailed results:
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

## 6. view-audit-log.py — Audit Log Display

### Description
Displays the audit log in a readable format. Fixes Windows cp1252 issue.

### Usage
```bash
python scripts/view-audit-log.py
python scripts/view-audit-log.py --date 2026-09-06
python scripts/view-audit-log.py --filter tool.execute
```

### Options
```
--date YYYY-MM-DD   Filter by date
--filter PATTERN     Filter by pattern
--json               Output JSON
```

### Windows cp1252 Fix
The script forces UTF-8 on stdout:
```python
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
```

Emojis are replaced with ASCII markers:
- `[OK]` instead of ✅
- `[NO]` instead of ❌
- `[R]` instead of 🔄
- `[ERR]` instead of ⚠️

---

## 7. State Files

### free-models.json
Model availability cache. Updated by `free-probe.py`.
```json
{
  "groq/qwen/qwen3.8-27b": "ok",
  "mistral/codestral-latest": "ok",
  "zhipu/glm-4.7-flash": "error",
  ...
}
```

### provider_usage.json
Daily quota counters. Updated automatically by `hash-direct.py`.
```json
{
  "groq:qwen/qwen3.8-27b:2026-09-06": 12,
  "mistral:codestral-latest:2026-09-06": 3,
  "zhipu:glm-4.7-flash:2026-09-06": 0
}
```

### provider_circuit.json
Circuit breaker states. Updated automatically by `hash-direct.py`.
```json
{
  "groq": {"state": "CLOSED", "failures": 0, "last_failure": 0},
  "zhipu": {"state": "OPEN", "failures": 3, "last_failure": 1725563400},
  "mistral": {"state": "CLOSED", "failures": 0, "last_failure": 0}
}
```

### myfree-eurinhash-report.json
Complete model test report. Generated by `myfree-eurinhash.py`.

### logs/audit-YYYY-MM-DD.jsonl
Detailed audit log. Generated by the audit-logger.ts plugin.
```jsonl
{"timestamp": "...", "tool": "bash", "command": "rm -rf /", "status": "blocked", "redaction": true}
{"timestamp": "...", "tool": "tool.execute", "model": "groq/qwen/qwen3.8-27b", "status": "success", "duration_ms": 1500}
```

---

## 8. Windows Fixes

### cp1252 Encoding Issue
Windows uses cp1252 by default for stdout, causing emoji/Unicode issues.

**Solution**: Force UTF-8 in all Python scripts:
```python
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
```

### opencode run Hang
Windows SDK bug causes `opencode run` to fail silently despite valid keys.

**Solution**: Use `hash-direct-wrapper.py` or `/run` or `/hash-direct` instead.

### permission task denied
Legacy `opencode.json` had `"permission": {"task": "deny"}` blocking session creation.

**Solution**: Rename to `.bak` and use `opencode.jsonc`.

---

*Documentation scripts generated $(date)*