# Agent Audit Logging — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured audit logging for all agent invocations, tool calls, and sensitive operations to enable production monitoring and debugging.

**Architecture:** Create an opencode plugin (`plugin/audit-logger.ts`) that hooks into tool.execute.before/after and agent.invoked events, writing JSONL logs to `~/.config/opencode/logs/audit-YYYY-MM-DD.jsonl` with rotation. Update `opencode.json` to load this plugin.

**Tech Stack:** TypeScript plugin, Node.js fs/promises, JSONL format, daily log rotation.

**Spec:** This plan itself.

## Global Constraints

- Logs must be append-only, never overwritten
- Log file rotation daily (keep 30 days)
- Structured JSONL for easy parsing
- No PII in logs (redact API keys, secrets, passwords)
- Plugin must not slow down execution (>5ms overhead)
- Works on Windows (paths, line endings)

---

### Task 1: Create audit logger plugin

**Files:**
- Create: `C:\Users\PC\.config\opencode\plugin\audit-logger.ts`
- Modify: `C:\Users\PC\.config\opencode\opencode.json` (add plugin)

**Interfaces:**
- Consumes: opencode plugin API (`tool.execute.before`, `tool.execute.after`, `agent.invoked`)
- Produces: JSONL log files in `~/.config/opencode/logs/`

- [ ] **Step 1: Write the plugin skeleton**

```typescript
// plugin/audit-logger.ts
import type { Plugin } from "@opencode-ai/plugin"
import { mkdir } from "node:fs/promises"
import { appendFile } from "node:fs/promises"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOG_DIR = `${__dirname}/../logs`
const REDACT_KEYS = ["apiKey", "api_key", "password", "secret", "token", "authorization", "key"]

function redact(obj: any): any {
  if (!obj || typeof obj !== "object") return obj
  if (Array.isArray(obj)) return obj.map(redact)
  const out: any = {}
  for (const [k, v] of Object.entries(obj)) {
    if (REDACT_KEYS.some(rk => k.toLowerCase().includes(rk.toLowerCase()))) {
      out[k] = "***REDACTED***"
    } else {
      out[k] = redact(v)
    }
  }
  return out
}

function logPath(): string {
  const today = new Date().toISOString().split("T")[0]
  return `${LOG_DIR}/audit-${today}.jsonl`
}

async function ensureLogDir() {
  try { await mkdir(LOG_DIR, { recursive: true }) } catch {}
}

function writeLog(entry: any) {
  ensureLogDir().then(() => {
    appendFile(logPath(), JSON.stringify(entry) + "\n").catch(() => {})
  })
}

export default (async () => {
  return {
    "tool.execute.before": async (input: any) => {
      writeLog({
        timestamp: new Date().toISOString(),
        type: "tool.execute.before",
        tool: input?.tool,
        args: redact(input?.args),
        sessionId: input?.sessionId,
        agentId: input?.agentId,
      })
    },
    "tool.execute.after": async (input: any, result: any) => {
      writeLog({
        timestamp: new Date().toISOString(),
        type: "tool.execute.after",
        tool: input?.tool,
        args: redact(input?.args),
        success: result?.error ? false : true,
        error: result?.error?.message,
        sessionId: input?.sessionId,
        agentId: input?.agentId,
      })
    },
    "agent.invoked": async (input: any) => {
      writeLog({
        timestamp: new Date().toISOString(),
        type: "agent.invoked",
        agent: input?.agent,
        model: input?.model,
        task: input?.task?.slice(0, 200),
        sessionId: input?.sessionId,
        parentAgentId: input?.parentAgentId,
      })
    },
  }
}) satisfies Plugin
```

- [ ] **Step 2: Update opencode.json to include the plugin**

```jsonc
// opencode.json (global config)
{
  "plugin": [
    "@felipegenef/opencode-lazy-skills",
    "./plugin/guard.ts",
    "./plugin/audit-logger.ts"
  ],
  "theme": "tokyonight"
}
```

- [ ] **Step 3: Test the plugin loads**

Run: `opencode plugin list`
Expected: audit-logger.ts appears in loaded plugins

- [ ] **Step 4: Test logging works**

Run: `opencode run "echo test"` then check `~/.config/opencode/logs/audit-$(date +%F).jsonl`
Expected: JSONL entries for tool.execute.before/after

- [ ] **Step 5: Commit**

```bash
git add plugin/audit-logger.ts opencode.json
git commit -m "feat(audit): add agent/tool audit logging plugin"
```

---

### Task 2: Add log rotation and retention

**Files:**
- Modify: `C:\Users\PC\.config\opencode\plugin\audit-logger.ts`

**Interfaces:**
- Consumes: existing plugin
- Produces: rotation logic, 30-day retention

