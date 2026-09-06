# Security Documentation — EURINHASH

## Table of Contents
1. [API Key Security](#1-api-key-security)
2. [Sensitive Ops Detection](#2-sensitive-ops-detection)
3. [Audit & Traceability](#3-audit--traceability)
4. [Secret Redaction](#4-secret-redaction)
5. [Permissions](#5-permissions)
6. [Git & Sharing](#6-git--sharing)
7. [Best Practices](#7-best-practices)
8. [Incident Response](#8-incident-response)

---

## 1. API Key Security

### 1.1 Storage
API keys stored in individual files in `~/.config/opencode/`:
```
.groq-key       → Groq key
.mistral-key    → Mistral key
.gemini-key     → Google Gemini key
.zhipu-key      → Zhipu key
.openrouter-key → OpenRouter key
.hf-key         → HuggingFace key
.novita-key     → Novita key
.together-key   → Together key
.deepseek-key   → DeepSeek key (optional)
.mammouth-key   → Mammouth key (paid fallback)
```

### 1.2 Protection
- **Never in clear code**: Each key in a separate file
- **Never committed**: `.gitignore` excludes all `.*-key` and `.env`
- **Restrictive permissions**: `chmod 600 ~/.config/opencode/.*-key`
- **Rotation**: Renew if exposure suspected

### 1.3 Verification
```bash
# Check keys not in git
git log --all --full-history -- "*.key" ".env"

# Check .gitignore
cat ~/.config/opencode/.gitignore

# Check permissions
ls -la ~/.config/opencode/.groq-key
```

### 1.4 Renewal
```bash
# If key is compromised:
echo "NEW_KEY" > ~/.config/opencode/.groq-key
# Then test:
/host-direct --provider groq "test"
```

---

## 2. Sensitive Ops Detection

### 2.1 Blocked Patterns
`guard.ts` plugin blocks destructive commands:

| Pattern | Description | Action |
|---------|-------------|--------|
| `rm -rf` | Recursive deletion | Block |
| `dd if=` | Raw disk write | Block |
| `mkfs` | Filesystem format | Block |
| `:>$` | Destructive redirect | Block |
| `>/etc/` | Write to /etc | Block |
| `chmod 777` | Wide permissions | Block |
| `sudo rm` | Delete with sudo | Block |
| `shutdown` | System shutdown | Block |
| `reboot` | Reboot | Block |

### 2.2 How It Works
```typescript
// In plugin/guard.ts
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

// Before each tool execution:
for (const pattern of SENSITIVE_PATTERNS) {
  if (pattern.test(command)) {
    throw new Error(`Command blocked: destructive operation detected`);
  }
}
```

### 2.3 Logging
Each blocked op is recorded in `logs/audit-YYYY-MM-DD.jsonl`:
```jsonl
{"timestamp":"2026-09-06T12:00:00Z","tool":"bash","command":"rm -rf /tmp/test","status":"blocked","reason":"ops_sensitive"}
```

---

## 3. Audit & Traceability

### 3.1 Audit Log
`audit-logger.ts` plugin records all events in `logs/audit-YYYY-MM-DD.jsonl`.

### 3.2 Traced Events
- **tool.execute.before**: Before each tool
- **tool.execute.after**: After each tool
- **agent.invoked**: When an agent is invoked

### 3.3 Entry Structure
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
# View today's logs
/audit-log

# View only errors
/audit-log --filter error

# View blocked ops
/audit-log --filter blocked

# Statistics
python scripts/view-audit-log.py --statistics
```

### 3.5 Rotation
- Logs rotated every 30 days
- `.gz` file kept for 90 days
- `.jsonl` file kept for 30 days

---

## 4. Secret Redaction

### 4.1 Detected Secrets
`audit-logger.ts` automatically replaces:
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

### 4.3 Add a New Pattern
```typescript
// In audit-logger.ts
const SECRET_PATTERNS = [
  ...
  /secret_key\s*=\s*\w+/gi,  // Add here
];
```

---

## 5. Permissions

### 5.1 Configuration in opencode.jsonc
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

### 5.2 Explanations

| Category | Examples | Action |
|----------|----------|--------|
| `auto_allow` | ls, cat, grep, python, npm | Execute without confirmation |
| `ask` | rm, dd, mkfs, sudo | Ask for confirmation |
| `deny` | (none by default) | Always blocked |

### 5.3 Security Rules
- **Never auto_allow rm, dd, mkfs** → Always `ask` or `deny`
- **API keys** → Always `ask` for curl/wget
- **System modifications** → Always `ask` for sudo

---

## 6. Git & Sharing

### 6.1 Repository Security
`.gitignore` excludes sensitive files:
```gitignore
.*-key          # API keys
.env            # Environment variables
provider_*.json # State files
free-models.json
myfree-eurinhash-report.json
logs/           # Logs
__pycache__/    # Python cache
```

### 6.2 Pre-commit Verification
```bash
# Check no key in commit
git diff --cached | grep -i "key\|secret\|token\|password"

# Check history
git log --all -p | grep -i "sk-\|Bearer\|password="
```

### 6.3 Secure Push
```bash
# Check before push
git status
git diff --cached

# Push
git push origin master
```

---

## 7. Best Practices

### 7.1 API Keys
- **Never share** keys in clear
- **Rotation**: Change keys every 90 days
- **Monitoring**: Monitor key usage
- **Backup**: Store keys in a password manager

### 7.2 Permissions
- **Least privilege**: Auto-allow only for safe commands
- **Ask for dangerous**: rm, dd, mkfs, sudo
- **Deny by default**: If in doubt, block

### 7.3 Audit
- **Regular review** of audit logs
- **Check blocked patterns**
- **Document exceptions**: Any exception must be justified

### 7.4 Deployment
- **Test first**: Never deploy without testing
- **Rollback plan**: Always have a rollback plan
- **Monitoring**: Monitor after deployment
- **Backup**: Backup before modification

---

## 8. Incident Response

### 8.1 Compromised API Key
```bash
# 1. Immediately renew the key with the provider
# 2. Update local file
echo "NEW_KEY" > ~/.config/opencode/.groq-key

# 3. Revoke old key with the provider
# 4. Check audit logs
/audit-log --filter groq --date 2026-09-06
```

### 8.2 Suspicious Unauthorized Access
```bash
# 1. Check audit logs
/audit-log --filter blocked

# 2. Check permissions
cat ~/.config/opencode/opencode.jsonc | grep permission

# 3. If compromised: revoke all keys and renew
```

### 8.3 Data Leak
```bash
# 1. Identify source in logs
/audit-log --filter "error\|blocked"

# 2. Isolate compromised agent or provider

# 3. Notify stakeholders

# 4. Fix and deploy
```

### 8.4 Rollback Procedure
```bash
# 1. Restore previous config
git checkout HEAD~1 -- opencode.jsonc

# 2. Reset state
/host-direct --reset-quota
/host-direct --reset-circuit

# 3. Verify it works
/opencode /run "test"
```

### 8.5 Incident Checklist
- [ ] Identify the incident
- [ ] Isolate affected systems
- [ ] Notify stakeholders
- [ ] Fix the vulnerability
- [ ] Check audit logs
- [ ] Deploy the fix
- [ ] Test the resolution
- [ ] Document the incident

---

## 9. Compliance

### 9.1 GDPR
- **Personal data**: No PII stored in logs
- **Right to erasure**: Ability to delete user logs
- **Retention**: Logs kept 30 days (configurable)
- **Traceability**: All events traced

### 9.2 SOC 2
- **Access**: Logging of all accesses
- **Encryption**: API keys encrypted in files
- **Monitoring**: Continuous monitoring
- **Alerts**: Sensitive op detection

### 9.3 ISO 27001
- **Risk management**: Circuit breaker, quota tracking
- **Access controls**: Bash permissions, guard.ts
- **Audit**: Complete logging
- **Continuous improvement**: Regular reviews

---

*Security documentation generated $(date)*