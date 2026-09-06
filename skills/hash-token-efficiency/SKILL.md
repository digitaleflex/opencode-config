---
name: hash-token-efficiency
description: Load at the start of any non-trivial coding task to enforce token-efficient methods. Triggers on multi-step work, big explorations, long outputs. Teaches search-before-read, no rereads, batched tools, minimal diffs.
---

# Hash Token Efficiency

Minimize total tokens per COMPLETED task — not tokens per response.

## Rules

1. Search before broad reading (grep/glob/AST first, read second).
2. Read only relevant files and sections, never whole repos without reason.
3. Never reread unchanged information — reuse what you already have.
4. Batch independent operations (parallel tool calls) when useful.
5. Avoid redundant tool calls and repeated verifications of the same thing.
6. No unnecessary explanations — answer, don't narrate routine work.
7. Prefer targeted edits over rewriting entire files for small changes.
8. Verify only what was affected by the change.
9. Stop when the task is complete — no gold-plating, no bonus refactors.
