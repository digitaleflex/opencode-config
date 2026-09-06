# Guide de Dépannage — opencode-config EURINHASH

## Table des matières
1. [Problèmes courants](#problèmes-courants)
2. [Erreurs de provider](#erreurs-de-provider)
3. [Problèmes Windows](#problèmes-windows)
4. [Problèmes de configuration](#problèmes-de-configuration)
5. [Dépannage avancé](#dépannage-avancé)
6. [Récupération d'urgence](#récupération-durgence)

---

## 1. Problèmes courants

### 1.1 "Creating a session failed"

**Cause** : L'ancien `opencode.json` avait `"permission": {"task": "deny"}` qui bloquait la création de session.

**Solution** :
```bash
# Vérifier si l'ancien fichier existe
ls -la ~/.config/opencode/opencode.json*

# Si opencode.json existe avec permission.task: "deny", le renommer
mv ~/.config/opencode/opencode.json ~/.config/opencode/opencode.json.bak

# Utiliser la nouvelle configuration
opencode /run "test"
```

### 1.2 `opencode run` hang (Windows SDK bug)

**Cause** : Le SDK OpenCode sous Windows ne parvient pas à appeler les providers malgré des clés valides.

**Solution** :
```bash
# Utiliser le wrapper à la place
/run "mon prompt"

# Ou directement
/hash-direct "mon prompt"

# Ou via la command
/opencode /run "mon prompt"
```

**Mesure permanente** : Le wrapper `hash-direct-wrapper.py` est maintenant la méthode recommandée sous Windows.

### 1.3 Quota épuisé

**Cause** : Trop d'appels vers un provider en peu de temps.

**Solution** :
```bash
# Voir l'état actuel
/quota status

# Réinitialiser (si c'est une erreur de comptage)
/quota reset

# Voir quels providers sont disponibles
/host-direct --list-providers

# Patienter et réessayer plus tard (le circuit breaker aidera)
```

### 1.4 Erreur 429 (trop de requêtes)

**Cause** : Limit de requêtes du provider dépassée.

**Solution** :
```bash
# Vérifier le circuit breaker
/host-direct --status

# Attendre le timeout (60s par défaut)
# Le circuit breaker passera en OPEN pendant 60s, puis HALF_OPEN

# Utiliser un autre provider en attendant
/host-direct --provider mistral "mon prompt"

# Voir quels providers ont encore des quotas
/quota status --detail
```

---

## 2. Erreurs de provider

### 2.1 Zhipu retourne 429

**Cause** : La clé Zhipu est invalide ou le quota est épuisé.

**Solution** :
```bash
# Zhipu est souvent en erreur dans le fallback actuel
# C'est normal, le circuit breaker le bloquera automatiquement

# Pour forcer Zhipu (non recommandé)
/host-direct --provider zhipu "test"

# Pour ignorer Zhipu et utiliser les autres
/host-direct "test"  # Utilise le fallback automatique

# Pour tester Zhipu spécifiquement
python scripts/myfree-eurinhash.py
```

### 2.2 Google rate_limited

**Cause** : Le tier gratuit Google a une limite de 20 req/min.

**Solution** :
```bash
# Laisser le circuit breaker gérer le timeout
/host-direct --status

# Attendre 1 minute avant de réessayer
# Utiliser un autre provider en attendant

# Le système essaiera automatiquement les autres providers
/host-direct "test"
```

### 2.3 Aucun provider ne répond

**Cause** : Tous les providers sont soit KO soit en circuit OPEN.

**Solution** :
```bash
# Voir l'état complet
/host-direct --status

# Réinitialiser les circuit breakers
/host-direct --reset-circuit

# Réinitialiser les quotas
/quota reset

# Si toujours rien, vérifier les clés API
cat ~/.config/opencode/.groq-key
# La clé doit être sur une ligne, sans espaces
```

---

## 3. Problèmes Windows

### 3.1 Problème cp1252 (emojis dans les scripts)

**Symptômes** : Emojis ✅ ❌ ⚠️ s'affichent mal dans le terminal.

**Solution** : Tous les scripts Python forcent UTF-8 :
```python
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
```

Les emojis sont remplacés par des marqueurs :
- ✅ → `[OK]`
- ❌ → `[NO]`
- ⚠️ → `[ERR]`
- 🔄 → `[R]`

C'est déjà appliqué dans :
- `scripts/hash-direct.py`
- `scripts/view-audit-log.py`
- `scripts/myfree-eurinhash.py`

### 3.2 `opencode run` hang

**Voir la section 1.2** ci-dessus.

### 3.3 Permission denied sur certaines commandes

**Cause** : Le plugin `guard.ts` bloque les commandes sensibles.

**Solution** :
```bash
# Voir pourquoi c'est bloqué dans les logs
/au-dit-log --filter "blocked"

# Si c'est légitime, modifier guard.ts
# Ou lancer la commande sans le plugin
opencode run "ma commande"
```

### 3.4 Problèmes de chemin sous Windows

**Solution** : Utiliser des chemins absolus ou vérifier les permissions.
```bash
# Vérifier que les scripts sont exécutables
ls -la scripts/

# Utiliser python pour lancer
python scripts/hash-direct.py "test"
```

---

## 4. Problèmes de configuration

### 4.1 Fichier opencode.jsonc invalide

**Symptômes** : OpenCode ne démarre pas, erreurs de parsing.

**Solution** :
```bash
# Vérifier la syntaxe JSONC
# Utiliser un validateur JSON en ligne ou
python -c "import json; json.load(open('opencode.jsonc'))"

# Si invalide, restaurer la sauvegarde
mv opencode.json.bak opencode.jsonc

# Ou recréer à partir des fichiers agent/
```

### 4.2 Plugins qui ne chargent pas

**Symptômes** : Erreurs au démarrage, compétences introuvables.

**Solution** :
```bash
# Vérifier la configuration
cat ~/.config/opencode/opencode.jsonc | grep plugins

# S'assurer que les chemins sont corrects
# Pour les plugins locaux : "./plugin/nom-du-plugin.ts"
# Pour les npm : "@nom/du-plugin"

# Vérifier que les fichiers existent
ls ~/.config/opencode/plugin/
ls ~/.config/opencode/node_modules/
```

### 4.4 Clés API non reconnues

**Symptômes** : `/hash-direct --list-providers` montre `[NO]`.

**Solution** :
```bash
# Vérifier que les fichiers de clés existent
ls ~/.config/opencode/*.key

# Vérifier le contenu
cat ~/.config/opencode/.groq-key

# Recréer la clé si nécessaire (depuis votre gestionnaire de mots de passe)
```

### 4.5 Mémoire pleine ou état corrompu

**Solution** :
```bash
# Réinitialiser tout l'état
/host-direct --reset-quota
/host-direct --reset-circuit

# Supprimer les fichiers de cache
rm ~/.config/opencode/free-models.json
rm ~/.config/opencode/myfree-eurinhash-report.json

# Redémarrer OpenCode
opencode /run "test"
```

---

## 5. Dépannage avancé

### 5.1 Débogage du circuit breaker

```bash
# Voir l'état détaillé
/host-direct --status

# Voir le fichier circuit
cat ~/.config/opencode/provider_circuit.json

# Forcer le passage en CLOSED
# Modifier le fichier manuellement ou
/host-direct --reset-circuit
```

### 5.2 Débogage du quota

```bash
# Voir le fichier usage
cat ~/.config/opencode/provider_usage.json

# Compter les appels d'aujourd'hui
# Chaque appel incrémente le compteur

# Réinitialiser si nécessaire
/quota reset
# Puis réessayer
```

### 5.3 Débogage du fallback

```bash
# Voir l'ordre de fallback
# Code: groq → mistral → zhipu → openrouter → novita → together
# Chat: groq → zhipu → mistral → openrouter → novita → together

# Tester chaque provider manuellement
/host-direct --provider groq "test"
/host-direct --provider mistral "test"
/host-direct --provider zhipu "test"
```

### 5.4 Personnaliser les seuils

```bash
# Modifier les seuils dans hash-direct.py
FAILURE_THRESHOLD = 3    # Par défaut : 3 échecs pour OPEN le circuit
CIRCUIT_TIMEOUT = 60     # Par défaut : 60 secondes en OPEN

# Modifier les quotas
QUOTA_LIMITS = {
    "groq": 50, "mistral": 30, "google": 20, ...
}
```

### 5.5 Problèmes de réseau

```bash
# Vérifier la connectivité
ping api.groq.com
ping api.mistral.ai

# Vérifier les proxies
# S'assurer que les clés API sont correctes

# Tester directement avec curl
curl -H "Authorization: Bearer $(cat .groq-key)" \
  https://api.groq.com/openai/v1/models
```

---

## 6. Récupération d'urgence

### Scénario : Tout est cassé

```bash
# 1. Restaurer la configuration sauvegardée
mv ~/.config/opencode/opencode.json.bak ~/.config/opencode/opencode.jsonc

# 2. Supprimer les fichiers d'état problématiques
rm ~/.config/opencode/provider_circuit.json
rm ~/.config/opencode/provider_usage.json
rm ~/.config/opencode/free-models.json

# 3. Réinitialiser les quotas
# (Les compteurs seront recomptés au prochain appel)

# 4. Vérifier les clés API
ls ~/.config/opencode/*.key
# S'assurer qu'elles existent et sont valides

# 4. Tester le système
opencode /run "test"

# 5. Si ça marche, réintroduire les state files progressivement
```

### Scénario : Clés API perdues

```bash
# 1. Les clés sont dans .gitignore, donc pas dans le repo
# 2. Il faut les recréer manuellement

# 2. Contacter le support de chaque provider
# - Groq : console.groq.com
# - Mistral : console.mistral.ai
# - Google : aistudio.google.com
# - Zhipu : bigmodel.cn
# - OpenRouter : openrouter.ai
# - HuggingFace : huggingface.co/settings/api
# - Novita : novita.ai
# - Together : api.together.xyz

# 3. Recréer les fichiers
echo "votre-cle" > ~/.config/opencode/.groq-key
```

---

*Guide de dépannage généré le $(date)*
*Pour les problèmes persistants, ouvrir une issue sur GitHub : https://github.com/digitaleflex/opencode-config*