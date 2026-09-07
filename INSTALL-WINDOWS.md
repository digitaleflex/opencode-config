# Installation de la config EURINHASH sur Windows — guide complet

> Guide de mise en route de [`digitaleflex/opencode-config`](https://github.com/digitaleflex/opencode-config) sur une machine Windows neuve, avec **OpenCode 1.17.13**.
>
> Il complète le README du dépôt en documentant les **quatre correctifs indispensables** sans lesquels l'installation ne démarre pas. Rédigé après une installation réelle de bout en bout : chaque erreur décrite ici a été rencontrée puis corrigée.

**Durée** : 30 à 45 minutes, dont l'essentiel en création de comptes providers.

---

## Sommaire

1. [Prérequis](#1-prérequis)
2. [Installer OpenCode](#2-installer-opencode)
3. [Déployer la config](#3-déployer-la-config)
4. [Protéger les clés API — À FAIRE AVANT TOUT `git add`](#4-protéger-les-clés-api--à-faire-avant-tout-git-add)
5. [Créer les clés API](#5-créer-les-clés-api)
6. [Appliquer les correctifs obligatoires](#6-appliquer-les-correctifs-obligatoires)
7. [Vérifier l'installation](#7-vérifier-linstallation)
8. [Intégration VS Code](#8-intégration-vs-code)
9. [Dépannage](#9-dépannage)
10. [Limites connues](#10-limites-connues)

---

## 1. Prérequis

Ouvrir **PowerShell** et vérifier :

```powershell
node --version
python --version
git --version
```

Versions validées lors de la rédaction de ce guide :

| Outil | Version testée | Minimum |
|---|---|---|
| Node.js | 24.14.0 | 18+ |
| Python | 3.14.3 | 3.8+ |
| Git | 2.54.0 | quelconque |
| OpenCode | 1.17.13 | 1.17+ |

Python est requis : les scripts `hash-direct.py`, `quota.py` et `view-audit-log.py` en dépendent.

---

## 2. Installer OpenCode

```powershell
opencode --version
```

Si la commande échoue, installer via l'une de ces méthodes :

```powershell
npm install -g opencode-ai
# ou
scoop install opencode
# ou
choco install opencode
```

Documentation officielle : <https://opencode.ai/docs/>

---

## 3. Déployer la config

La config vit dans `%USERPROFILE%\.config\opencode`. **Ce chemin est le même sur Windows que sur Linux/macOS** — OpenCode n'utilise pas `%APPDATA%`.

### Cas 1 — le dossier n'existe pas

```powershell
git clone https://github.com/digitaleflex/opencode-config.git "$env:USERPROFILE\.config\opencode"
```

### Cas 2 — le dossier existe déjà

C'est le cas le plus fréquent : OpenCode crée ce dossier dès son premier lancement, et `git clone` refuse une destination non vide.

```powershell
Move-Item "$env:USERPROFILE\.config\opencode" "$env:USERPROFILE\.config\opencode.old"
git clone https://github.com/digitaleflex/opencode-config.git "$env:USERPROFILE\.config\opencode"
```

Le dossier `.old` ne contient généralement qu'un `opencode.jsonc` réduit à `{ "$schema": ... }` et un `node_modules` de plugins. Le vérifier, puis le supprimer une fois l'installation validée.

Contrôler le résultat :

```powershell
Get-ChildItem "$env:USERPROFILE\.config\opencode"
```

Doivent apparaître : `agent/`, `command/`, `plugin/`, `scripts/`, `skills/`, `docs/`, `opencode.jsonc`.

---

## 4. Protéger les clés API — À FAIRE AVANT TOUT `git add`

> **Correctif n°1 — sécurité.**
> Le dépôt **ne contient aucun fichier `.gitignore`**, alors que le README affirme que « toutes les `.*-key` sont dans le `.gitignore` ». C'est faux. Vos clés apparaîtront dans `git status` sous *Untracked files* et un simple `git add .` suivi d'un `git push` les publierait en clair.

Créer le fichier **avant** de déposer la moindre clé :

```powershell
cd "$env:USERPROFILE\.config\opencode"

$gi = @"
# Cles API - NE JAMAIS COMMITER
.*-key
.env
.env.*

# Etat local
provider_usage.json
provider_circuit.json
logs/
node_modules/
*.bak2
*.disabled
"@
[IO.File]::WriteAllText("$env:USERPROFILE\.config\opencode\.gitignore", $gi)
```

Vérification, une fois les clés créées (étape suivante) :

```powershell
git status --short
```

**Aucune ligne `.xxx-key` ne doit apparaître.** Si une seule subsiste, ne rien commiter et corriger le `.gitignore` d'abord.

---

## 5. Créer les clés API

Neuf providers sont configurés. **Deux suffisent pour démarrer** : Groq et Mistral portent l'intégralité des onze agents. Les autres ne servent qu'au basculement automatique du circuit breaker.

| Provider | Créer la clé | Fichier | Statut |
|---|---|---|---|
| **Mistral** | <https://console.mistral.ai/api-keys> | `.mistral-key` | **essentiel** |
| **Groq** | <https://console.groq.com/keys> | `.groq-key` | **essentiel** |
| Google Gemini | <https://aistudio.google.com/apikey> | `.gemini-key` | fallback |
| OpenRouter | <https://openrouter.ai/settings/keys> | `.openrouter-key` | fallback |
| Zhipu / Z.ai | <https://z.ai/manage-apikey/apikey-list> | `.zhipu-key` | fallback |
| HuggingFace | <https://huggingface.co/settings/tokens> | `.hf-key` | fallback |
| Novita | <https://novita.ai/settings/key-management> | `.novita-key` | fallback |
| Together | <https://api.together.ai/settings/api-keys> | `.together-key` | fallback |
| DeepSeek | <https://platform.deepseek.com/api_keys> | `.deepseek-key` | optionnel, **payant** |

Remarques :

- **HuggingFace** : prendre un token de type *Read*. Aucune raison d'accorder l'écriture à un agent de code.
- **Together** : exige désormais un moyen de paiement chez de nombreux comptes. Facultatif.
- **DeepSeek** : seul provider payant de la liste (solde prépayé). La config le déclare pour son prompt caching, mais il n'est jamais dans le chemin par défaut.
- **Zhipu** est le nom historique de **Z.ai** — même provider, modèles GLM.

### Déposer les clés

> **Ne pas utiliser le Bloc-notes ni `Set-Content`.** PowerShell 5.1 écrit un BOM UTF-8 invisible en tête de fichier. Le script lit les clés avec `.strip()`, qui **ne retire pas le BOM** : toutes les authentifications échouent avec une erreur incompréhensible.

`[IO.File]::WriteAllText` écrit en UTF-8 sans BOM. C'est la seule méthode fiable :

```powershell
$d = "$env:USERPROFILE\.config\opencode"

[IO.File]::WriteAllText("$d\.groq-key",       "VOTRE_CLE")
[IO.File]::WriteAllText("$d\.mistral-key",    "VOTRE_CLE")
[IO.File]::WriteAllText("$d\.gemini-key",     "VOTRE_CLE")
[IO.File]::WriteAllText("$d\.zhipu-key",      "VOTRE_CLE")
[IO.File]::WriteAllText("$d\.openrouter-key", "VOTRE_CLE")
[IO.File]::WriteAllText("$d\.hf-key",         "VOTRE_CLE")
[IO.File]::WriteAllText("$d\.novita-key",     "VOTRE_CLE")
[IO.File]::WriteAllText("$d\.together-key",   "VOTRE_CLE")
[IO.File]::WriteAllText("$d\.deepseek-key",   "VOTRE_CLE")
```

Points de vigilance :

- La ligne `$d = ...` est **obligatoire** et doit passer en premier. Sans elle, les fichiers atterrissent à la racine de `C:\`.
- Si une clé contient un `$`, utiliser des guillemets **simples** : `'ma$cle'`.
- Sauter la ligne d'un provider non utilisé : il sera simplement traité comme indisponible.

Contrôler que les fichiers existent, sans afficher leur contenu :

```powershell
Get-ChildItem -Force $d -Filter ".*-key" | Select-Object Name, Length
```

Longueurs attendues : Groq 56, OpenRouter 73, HuggingFace 37, DeepSeek 35, Mistral 32. Une taille de 0 signale une ligne mal exécutée.

---

## 6. Appliquer les correctifs obligatoires

Sans ces trois correctifs, l'installation ne fonctionne pas sur OpenCode 1.17.13.

### Correctif n°2 — clé `_disabled_plugins` rejetée par le schéma

**Symptôme** :

```
Configuration is invalid at C:\Users\<vous>\.config\opencode\opencode.jsonc
↳ Unrecognized key: _disabled_plugins
```

OpenCode 1.17.13 refuse toute clé inconnue à la racine. Le préfixe `_` ne confère aucun statut particulier.

**Correctif** — ouvrir `opencode.jsonc` (le bloc se trouve vers la ligne 11) et supprimer ces quatre lignes :

```jsonc
  // ── Plugins désactivés (MORPH_API_KEY manquant) ──
  "_disabled_plugins": [
    "@f97/opencode-morph-fast-apply"
  ],
```

Aucune perte : ce plugin était déjà inactif, il s'agissait d'une note de l'auteur.

### Correctif n°3 — `opencode.json` legacy en conflit

**Symptôme** : démarrage très long au premier lancement, puis compactions à répétition, ou `Creating a session failed`.

Le dépôt contient **deux fichiers de configuration concurrents** :

- `opencode.jsonc` déclare **4 plugins**
- `opencode.json` déclare **14 plugins**, dont trois mécanismes d'élagage de contexte simultanés (`opencode-dynamic-context-pruning`, `./plugin/context-summarizer.ts`, `opencode-mem`), deux systèmes de mémoire concurrents, et `@f97/opencode-morph-fast-apply` — celui-là même que le `.jsonc` prétend désactiver.

**Correctif** :

```powershell
Rename-Item "$env:USERPROFILE\.config\opencode\opencode.json" "opencode.json.disabled"
```

Vider le cache dans la foulée :

```powershell
Remove-Item "$env:USERPROFILE\.cache\opencode" -Recurse -Force -ErrorAction SilentlyContinue
```

### Correctif n°4 — boucle de compaction infinie

**Symptôme** — le plus déroutant des quatre. Dès qu'une demande dépasse la question triviale, l'agent ne répond pas : il produit un résumé structuré (`Goal` / `Blocked` / `Next Move` / `Relevant Files`) suivi de `▣ Compaction`, puis recommence. Trois à quatre compactions d'affilée, chacune résumant la précédente. Aucune tâche n'est jamais exécutée.

En phase avancée, la session se corrompt : le résumé **inverse les rôles** — il décrit l'utilisateur comme l'auteur du code — et l'agent finit par répondre qu'il n'a « pas les outils nécessaires » pour aider. Il a perdu l'accès à ses propres outils d'édition. La session est morte à cet instant, seul un redémarrage la récupère.

**Cause** : **aucun bloc `provider` de la config ne déclare de limite de contexte.** Sans cette information, OpenCode applique une valeur par défaut très basse, se croit saturé dès les premiers échanges et déclenche une compaction — qui échoue pour la même raison et se relance aussitôt.

Deux précisions importantes :

- Le phénomène est **indépendant du provider**. Il se produit sur Groq comme sur Mistral. Il apparaît simplement plus tôt sur Groq, dont le débit gratuit est plus contraint — ce qui donne à tort l'impression d'un problème spécifique à ce provider.
- `small_model` est le modèle qu'OpenCode utilise **pour les compactions elles-mêmes**. Ses limites comptent donc autant que celles du modèle principal.

**Correctif** — déclarer les limites dans `opencode.jsonc`.

Bloc `groq` :

```jsonc
      "models": {
        "qwen/qwen3.8-27b": {
          "name": "Qwen 3.8 27B (FREE, testé OK)",
          "limit": { "context": 131042, "output": 16384 }
        },
        "openai/gpt-oss-120b": {
          "name": "GPT-OSS 120B (FREE)",
          "limit": { "context": 131072, "output": 8192 }
        },
        "openai/gpt-oss-20b": {
          "name": "GPT-OSS 20B (FREE)",
          "limit": { "context": 131072, "output": 8192 }
        },
        "qwen/qwen3.6-27b": {
          "name": "Qwen 3.6 27B (FREE)",
          "limit": { "context": 131072, "output": 16384 }
        }
      }
```

Bloc `mistral` :

```jsonc
      "models": {
        "codestral-latest": {
          "name": "Codestral (FREE, testé OK)",
          "limit": { "context": 131072, "output": 8192 }
        },
        "mistral-code-latest": {
          "name": "Mistral Code (FREE, testé OK)",
          "limit": { "context": 131072, "output": 8192 }
        }
      }
```

Valeurs issues des documentations officielles : 131 042 tokens de contexte et 16 384 en sortie pour Qwen 3.8 27B chez Groq, 128 K de contexte pour `codestral-latest` chez Mistral.

**Contournement complémentaire** — si la compaction persiste sur les tâches longues, basculer les agents de premier plan (`eurinhash`, `planner`, `architect`, `design-lead`, `docwriter`) et `small_model` vers Mistral, dont le débit gratuit est plus confortable :

```powershell
$d = "$env:USERPROFILE\.config\opencode\agent"
Copy-Item $d "$d-backup" -Recurse -Force

Get-ChildItem $d -Filter *.md | Where-Object { $_.Name -notlike 'worker-*' } | ForEach-Object {
  $c = [IO.File]::ReadAllText($_.FullName)
  $n = $c -replace 'model:\s*groq/[^\r\n]+', 'model: mistral/codestral-latest'
  if ($n -ne $c) { [IO.File]::WriteAllText($_.FullName, $n); "MODIFIE : $($_.Name)" }
}
```

Le filtre `worker-*` est délibéré : `worker-groq.md` **doit** rester sur Groq, c'est sa fonction dans la chaîne de fallback.

Ce contournement traite un symptôme, pas la cause. À n'appliquer qu'après les limites, et seulement si nécessaire.

---

## 7. Vérifier l'installation

Trois tests, du plus isolé au plus intégré. Ne pas passer au suivant tant que le précédent échoue.

**1. Les clés sont lues** — n'effectue aucun appel réseau :

```powershell
cd "$env:USERPROFILE\.config\opencode"
python scripts\hash-direct.py --list-providers
```

Attendu : **8 providers** en `[OK]`. DeepSeek n'apparaît pas — le wrapper ne le gère pas, les modèles DeepSeek n'y sont accessibles que via HuggingFace et Novita. Ce n'est pas une erreur.

**2. Les clés sont valides** — premier appel réseau réel :

```powershell
python scripts\hash-direct.py --provider mistral "dis bonjour en une phrase"
```

**3. OpenCode démarre** :

```powershell
cd C:\chemin\vers\un\projet
opencode
```

L'écran d'accueil doit afficher l'agent **Eurinhash** et le modèle **Codestral**. Poser une question portant sur un fichier du projet et vérifier qu'une vraie réponse arrive — pas un bloc de compaction.

---

## 8. Intégration VS Code

L'extension s'installe automatiquement au premier lancement d'`opencode` **depuis le terminal intégré** de VS Code. Prérequis : la commande `code` doit être dans le `PATH`.

```powershell
code --version
```

Si elle échoue : `Ctrl+Shift+P` → `Shell Command: Install 'code' command in PATH`.

À défaut, installer « OpenCode » depuis le marketplace.

Raccourcis :

| Action | Windows/Linux |
|---|---|
| Lancement rapide avec contexte | `Ctrl+Échap` |
| Nouvelle session | `Ctrl+Shift+Échap` |
| Insérer une référence de fichier | `Alt+Ctrl+K` |

### Conflit de raccourcis

`Ctrl+P` (palette de commandes d'OpenCode) est intercepté par VS Code, qui l'utilise pour « Aller au fichier ». Pour le rendre au terminal, dans `settings.json` :

```json
"terminal.integrated.commandsToSkipShell": [
  "-workbench.action.quickOpen"
]
```

Le préfixe `-` retire la commande de la liste que VS Code se réserve.

Alternative souvent plus confortable : lancer OpenCode dans **Windows Terminal** à côté de VS Code, et réserver VS Code à l'édition. Aucun conflit.

---

## 9. Dépannage

| Symptôme | Cause | Correctif |
|---|---|---|
| `Unrecognized key: _disabled_plugins` | Clé refusée par le schéma 1.17 | [Correctif n°2](#correctif-n2--clé-_disabled_plugins-rejetée-par-le-schéma) |
| Rien ne s'affiche au premier lancement | 14 plugins npm en téléchargement | Patienter, puis [correctif n°3](#correctif-n3--opencodejson-legacy-en-conflit) |
| Compactions en boucle, aucune réponse | Limites de contexte non déclarées | [Correctif n°4](#correctif-n4--boucle-de-compaction-infinie) |
| L'agent répond qu'il n'a « pas les outils nécessaires » | Session corrompue par une compaction | Redémarrer OpenCode, puis [correctif n°4](#correctif-n4--boucle-de-compaction-infinie) |
| `Creating a session failed` | `opencode.json` legacy | [Correctif n°3](#correctif-n3--opencodejson-legacy-en-conflit) |
| Clés valides mais authentification refusée | BOM UTF-8 en tête de fichier | Réécrire avec `[IO.File]::WriteAllText` |
| Les `.xxx-key` apparaissent dans `git status` | `.gitignore` absent | [Correctif n°1](#4-protéger-les-clés-api--à-faire-avant-tout-git-add) |
| `Ctrl+P` sans effet | VS Code intercepte la touche | [Conflit de raccourcis](#conflit-de-raccourcis) |
| Une `/commande` ne fait rien | Ce sont des modèles de prompt, pas des commandes natives | Exécuter le script directement en PowerShell |

Diagnostic approfondi :

```powershell
opencode --print-logs --log-level DEBUG   # démarrage verbeux
opencode --pure                            # démarrage sans aucun plugin externe
```

Journaux sur disque :

```powershell
Get-ChildItem "$env:USERPROFILE\.local\share\opencode\log" | Sort-Object LastWriteTime -Descending | Select-Object -First 3
```

---

## 10. Limites connues

**Les `/commandes` ne sont pas natives.** `/run`, `/hash-direct`, `/audit-log` sont des **modèles de prompt** injectés à l'agent, pas des commandes exécutées par OpenCode. Si l'agent dysfonctionne, elles semblent muettes. Pour tester réellement le wrapper, passer par PowerShell :

```powershell
python scripts\hash-direct.py --status
python scripts\hash-direct.py --list
```

**Les modèles gratuits ne tiennent pas les tâches longues.** Même avec les limites correctement déclarées, un modèle comme Codestral ne suit pas un prompt à quinze contraintes : il réécrit le même fichier en boucle et n'applique qu'une fraction des consignes. La méthode qui fonctionne est le découpage — un objectif par prompt, une session neuve entre chaque tâche pour repartir d'un contexte propre.

**Le contournement Mistral concentre la charge sur un seul tier gratuit.** Si vous l'appliquez, la rotation multi-providers — l'intérêt premier de cette config — n'opère plus au premier niveau. Envisager alors de répartir les agents non-code (`planner`, `architect`, `docwriter`) sur Gemini, dont le tier gratuit est plus généreux que celui de Groq.

**Le MCP Postgres est déclaré dans la config.** Sans base PostgreSQL locale, il émet des avertissements au démarrage. Sans conséquence sur le fonctionnement.

**Fichiers d'état versionnés.** `provider_usage.json`, `provider_circuit.json` et `logs/` sont suivis par git dans le dépôt d'origine : ils apparaîtront systématiquement comme modifiés. Le `.gitignore` de l'étape 4 n'affecte pas les fichiers déjà suivis.

**Le dépôt n'a pas de licence.** `license: null`, et le README indique « Personal configuration ». Aucun droit de réutilisation n'est formellement accordé.

---

## Conserver ses correctifs

Le dossier de config **est un dépôt git**. Vos correctifs y sont des modifications locales non commitées, qui entreront en conflit au prochain `git pull`. Les isoler sur une branche :

```powershell
cd "$env:USERPROFILE\.config\opencode"
git checkout -b fix/windows-opencode-1.17
git add .gitignore agent/ opencode.jsonc opencode.json
git commit -m "fix: compatibilite OpenCode 1.17.13 sur Windows"
```

`master` reste intact, et la branche pourra être rejouée sur une future version de la config.

---

*Guide rédigé après une installation complète sur Windows 11 — OpenCode 1.17.13, Node 24.14.0, Python 3.14.3.*
