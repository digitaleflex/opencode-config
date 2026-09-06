# opencode-config

EURINHASH configuration for OpenCode - free-tier + Novita AI (vraiment gratuit), specialized agents, and security hardening.

## Features

- **Models**: Groq, Mistral (API keys), Zhipu (rate_limited), Novita AI (**GRATUIT**), Google (rate_limited)
- **EURINHASH Supervisor**: Automatic provider rotation on quota/error
- **9 specialized agents**: planner, architect, design-lead, builder, quality-engineer, tester, security, reviewer, git-engineer
- **Circuit breaker**: Protection against failing providers (CLOSED/OPEN/HALF_OPEN state)
- **Local quota tracking**: Daily count per provider/model to prevent overuse
- **hash-direct wrapper**: Bypass of the `opencode run` Windows bug
- **Audit logger**: JSONL logging of tool calls with sensitive ops detection and redaction
- **Custom commands**: `/run`, `/hash-direct`, `/audit-log`
- **Plugins**: `@felipegenef/opencode-lazy-skills`, `envsitter-guard`, guard.ts, audit-logger.ts
- **Skill matrix**: Intelligent routing of tasks by complexity (L1-L4)

## Architecture

```
opencode
├── agent/              # 9 specialized agents with dedicated models
├── command/            # Slash commands
├── plugin/             # Audit logger, guard, context summarizer
├── scripts/            # hash-direct.py (wrapper), quota tracking, circuit breaker
├── skills/             # Custom skills (hash-agent-matrix, etc.)
└── config/             # opencode.jsonc (main configuration)
```

### Models by Agent

| Agent | Model | Provider |
|-------|--------|----------|
| eurinhash (supervisor) | `groq/qwen/qwen3.8-27b` | Groq |
| planner, architect, design-lead, docwriter | `groq/qwen/qwen3.8-27b` | Groq |
| builder, quality-engineer, tester, security, reviewer, git-engineer | `mistral/codestral-latest` | Mistral |
| worker-* | Various based on fallback | Free/Pro |

## Installation

### Prerequisites
- [OpenCode installed](https://opencode.ai/)
- API keys for free providers (see `.gitignore` for file names)

### Steps
1. Clone this repository:
   ```bash
   git clone https://github.com/digitaleflex/opencode-config.git %USERPROFILE%\.config\opencode
   ```

2. Create API key files in `%USERPROFILE%\.config\opencode\`:
   - `.groq-key`
   - `.mistral-key`
   - `.gemini-key`
   - `.zhipu-key`
   - `.openrouter-key`
   - `.hf-key`
   - `.novita-key`
   - `.together-key`
   - `.deepseek-key` (optional)

3. Verify the configuration:
   ```bash
   opencode /run "test"
   ```

## Usage

### Custom Commands
- `/run "your prompt"` → Uses the hash-direct wrapper with automatic fallback
- `/hash-direct [options] "prompt"` → Direct provider access with fine-grained control
- `/audit-log` → Displays the audit log (JSONL)
- `/hash-direct --status` → Quota and circuit breaker state
- `/hash-direct --list` → Lists all available models
- `/hash-direct --list-providers` → Shows which providers have configured keys

### hash-direct Options
```
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

## Security

- **API keys excluded**: All `.*-key`, `.env`, `provider_*.json` are in `.gitignore`
- **Secret redaction**: The audit logger automatically masks tokens, passwords, etc.
- **Sensitive ops detection**: Monitoring of dangerous commands (rm, dd, mkfs, etc.)
- **Log rotation**: Audit files rotated every 30 days
- **No sensitive data versioned**: Only configuration code is public

## Monitoring

### State Files
- `provider_usage.json`: Daily call counter
- `provider_circuit.json`: Circuit breaker state
- `logs/audit-YYYY-MM-DD.jsonl`: Detailed audit log

### Useful Commands
```bash
# View system state
opencode /run --status

# Force test with a specific provider
opencode /hash-direct --provider mistral "explain recursion"

# View available models
opencode /hash-direct --list

# Reset quotas (useful for testing)
opencode /hash-direct --reset-quota
```

## Advanced Configuration

### opencode.jsonc
The main configuration defines:
- `default_agent`: "eurinhash"
- `small_model`: "groq/qwen/qwen3.8-27b"
- Bash and skills permissions
- Free providers only (Mammouth as optional fallback)
- MCP servers (Postgres for memory)

### Custom Skills
- `hash-agent-matrix`: L1-L4 routing by complexity
- `hash-token-efficiency`: Token optimization
- `hash-code-navigation`: Efficient codebase search
- `hash-verification`: Risk-proportional verification

## Troubleshooting

### Common Issues
1. **"Creating a session failed"** → Check that `opencode.json` (legacy) does not have `permission.task: "deny"` (rename to `.bak`)
2. **Opencode run hang** → Use `/run` or `/hash-direct` instead (Windows SDK bug workaround)
3. **Quota exhausted** → The circuit breaker automatically switches to the next provider
4. **Provider error 429** → Check `provider_circuit.json` and wait for timeout to end

### Logs
- Consult `logs/audit-YYYY-MM-DD.jsonl` to see all tool calls
- Provider errors are logged with context for debugging

## Documentation

The complete documentation is available in `docs/` (in English and French):

- [Architecture](docs/01-architecture-en.md)
- [Configuration](docs/02-configuration-en.md)
- [Agents](docs/03-agents-en.md)
- [Scripts](docs/04-scripts-en.md)
- [Plugins](docs/05-plugins-en.md)
- [Commands](docs/06-commands-en.md)
- [Skills](docs/07-skills-en.md)
- [Troubleshooting](docs/08-troubleshooting-en.md)
- [Security](docs/09-security-en.md)
- [Summary](docs/10-summary-en.md)

## Contribution

Improvements are welcome! To contribute:

1. Fork the repository
2. Create a branch for your feature
3. Commit your changes
4. Open a Pull Request

## License

Personal configuration - adapt according to your needs.

## Acknowledgments

- OpenCode team for the excellent tool
- Free providers (Groq, Mistral, etc.) for their APIs
- Open source community for inspiration

---

*Configuration maintained with love by digitalefish*
*Last update: $(date)*