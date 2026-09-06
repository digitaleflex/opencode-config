---
description: Affiche le monitoring quotas et dépenses (FREE, OpenRouter, jour en cours). Lecture seule.
agent: build
---

Exécute `python ~/.config/opencode/scripts/quota.py` (bash) et présente le résultat en tableau court FR :

1. État des FREE (avec âge du cache — si >30 min, propose de régénérer via @eurinhash, ne le fais pas tout seul car ça consomme des quotas).
2. Usage clé OpenRouter vs limite.
3. Dépense OpenCode du jour par modèle + total.
4. Rappelle que les autres providers n'ont pas d'API quota (dashboard uniquement).

Contexte : $ARGUMENTS
