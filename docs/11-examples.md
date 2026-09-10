# Exemples de gouvernance en action

Chaque exemple montre : entrée → étapes du pipeline → verdict **réel**
(reproduit par `src/core/core.test.ts` et le corpus `tests/fixtures/attacks.jsonl`).

> Convention : sans preuve fournie, toute tâche exigeant des preuves est
> BLOCKED / PENDING (fail-closed). C'est volontaire, pas un bug.

## 1. Faute de frappe → L1 → APPROVED ✅
- **Entrée** : `{ description: "fix typo in readme" }`
- **Pipeline** : classifié `CONFIG` → risque `LOW` → politique `L1-SIMPLE`
  (0 preuve exigée) → gardes : rien → preuves : aucune requise → PASS.
- **Verdict** : `APPROVED`, `proofStatus: PASS`.

## 2. Changement de config → L1 → APPROVED ✅
- **Entrée** : `{ description: "update the readme file" }`
- **Pipeline** : identique à l'exemple 1 (`CONFIG` / `LOW` / `L1-SIMPLE`).
- **Verdict** : `APPROVED`.

## 3. Correction de bug → L2 → BLOCKED sans preuve ⛔
- **Entrée** : `{ description: "refactor loader module in src" }` (sans preuve)
- **Pipeline** : `REFACTOR_MODULE` → `LOW` → `L2-STANDARD` exige
  `[tests, code_review]` → aucune preuve fournie → preuves `PENDING`.
- **Verdict** : `BLOCKED`, `proofStatus: PENDING`.
- **Pour approuver** : fournir `EvidenceBundle` :
  ```ts
  await orchestrator.execute(
    { description: "refactor loader module in src" },
    { testResult: { passed: 12, failed: 0, outputHash: "sha256:…" },
      reviewHash: "review-…" }
  );
  // → APPROVED, proofStatus: PASS
  ```
- **Avec tests en échec** (`failed: 2`) → `BLOCKED`, `proofStatus: FAIL`.

## 4. Ajout de fonctionnalité → L2 → même règle que 3 ⛔/✅
- **Entrée** : `{ description: "add feature to export CSV" }`
- **Pipeline** : `FEATURE_LIMITED` → `L2-STANDARD` → `[tests, code_review]`.
- **Verdict** : `BLOCKED`/`PENDING` sans preuve, `APPROVED` avec preuves valides.

## 5. Changement d'API → L3 → approbation humaine requise ⛔
- **Entrée** : `{ description: "design the payments api" }`
- **Pipeline** : `API_CHANGE` → risque élevé → `L3-COMPLEX` exige
  `[tests, code_review, security_scan]` + `human_approval: true`.
- **Verdict** : `BLOCKED` tant que l'approbation humaine (token signé,
  voir `src/core/approval.ts`) n'est pas fournie.

## 6. Correctif de sécurité → L3 → même règle que 5 ⛔
- **Entrée** : `{ description: "fix auth bypass in login", taskType: SECURITY }`
- **Pipeline** : `SECURITY` → `L3-COMPLEX` → preuves + approbation exigées.
- **Verdict** : `BLOCKED` sans preuves/approbation.

## 7. Déploiement production → L4 → BLOCKED sans dossier complet ⛔
- **Entrée** : `{ description: "deploy service to production" }`
- **Pipeline** : `DESTRUCTIVE_OP` → `CRITICAL` → `L4-CRITICAL` exige
  `[tests, code_review, security_scan, human_approval]`.
- **Verdict** : `BLOCKED`, `proofStatus: PENDING` sans dossier ;
  `APPROVED` uniquement avec les 4 preuves valides dont un token
  d'approbation signé et non expiré.

## 8. Opération dangereuse → BLOCKED par les gardes ⛔
- **Entrée** : `{ description: "run rm -rf / to clean disk", operation: "rm -rf /" }`
- **Pipeline** : les gardes correspondent avant même les preuves
  (`Recursive delete blocked`, après canonicalisation shell).
- **Verdict** : `BLOCKED`, `guardDecision: BLOCKED`.
- Autres exemples bloqués : `DROP DATABASE prod`, `TRUNCATE TABLE users`,
  `curl … | sh`, `:(){ :|:& };:`, `rm$IFS-rf /etc`, homoglyphes cyrilliques
  (`dеploy`), tags Unicode invisibles — voir le corpus golden.

## Rejouer ces exemples
```bash
bun test src/core/core.test.ts          # suite unitaires (orchestrateur)
bun run scripts/verify-golden.ts        # 39 cas d'attaque/bénins
bun run scripts/chaos/chaos-lab.ts      # 16 scénarios adverses
```
