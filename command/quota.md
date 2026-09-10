---
description: Tableau de bord lisible (argent dépensé, état des modèles gratuits, conseil du moment). Lecture seule.
agent: build
---

Exécute `python ~/.config/opencode/scripts/quota.py` (bash) et présente le résultat **en langage simple et non-technique** :

1. **Argent** : combien dépensé aujourd'hui (normalement 0,00 $ — le dire clairement et fêter ça).
2. **État des modèles** : pour chaque worker, une phrase simple (disponible / en pause quota / en panne / jamais testé). Ne jamais sortir de sigles sans explication.
3. **Conseil** : relaye la recommandation du script (quel modèle utiliser maintenant et pourquoi). Si tout est en pause ou en panne, explique quoi faire (attendre, passer en local Ollama, relancer free-probe via @eurinhash).
4. Ne reprobe jamais toi-même (ça consomme des quotas). Si le cache a plus de 30 min, propose de régénérer via @eurinhash.

Contexte : $ARGUMENTS
