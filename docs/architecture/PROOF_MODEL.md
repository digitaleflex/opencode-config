# EURINHASH Proof Model

> `DONE ≠ CODE GENERATED`. Une tâche est terminée quand les preuves attestent que le livrable est correct, sécurisé, et prêt.
> Reference: `docs/09-security.md`, `AGENTS.md` (verification-before-completion), `docs/architecture/GOVERNANCE_MODEL.md`.

---

## 1. Principe fondamental

```
DONE  ⟺  CODE_GENERATED  ∧  PROOFS_VALIDATED  ∧  RISK_ASSESSED
```

| Ce qui n'est PAS une preuve | Pourquoi |
|---|---|
| "Le code compile" seul | Le compilateur ne vérifie ni la logique ni la sécurité |
| "L'IA a dit que c'est correct" | Auto-évaluation biaisée |
| "Le fichier existe" | Pas de vérification fonctionnelle |
| "Ça a marché une fois" | Non-reproductible |

| Ce qui EST une preuve | Garantie |
|---|---|
| Test unitaire vert | Logique fonctionnelle vérifiée |
| Test d'intégration vert | Interactions inter-modules vérifiées |
| Scan sécurité clean | Pas de vulnérabilités connues |
| Revue humaine signée | Jugement expert documenté |
| Build passant (lint + compile) | Artefact déployable |

---

## 2. Taxonomie des preuves

### 2.1 Tests automatisés

| Type | Couverture | Outil suggéré | Intégration EURINHASH |
|---|---|---|---|
| **Unitaires** | Fonction / classe isolée | `pytest`, `vitest`, `jest` | `logs/proofs/<id>/unit-tests.json` |
| **Intégration** | Module ↔ module, API | `pytest + httpx`, `supertest` | `logs/proofs/<id>/integration-tests.json` |
| **E2E** | Flux complet utilisateur | `playwright`, `cypress` | `logs/proofs/<id>/e2e-tests.json` |
| **Propriété** (property-based) | Invariants logiques | `hypothesis`, `fast-check` | `logs/proofs/<id>/property-tests.json` |

**Critère de succès** : 100 % des tests GREEN ; 0 skipped ; 0 timeout.

### 2.2 Code Review

| Type | Automatique | Exige humain | Critère |
|---|---|---|---|
| **Linting** | ✅ always | ❌ | `ruff clean` / `eslint --max-warnings 0` |
| **Format** | ✅ always | ❌ | `ruff format` / `prettier --check` |
| **Type check** | ✅ always | ❌ | `ruff check --type-check` / `tsc --noEmit` |
| **Static analysis** | ✅ | ❌ | `bandit`, `semgrep` (règles custom) |
| **Revue humaine** | ❌ | ✅ | Approbation signée dans `logs/reviews/<id>.json` |

**Critère humain** : au moins 1 reviewer humain (auteur ≠ reviewer) pour L3+.

### 2.3 Security Scan

Implémente et étend `docs/09-security.md`.

| Scan | Outil | Ce qu'il vérifie | Seuil critique |
|---|---|---|---|
| **Secrets** | `git-secrets`, `trufflehog`, `semgrep-rules/secrets` | Clés API, tokens, passwords en clair | 0 hallazgos |
| **Vulnérabilités** | `pip-audit`, `npm audit`, `snyk`, `grype` | CVE connues dans dépendances | 0 critiques |
| **Dependencies** | `pip-compile --dry-run`, `npm outdated` | Versions obsolètes | 0 critiques |
| **Injection** | `semgrep-rules/Injection` | SQLi, XSS, command injection | 0 hallazgos high+ |
| **SAST custom** | Règles `guard.ts` (patterns destructeurs) | Opérations sensibles | 0 bloque |

### 2.4 Human Approval

| Niveau | Qui | Quand | Où |
|---|---|---|---|
| L3 | Reviewer humain assigné | Post-revue + pre-build | `logs/approvals/<id>.json` |
| L4 | Architect + Security + Owner | Pre-exécution (gating) | `logs/approvals/<id>.json` + confirmation interactive |

**Structure d'approbation** :
```json
{
  "task_id": "...",
  "approver": "user@domain.com",
  "role": "architect|security|owner",
  "timestamp": "2026-09-06T12:00:00Z",
  "decision": "approved|rejected|conditional",
  "conditions": ["réaliser le rollback avant merger"],
  "signature": "hmac-sha256(approver, task_id, decision)"
}
```

### 2.5 Build Verification

