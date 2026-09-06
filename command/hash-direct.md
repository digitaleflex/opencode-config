---
description: Contournement direct pour appeler les providers AI (Groq, Mistral, Google, etc.) avec fallback automatique comme EURINHASH. Utilise les clés déjà configurées dans ~/.config/opencode/.
agent: eurinhash
---

`python "$HOME/.config/opencode/scripts/hash-direct.py" $ARG`

**Exemples :**
- `/hash-direct "explique la loi d'Ohm"` → utilise le fallback automatique (Groq → Mistral → ...)
- `/hash-direct --model "codestral-latest" "que fait cette fonction ?"` → utilise un modèle spécifique
- `/hash-direct --provider groq "salut"` → force un provider
- `/hash-direct --list` → liste tous les modèles disponibles par provider
- `/hash-direct --list-providers` → montre quels providers ont des clés configurées
- `/hash-direct --json "test"` → sortie JSON brute (utile pour le traitement automatique)

**Notes :**
- Ce script est un contournement pour les cas où `opencode run` ne parvient pas à appeler les providers malgré des clés valides.
- Il implémente le même fallback automatique qu'EURINHASH selon le type de tâche.
- Toutes les réponses sont tracées par le plugin audit-logger si actif (tool.execute.before/after).