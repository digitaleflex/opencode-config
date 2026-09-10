# ROADMAP — EURINHASH Governance Engine

Detailed improvement plan following the v0.3.1 agentic hardening.
Ordering and dependencies are noted per item.

```
#1 reproductibilité ──┬─> #2 preuves réelles ──> #9 CI + golden
                      ├─> #3 confinement
                      ├─> #4 HMAC ──> #6 approbation
                      ├─> #5 état persistant
                      ├─> #7 MCP
                      ├─> #8 budget
                      ├─> #10 fuzzing
                      └─> #12 version
#11 fix chaos (indépendant, immédiat)
```

---

## Phase 1 — Fondations reproductibles & preuves réelles

### 1. Reproductibilité dev (package.json + lock) — ~1h
Clone neuf doit pouvoir `bun install && bun test && bun run typecheck`.
- Créer `package.json` versionné: `name`, `version`, `type: module`, `private`,
  `devDependencies` (@types/bun, @types/node, typescript), scripts
  (`test`, `typecheck`, `chaos`, `test:golden`, `verify`).
- `.gitignore`: retirer `package.json` et `bun.lock`.
- `bun install` → committer `bun.lock`; retirer `package-lock.json` orphelin.
- Acceptation: `git clean -xdf && bun install && bun run verify` OK.

### 2. Preuves réelles (fin des placeholders) — ~1–2j · dép. #1
L2+ approuvable uniquement avec preuves vérifiables.
- `types.ts`: `Proof` + `evidenceHash`/`signature`/`source`; `EvidenceBundle`
  (testResult, reviewHash, scanReport, approvalToken).
- `proof-verifier.ts`: `generateProofChain(task, policy, evidence)`; statut
  dérivé des preuves; `verifyProofChain` vérifie hash/signature; remplacer
  `isPlaceholderEvidence()` par `isEvidenceAuthentic()`.
- `orchestrator.ts`: `execute(task, evidence?)`; preuve manquante → BLOCKED.
- Acceptation: L2 `failed=0` → APPROVED; `failed>0`/absent → BLOCKED; plus de
  chaîne `"Test suite executed for:"`.

### 3. Confinement filesystem & egress — ~2j · dép. #1
- `confinement.ts`: `WorkspaceGuard.resolve()` (path.resolve + realpath +
  startsWith(root), refus symlinks sortants, `..`, absolus hors root);
  `checkEgress()` (curl/wget/nc/ssh/scp + allowlist `policies/egress.yaml`).
- `guard-overrides.ts`: overrides `PATH_ESCAPE`, `EGRESS_DENIED`.
- `orchestrator.ts`: injecter `workspaceRoot`.
- Acceptation: `../../etc/passwd`, `/etc/shadow`, symlink sortant, `curl evil`
  → BLOCKED.

---

## Phase 2 — Intégrité cryptographique & état

### 4. HMAC sur la chaîne d'audit — ~1j · dép. #1
- `merkle-audit.ts`: clé HMAC-SHA256 optionnelle (leaves + noeuds internes),
  `verifyChain(key)`; `exportHead()` externe + détection de troncature.
- Clé via `EURINHASH_AUDIT_KEY` ou `.morph-key`.
- Acceptation: altération 1 octet → false; troncature détectée par ancre.

### 5. État persistant (anomaly/drift/FSM) — ~1j · dép. #1
- `state-store.ts`: `load/save` JSON atomique sous `logs/state/`.
- `serialize()/restore()` sur `AnomalyDetector`, `DriftDetector`, `BehavioralFSM`.
- Orchestrateur: charge au constructeur, sauve (debounced) après execute.
- Acceptation: détection identique après redémarrage.

### 6. Supervision humaine Art.14 (token signé) — ~1–2j · dép. #4
- `types.ts`: `ApprovalToken { taskId; approver; scope; issuedAt; expiresAt;
  nonce; sig }`; `approval.ts`: `issue/verify` (HMAC #4), anti-rejeu.
- `orchestrator.hasHumanApproval()`: vérifie le token, plus la string.
- `standards-mapping.ts`: mapper sur EU AI Act Art.14.
- Acceptation: token valide → APPROVED; expiré/rejoué/scope≠ → BLOCKED.

---

## Phase 3 — Surface d'attaque agentique

### 7. MCP governance (tool poisoning / rug-pull) — ~2j · dép. #1
- `mcp-governance.ts`: `registerManifest(server, tools)`,
  `verifyManifest()` (tools ajoutés/supprimés, description modifiée, non signé).
- `policies/mcp-trust.yaml`; étape `mcp-scan` dans l'orchestrateur.
- Acceptation: description modifiée → BLOCKED; tool inconnu → WARN.

### 8. Bornes de coût / anti-DoS guardrail — ~1j · dép. #1
- `budget.ts`: `TaskBudget { maxMs; maxToolCalls; maxTokens }`, `spend()`,
  `exhausted()`; timeout dur par évaluation guard (50ms).
- Orchestrateur: blocage traçable sur dépassement.
- Acceptation: dépassement → BLOCKED.

---

## Phase 4 — Qualité & anti-régression

### 9. CI + corpus d'attaques golden — ~1j · dép. #1, #2
- `.github/workflows/ci.yml`: setup-bun, `bun install --frozen-lockfile`,
  `typecheck`, `test`, `chaos`, `test:golden`.
- `tests/fixtures/attacks.jsonl`: attendus `BLOCKED` (rm, `$IFS`, homoglyphes,
  unicode tags, path traversal, egress, injections).
- `scripts/verify-golden.ts`: exit 1 si un cas n'est plus bloqué; gate p95.
- Acceptation: CI rouge sur régression de blocage ou de perf.

### 10. Fuzzing canonicalizer + normalizer — ~1–2j · dép. #1
- `fast-check` (devDep); `tests/fuzz/*.fuzz.test.ts`.
- Propriété: toute mutation destructive reste BLOCKED; classification préservée.
- Acceptation: 0 contre-exemple sur 10k cas; figer les fails en tests.

### 11. Fix harness chaos (faux positif CHAOS-17) — ~30min
- `chaos-lab.ts`: `unsafe` basé sur `isDangerous(t)` au lieu de tout
  `L1:APPROVED`.
- Acceptation: `unsafeExecutionScenarios: 0`.

### 12. Version unique — ~30min · dép. #1
- `src/core/version.ts`: `export const VERSION`; `getSummary()` l'utilise.
- (Option) `scripts/check-version.ts` compare au CHANGELOG.
- Acceptation: une seule définition, testée.
