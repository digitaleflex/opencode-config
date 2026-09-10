# EURINHASH — AI Coding Agent Governance

**Don't just build. Prove it.**

EURINHASH is a governance layer for AI coding agents. It automatically selects the right orchestration level, agents, models, and controls based on task complexity and risk — then requires verifiable proof before considering work done.

---

## Vision

> *Your AI agents can code. EURINHASH makes sure they should.*

## Mission

Build the best system to intelligently decide how to use AI coding agents that already exist — without losing control over complexity, cost, security, and quality.

---

## The 4 Pillars

### 1. RIGHT AGENT
EURINHASH decides which agent is needed based on task complexity.

```text
CSS Fix → 1 agent (builder)

Authentication System →
  architect +
  security +
  builder +
  reviewer
```

### 2. RIGHT INTELLIGENCE
EURINHASH matches model power to task difficulty.

```text
Change a blue button to green → qwen/qwen3.8-27b (fast, free)
Authentication system → codestral-latest (powerful, free)
```

### 3. RIGHT CONTROL
EURINHASH evaluates risk and enforces appropriate verification.

```text
CSS change 🟢 → Direct execution
Database migration 🟠 → Review required
Production deployment 🔴 → Human validation mandatory
```

### 4. RIGHT PROOF
EURINHASH demands verifiable evidence before approving work.

```text
Agent: "Done."
EURINHASH: Tests? Review? Security audit?
Agent: ✅ ✅ ✅
EURINHASH: Approved.
```

---

## Key Features

| Feature | Description |
|---------|-------------|
| **9 specialized agents** | planner, architect, design-lead, builder, quality-engineer, tester, security, reviewer, git-engineer |
| **7 free providers** | Groq, Mistral, Zhipu, OpenRouter, HuggingFace, Novita, Together |
| **Circuit breaker** | Automatic provider failover on errors (CLOSED/OPEN/HALF_OPEN) |
| **Quota tracking** | Daily usage counters per provider/model to avoid rate limits |
| **Audit logging** | JSONL logs with secret redaction and sensitive op detection |
| **Slash commands** | `/run`, `/hash-direct`, `/audit-log`, `/commit`, `/review` |
| **Custom skills** | Agent routing (L1-L4), token efficiency, code navigation, verification |
| **Windows bypass** | `hash-direct-wrapper.py` for the `opencode run` bug |

---

## Architecture

```
opencode/
├── agent/              # 21 agents (11 role + 10 workers)
├── command/           # 7 slash commands
├── plugin/            # audit-logger.ts, guard.ts
├── scripts/           # hash-direct.py, free-probe.py, quota.py, etc.
└── skills/            # hash-agent-matrix, hash-code-navigation, etc.
```

### Agent Model Assignment

| Agent | Model | Provider |
|-------|-------|----------|
| eurinhash (supervisor) | `groq/qwen/qwen3.8-27b` | Groq |
| planner, architect, design-lead, docwriter | `groq/qwen/qwen3.8-27b` | Groq |
| builder, quality-engineer, tester, security, reviewer, git-engineer | `mistral/codestral-latest` | Mistral |
| worker-* | Various (fallback) | Free/Pro |

---

## Installation

### Prerequisites
- [OpenCode installed](https://opencode.ai/)
- API keys for free providers

### Steps
```bash
# Clone the repo
git clone https://github.com/digitaleflex/opencode-config.git %USERPROFILE%\.config\opencode

# Create API key files
echo "YOUR_KEY" > .groq-key
echo "YOUR_KEY" > .mistral-key
# ... other keys

# Test
opencode /run "test"
```

---

## Quick Start

```bash
# Run with automatic fallback
/opencode /run "Explain recursion"

# Direct provider access
/opencode /hash-direct --provider mistral "Code review"

# Check system status
/opencode /run --status

# View audit logs
/opencode /audit-log
```

---

## Security

- **API keys excluded** via `.gitignore` (never committed)
- **Secret redaction** in audit logs
- **Sensitive op detection** (rm -rf, dd, mkfs, etc.)
- **Configurable permissions** for bash commands
- **30-day log rotation**

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/01-architecture.md) | Technical architecture, providers, EURINHASH protocol |
| [Configuration](docs/02-configuration.md) | Full configuration guide |
| [Agents](docs/03-agents.md) | All 19 agents documented |
| [Scripts](docs/04-scripts.md) | Python scripts reference |
| [Plugins](docs/05-plugins.md) | TypeScript plugins |
| [Commands](docs/06-commands.md) | Slash commands |
| [Skills](docs/07-skills.md) | Custom skills |
| [Troubleshooting](docs/08-troubleshooting.md) | Common issues and solutions |
| [Security](docs/09-security.md) | Security best practices |

---

## Philosophy

> **"Build less. Prove more."**

AI agents can generate enormous amounts of code. But how do you know it's actually correct?

EURINHASH answers this with:
- Right agent for the task
- Right model for the complexity
- Right control for the risk
- Proof before approval

---

## License

MIT — Adapt to your needs.

---

*EURINHASH — Govern. Build. Prove.*