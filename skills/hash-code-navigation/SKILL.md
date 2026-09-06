---
name: hash-code-navigation
description: Use when exploring unfamiliar code, locating files or symbols, or understanding dependencies before editing. Enforces search-first navigation instead of mass reading.
---

# Hash Code Navigation

Mandatory workflow for codebase exploration:

```
SEARCH → IDENTIFY RELEVANT FILES → READ TARGETED SECTIONS → UNDERSTAND DEPENDENCIES → ACT
```

## Rules

1. Never read a whole repository without justification.
2. Search (grep, glob, AST) before any massive reading.
3. Identify the relevant files first, then read only necessary sections.
4. Do not explore modules unrelated to the task.
5. Reuse previously obtained results instead of re-searching.
6. Only move to ACT when dependencies are understood.
