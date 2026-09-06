# Troubleshooting Guide — opencode-config EURINHASH

## Table of Contents
1. [Common Issues](#common-issues)
2. [Provider Errors](#provider-errors)
3. [Windows Issues](#windows-issues)
4. [Configuration Issues](#configuration-issues)
5. [Advanced Troubleshooting](#advanced-troubleshooting)
6. [Emergency Recovery](#emergency-recovery)

---

## 1. Common Issues

### 1.1 "Creating a session failed"

**Cause**: The legacy `opencode.json` had `"permission": {"task": "deny"}` which blocked session creation.

**Solution**:
```bash
# Check if the old file exists
ls -la ~/.config/opencode/opencode.json*

# If opencode.json exists with permission.task: "deny", rename it
mv ~/.config/opencode/opencode.json ~/.config/opencode/opencode.json.bak

# Use the new configuration
opencode /run "test"
```

### 1.2 `opencode run` Hang (Windows SDK bug)

**Cause**: The OpenCode SDK under Windows cannot call providers despite valid keys.

**Solution**:
```bash
# Use the wrapper instead
/run "my prompt"

# Or directly
/hash-direct "my prompt"

# Or via the command
/opencode /run "my prompt"

# Permanent measure: The `hash-direct-wrapper.py` wrapper is now the recommended method under Windows.
```

### 1.3 Quota Exhausted

**Cause**: Too many calls to a provider in a short time.

**Solution**:
```bash
# View current state
/quota status

# Reset (if it's a counting error)
/quota reset

# See which providers are available
/host-direct --list-providers

# Wait and retry later (the circuit breaker will help)
```

### 1.4 429 Error (Too Many Requests)

**Cause**: Provider's request limit exceeded.

**Solution**:
```bash
# Check the circuit breaker
/host-direct --status

# Wait for the timeout (60s default)
# The circuit breaker will go to OPEN for 60s, then HALF_OPEN

# Use another provider while waiting
/host-direct --provider mistral "my prompt"

# See which providers still have quota
/quota status --detail
```

---

## 2. Provider Errors

### 2.1 Zhipu Returns 429

**Cause**: The Zhipu key is invalid or quota is exhausted.

**Solution**:
```bash
# Zhipu is often in error in the current fallback
# This is normal, the circuit breaker will automatically block it

# To force Zhipu (not recommended)
/host-direct --provider zhipu "test"

# To ignore Zhipu and use other providers
/host-direct "test"  # Uses automatic fallback

# To test Zhipu specifically
python scripts/myfree-eurinhash.py
```

### 2.2 Google rate_limited

**Cause**: The free Google tier has a limit of 20 requests/minute.

**Solution**:
```bash
# Let the circuit breaker handle the timeout
/host-direct --status

# Wait 1 minute before retrying
# Use another provider in the meantime

# The system will automatically try other providers
/host-direct "test"
```

### 2.3 No Provider Responds

**Cause**: All providers are either KO or in circuit OPEN state.

**Solution**:
```bash
# View complete state
/host-direct --status

# Reset circuit breakers
/host-direct --reset-circuit

# Reset quotas
/quota reset

# If still nothing, check API keys
cat ~/.config/opencode/.groq-key
# The key must be on a single line, without spaces
```

---

## 3. Windows Issues

### 3.1 cp1252 Encoding Issue (Emojis in scripts)

**Symptoms**: Emojis ✅ ❌ ⚠️ display incorrectly in the terminal.

**Solution**: All Python scripts force UTF-8:
```python
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
```

Emojis are replaced with markers:
- ✅ → `[OK]`
- ❌ → `[NO]`
- ⚠️ → `[ERR]`
- 🔄 → `[R]`

This is already applied in:
- `scripts/hash-direct.py`
- `scripts/view-audit-log.py`
- `scripts/myfree-eurinhash.py`

### 3.2 `opencode run` Hang

**See section 1.2** above.

### 3.3 Permission denied on certain commands

**Cause**: The `guard.ts` plugin blocks sensitive commands.

**Solution**:
```bash
# See why it was blocked in the logs
/audit-log --filter "blocked"

# If it's legitimate, modify guard.ts
# Or run the command without the plugin
opencode run "my command"
```

### 3.4 Path Issues under Windows

**Solution**: Use absolute paths or verify permissions.
```bash
# Check scripts are executable
ls -la scripts/

# Use python to run
python scripts/hash-direct.py "test"
```

---

## 4. Configuration Issues

### 4.1 Invalid opencode.jsonc File

**Symptoms**: OpenCode fails to start, JSON parse errors.

**Solution**:
```bash
# Verify JSONC syntax
# Use an online JSON validator or
python -c "import json; json.load(open('opencode.jsonc'))"

# If invalid, restore the backup
mv opencode.json.bak opencode.jsonc

# Or recreate from agent/ files
```

### 4.2 Plugins Not Loading

**Symptoms**: Startup errors, skills unavailable.

**Solution**:
```bash
# Check the configuration
cat ~/.config/opencode/opencode.jsonc | grep plugins

# Ensure paths are correct
# For local plugins: "./plugin/nom-du-plugin.ts"
# For npm: "@nom/du-plugin"

# Verify files exist
ls ~/.config/opencode/plugin/
ls ~/.config/opencode/node_modules/
```

### 4.3 API Keys Not Recognized

**Symptoms**: `/hash-direct --list-providers` shows `[NO]`.

**Solution**:
```bash
# Verify key files exist
ls ~/.config/opencode/*.key

# Check the content
cat ~/.config/opencode/.groq-key

# Recreate the key if needed (from your password manager)
```

### 4.4 Full Memory or Corrupted State

**Solution**:
```bash
# Reset all state
/host-direct --reset-quota
/host-direct --reset-circuit

# Delete cache files
rm ~/.config/opencode/free-models.json
rm ~/.config/opencode/myfree-eurinhash-report.json

# Restart OpenCode
opencode /run "test"
```

---

## 5. Advanced Troubleshooting

### 5.1 Circuit Breaker Debugging

```bash
# View detailed state
/host-direct --status

# View the circuit file
cat ~/.config/opencode/provider_circuit.json

# Force circuit to CLOSED
# Manually edit the file or
/host-direct --reset-circuit
```

### 5.2 Debugging the Quota

```bash
# View the quota file
cat ~/.config/opencode/provider_usage.json

# Count today's calls
# Each call increments the counter

# Reset if necessary
/quota reset
# Then retry
```

### 5.3 Debugging the Fallback

```bash
# View the fallback order
# Code: groq → mistral → zhipu → openrouter → novita → together
# Chat: groq → zhipu → mistral → openrouter → novita → together

# Manually test each provider
/host-direct --provider groq "test"
/host-direct --provider mistral "test"
/host-direct --provider zhipu "test"
```

### 5.4 Customize Thresholds

```bash
# Modify thresholds in hash-direct.py
FAILURE_THRESHOLD = 3    # Default: 3 failures to OPEN the circuit
CIRCUIT_TIMEOUT = 60     # Default: 60 seconds in OPEN

# Modify quotas
QUOTA_LIMITS = {
    "groq": 50, "mistral": 30, "google": 20, ...
}
```

### 5.5 Network Issues

```bash
# Check connectivity
ping api.groq.com
ping api.mistral.ai

# Check proxies
# Ensure API keys are correct

# Test directly with curl
curl -H "Authorization: Bearer $(cat .groq-key)" \
  https://api.groq.com/openai/v1/models
```

---

## 6. Emergency Recovery

### Scenario: Everything is Broken

```bash
# 1. Restore the saved configuration
mv ~/.config/opencode/opencode.json.bak ~/.config/opencode/opencode.jsonc

# 2. Delete problematic state files
rm ~/.config/opencode/provider_circuit.json
rm ~/.config/opencode/provider_usage.json
rm ~/.config/opencode/free-models.json

# 3. Reset quotas
# (Counters will be recomputed at the next call)
/host-direct --reset-quota

# 4. Verify API keys exist
ls ~/.config/opencode/*.key
# Ensure they exist and are valid

# 5. Test the system
opencode /run "test"

# 6. If it works, reintroduce state files gradually
```

### Scenario: API Keys Lost

```bash
# 1. Keys are in .gitignore, so not in the repo
# 2. You must recreate them manually

# 2. Contact the support of each provider
# - Groq : console.groq.com
# - Mistral : console.mistral.ai
# - Google : aistudio.google.com
# - Zhipu : bigmodel.cn
# - OpenRouter : openrouter.ai
# - HuggingFace : huggingface.co/settings/api
# - Novita : novita.ai
# - Together : api.together.xyz

# 3. Recreate the files
echo "your-key" > ~/.config/opencode/.groq-key
```

---

*Troubleshooting guide generated $(date)*
*For persistent issues, open a GitHub issue: https://github.com/digitaleflex/opencode-config*