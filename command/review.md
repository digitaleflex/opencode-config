---
description: Relit le diff courant (sécurité, secrets, qualité) et rend un verdict ship / fix.
agent: build
---

Follow the `code-review-skill` methodology. Review the current git diff (`git status`, `git diff`):

1. Secrets/credentials leakés, vulnérabilités (injection, XSS, SSRF), erreurs de logique.
2. Règles du projet (AGENTS.md, typage, lint).
3. Findings avec `fichier:ligne`, fix appliqué directement si petit, sinon plan de fix.

Termine par un verdict clair : ✅ SHIP ou ❌ FIX d'abord. Contexte : $ARGUMENTS
