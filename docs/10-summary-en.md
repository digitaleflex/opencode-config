# Summary — EURINHASH OpenCode Configuration

## Overview

This repository provides a **production-grade configuration** for OpenCode, an AI coding agent. It is designed to be:

- **100% free**: All providers are free models by default
- **Robust**: Circuit breaker, quota tracking, automatic fallback
- **Secure**: Secret redaction, sensitive ops detection
- **Shareable**: Versioned configuration, comprehensive documentation
- **Extensible**: Modular architecture, specialized agents

## Three Advanced Recommendations

We applied three advanced recommendations to strengthen the system:

### 1. Circuit Breaker (Protection against failing providers)

**Problem**: When a provider returns errors (429, timeout), the system keeps trying and wastes calls.

**Solution**: Implemented a circuit breaker that:
- Detects repeated failures (>3)
- Opens the circuit for 60 seconds
- Allows a test request after timeout (HALF_OPEN)
- Automatically closes on success

**Implementation**: `scripts/hash-direct.py` with `provider_circuit.json` state file.

**Impact**: Prevents cascading failures, saves quota, improves reliability.

---

### 2. Quota Tracking (Avoiding usage limits)

**Problem**: No visibility into daily usage per provider/model, risking unexpected exhaustion.

**Solution**: Local tracking of calls per provider/model per day.

**Implementation**: `scripts/hash-direct.py` with `provider_usage.json`. Each call increments a counter. Providers have defined limits (groq: 50, mistral: 30, etc.).

**Impact**: Prevents quota exhaustion, enables informed decisions, provides usage statistics.

---

### 3. Wrapper Script Alias (`/run` command)

**Problem**: `opencode run` hangs on Windows due to SDK bug, blocking all automation.

**Solution**: Created `hash-direct-wrapper.py` and `/run` command that bypasses the bug by calling providers directly.

**Implementation**: `scripts/hash-direct-wrapper.py` + `command/run.md`.

**Impact**: Restores automation capability on Windows, provides `/run`, `/hash-direct`, `/audit-log` commands.

---

## System Architecture

```
opencode
├── agent/              # 9 specialized agents + 4 workers
├── command/            # 8 slash commands
├── plugin/             # audit-logger.ts, guard.ts, context-summarizer.ts
├── scripts/            # hash-direct.py, hash-direct-wrapper.py, etc.
├── skills/             # hash-agent-matrix, hash-token-efficiency, etc.
├── docs/               # 10 English documentation files
├── logs/               # Audit logs (JSONL)
└── config/             # opencode.jsonc, provider keys, state files
```

### Agents (9)

| Agent | Model | Provider |
|-------|-------|----------|
| eurinhash (supervisor) | `groq/qwen/qwen3.8-27b` | Groq |
| planner, architect, design-lead, docwriter | `groq/qwen/qwen3.8-27b` | Groq |
| builder, quality-engineer, tester, security, reviewer, git-engineer | `mistral/codestral-latest` | Mistral |
| worker-* | Various | Free/Paid fallback |

### Commands (8)

- `/run` - Wrapper for opencode run (bypasses Windows bug)
- `/hash-direct` - Direct provider access with fallback
- `/audit-log` - View JSONL audit log
- `/commit` - Git commit with conventional message
- `/review` - Code review by reviewer agent
- `/quota` - View and manage quotas
- `/myfree-eurinhash` - Test all free models
- `/hash-direct --status/list/reset` - System management

### Scripts (7)

- `hash-direct.py` - Main wrapper with circuit breaker + quota tracking
- `hash-direct-wrapper.py` - Alias for opencode run
- `free-probe.py` - Test model availability
- `quota.py` - Manual quota management
- `myfree-eurinhash.py` - Complete model test
- `view-audit-log.py` - Display audit log

### Plugins (3)

- `audit-logger.ts` - JSONL logging with sensitive ops detection
- `guard.ts` - Blocks destructive commands
- `context-summarizer.ts` - Summarizes long conversations

### Skills (5)

- `hash-agent-matrix` - L1-L4 task routing
- `hash-token-efficiency` - Optimize token usage
- `hash-code-navigation` - Efficient codebase search
- `hash-verification` - Proportional verification levels
- `hash-enterprise-development` - Enterprise compliance

---

## Security Measures

- **API keys**: Stored separately, excluded from git, permissions 600
- **Guard plugin**: Blocks dangerous commands (rm -rf, dd, mkfs, etc.)
- **Audit logger**: Redacts secrets, logs all tool calls
- **Circuit breaker**: Prevents failed provider cascading
- **Quota tracking**: Avoids exhaustion
- **Permissions**: Auto-allow safe commands, ask for dangerous, deny destructive

---

## Provider Fallback Chain

```
Code tasks: groq → mistral → zhipu → openrouter → novita → together
Chat tasks:  groq → zhipu → mistral → openrouter → novita → together
```

- Zhipu often returns 429; circuit breaker blocks it automatically
- Google is rate_limited (20 req/min); circuit breaker handles timeout
- All models are free; Mammouth available as paid fallback only with explicit approval

---

## Documentation Structure

All documentation is available in English and French:

| File | Description |
|------|-------------|
| README.md | Overview and quick start (English) |
| docs/README.md | Table of contents (French) |
| docs/01-architecture-en.md | Technical architecture |
| docs/02-configuration-en.md | Configuration guide |
| docs/03-agents-en.md | Agent documentation |
| docs/04-scripts-en.md | Scripts reference |
| docs/05-plugins-en.md | Plugins reference |
| docs/06-commands-en.md | Slash commands |
| docs/07-skills-en.md | Skills documentation |
| docs/08-troubleshooting-en.md | Troubleshooting guide |
| docs/09-security-en.md | Security documentation |

---

## Current Status

✅ **Completed**:
- All configuration files
- 9 agents + 4 workers
- 8 slash commands
- 3 plugins
- 7 scripts
- 5 skills
- Circuit breaker + quota tracking
- Windows workaround (/run, /hash-direct)
- Documentation (English + French)
- GitHub repo pushed

⚠️ **Known Issues**:
- Zhipu frequently returns 429 (circuit breaker handles)
- `opencode run` bug on Windows (workaround active)
- Some providers rate_limited (circuit breaker handles)

---

## Getting Started

```bash
# Clone the repo
git clone https://github.com/digitaleflex/opencode-config.git %USERPROFILE%\.config\opencode

# Create API key files
echo "YOUR_GROQ_KEY" > ~/.config/opencode/.groq-key
# ... repeat for other providers

# Test the system
opencode /run "test"
```

---

*Summary generated $(date)*
*By the EURINHASH team*