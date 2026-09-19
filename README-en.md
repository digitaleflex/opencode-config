# EURINHASH — AI Coding Agent Governance

**Don't just build. Prove it.**

EURINHASH is a governance layer for AI coding agents. It automatically selects the right orchestration level, agents, models, and controls based on task complexity and risk — then requires verifiable proof before considering work done.

---

## 📋 Table of Contents

1. [Features](#-features)
2. [Architecture](#-architecture)
3. [Installation](#-installation)
4. [Usage](#-usage)
5. [Security](#-security)
6. [Monitoring](#-monitoring)
7. [Advanced Configuration](#-advanced-configuration)
8. [Troubleshooting](#-troubleshooting)
9. [Documentation](#-documentation)
10. [Contribution](#-contribution)
11. [License](#-license)

---

## ✨ Features

- **Models (free tiers, strict quotas)**: Groq, Google, Zhipu, Novita AI (**FREE**, 256K ctx), SambaNova, Pollinations (keyless), Cerebras (trial), Ollama (local), Cohere (trial) — see `docs/02-configuration-en.md` §3
- **EURINHASH Supervisor**: Automatic provider rotation on quota/error
- **25 agents**: 15 role agents (planner, architect, design-lead, builder, quality-engineer, tester, security, reviewer, git-engineer, docwriter, auditor, integrator, verifier, quota-guard, eurinhash) + 10 free/trial workers
- **Circuit breaker**: Protection against failing providers (CLOSED/OPEN/HALF_OPEN)
- **Local quota tracking**: Daily count per provider/model to prevent overuse
- **hash-direct wrapper**: Bypass of the `opencode run` bug (Windows SDK workaround, optional on macOS/Linux)
- **Audit logger**: JSONL logging of tool calls with sensitive ops detection and redaction
- **Custom commands**: `/run`, `/hash-direct`, `/audit-log`, `/commit`, `/review`, `/quota`, `/mode`, `/myfree-eurinhash`
- **Plugins**: `better-compact`, `opencode-mem`, `envsitter-guard`, `oh-my-opencode-slim`, `opencode-plugin-preload-skills`, guard.ts, audit-logger.ts, auto-compact.ts
- **Skill matrix**: Intelligent routing of tasks by complexity (L1-L4)

---

## 🏗️ Architecture

```
~/.config/opencode/
├── 📄 opencode.jsonc              # Main OpenCode configuration
├── 📄 opencode.json               # Legacy configuration (backup)
├── 📄 opencode-mem.jsonc          # Long-term memory configuration
├── 📄 tui.json                    # TUI configuration
├── 📄 AGENTS.md                   # Default agent instructions
├── 📄 CONFIG-GUIDE.md            # Quick configuration guide
├── 📄 .gitignore                 # Sensitive file exclusions
├── 📁 agent/                     # 25 specialized agents
│   ├── eurinhash.md              # Main supervisor
│   ├── planner.md                # Task planning
│   ├── architect.md              # Technical architecture
│   ├── design-lead.md            # Design direction
│   ├── builder.md                # Code execution
│   ├── quality-engineer.md       # Quality and testing
│   ├── tester.md                 # Automated tests
│   ├── security.md               # Security
│   ├── reviewer.md               # Code review
│   ├── git-engineer.md           # Git management
│   ├── docwriter.md              # Documentation
│   ├── auditor.md                # Audit
│   ├── integrator.md             # Integration
│   ├── verifier.md               # Verification
│   ├── quota-guard.md            # Quota guard
│   └── worker-*.md              # Fallback workers (10)
├── 📁 command/                   # 8 slash commands
│   ├── audit-log.md              # Audit log
│   ├── commit.md                 # Git commit
│   ├── hash-direct.md            # Direct provider access
│   ├── myfree-eurinhash.md       # Free model testing
│   ├── quota.md                  # Quota management
│   ├── review.md                 # Code review
│   └── run.md                    # opencode run wrapper
├── 📁 plugin/                    # 3 TypeScript plugins
│   ├── audit-logger.ts           # JSONL logging
│   ├── guard.ts                  # Destructive protection + secret redaction
│   └── auto-compact.ts           # Intelligent compaction
├── 📁 scripts/                   # 12 scripts (Python, Node, TypeScript)
│   ├── hash-direct.py            # Main wrapper (circuit breaker + quota)
│   ├── hash-direct-wrapper.py    # opencode run alias
│   ├── free-probe.py             # Model availability testing
│   ├── quota.py                  # Quota management
│   ├── myfree-eurinhash.py       # Full model testing
│   ├── view-audit-log.py         # Audit log display
│   ├── route.py                  # EV routing + Bayesian feedback
│   ├── models-free.py            # Free model inventory
│   ├── patch-better-compact.py   # Windows fsync patch
│   ├── session-review.mjs        # Session review
│   ├── cleanup-opencode-db.mjs   # Database cleanup
│   └── verify-golden.ts          # Golden test verification
│   └── windows/                  # PowerShell scripts (Windows-only)
│       ├── compact-docker-vhdx.ps1
│       └── finish-cleanup.ps1
├── 📁 skills/                    # 30+ skills
│   ├── hash-agent-matrix/        # L1-L4 routing
│   ├── hash-code-navigation/     # Efficient codebase search
│   ├── hash-token-efficiency/    # Token optimization
│   ├── hash-verification/        # Proportional verification
│   └── hash-enterprise-development/ # Enterprise development
├── 📁 docs/                      # Technical documentation (FR/EN)
├── 📁 logs/                      # Audit logs (JSONL)
└── 📁 node_modules/              # Installed dependencies
```

### Data Flow

```
User
    │
    ├─ opencode run "prompt" ──► hash-direct-wrapper.py ──► hash-direct.py
    │                                                                    │
    │                                                                    ├─► Circuit breaker (provider_circuit.json)
    │                                                                    ├─► Quota tracking (provider_usage.json)
    │                                                                    └─► API calls (Groq, Google, Zhipu, etc.)
    │
    └─ opencode agent "task" ──► Agent (eurinhash/planner/etc.)
                                    │
                                    ├─► opencode run (if bug) ──► hash-direct.py
                                    └─► opencode native (if working)
```

### Agent Model Assignment

| Agent | Role | Model | Provider |
|-------|------|--------|----------|
| **eurinhash** | Supervisor | `google/gemini-2.5-flash` | Google (FREE) |
| **planner** | Planning | `google/gemini-2.5-flash` | Google (FREE) |
| **architect** | Architecture | `google/gemini-2.5-flash` | Google (FREE) |
| **design-lead** | Design | `google/gemini-2.5-flash` | Google (FREE) |
| **builder** | Execution | `google/gemini-2.5-flash` | Google (FREE) |
| **quality-engineer** | Quality | `google/gemini-2.5-flash` | Google (FREE) |
| **tester** | Testing | `google/gemini-2.5-flash` | Google (FREE) |
| **security** | Security | `google/gemini-2.5-flash` | Google (FREE) |
| **reviewer** | Review | `google/gemini-2.5-flash` | Google (FREE) |
| **git-engineer** | Git | `google/gemini-2.5-flash` | Google (FREE) |
| **docwriter** | Docs | `google/gemini-2.5-flash` | Google (FREE) |
| **auditor** | Audit | `google/gemini-2.5-flash` | Google (FREE) |
| **integrator** | Integration | `google/gemini-2.5-flash` | Google (FREE) |
| **verifier** | Verification | `google/gemini-2.5-flash` | Google (FREE) |
| **quota-guard** | Quota guard | `google/gemini-2.5-flash` | Google (FREE) |
| **worker-opencode** | Worker | `opencode/deepseek-v4-flash-free` | Integrated (0 quota) |
| **worker-opencode-heavy** | Worker | `opencode/glm-5-free` | Integrated (0 quota) |
| **worker-codestral** | Worker | `openrouter/poolside/laguna-s-2.1:free` | OpenRouter (FREE) |
| **worker-groq** | Worker | `groq/qwen/qwen3.8-27b` | Groq (FREE tier) |
| **worker-novita** | Worker | `novita/inclusionai/ling-3.0-flash-sante` | Novita (FREE) |
| **worker-zhipu** | Worker | `zhipu/glm-4.7-flash` | Zhipu (FREE tier) |
| **worker-google** | Worker | `google/gemini-2.5-flash` | Google (FREE tier) |
| **worker-pollinations** | Worker | `pollinations/openai` | Pollinations (keyless) |
| **worker-ollama** | Worker | `ollama/devstral` | Local (offline) |
| **worker-zenmux** | Worker | `zenmux/anthropic/claude-sonnet-5-free` | ZenMux (PAYG) |

---

## 🛠️ Installation

### Prerequisites

- [OpenCode installed](https://opencode.ai/) (v0.10.0+)
- Python 3.8+ (for scripts)
- Node.js 18+ or [Bun](https://bun.sh) (for plugins)
- API keys for free providers (see below)
- `bash` (available natively on macOS/Linux, via WSL/Git Bash on Windows)

### Steps

1. **Clone the repository** to `~/.config/opencode`:
   ```bash
   git clone https://github.com/digitaleflex/opencode-config.git ~/.config/opencode
   ```

2. **Install dependencies**:
   ```bash
   cd ~/.config/opencode
   npm install  # or bun install
   ```

3. **Create API key files** in `~/.config/opencode/`:
   ```bash
   # Required providers (for orchestration)
   echo "YOUR_GROQ_KEY" > ~/.config/opencode/.groq-key
   echo "YOUR_GEMINI_KEY" > ~/.config/opencode/.gemini-key
   echo "YOUR_OPENROUTER_KEY" > ~/.config/opencode/.openrouter-key
   echo "YOUR_NOVITA_KEY" > ~/.config/opencode/.novita-key
   echo "YOUR_ZHIPU_KEY" > ~/.config/opencode/.zhipu-key
   echo "YOUR_HF_KEY" > ~/.config/opencode/.hf-key

   # Optional providers
   echo "YOUR_MISTRAL_KEY" > ~/.config/opencode/.mistral-key
   echo "YOUR_TOGETHER_KEY" > ~/.config/opencode/.together-key
   echo "YOUR_DEEPSEEK_KEY" > ~/.config/opencode/.deepseek-key
   echo "YOUR_ZENMUX_KEY" > ~/.config/opencode/.zenmux-key
   echo "YOUR_MAMMOUTH_KEY" > ~/.config/opencode/.mammouth-key
   ```

4. **Verify the configuration**:
   ```bash
   opencode /run "test"
   ```

### Installation on Different OS

| OS | Shell | Notes |
|----|-------|-------|
| **Windows** | WSL2 / Git Bash / PowerShell | `hash-direct.py` wrapper bypasses SDK bug. PowerShell scripts in `scripts/windows/`. |
| **macOS** | bash / zsh | Everything works natively. `opencode run` works without wrapper. |
| **Linux** | bash | Everything works natively. No workaround needed. |

---

## 🚀 Usage

### Custom Commands

- `/run "your prompt"` → Uses hash-direct wrapper with automatic fallback
- `/hash-direct [options] "prompt"` → Direct provider access with fine-grained control
- `/audit-log` → Displays the audit log (JSONL)
- `/commit` → Intelligent Git commit
- `/review` → Code review
- `/quota` → Quota management
- `/mode` → Switch mode (FREE/PRO)
- `/myfree-eurinhash` → Full free model testing

### hash-direct Options

```bash
--model SPECIFIC    Use a specific model
--provider SPECIFIC Force a provider (groq, mistral, zhipu, etc.)
--task-type TYPE    Task type (code|chat|auto)
--max-tokens N      Max tokens (default: 2048)
--temperature F     Temperature (default: 0.2)
--json              Raw JSON output
--reset-quota       Reset quota counters
--reset-circuit     Reset circuit breakers
--status            Show quota + circuit state
--list              List all available models
--list-providers    List configured providers
```

### EURINHASH Routing

```bash
# Find the best worker for a task type
python ~/.config/opencode/scripts/route.py code

# Find the fallback worker
python ~/.config/opencode/scripts/route.py code --next

# List all workers with status
python ~/.config/opencode/scripts/route.py list

# Record a result (Bayesian feedback)
python ~/.config/opencode/scripts/route.py record worker-groq success
```

---

## 🔒 Security

- **API keys excluded**: All `.*-key`, `.env`, `provider_*.json` are in `.gitignore`
- **Secret redaction**: Audit logger automatically masks tokens, passwords, etc.
- **Sensitive ops detection**: Monitoring of dangerous commands (rm, dd, mkfs, etc.)
- **Log rotation**: Audit files rotated every 30 days
- **No sensitive data versioned**: Only configuration code is public

---

## 📊 Monitoring

### State Files

- `provider_usage.json`: Daily call counter
- `provider_circuit.json`: Circuit breaker state
- `logs/audit-YYYY-MM-DD.jsonl`: Detailed audit log
- `free-models.json`: Real-time worker status
- `route-usage.json`: Success/failure history (Bayesian feedback)

### Useful Commands

```bash
# View system state
opencode /run --status

# Test a specific provider
opencode /hash-direct --provider groq "explain recursion"

# List available models
opencode /hash-direct --list

# Reset quotas (for testing)
opencode /hash-direct --reset-quota

# View audit log
opencode /audit-log

# Test all free models
opencode /myfree-eurinhash
```

---

## ⚙️ Advanced Configuration

### opencode.jsonc

The main configuration defines:
- `default_agent`: "eurinhash"
- `small_model`: "google/gemini-2.5-flash"
- Bash and skills permissions
- Free/trial providers by default, paid entries clearly marked (Mammouth as optional fallback)
- MCP servers (Postgres for memory)

### Custom Skills

- `hash-agent-matrix`: L1-L4 routing by complexity
- `hash-token-efficiency`: Token optimization
- `hash-code-navigation`: Efficient codebase search
- `hash-verification`: Proportional verification
- `hash-enterprise-development`: Enterprise development
- `hash-verification`: Verification before completion

---

## 🆘 Troubleshooting

### Common Issues

1. **"Creating a session failed"** → Check that `opencode.json` (legacy) does not have `permission.task: "deny"` (rename to `.bak`)
2. **Opencode run hangs** → Use `/run` or `/hash-direct` instead (Windows SDK bug workaround — macOS/Linux: `opencode run` works natively)
3. **Quota exhausted** → Circuit breaker automatically switches to the next provider
4. **Provider error 429** → Check `provider_circuit.json` and wait for timeout to end
5. **Missing API key** → Create the corresponding `.xxx-key` file
6. **Plugin not loading** → Check that `node_modules` is installed (`npm install`)

### Logs

- Consult `logs/audit-YYYY-MM-DD.jsonl` to see all tool calls
- Provider errors are logged with context for debugging

---

## 📚 Documentation

Complete documentation is available in `docs/` (in English and French):

| Document | Description |
|----------|-------------|
| [Architecture](docs/01-architecture-en.md) | Technical architecture, providers, EURINHASH protocol |
| [Configuration](docs/02-configuration-en.md) | Full configuration guide |
| [Agents](docs/03-agents-en.md) | All 25 agents documented |
| [Scripts](docs/04-scripts-en.md) | Python scripts reference |
| [Plugins](docs/05-plugins-en.md) | TypeScript plugins |
| [Commands](docs/06-commands-en.md) | Slash commands |
| [Skills](docs/07-skills-en.md) | Custom skills |
| [Troubleshooting](docs/08-troubleshooting-en.md) | Common issues and solutions |
| [Security](docs/09-security-en.md) | Security best practices |
| [Summary](docs/10-summary-en.md) | Project summary |
| [Examples](docs/11-examples-en.md) | Governance examples |

---

## 🤝 Contribution

Improvements are welcome! To contribute:

1. Fork the repository
2. Create a branch for your feature
3. Commit your changes
4. Open a Pull Request

---

## 📄 License

MIT — Adapt to your needs.

---

## 🙏 Acknowledgments

- OpenCode team for the excellent tool
- Free providers (Groq, Mistral, etc.) for their APIs
- Open source community for inspiration

---

*Configuration maintained with love by EurinHash*
*Last update: 2026-09-19*

---

## 🔗 Useful Links

- [OpenCode](https://opencode.ai/) — AI coding tool
- [OpenCode GitHub](https://github.com/sst/opencode) — Source repository
- [Groq](https://groq.com/) — Free API (free tier)
- [Google AI Studio](https://aistudio.google.com/) — Free Gemini
- [Novita AI](https://novita.ai/) — Free API (256K ctx)
- [Zhipu AI](https://open.bigmodel.cn/) — Free GLM
- [OpenRouter](https://openrouter.ai/) — Access to free models
- [Hugging Face](https://huggingface.co/) — Open source models
- [Ollama](https://ollama.com/) — Local models
- [Pollinations](https://pollinations.ai/) — Keyless API
- [ZenMux](https://zenmux.ai/) — Claude Sonnet 5 free
- [Bun](https://bun.sh/) — Fast JavaScript runtime
- [Node.js](https://nodejs.org/) — JavaScript environment