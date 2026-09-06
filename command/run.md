---
description: Contourne le bug opencode run en appelant directement les providers via hash-direct. Utilise le fallback EURINHASH.
agent: eurinhash
---

`python "$HOME/.config/opencode/scripts/hash-direct-wrapper.py" run $ARG`

**Exemples :**
- `/run "explique la loi d'Ohm"` → fallback automatique Groq → Mistral → ...
- `/run --model "codestral-latest" "que fait cette fonction ?"` → modèle spécifique
- `/run --provider groq "salut"` → force Groq
- `/run --list` → modèles disponibles
- `/run --list-providers` → providers configurés
- `/run --json "test"` → sortie JSON
- `/run --status` → état quota + circuit breakers

**Alias pratique :**  
Bash : `alias opencode-run='python "$HOME/.config/opencode/scripts/hash-direct-wrapper.py" run'`

**Notes :**
- Si `opencode run` est planté (bug Windows SDK), utilise `/run` à la place.
- Le circuit breaker et le quota tracking sont actifs (fichiers dans ~/.config/opencode/).
- Voir `/audit-log` pour les traces d'appels.