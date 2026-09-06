---
description: Teste tous les modèles FREE, affiche un rapport trié par qualité/prix, et permet de changer le modèle par défaut. Utilise le script myfree-eurinhash.py pour le scan ou affiche le rapport cached.
agent: eurinhash
---

Exécute la commande appropriée selon l'argument :

**Arguments supportés :**
- (aucun) → `python ~/.config/opencode/scripts/myfree-eurinhash.py report` — affiche le rapport cached
- `test` → `python ~/.config/opencode/scripts/myfree-eurinhash.py test` — lance le scan complet de tous les modèles FREE
- `list` → `python ~/.config/opencode/scripts/myfree-eurinhash.py list` — liste les modèles sans tester
- `use <model>` → `python ~/.config/opencode/scripts/myfree-eurinhash.py use <model>` — change le modèle par défaut

**Contexte :** $ARGUMENTS

Rends un tableau clair en français avec le statut, latence, qualité et coût EUR/INR de chaque modèle testé.
