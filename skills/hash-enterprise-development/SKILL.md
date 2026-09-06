---
name: hash-enterprise-development
description: "Use when writing or reviewing production code. Enforces enterprise-grade quality: separation of concerns, security by design, clear naming, no over-engineering."
---

# Hash Enterprise Development

Fundamental rule: SIMPLE, CLEAR, MAINTAINABLE. Never over-architect.

## Principles

1. Separation of concerns; minimal complexity; no unnecessary abstractions.
2. Security by design: validate inputs, parameterize queries, never commit secrets (`.env` stays git-ignored).
3. Clear naming; code that reads without comments.
4. Backward compatibility awareness for shared interfaces.
5. Error handling where it matters; logging where appropriate.
6. Configuration through environment variables, never hardcoded secrets.
7. Document only when architectural decisions change.
