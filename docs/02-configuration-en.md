# Configuration Guide — EURINHASH

## Table of Contents
1. [Quick Installation](#1-quick-installation)
2. [OpenCode Configuration](#2-opencode-configuration)
3. [API Keys](#3-api-keys)
4. [Agents](#4-agents)
5. [Plugins](#5-plugins)
6. [Commands](#6-commands)
7. [Skills](#7-skills)
8. [MCP Servers](#8-mcp-servers)
9. [Migration](#9-migration)

---

## 1. Quick Installation

### Prerequisites
- [OpenCode installed](https://opencode.ai/)
- Python 3.8+ (for scripts)
- Git (for versioning)

### Steps
```bash
# Clone the repo
git clone https://github.com/digitaleflex/opencode-config.git ~/.config/opencode

# Create API key files (see section 3)
echo "your-groq-key" > .groq-key
echo "your-mistral-key" > .mistral-key
# ... other keys

# Verify installation
python scripts/hash-direct.py --list-providers

# Test
opencode /run "test"
```

---

## 2. OpenCode Configuration

### opencode.jsonc (main config)
```jsonc
{
  "default_agent": "eurinhash",
  "small_model": "groq/qwen/qwen3.8-27b",
  "plugins": [
    "@felipegenef/opencode-lazy-skills",
    "envsitter-guard",
    "./plugin/guard.ts",
    "./plugin/audit-logger.ts"
  ],
  "providers": {
    "groq": {
      "api_key": "file:.groq-key",
      "base_url": "https://api.groq.com/openai/v1",
      "models": ["qwen/qwen3.8-27b", "qwen/qwen3.6-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"]
    },
    "mistral": {
      "api_key": "file:.mistral-key",
      "base_url": "https://api.mistral.ai/v1",
      "models": ["codestral-latest", "mistral-code-latest"]
    },
    "google": {
      "api_key": "file:.gemini-key",
      "base_url": "https://generativelanguage.googleapis.com/v2beta",
      "models": ["gemini-2.5-flash", "gemini-3.8-flash"]
    },
    "zhipu": {
      "api_key": "file:.zhipu-key",
      "base_url": "https://open.bigmodel.cn/api/paas/v4",
      "models": ["glm-4-flash", "glm-4-plus"]
    },
    "openrouter": {
      "api_key": "file:.openrouter-key",
      "base_url": "https://openrouter.ai/api/v1",
      "models": ["openrouter/free"]
    },
    "huggingface": {
      "api_key": "file:.hf-key",
      "base_url": "https://router.huggingface.co/v1",
      "models": ["Qwen/Qwen3-Coder-480B-A35B-Instruct"]
    },
    "novita": {
      "api_key": "file:.novita-key",
      "base_url": "https://api.novita.ai/v3/openai",
      "models": ["deepseek-ai/DeepSeek-V4-Flash", "inclusionai/ling-3.0-flash-sante"]
    },
    "together": {
      "api_key": "file:.together-key",
      "base_url": "https://api.together.xyz/v1",
      "models": ["moonshotai/Kimi-K2.7-Code", "meta-llama/Llama-4-Maverick"]
    }
  },
  "permission": {
    "bash": {
      "auto_allow": ["git status", "ls", "cat", "head", "tail", "grep", "find", "pwd", "cd", "echo", "python", "node", "npm"],
      "ask": ["rm", "dd", "mkfs", "chmod", "sudo", "curl", "wget", "pip", "cargo"],
      "deny": []
    },
    "skill": "auto_allow"
  },
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost:5432/opencode"]
    }
  }
}
```

### opencode-mem.jsonc (memory)
```jsonc
{
  "context_window": 200000,
  "summarize_after": 150000,
  "strategy": "auto"
}
```

### tui.json (interface)
```jsonc
{
  "theme": "default",
  "keybinds": {
    "tab": "switch_mode",
    "ctrl+c": "interrupt",
    "ctrl+z": "undo"
  }
}
```

---

## 3. API Keys

### Location
All API keys in `~/.config/opencode/` as `.<provider>-key`:
```
.groq-key       # Groq API key
.mistral-key    # Mistral API key
.gemini-key     # Google Gemini API key
.zhipu-key      # Zhipu AI API key
.openrouter-key # OpenRouter API key
.hf-key         # HuggingFace API key
.novita-key     # Novita AI API key
.together-key   # Together AI API key
.deepseek-key   # DeepSeek API key (optional)
.mammouth-key   # Mammouth API key (paid fallback)
.sambanova-key  # SambaNova API key (FREE, 20 req/day)
.cerebras-key   # Cerebras API key (TRIAL $5, optional)
.pollinations-key # Pollinations (optional: anonymous tier needs no key)
.cohere-key     # Cohere trial key (1000 calls/month, no card)
.cloudflare-key     # Cloudflare API token (Workers AI, 10K neurons/day)
.cloudflare-account # Cloudflare account ID (required with the token)
# Ollama: no key (local, http://localhost:11434)
```

### File Format
```bash
# One line, no quotes, no spaces
cat .groq-key
# gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Getting Keys

| Provider | Sign-up URL | Free Tier |
|---------|-------------|-----------|
| Groq | https://console.groq.com/ | 30 req/min; **1,000 req/day on chat models** (14,400 = small models only) |
| SambaNova | https://cloud.sambanova.ai/ | 20 req/min, 20 req/day, 200K tokens/day per model |
| Pollinations | https://auth.pollinations.ai/ (optional) | No key: 1 req/15s; free account: 1 req/5s |
| Cerebras | https://cloud.cerebras.ai/ | $5 / 30-day trial (no permanent free tier) |
| Ollama | None (local) | Unlimited (bound by your machine) |
| Cohere | https://dashboard.cohere.com/api-keys | Trial: 1000 calls/month, no card, **non-commercial use only** |
| Cloudflare | https://dash.cloudflare.com/ (Workers AI) | 10K neurons/day (API token + account ID) |
| Mistral | https://console.mistral.ai/ | 30M tokens/month |
| Google | https://aistudio.google.com/ | 20 req/min |
| Zhipu | https://bigmodel.cn/ | 200 req/day |
| OpenRouter | https://openrouter.ai/keys | Variable by model |
| HuggingFace | https://huggingface.co/settings/api | Free rate limiting |
| Novita | https://novita.ai/ | Free API |
| Together | https://api.together.xyz/ | $1 free |

### Security
- `.*-key` files are in `.gitignore` (never committed)
- Never share keys in logs or errors
- Renew exposed keys immediately

### New free providers — step-by-step setup

#### SambaNova (large models, 20 free req/day)
```bash
# 1. Sign up (no card): https://cloud.sambanova.ai/
# 2. Create an API key in the dashboard, then:
echo "your-sambanova-key" > ~/.config/opencode/.sambanova-key
chmod 600 ~/.config/opencode/.sambanova-key
# 3. Verify: python ~/.config/opencode/scripts/free-probe.py
```
Configured models: `DeepSeek-V3.1`, `Meta-Llama-3.3-70B-Instruct`,
`gpt-oss-120b`. Free quotas: 20 req/min, 20 req/day, 200K tokens/day
**per model**. Best as a quality fallback when Groq/Mistral hit 429.

#### Pollinations (no key, ultimate backup)
No key needed: the anonymous tier (`apiKey: "anonymous"` in
`opencode.jsonc`) works at 1 req/15s. For higher limits (1 req/5s), register
free at https://auth.pollinations.ai/ and:
```bash
echo "your-pollinations-key" > ~/.config/opencode/.pollinations-key
# then in opencode.jsonc, pollinations provider:
# "apiKey": "{file:~/.config/opencode/.pollinations-key}"
```

#### Cerebras ($5 trial, ultra-fast)
```bash
# 1. Sign up: https://cloud.cerebras.ai/ ($5 credit, 30 days)
# 2. Create an API key
echo "your-cerebras-key" > ~/.config/opencode/.cerebras-key
chmod 600 ~/.config/opencode/.cerebras-key
```
Configured models: `gpt-oss-120b` (1M tokens/day during trial),
`llama3.1-8b` (~2000 tok/s). **No permanent free tier** — access stops
when the $5 runs out until credits are purchased.

#### Ollama (local, 100% free, offline)
```bash
# 1. Install: https://ollama.com/ (or: curl -fsSL https://ollama.com/install.sh | sh)
# 2. Start: ollama serve
# 3. Pull models:
ollama pull devstral        # agentic coding, recommended
ollama pull qwen2.5-coder   # code
ollama pull llama3.1        # general
# No key to create. Verify: curl http://localhost:11434/api/tags
```

#### Cohere (1000-call/month trial, all models)
```bash
# 1. Sign up (no card): https://dashboard.cohere.com/
# 2. Create a TRIAL key at https://dashboard.cohere.com/api-keys
echo "your-cohere-key" > ~/.config/opencode/.cohere-key
chmod 600 ~/.config/opencode/.cohere-key
# 3. Verify: python ~/.config/opencode/scripts/free-probe.py
```
Configured models: `command-a-03-2025`, `command-r-plus-08-2024`,
`north-mini-code-1-0` (code). **Constraints**: 1000 calls/month across ALL
endpoints, 20 req/min, **non-commercial use only**. Proprietary `/v2/chat`
API exposed via the AI SDK adapter — validate live on first real call.

#### Cloudflare Workers AI (10K neurons/day)
```bash
# 1. Free Cloudflare account: https://dash.cloudflare.com/
# 2. Create an API token (Workers AI) and note the account ID
echo "your-cloudflare-token" > ~/.config/opencode/.cloudflare-key
echo "your-account-id" > ~/.config/opencode/.cloudflare-account
chmod 600 ~/.config/opencode/.cloudflare-*
# 3. Verify: python ~/.config/opencode/scripts/free-probe.py
```
Free models observed: `@cf/zai-org/glm-4.7-flash`, `@cf/google/gemma-4-*`,
`@cf/nvidia/nemotron-3-*` (heavy Kimi/GLM-5.2 moved to paid).
**Integration note**: Workers AI is a proprietary REST API
(`/client/v4/accounts/{id}/ai/run/...`), not OpenAI-compatible — the probe
above tests it directly, but the OpenCode provider mapping is **pending
live validation** before routing workers to it.

#### After adding a provider
1. Quit + restart OpenCode (config reload).
2. `python ~/.config/opencode/scripts/free-probe.py` → `free-models.json`
   flips the worker to `ok` (or `rate_limited`/`error` with the reason).
3. `/models` inside OpenCode to pick the model manually.

---

## 4. Agents

### Agent List
| Agent | Model | Role |
|-------|-------|------|
| eurinhash | groq/qwen/qwen3.8-27b | Supervisor, provider rotation |
| planner | groq/qwen/qwen3.8-27b | Planning before action |
| architect | groq/qwen/qwen3.8-27b | Architecture decisions |
| design-lead | groq/qwen/qwen3.8-27b | UI/UX direction |
| builder | mistral/codestral-latest | Code implementation |
| quality-engineer | mistral/codestral-latest | Code quality, linting |
| tester | mistral/codestral-latest | Automated tests |
| security | mistral/codestral-latest | Security analysis |
| reviewer | mistral/codestral-latest | Code review |
| git-engineer | mistral/codestral-latest | Git operations |
| docwriter | groq/qwen/qwen3.8-27b | Documentation |

### Agent Structure
```markdown
---
description: Short description of agent role
model: groq/qwen/qwen3.8-27b
tools: read_files, write_files, bash, web_fetch, search
---

# Agent Name

You are [agent name]. Your role is to...

## Capabilities
- Capability 1
- Capability 2

## Limitations
- Limitation 1
- Limitation 2

## Workflow
1. First step
2. Second step
3. Third step
```

### Add a New Agent
```bash
# Create the file
cat > agent/my-agent.md << 'EOF'
---
description: My custom agent
model: groq/qwen/qwen3.8-27b
tools: read_files, write_files, bash
---

# My Agent

Detailed instructions...
EOF
```

### Invoke a Specific Agent
```bash
# Via TUI
/agent planner "Plan this task"

/# Via prompt
@planner Plan this task: ...
```

---

## 5. Plugins

### Installed Plugins
| Plugin | File | Function |
|--------|------|----------|
| opencode-lazy-skills | node_modules | Lazy skill loading |
| envsitter-guard | (npm) | Environment variable protection |
| guard.ts | plugin/guard.ts | Destructive command blocking |
| audit-logger.ts | plugin/audit-logger.ts | JSONL logging |

### Plugin Configuration
```jsonc
// In opencode.jsonc
"plugins": [
  "@felipegenef/opencode-lazy-skills",
  "envsitter-guard",
  "./plugin/guard.ts",
  "./plugin/audit-logger.ts"
]
```

### Add a Plugin
```bash
# npm plugin
npm install @my/plugin

# local plugin
cp my-plugin.ts plugin/

# Add to opencode.jsonc
"plugins": [
  ...
  "@my/plugin"
]
```

---

## 6. Commands

### Command List
| Command | Description |
|---------|-------------|
| `/run` | hash-direct wrapper with auto fallback |
| `/hash-direct` | Direct provider access |
| `/audit-log` | Audit log display |
| `/commit` | Git commit with Conventional Commits |
| `/review` | Code review |
| `/quota` | Quota management |
| `/myfree-eurinhash` | Test all free models |

### Command Structure
```markdown
---
description: Short command description
agent: eurinhash
---

Command to execute
$ARG = argument passed by user

Examples:
- /command arg1
- /command "full prompt"
```

### Create a New Command
```bash
# Create the file
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
```

---

## 7. Skills

### Custom Skills
| Skill | Description |
|-------|-------------|
| `hash-agent-matrix` | L1-L4 task routing |
| `hash-token-efficiency` | Token optimization |
| `hash-code-navigation` | Efficient code navigation |
| `hash-verification` | Risk-proportionate verification |
| `hash-enterprise-development` | Enterprise development |

### Skill Structure
```markdown
# Skill Name

## Description
Skill description...

## Activation
When to use this skill:
- Condition 1
- Condition 2

## Workflow
1. Step 1
2. Step 2
3. Step 3

## Validation
How to validate the result...
```

### Create a New Skill
```bash
# Create the directory and file
mkdir -p skills/my-skill
cat > skills/my-skill/SKILL.md << 'EOF'
# My Skill

Description...
EOF
```

---

## 8. MCP Servers

### Configuration
```jsonc
// In opencode.jsonc
"mcpServers": {
  "postgres": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost:5432/opencode"]
  }
}
```

### Add an MCP Server
```jsonc
"mcpServers": {
  "my-server": {
    "command": "npx",
    "args": ["-y", "@mcp/server", "arg1", "arg2"]
  }
}
```

---

## 9. Migration

### From opencode.json to opencode.jsonc
If you had `opencode.json`, migrate to `opencode.jsonc`:
```bash
# Backup old config
cp opencode.json opencode.json.bak

# Convert to JSONC (add // comments)
# Add new features
```

### Common Migration Issues
| Issue | Solution |
|-------|----------|
| "Creating a session failed" | Check that `permission.task` is not `"deny"` |
| Permission denied | Check `permission.bash` in `opencode.jsonc` |
| Plugins don't load | Check local plugin paths |

### Rollback
```bash
# Revert to old config
mv opencode.json.bak opencode.jsonc
```

---

## Post-Installation Checklist

- [ ] API keys created (`.groq-key`, `.mistral-key`, etc.)
- [ ] `python scripts/hash-direct.py --list-providers` → OK
- [ ] `opencode /run "test"` → OK
- [ ] `opencode /audit-log` → works
- [ ] Git initialized (if desired)
- [ ] `.gitignore` verified (keys excluded)

---

*Document generated $(date)*