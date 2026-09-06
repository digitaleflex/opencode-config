---
description: Commit les changements avec un message Conventional Commits propre.
agent: build
---

1. Inspecte `git status` + `git diff --stat`. Si rien à committer, dis-le et stoppe.
2. Relis vite le diff pour un message fidèle (pas de secrets dedans).
3. Message en Conventional Commits (`feat:`, `fix:`, `refactor:`...), concis, impératif, sans emoji.
4. `git add` uniquement les fichiers pertinents puis commit. Ne push JAMAIS sans demande explicite.

Contexte : $ARGUMENTS
