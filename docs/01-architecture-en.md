# Architecture — EURINHASH

## Overview

EURINHASH is an intelligent supervisor for OpenCode that guarantees:
- **100% free** : No paid models by default
- **Never down** : Automatic provider rotation on failure
- **Transparent** : Detailed logs, integrated monitoring
- **Secure** : Secret redaction, sensitive op detection

---

## EURINHASH Protocol (6 Steps)

### Step 1 — Probe
```
Read free-models.json (>30min = re-probe via free-probe.py)
Mark providers OK/KO
```

### Step 2 — Pick
```
Code: groq → mistral → zhipu → openrouter → novita → together
Chat: groq → zhipu → mistral → openrouter → novita → together
```

### Step 3 — Delegate
```
Send complete task + context to 1st available worker
Include EURINHASH instructions
```

### Step 4 — Rotate
```
If 429/quota/auth/timeout:
  - Mark provider KO in circuit breaker
  - Move to next provider
  - Retry with same prompt
```

### Step 5 — Stop
```
If all providers KO:
  - Summarize what's done / what's blocked
  - Propose paid fallback (mammouth)
  - Request explicit approval
```

### Step 6 — No Paid
```
Never use paid model without explicit approval
EURINHASH Pro = only if user explicitly approves
```

---

## Circuit Breaker

### States
| State | Description | Action |
|-------|-------------|--------|
| `CLOSED` | Working normally | Calls allowed |
| `OPEN` | Failing (3+ errors) | Calls blocked for 60s |
| `HALF_OPEN` | Test after timeout | 1 test request |

### Transitions
```
CLOSED ──[3 failures]──► OPEN
  ▲                       │
  │                   [60s timeout]
  │                       │
  └────[success]──── HALF_OPEN ──[failure]──► OPEN
                └────[success]────► CLOSED
```

---

## Quota Tracking

### Structure
```json
{
  "groq:qwen/qwen3.8-27b:2026-09-06": 12,
  "mistral:codestral-latest:2026-09-06": 3
}
```

### Limits per provider
| Provider | Limit/day |
|----------|-----------|
| Groq | 50 |
| Mistral | 30 |
| Google | 20 |
| Zhipu | 20 |
| OpenRouter | 30 |
| HuggingFace | 20 |
| Novita | 30 |
| Together | 20 |

---

## Data Flow

```
User
  │
  └─► OpenCode TUI (eurinhash agent)
                │
        ┌───────┴───────┐
        ▼               ▼
  opencode run      hash-direct
  (NATIVE - bug)   wrapper.py
  (Windows SDK)     (WORKAROUND)
        │               │
        └───────┬───────┘
                ▼
      ┌─────────────────┐
      │ hash-direct.py  │
      │ ┌─────────────┐ │
      │ │Circuit Breaker│ │
      │ │  (file)     │ │
      │ └─────────────┘ │
      │ ┌─────────────┐ │
      │ │Quota Tracking│ │
      │ │  (file)     │ │
      │ └─────────────┘ │
      │ ┌─────────────┐ │
      │ │ Auto-Fallback│ │
      │ │ Groq→Mistral│ │
      │ └─────────────┘ │
      └────────┬────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐
│  GROQ  │ │ MISTRAL│ │  ZHIPU │
│ (qwen) │ │(codestrl│ │ (glm-4)│
└────────┘ └────────┘ └────────┘
```

---

## Components

### Configuration Files
| File | Purpose |
|------|---------|
| `opencode.jsonc` | Main configuration |
| `opencode-mem.jsonc` | Long-term memory config |
| `tui.json` | TUI customization |

### Agents (19)
| Agent | Role |
|-------|------|
| eurinhash | Supervisor, provider rotation |
| planner | Planning before action |
| architect | Architecture decisions |
| design-lead | UI/UX direction |
| builder | Code execution |
| quality-engineer | Code quality |
| tester | Automated tests |
| security | Security analysis |
| reviewer | Code review |
| git-engineer | Git operations |
| docwriter | Documentation |
| worker-* | Targeted fallback (4) |

### Scripts (7)
| Script | Purpose |
|--------|---------|
| `hash-direct.py` | Main wrapper with circuit breaker + quota |
| `hash-direct-wrapper.py` | Alias for `opencode run` |
| `free-probe.py` | Test free model availability |
| `quota.py` | Manual quota management |
| `myfree-eurinhash.py` | Complete free model test |
| `view-audit-log.py` | Audit log display |

