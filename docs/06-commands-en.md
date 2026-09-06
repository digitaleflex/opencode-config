# Commands Documentation — EURINHASH

## Table of Contents
1. [/run](#run)
2. [/hash-direct](#hash-direct)
3. [/audit-log](#audit-log)
4. [/commit](#commit)
5. [/review](#review)
6. [/quota](#quota)
7. [/myfree-eurinhash](#myfree-eurinhash)
8. [Creating Custom Commands](#creating-custom-commands)

---

## 1. /run — opencode run Wrapper

### Description
Bypasses the Windows SDK bug in `opencode run` by calling hash-direct with automatic fallback.

### Syntax
```
/run "your prompt here"
/run --model "codestral-latest" "your prompt"
/run --provider groq "your prompt"
/run --status
/run --list
/run --list-providers
```

### Options
| Option | Description |
|--------|-------------|
| `--model` | Force specific model |
| `--provider` | Force specific provider |
| `--status` | Show quota and circuit breaker status |
| `--list` | List all available models |
| `--list-providers` | List configured providers |

### Examples
```bash
# Standard usage (recommended)
/run "Explain recursion"

# Force Groq
/run --provider groq "Analyze this code"

# Force a model
/run --model "qwen/qwen3.8-27b" "What does this function do?"

# Check system status
/run --status

# List models
/run --list
```

### Why This Command?
The `opencode run` bug on Windows (SDK) fails silently. This command uses our hash-direct wrapper instead, bypassing the bug.

---

## 2. /hash-direct — Direct Provider Access

### Description
Direct access to AI providers with full control. Automatic fallback, circuit breaker, quota tracking.

### Syntax
```
/hash-direct "your prompt"
/hash-direct --model "qwen/qwen3.8-27b" "your prompt"
/hash-direct --provider mistral "your prompt"
/hash-direct --task-type code "your prompt"
/hash-direct --json "your prompt"
/hash-direct --status
/hash-direct --reset-quota
/hash-direct --reset-circuit
```

### Options
| Option | Description |
|--------|-------------|
| `--model` | Specific model |
| `--provider` | Specific provider |
| `--task-type` | code, chat, auto |
| `--max-tokens` | Max tokens |
| `--temperature` | Temperature |
| `--json` | Raw JSON output |
| `--status` | System status |
| `--reset-quota` | Reset quota counters |
| `--reset-circuit` | Reset circuit breakers |

### Examples
```bash
# Automatic fallback
/hash-direct "Analyze this code"

# Force a provider
/hash-direct --provider groq "Hello"

# Force a model
/hash-direct --model "codestral-latest" "Code review"

# JSON for automation
/hash-direct --json "test"

# System status
/hash-direct --status
```

### Advanced Usage
```bash
# With all options
/hash-direct --provider mistral --task-type code --max-tokens 4096 --temperature 0.1 "Code a sort function"
```

---

## 3. /audit-log — Audit Log

### Description
Displays recent JSONL audit log. Detects sensitive ops, shows model calls, successes/errors.

### Syntax
```
/audit-log
/audit-log --date 2026-09-06
/audit-log --filter tool.execute
/audit-log --json
/audit-log --help
```

### Options
| Option | Description |
|--------|-------------|
| `--date YYYY-MM-DD` | Filter by date |
| `--filter PATTERN` | Filter by pattern (tool, status, model) |
| `--json` | Raw JSON output |
| `--help` | Contextual help |

### Examples
```bash
# View all today's logs
/audit-log

# View only errors
/audit-log --filter error

# View logs for a specific date
/audit-log --date 2026-09-05

# JSON for processing
/audit-log --json

# Quick stats
/audit-log | python scripts/view-audit-log.py --statistics
```

### Log Structure
```jsonl
{"timestamp":"2026-09-06T10:30:00Z","tool":"tool.execute","model":"groq/qwen/qwen3.8-27b","status":"success","duration_ms":1500,"provider":"groq"}
{"timestamp":"2026-09-06T10:30:01Z","tool":"bash","command":"rm -rf /test","status":"blocked","reason":"ops_sensitive","redaction":true}
{"timestamp":"2026-09-06T10:30:02Z","tool":"tool.execute","model":"zhipu/glm-4.7-flash","status":"error","error":"429","provider":"zhipu"}
```

---

## 4. /commit — Git Commit

### Description
Performs a Git commit with Conventional Commits message. Follows commit conventions for clean history.

### Syntax
```
/commit
/commit "custom message"
/commit feat "add auth feature"
/commit fix "fix connection bug"
/commit docs "update README"
```

### Options
| Option | Description |
|--------|-------------|
| Custom message | `/commit "my message"` |
| By type and scope | `/commit feat "description"` |
| By type only | `/commit feat` |

### Commit Convention
```
Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting, style (no functional change)
- refactor: Refactoring
- test: Adding tests
- chore: Maintenance

Scope (optional):
- auth, core, api, ui, docs, build, ci, chore, test

Examples:
/commit feat "add OAuth authentication"
/commit fix "fix memory leak"
/commit docs "update README"
/commit style "reformat code"
/commit refactor "extract util module"
/commit test "add unit tests"
/commit chore "update dependencies"
```

### Usage
```bash
# Automatic commit with generated message
/commit

# Commit with custom message
/commit "Refactor auth module to use OAuth2"
```

### Verification
Before commit, verify:
- No sensitive files included (API keys, secrets)
- Conventional message respected
- Files staged correctly

---

## 5. /review — Code Review

### Description
Launches structured code review by `reviewer` agent. Checks quality, security, best practices.

### Syntax
```
/review
/review "description of code to review"
/review "authenticate function"
/review "module auth.ts"
```

### Options
| Option | Description |
|--------|-------------|
| Description | Description of code to review |
| Focus | Focus on specific aspect |
| Agent | Specific agent (reviewer by default) |

### Usage
```bash
# Automatic code review
/review

# Targeted review
/review "Login function with error handling"

# Review with security focus
/review --security "Token management code"
```

### Output
The reviewer produces a structured report:
- Code quality (score out of 10)
- Issues detected
- Improvement suggestions
- Security (OWASP Top 10)
- Best practices

---

## 6. /quota — Quota Management

### Description
Displays and manages provider quotas. View status, reset, force.

### Syntax
```
/quota
/quota status
/quota reset
/quota set groq 30
/quota add mistral 5
/quota status --detail
```

### Options
| Option | Description |
|--------|-------------|
| `status` | Current quota status |
| `reset` | Reset all counters |
| `set provider N` | Set specific quota |
| `add provider N` | Add to current quota |
| `--detail` | Details per model |

### Examples
```bash
# Current status
/quota

# Detailed status
/quota status --detail

# Reset
/quota reset

# Force a quota
/quota set groq 50

# Add quotas
/quota add mistral 5
```

### Displayed Structure
```text
=== Quota tracking ===
groq/qwen/qwen3.8-27b: 12/50 (12 used out of 50)
mistral/codestral-latest: 3/30
google/gemini-2.5-flash: 0/20
zhipu/glm-4.7-flash: 0/20

=== Circuit breakers ===
groq: CLOSED (failures=0)
mistral: CLOSED (failures=0)
zhipu: OPEN (failures=3, timeout in 32s)
```

---

## 7. /myfree-eurinhash — Free Models Test

### Description
Runs a complete test of all free models and displays results.

### Syntax
```
/myfree-eurinhash
/myfree-eurinhash --quick
/myfree-eurinhash --detail
```

### Options
| Option | Description |
|--------|-------------|
| `--quick` | Quick test (1 model per provider) |
| `--detail` | Detailed test (full responses) |

### Examples
```bash
# Complete test
/myfree-eurinhash

# Quick test (1 model per provider)
/myfree-eurinhash --quick

# Detailed test
/myfree-eurinhash --detail
```

### Output
```text
=== EURINHASH Free Models Test ===
Providers tested: 8
Models tested: 21
OK: 17
Errors: 4

[OK] groq/qwen/qwen3.8-27b - 1.2s
[OK] mistral/codestral-latest - 1.5s
[OK] openrouter/openrouter/free - 2.1s
[OK] google/gemini-2.5-flash - 850ms
[ERR] zhipu/glm-4.7-flash - 429 (Quota exhausted)
[OK] huggingface/Qwen - 3.2s
[OK] novita/DeepSeek-V4-Flash - 1.8s
[OK] together/Kimi-K2.7-Code - 2.3s
```

---

## 8. Creating Custom Commands

### Command Structure
```markdown
---
description: Short command description
agent: eurinhash
---

Command to execute with $ARG

Examples:
- /my-command arg1
- /my-command "full prompt"
```

### Create a Command
```bash
# 1. Create the file
cat > command/my-command.md << 'EOF'
---
description: My custom command
agent: builder
---

python scripts/my-script.py $ARG

## Examples
- /my-command argument1
- /my-command "full prompt"
EOF

# 2. The command is automatically available via /my-command
```

### Add in TUI
Commands are automatically detected by OpenCode via the `command/` directory. Just create the `.md` file with the right structure.

---

*Documentation commands generated $(date)*