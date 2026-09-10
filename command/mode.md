---
description: Bascule le moteur entre mode FREE (gratuit uniquement) et mode PRO (payant autorisé, plafonné). Changement explicite uniquement.
agent: build
---

# Commande /mode — bascule FREE / PRO

**Règle d'or : ne JAMAIS basculer sans confirmation explicite de l'utilisateur.**
- `/mode` sans argument → affiche le mode actuel (lis `mode.json`, défaut `free`) et explique les deux modes. Ne change rien.
- `/mode free` → repasse en gratuit uniquement. Confirmation simple suffit (« oui »).
- `/mode pro` → **exige une confirmation forte** : l'utilisateur doit écrire explicitement qu'il accepte de payer (ex. « oui, passer en pro, plafond 10 $ »). Sans cette phrase, ne change rien et explique.
- Argument optionnel : plafond mensuel en $ (`/mode pro 10` ou `/mode cap 10` pour ajuster sans changer de mode).

## Ce que fait la bascule
1. Écrit `~/.config/opencode/mode.json` : `{"mode": "free"}` ou `{"mode": "pro", "proMonthlyCapUsd": 10}`.
2. En FREE : le moteur bloque toute politique dont le plan ne contient que des workers payants ; le bandeau affiche FREE en vert.
3. En PRO : workers payants autorisés, dépense suivie vs plafond dans `/quota` (alerte à 70/90%) ; le bandeau affiche PRO en orange.
4. Après bascule : quitter + relancer OpenCode, puis vérifier avec `/quota`.

## Garde-fous à rappeler à l'utilisateur
- FREE est le défaut ; fichier absent ou illisible = FREE (fail-closed).
- `EURINHASH_MODE=pro|free` en variable d'environnement surcharge temporairement le fichier.
- Passer en PRO n'achète rien tout seul : chaque provider payant garde ses propres clés/quotas.

Contexte : $ARGUMENTS
