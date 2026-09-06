---
name: hash-verification
description: Use after making code changes to validate correctly without wasting tokens or time. Targeted checks only, never full blind re-runs.
---

# Hash Verification

Mandatory workflow after any change:

```
CHANGE → IDENTIFY AFFECTED AREA → RUN TARGETED VALIDATION → CHECK RESULT → STOP
```

## Rules

1. Do not run the whole test suite automatically — identify relevant tests.
2. Verify critical assumptions and newly introduced errors only.
3. Never relaunch the same command needlessly; no checks unrelated to the change.
4. Parse failures first (failing tests, error messages, files concerned), skip green noise.
5. For outputs: read errors, relevant warnings, and last useful lines — never full dumps (use `tail`, grep, or output files).
6. Stop after the affected area is green.