| Étape | Commande | Critère |
|---|---|---|
| **Compilation** | `tsc --noEmit`, `python -m py_compile`, `go build` | 0 erreurs |
| **Lint** | `ruff check .`, `eslint .`, `golangci-lint run` | 0 erreurs, 0 warnings critiques |
| **Format check** | `ruff format --check`, `prettier --check` | 0 différences |
| **Bundle size** (si applicable) | `du -sh dist/`, seuils custom | ≤ seuil défini |
| **SBOM** (L4) | `syft . -o json`, `cyclonedx` | Généré et archivé |

---

## 3. Niveaux de preuve par complexité

Le Policy Engine sélectionne les preuves requises selon la complexité.

| Complexity | Preuves requises | Humain | Sécurité | Règle additionnelle |
|---|---|---|---|---|
| **L1** | 1 minimum | jamais | scan guard.ts (patterns destructeurs) | Si scan guard → passer à L2 minimum |
| **L2** | 2 minimum | optionnel (si HIGH) | — | Tests unitaires + build |
| **L3** | 3 minimum | **obligatoire** | scan sécurité | Tests + revue auto + revue humaine |
| **L4** | 4 minimum | **obligatoire** | scan sécurité complet (secrets + vuln + SAST) | Tests + 2 revues (auto + humain) + scan + build |

### 3.1 Grille de sélection (Policy Engine)

```
SI complexity = L1:
  → [1] depuis {unit-test, build-check, guard-scan}
  → Si guard-detected → escalate(L2)

SI complexity = L2:
  → [2] depuis {unit-test, integration-test, lint, format, guard-scan}
  → Au moins 1 test

SI complexity = L3:
  → [3] dont {human-review} obligatoire
  → Sécurité requise si task_type ∈ {SECURITY, SENSITIVE_DATA, API_CHANGE}

SI complexity = L4:
  → [4] dont {human-review, security-scan-full}
  → Security scan = {secrets, vuln, dependencies, injection, SAST}
  → SBOM généré et archivé
```

---

## 4. Chaîne de preuve (Proof Chain)

Chaque preuve est signée et horodatée dans la chaîne d'audit.

```
logs/
  proofs/
    <task_id>/
      00-unit-tests.json          # résultats jq
      01-integration-tests.json
      02-lint.json
      03-security-scan.json       # secrets + vuln
      04-human-review.json        # approbation signée
      05-build.json               # compile + lint + format
      _chain.json                 # hash SHA-256 de chaque fichier dans l'ordre
  audit/
    <YYYY-MM-DD>.jsonl            # tous les événements
```

### 4.1 Intégrité de chaîne

`_chain.json` référence chaque preuve :
```json
{
  "task_id": "...",
  "created": "2026-09-06T12:00:00Z",
  "proofs": [
    {"seq": 0, "file": "00-unit-tests.json", "hash": "sha256:abc..."},
    {"seq": 1, "file": "01-integration-tests.json", "hash": "sha256:def..."}
  ],
  "chain_hash": "sha256:chain_of_all"
}
```

Un `task_id` n'est marqué `DONE` que si tous les `hash` correspondent aux fichiers et si le `chain_hash` est intègre.

---

## 5. Échec de preuve (Proof Failure)

| Scénario | Action |
|---|---|
| Test unitaire rouge | `@builder` corrige ; itération jusqu'à GREEN |
| Scan sécurité alerte | `@security` évalue ; `guard.ts` ou reject |
| Revue humaine reject | Retour à `@planner` ; nouvelle itération |
| Build échoue | `@builder` corrige ; pas de merge possible |
| Humain absent (L3/L4) | **Pipeline bloqué** ; notification ; escalation |

Le Proof Verifier génère un `ProofReport` :
```json
{
  "task_id": "...",
  "timestamp": "...",
  "status": "PASS|FAIL|BLOCKED",
  "passed": ["unit-tests", "lint"],
  "failed": [],
  "blocked": ["human-review"],
  "blocker_reason": "Aucun reviewer assigné pour L3"
}
```

---

## 6. Éthique et exceptions

### 6.1假阳性 (False positives)
- Scan sécurité peut générer des faux positifs (ex: `dummy_api_key` dans un test).
- `@security` est seul habilité à marquer un hallazgo comme `IGNORED` avec justification documentée.

### 6.2 Waiver (dérogation)
- Une dérogation L2→L1 est possible uniquement si :
  - `task_type` = `DOC_READ` ou `CONFIG`
  - `@architect` signe le waiver dans `logs/waivers/<id>.json`
  - Le waiver est limité dans le temps (max 7 jours).

### 6.3 Cas d'urgence
- Hotfix production : le pipeline L4 peut être réduit à L3 sous réserve que :
  - `@architect` + `@security` cosignent l'urgence
  - Les preuves L3 sont générées en post-déploiement (P0)
  - L'approbation humaine reste obligatoire.
