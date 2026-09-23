---
description: Lance le Command Center EURINHASH (dashboard web) sur le projet courant. Ouvre http://localhost:4321.
agent: build
---

Lance le Command Center EURINHASH sur le **projet courant** :

1. Détermine le répertoire du projet courant (le workspace actif d'opencode).
2. Lance le serveur en arrière-plan :
   ```bash
   bun run ~/.config/opencode/dashboard/server.ts -- "<répertoire du projet courant>"
   ```
   (ou `EURINHASH_DASHBOARD_DIR="<répertoire>" bun run ~/.config/opencode/dashboard/server.ts`)
3. Confirme l'URL : **http://localhost:4321** et dis à l'utilisateur d'ouvrir son navigateur.
4. Rappelle ce que le Command Center permet :
   - **Chat** → envoie des tâches au GovernanceOrchestrator (classification, risk, policy, guard, proof en temps réel)
   - **Git** → branche réelle, fichiers modifiés, bouton commit fonctionnel
   - **File tree** → arborescence réelle du projet
   - **Terminal** → commandes réelles protégées par GuardOverrides (`rm -rf /` bloqué)
   - **Workers** → état live des workers gratuits (free-models.json + circuit breakers)
   - **System** → CPU, mémoire, uptime réels

Si le port 4321 est déjà occupé, propose `EURINHASH_DASHBOARD_PORT=9999`.

Contexte : $ARGUMENTS