### Plugins (3)
| Plugin | Purpose |
|--------|---------|
| `audit-logger.ts` | JSONL logging with redaction |
| `guard.ts` | Destructive command protection (+ secret redaction on outputs) |

### Commands (8)
| Command | Purpose |
|---------|---------|
| `/run` | hash-direct wrapper |
| `/hash-direct` | Direct provider access |
| `/audit-log` | Audit log display |
| `/commit` | Git commit |
| `/review` | Code review |
| `/quota` | Quota management |
| `/myfree-eurinhash` | Test free models |

---

## Models by Provider

### Groq
| Model | Type | Specialty |
|-------|------|-----------|
| `qwen/qwen3.8-27b` | MoE (8B active) | Code, reasoning |
| `openai/gpt-oss-120b` | MoE (120B) | Complex code |
| `openai/gpt-oss-20b` | MoE (20B) | Light code |
| `qwen/qwen3.6-27b` | MoE (8B active) | Code, reasoning |

### Mistral
| Model | Type | Specialty |
|-------|------|-----------|
| `codestral-latest` | Dense | Code, completion |
| `mistral-code-latest` | Dense | Code |

### Google
| Model | Type | Context | Specialty |
|-------|------|---------|-----------|
| `gemini-2.5-flash` | Flash | 1M | Versatile |
| `gemini-3.8-flash` | Flash | 1M | Reasoning |
| `gemini-3.7-flash` | Flash | 1M | Reasoning |
| `gemini-3.6-flash` | Flash | 1M | Reasoning |
| `gemini-3.5-flash` | Flash | 1M | Versatile |
| `gemini-flash-latest` | Flash | 1M | Versatile |

### Zhipu
| Model | Type | Context | Specialty |
|-------|------|---------|-----------|
| `glm-4.7-flash` | Flash | 128K | Chat |
| `glm-5.3-flash` | Flash | 128K | Chat |

### OpenRouter
| Model | Type | Specialty |
|-------|------|-----------|
| `openrouter/free` | Free | Versatile |

### HuggingFace
| Model | Type | Specialty |
|-------|------|-----------|
| `Qwen/Qwen3-Coder-480B-A35B-Instruct:cheapest` | Code | Code |
| `deepseek-ai/DeepSeek-V4-Flash:cheapest` | Chat | Chat |

### Novita
| Model | Type | Context | Specialty |
|-------|------|---------|-----------|
| `deepseek-ai/DeepSeek-V4-Flash` | Flash | 128K+ | Code, chat |
| `inclusionai/ling-3.0-flash-fin` | Flash | 256K | Chat |
| `inclusionai/ling-3.0-flash-sante` | Flash | 256K | Chat |

### Together
| Model | Type | Specialty |
|-------|------|-----------|
| `moonshotai/Kimi-K2.7-Code` | Code | Code |
| `meta-llama/Llama-4-Maverick` | Chat | Chat |

---

## State Files

| File | Location | Purpose |
|------|----------|---------|
| `free-models.json` | `~/.config/opencode/` | Model availability cache |
| `provider_usage.json` | `~/.config/opencode/` | Usage counters |
| `provider_circuit.json` | `~/.config/opencode/` | Circuit breaker states |
| `myfree-eurinhash-report.json` | `~/.config/opencode/` | Model test report |
| `logs/audit-YYYY-MM-DD.jsonl` | `~/.config/opencode/logs/` | Detailed audit log |

---

## Extensibility

### Add a new provider
1. Create API key file: `echo "KEY" > .newprovider-key`
2. Add in `hash-direct.py`:
   - Endpoint in `ENDPOINTS`
   - Models in `MODELS`
   - Call function
   - Limit in `QUOTA_LIMITS`
3. Test: `python scripts/hash-direct.py --provider newprovider "test"`

### Add a new agent
1. Create `agent/my-agent.md`
2. Define model and instructions
3. Update `skills/hash-agent-matrix/SKILL.md`

---

## Performance

| Step | Latency |
|------|---------|
| hash-direct-wrapper → hash-direct | ~0ms |
| Circuit breaker check | ~1ms |
| Quota check | ~1ms |
| Groq API (qwen-32b) | ~500-2000ms |
| Mistral API (codestral) | ~500-2000ms |
| Zhipu API | ~500-1500ms |

---

*Document generated $(date)*