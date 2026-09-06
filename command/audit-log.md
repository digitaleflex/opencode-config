---
description: View audit logs for agent and tool activity. Use to inspect what agents did, filter by tool, agent, sensitive operations, or errors.
agent: eurinhash
---

`python "$HOME/.config/opencode/scripts/view-audit-log.py" $ARG`

**Examples:**
- `/audit-log --sensitive --limit 20` — view sensitive operations
- `/audit-log --tool bash --limit 50` — view bash commands only
- `/audit-log --errors --limit 30` — view failed operations only
- `/audit-log --all --limit 100` — view all logs, all dates
- `/audit-log --date 2026-09-05 --tool bash` — specific date, bash only