- [ ] **Step 1: Add rotation function**

```typescript
import { readdir, unlink, stat } from "node:fs/promises"

async function rotateLogs() {
  try {
    const files = await readdir(LOG_DIR)
    const now = Date.now()
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000
    for (const file of files) {
      if (!file.startsWith("audit-") || !file.endsWith(".jsonl")) continue
      const filepath = `${LOG_DIR}/${file}`
      const stats = await stat(filepath)
      if (now - stats.mtimeMs > THIRTY_DAYS) {
        await unlink(filepath)
      }
    }
  } catch {}
}

// Run rotation once at startup
rotateLogs()
// And daily
setInterval(rotateLogs, 24 * 60 * 60 * 1000)
```

- [ ] **Step 2: Test rotation manually**

Run: create old log file, trigger rotation, verify deletion

- [ ] **Step 3: Commit**

```bash
git add plugin/audit-logger.ts
git commit -m "feat(audit): add 30-day log rotation"
```

---

### Task 3: Add sensitive operation tagging

**Files:**
- Modify: `C:\Users\PC\.config\opencode\plugin\audit-logger.ts`

**Interfaces:**
- Consumes: existing plugin
- Produces: `sensitive: true` flag on logged entries matching patterns

- [ ] **Step 1: Add sensitivity detection**

```typescript
const SENSITIVE_PATTERNS = [
  /DATABASE_URL/,
  /migration/,
  /deploy/,
  /push --force/,
  /npm publish/,
  /DELETE FROM/,
  /DROP TABLE/,
  /ALTER TABLE/,
  /CREATE USER/,
  /GRANT /,
]

function isSensitive(tool: string, args: any): boolean {
  const cmd = JSON.stringify(args)
  return SENSITIVE_PATTERNS.some(p => p.test(cmd))
}
```

- [ ] **Step 2: Include in log entries**

```typescript
// In tool.execute.before:
sensitive: isSensitive(input?.tool, input?.args),
```

- [ ] **Step 3: Test with a sensitive command**

Run: `opencode run "rm -rf test"` (should be flagged sensitive)

- [ ] **Step 4: Commit**

```bash
git add plugin/audit-logger.ts
git commit -m "feat(audit): add sensitive operation tagging"
```

---

### Task 4: Add log viewer command

**Files:**
- Create: `C:\Users\PC\.config\opencode\command\audit-log.md`
- Create: `C:\Users\PC\.config\opencode\scripts\view-audit-log.py`

**Interfaces:**
- Consumes: JSONL log files
- Produces: Human-readable filtered output

- [ ] **Step 1: Create viewer script**

```python
#!/usr/bin/env python3
import json, sys, argparse, glob
from datetime import datetime
from pathlib import Path

LOG_DIR = Path.home() / ".config" / "opencode" / "logs"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", help="YYYY-MM-DD (default: today)")
    parser.add_argument("--tool", help="Filter by tool name")
    parser.add_argument("--agent", help="Filter by agent name")
    parser.add_argument("--sensitive", action="store_true", help="Only sensitive ops")
    parser.add_argument("--limit", type=int, default=50)
    args = parser.parse_args()

    date = args.date or datetime.now().strftime("%Y-%m-%d")
    log_file = LOG_DIR / f"audit-{date}.jsonl"
    if not log_file.exists():
        print(f"No log file for {date}")
        return

    count = 0
    with open(log_file) as f:
        for line in f:
            if count >= args.limit: break
            try:
                entry = json.loads(line)
                if args.tool and entry.get("tool") != args.tool: continue
                if args.agent and entry.get("agent") != args.agent: continue
                if args.sensitive and not entry.get("sensitive"): continue
                print(json.dumps(entry, ensure_ascii=False))
                count += 1
            except: pass

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Create slash command**

```markdown
---
description: View audit logs for agent/tool activity
agent: eurinhash
---

`python ~/.config/opencode/scripts/view-audit-log.py` $ARGS
```

- [ ] **Step 3: Test command**

Run: `/audit-log --sensitive --limit 20`

- [ ] **Step 4: Commit**

```bash
git add command/audit-log.md scripts/view-audit-log.py
git commit -m "feat(audit): add log viewer command"
```

---

## Self-Review Checklist

- [ ] Spec coverage: All 4 tasks map to logging, rotation, sensitivity, viewing
- [ ] Placeholders: None — every step has real code
- [ ] Type consistency: Plugin uses opencode Plugin type, entry shapes consistent

---

**Plan complete.** Two execution options:

1. **Subagent-Driven** (recommended) — I dispatch a fresh subagent per task, review between tasks
2. **Inline Execution** — Execute tasks in this session using executing-plans

**Which approach?**