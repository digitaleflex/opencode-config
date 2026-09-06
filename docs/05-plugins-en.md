# Plugins Documentation — opencode-config EURINHASH

## Table of Contents
1. [audit-logger.ts](#audit-loggerts)
2. [guard.ts](#guardts)
3. [context-summarizer.ts](#context-summarizerts)
4. [Third-party Plugins](#third-party-plugins)
5. [Plugin Configuration](#plugin-configuration)
6. [How to Add a Plugin](#how-to-add-a-plugin)

---

## 1. audit-logger.ts — JSONL Logging

### Description
Complete logging plugin that traces all tool calls and agent interactions in a rotating JSONL file. Detects sensitive operations and redacts secrets.

### Installation
```typescript
// In opencode.jsonc
"plugins": [
  "./plugin/audit-logger.ts"
]
```

### Features

#### 1. JSONL Logging
- Format: `logs/audit-YYYY-MM-DD.jsonl`
- Rotation: 30 days
- Entry structure:
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
The plugin attaches to 3 events:
- `tool.execute.before` — Before each tool execution
- `tool.execute.after` — After each tool execution
- `agent.invoked` — When an agent is invoked

#### 3. Sensitive Ops Detection
```typescript
const SENSITIVE_PATTERNS = [
  /rm\s+-rf/i,           // Recursive deletion
  /dd\s+if=/i,            // dd (disk write)
  /mkfs/i,                // System formatting
  /:>$/m,                // Destructive redirection
  />\s*\/etc/,            // Writing to /etc
  /chmod\s+777/,          // Wide permissions
  /sudo\s+rm/,            // Deletion with sudo
  /shutdown/i,            // System shutdown
  /reboot/i,              // Reboot
];
```

#### 4. Secret Redaction
```typescript
const SECRET_PATTERNS = [
  /sk-\w+/gi,              // OpenAI keys
  /Bearer\s+\w+/gi,        // Authorization headers
  /password\s*=\s*\w+/gi,  // Password in config
  /api_key\s*=\s*\w+/gi,   // API keys
];
```

### Usage
```bash
# View audit logs
opencode /audit-log

# View today's logs
cat logs/audit-2026-09-06.jsonl

# Search for a pattern
grep "blocked" logs/audit-2026-09-06.jsonl

# Statistics
python scripts/view-audit-log.py
```

### Log Structure
```jsonl
// Success
{"ts": "...", "tool": "tool.execute", "model": "...", "status": "success", "duration": 1500}

// Blocked (sensitive op)
{"ts": "...", "tool": "tool.execute", "command": "rm -rf /", "status": "blocked", "redaction": true}

// Provider error
{"ts": "...", "tool": "tool.execute", "status": "error", "error": "429", "provider": "zhipu"}
```

### Rotation and Cleanup
- Automatic rotation every 30 days
- Old file renamed to `.gz`
- Automatic deletion after 90 days

---

## 2. guard.ts — Destructive Protection

### Description
Security plugin that blocks destructive commands before execution. Protection against human error.

### Installation
```typescript
// In opencode.jsonc
"plugins": [
  "./plugin/guard.ts"
]
```

### Blocked Commands

| Command | Pattern | Action |
|---------|---------|--------|
| `rm -rf` | `/rm\s+-rf/` | Block |
| `dd` | `/dd\s+if=/` | Block |
| `mkfs` | `/mkfs/` | Block |
| `> /etc/` | `/>\s*\/etc/` | Block |
| `chmod 777` | `/chmod\s+777/` | Block |
| `sudo rm` | `/sudo\s+rm/` | Block |
| `shutdown` | `/shutdown/i` | Block |
| `reboot` | `/reboot/i` | Block |

### Configuration
```typescript
// Customize in guard.ts
const BLOCKED_COMMANDS = [
  ...SENSITIVE_PATTERNS,
  "my_custom_command",
];
```

### Usage
The plugin works automatically. When a blocked command is detected:
1. Execution is cancelled
2. A warning message is displayed
3. The audit logger records the event

### Example Output
```
⚠️ Command blocked: rm -rf /tmp/test
Reason: Destructive operation detected
User: user@machine
Time: 2026-09-06T12:00:00Z
```

---

## 3. context-summarizer.ts — Context Summarizer

### Description
Plugin that automatically summarizes conversation context when it becomes too long for the context window.

### Installation
```typescript
// In opencode.jsonc
"plugins": [
  "./plugin/context-summarizer.ts"
]
```

### Operation
- Triggers when context exceeds 80% of limit
- Creates a structured summary of previous exchanges
- Preserves important decisions and modified files
- Replaces old context with the summary

### Configuration
```typescript
const CONTEXT_LIMIT = 200000;  // 200K tokens
const SUMMARIZE_AT = 0.8;     // 80% of limit
```

### Output
The summary is automatically injected into the next prompt:
```
[Context Summary]
- Task: Refactor auth module
- Modified files: auth.ts, config.ts
- Decisions: Use OAuth2, no local session
- To complete: Unit tests, documentation
```

---

## 4. Third-party Plugins

### opencode-lazy-skills
- **Source**: `@felipegenef/opencode-lazy-skills`
- **Function**: Lazy loading of skills
- **Advantage**: Reduces startup time, loads only needed skills

### envsitter-guard
- **Source**: npm
- **Function**: Environment variable protection
- **Advantage**: Prevents API key exposure in logs

---

## 5. Plugin Configuration

### opencode.jsonc
```jsonc
{
  "plugins": [
    "@felipegenef/opencode-lazy-skills",
    "envsitter-guard",
    "./plugin/guard.ts",
    "./plugin/audit-logger.ts",
    "./plugin/context-summarizer.ts"
  ]
}
```

### Initialization Order
1. `@felipegenef/opencode-lazy-skills` — Skill loading
2. `envsitter-guard` — Env protection
3. `./plugin/guard.ts` — Destructive protection
4. `./plugin/audit-logger.ts` — Logging
5. `./plugin/context-summarizer.ts` — Context summarization

### Hook Execution Order
```
tool.execute.before → guard.ts → audit-logger.ts (before)
tool.execute.after  → audit-logger.ts (after) → context-summarizer.ts
agent.invoked       → audit-logger.ts (agent)
```

---

## 6. How to Add a Plugin

### Local Plugin (TypeScript)
1. Create the file:
```bash
cat > plugin/my-plugin.ts << 'EOF'
export default function init() {
  return {
    name: "my-plugin",
    hooks: {
      "tool.execute.before": async (ctx) => {
        console.log(`Before: ${ctx.command}`);
      }
    }
  };
}
EOF
```

2. Add to `opencode.jsonc`:
```jsonc
"plugins": [
  ...
  "./plugin/my-plugin.ts"
]
```

### npm Plugin
```bash
npm install @my/plugin
```

```jsonc
"plugins": [
  ...
  "@my/plugin"
]
```

### Remote Plugin
```jsonc
"plugins": [
  ...
  "github:my/repo"
]
```

### Best Practices
- Always test plugin before production
- Verify permissions (read_files, write_files, bash)
- Document hooks used
- Handle errors gracefully
- Don't block main flow

---

*Plugins documentation generated $(date)*