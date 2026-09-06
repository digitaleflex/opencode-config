# Documentation des Agents — opencode-config EURINHASH

## Table des matières
1. [eurinhash.md](#eurinhashmd)
2. [planner.md](#plannermd)
3. [architect.md](#architectmd)
4. [design-lead.md](#design-leadmd)
5. [builder.md](#buildermd)
6. [quality-engineer.md](#quality-engineermd)
7. [tester.md](#testermd)
8. [security.md](#securitymd)
9. [reviewer.md](#reviewermd)
10. [git-engineer.md](#git-engineermd)
11. [docwriter.md](#docwritermd)
12. [Workers (fallback)](#workers-fallback)
13. [Routing matrix (hash-agent-matrix)](#routing-matrix)

---

## 1. eurinhash.md — Superviseur

### Rôle
Superviseur EURINHASH principal. Gère la rotation des providers, le quota tracking, le circuit breaker, et décide quel agent/provider utiliser selon le type de tâche.

### Modèle
- `groq/qwen/qwen3.8-27b` (via Groq API)

### Protocol EURINHASH (6 étapes)

**Étape 1 — Probe** : Lire `free-models.json`. Si >30min ou fichier absent → lancer `python scripts/free-probe.py`.

**Étape 2 — Pick** : Définir l'ordre de fallback :
- Tâche **code** : `groq → mistral → zhipu → openrouter → novita → together`
- Tâche **chat** : `groq → zhipu → mistral → openrouter → novita → together`
- Tâche **autre** : Définir par défaut

**Étape 3 — Delegate** : Envoyer la tâche complète + contexte au 1er worker disponible. Inclure :
- Prompt complet
- Type de tâche
- Modèle cible
- Options (max_tokens, temperature)

**Étape 4 — Rotate** : Si 429/quota/auth/timeout :
- Marquer provider KO dans `provider_circuit.json`
- Passer au provider suivant
- Réessayer avec le même prompt

**Étape 5 — Stop** : Si tous les providers KO :
- Résumer ce qui est fait / ce qui bloque
- Proposer fallback payant (Mammouth)
- Demander validation explicite

**Étape 6 — No Paid** : Jamais de modèle payant sans accord explicite

### Invocation

```bash
# Via le TUI OpenCode
/agent eurinhash "Gère ma session"

# Via le prompt
@eurinhash Gère ma session : ...
```

### Logique de décision
```python
# Pseudocode
def select_provider(task_type):
    order = {
        "code": ["groq", "mistral", "zhipu", "openrouter", "novita", "together"],
        "chat": ["groq", "zhipu", "mistral", "openrouter", "novita", "together"],
    }.get(task_type, ["groq", "zhipu", "mistral", "openrouter", "novita", "together"])
    
    for provider in order:
        if load_key(provider) and check_circuit(provider) and check_quota(provider, model):
            return provider
    
    # Aucun provider disponible
    return None
```

---

## 2. planner.md — Planification

### Modèle
- `groq/qwen/qwen3.8-27b`

### Rôle
Planifie les tâches complexes avant l'exécution. Décide du périmètre, des dépendances, et créé un plan structuré.

### Quand invoquer
- Tâche nécessitant 3+ fichiers modifiés
- Feature new avec plusieurs dépendances
- Refactorisation multi-modules
- Architecture décision à prendre

### Structure du plan
```markdown
## Plan de tâche

### Objectif
Décrire ce qu'on veut accomplir.

### Périmètre
- Fichiers à modifier : ...
- Fichiers à créer : ...
- Fichiers à supprimer : ...

### Étapes
1. Première étape : ...
2. Deuxième étape : ...
3. Troisième étape : ...

### Dépendances
- Module A nécessite Module B
- Nécessite npm install avant

### Risques
- Risque 1 : ...
- Risque 2 : ...

### Validation
- Critère de réussite : ...
- Tests à exécuter : ...
```

### Invocation
```bash
/agent planner "Planifie le refactoring du module auth"
```

---

## 3. architect.md — Architecture

### Modèle
- `groq/qwen/qwen3.8-27b`

### Rôle
Prend les décisions architecturales à long terme. Trade-offs performance/maintenabilité, scalabilité, sécurité.

### Domaines de décision
- Choix des librairies/frameworks
- Patterns architecturaux (MVCC, CQRS, Event Sourcing)
- Scalabilité horizontale vs verticale
- Base de données relationnelle vs NoSQL
- Architecture microservices vs monolithique

### Quand invoquer
- Nouveau projet ou nouveau module majeur
- Migration d'infrastructure
- Passage d'une architecture à une autre
- Problèmes de performance persistants

### Invocation
```bash
/agent architect "Décide de l'architecture pour un SaaS de gestion de tâches"
```

---

## 4. design-lead.md — Design Lead

### Modèle
- `groq/qwen/qwen3.8-27b`

### Rôle
Direction UI/UX. Définit le style visuel, les interactions, la cohérence du design system.

### Responsabilités
- Layout, hiérarchie, espacement
- Typographie, couleurs, composants
- Responsive behavior, animations/micro-interactions
- Accessibilité (WCAG), couleurs contrastées
- Tone et copywriting (stratégie, l'agent ne fait pas le copy final)

### Domaines
- Layout & spacing (grille, marge, paddding)
- Typography (police, taille, poids)
- Color system (palette, contrast WCAG)
- Components (boutons, formulaires, navigation)
- Interactions (hover, focus, animations)
- Responsive (breakpoints, layout mobile)
- Design tokens (tokens de conception centralisés)

### Quand invoquer
- Nouveau composant UI
- Refonte de page
- Problème d'accessibilité
- Cohérence visuelle à rétablir

### Invocation
```bash
/agent design-lead "Refonte du formulaire de connexion avec meilleur UX et accessibilité"
```

---

## 5. builder.md — Builder

### Modèle
- `mistral/codestral-latest` (via Mistral API)

### Rôle
Exécution de code concrète. Implémentation front-end et back-end, création de composants, modification de fonctionnalités existantes.

### Forces
- Implémentation rapide de features bien définies
- Multi-fichiers en parallèle
- Respect strict des specs existantes
- Conversion de designs en code

### Limites
- Design taste (non : préfère @designer)
- Architecture decisions (non : architecte)
- Goûts visuels (non : design-lead)
- Comprendre l'intention utilisateur (parfois)

### Quand invoquer
- Feature claire et bornée
- Bug précis et reproductible
- Migration de données structurée
- Portage d'API

### Quand ne pas invoquer
- Besoin de design taste
- Décisions architecturales
- Problèmes abstraits
- Spécifications floues

### Invocation
```bash
/builder "Implémente la fonction getUser avec gestion d'erreur"
# Ou via le prompt
@builder Implémente la fonction getUser avec gestion d'erreur
```

### Structure du code attendu
```typescript
// builder s'attend à ce que le code soit :
/**
 * Description de la fonction
 * @param {Type} param - Description
 * @returns {Type} - Description du retour
 * @throws {Error} - Conditions d'erreur
 *
 * Exemple :
 * const result = getUser(123);
 * console.log(result); // { id: 123, name: "Jean" }
 */
function getUser(id: number): User {
  // implémentation
}
```

---

## 6. quality-engineer.md — Quality Engineer

### Modèle
- `mistral/codestral-latest`

### Rôle
Qualité du code. Linting, formatting, anti-patterns, best practices.

### Outils
- Ruff (Python) / eslint (JS/TS)
- Prettier (formatage)
- SonarLint / CodeQL
- Tests unitaires

### Responsabilités
- `ruff --check` propre
- `ruff --fix` appliqué
- Aucun bare `except`
- Type hints partout
- SQL paramétrées uniquement
- Virtualenv par projet

### Quand invoquer
- Avant chaque commit
- Pull request opening
- Découverte de nouveau code
- Refactoring terminé

### Invocation
```bash
/quality-engineer "Vérifie la qualité de ce code"
# Ou
@quality-engineer Analyse ce fichier pour les anti-patterns
```

---

## 7. tester.md — Tester

### Modèle
- `mistral/codestral-latest`

### Rôle
Tests automatisés. Tests unitaires, d'intégration, e2e.

### Responsabilités
- Coverage ≥ 80%
- Pas de test cassant
- Tests significatifs (pas juste "hello world")
- Fiabilité des tests

### Quand invoquer
- Nouveau code ajouté
- Bug fix
- Refactoring
- Avant chaque release

### Invocation
```bash
/tester "Écrit les tests pour la fonction calculate_total"
```

---

## 8. security.md — Security

### Modèle
- `mistral/codestral-latest`

### Rôle
Analyse sécurité. OWASP Top 10, vulnérabilités, audit.

### Domaines
- Injection (SQL, NoSQL, OS, Command injection)
- Authentification, Authorization
- Secrets, clés API dans le code
- XSS, CSRF
- Rate limiting
- Secrets exposure
- Sensitive data handling

### Quand invoquer
- Code handling des données sensibles
- Authentification implémentée
- Déploiement en production
- Découverte de vulnérabilité

### Invocation
```bash
/security "Analyse les risques de sécurité de ce code"
```

---

## 9. reviewer.md — Reviewer

### Modèle
- `mistral/codestral-latest`

### Rôle
Revue de code. Architecture, qualité, best practices, sécurité.

### Quand invoquer
- Pull request opening
- Code review pair
- Découverte de nouveau code

### Invocation
```bash
/review "Review this PR : ..." 
# Ou
@reviewer Review this code
```

---

## 10. git-engineer.md — Git Engineer

### Modèle
- `mistral/codestral-latest`

### Rôle
Git operations. Commits, branches, merges, history.

### Responsabilités
- Conventional Commits
- Branch strategy (gitflow/maintenance)
- Merge conflict resolution
- Git history cleanup
- Tagging releases

### Quand invoquer
- New feature commit
- Branch creation/merging
- History cleanup
- Release tagging

### Invocation
```bash
/git-engineer "Commit le refactoring avec message conventionnel"
```

---

## 11. docwriter.md — Doc Writer

### Modèle
- `groq/qwen/qwen3.8-27b`

### Rôle
Documentation technique. README, API docs, guides.

### Quand invoquer
- Nouveau projet
- API changée
- Guide utilisateur nécessaire

### Invocation
```bash
/docwriter "Écrit la README pour ce projet"
```

---

## 12. Workers (fallback)

### worker-codestral.md
- `mistral/codestral-latest`
- Fallback Mistral

### worker-google.md
- `google/gemini-2.5-flash`
- Fallback Google

### worker-groq.md
- `groq/qwen/qwen3.8-27b`
- Fallback Groq

### worker-zhipu.md
- `zhipu/glm-4.7-flash`
- Fallback Zhipu (attention : souvent 429)

---

## 13. Routing matrix (hash-agent-matrix)

### Niveaux
| Niveau | Description | Exemple |
|--------|-------------|---------|
| L1 | Typo, color, config, bug localisé | "Corrige la couleur rouge en bleu" |
| L2 | Module, endpoint, business logic | "Ajoute l'Authentification OAuth" |
| L3 | Nouveau module, architecture, API change | "Refactor le système complet en microservices" |
| L4 | Critique : production, données sensibles | "Migration de données clients vers nouvelle BD" |

### Pipeline par niveau
- L1 → `@builder` (direct)
- L2 → `@planner` → `@builder`
- L3 → `@planner` → `@architect` → `user approval` → `@builder` → `@reviewer`
- L4 → `@planner` → `@architect` → `risk assessment` → `user approval` → `@builder` → `@reviewer`

### Routage automatique
```bash
# L1 : Directement vers builder
opencode /run "Corrige la typo dans le bouton"

# L2 : Planification d'abord
/agent planner "Planifie l'ajout auth"
/agent builder "Implémente l'auth"

# L3 : Architecture + approval
/agent architect "Décide de l'architecture"
# Après approval :
/agent builder "Implémente selon l'architecture"
```

---

*Documentation agents générée le $(date)*