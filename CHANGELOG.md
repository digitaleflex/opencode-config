# CHANGELOG — EURINHASH Governance Engine

## [0.10.0] - 2026-09-10 — Modes FREE / PRO : jamais bloqué, jamais de surprise

### 🔀 Modes explicites (jamais bloqué, jamais de surprise)
- **`policies/models.json`** : registre des coûts par worker
  (`free` / `trial` / `paid`) ; **`src/core/mode.ts`** : résolution
  `EURINHASH_MODE` > `mode.json` > `free` (défaut fail-closed), `saveMode`,
  `filterModelPlan`, registre embarqué de secours.
- **Enforcement** : `evaluatePolicy(task, mode)` filtre le plan sur les
  workers autorisés ; plan vide → `BLOCKED`. Le `modelPlan` retourné ne
  contient que des workers autorisés ; le mode est tracé dans l'audit Merkle.
- **Interface** : widget `mode` (FREE vert / PRO orange), `/quota` affiche
  le mode + dépense vs plafond (alertes 70/90%), commande `/mode` (bascule
  PRO uniquement sur confirmation forte + plafond).
- **Correctifs trouvés en route** : le loader YAML ne parsait pas le
  `model_plan` imbriqué (plans `undefined`) et lisait la mauvaise casse —
  `default.yaml` charge désormais avec des plans fonctionnels.

## [0.9.0] - 2026-09-10 — Pilotage visuel : burn temps réel, garde-contexte auto

### 🔥 Widgets temps réel (statusline)
- **`burn`** : tokens cumulés de la session + débit (tokens/min), calculé à
  chaque message assistant — la consommation en direct pendant le travail.
- **`context-guard`** : vert < 60%, orange ≥ 60% (`→ bientôt /compact`),
  rouge ≥ 80% (`→ /compact ou /new`). Couleurs automatiques selon l'état.
- **Toast unique anti-spam** à 60% puis 80% de contexte avec l'action
  recommandée en langage clair ; réarmé après compaction/nouvelle session,
  max 1 par palier toutes les 10 min.

### 🧭 Layout informatif par défaut (5 lignes)
Modèle + conseil, barre contexte, santé + routage (10 workers, actif
surligné via mapping provider→worker corrigé) + risque, coût + quota +
budget, burn + garde. Miroir `tui.json` aligné ; personnalisable au clic
via `/statusline` (presets dont EURINHASH, profils, FR/EN/中文).

### 🧪 Validation
- `tsc` clean (zéro nouvelle erreur vs baseline) ; 133 + 12 tests OK ;
  `tui.json` valide ; dashboard testé sur fixtures.

## [0.8.0] - 2026-09-10 — Interface lisible : conseil live, dashboard clair, couleurs d'état

### 🔭 Statusline informative (widgets dormants activés)
- Le plugin statusline savait déjà tout faire (santé providers, chaîne de
  routage, risque, quotas, budget) mais n'affichait que modèle/tokens/coût.
  Le layout par défaut (`tui.json` + `DEFAULT_CONFIG`) montre maintenant :
  modèle + **conseil** + tokens + contexte, barre contexte, santé + routage
  + risque, coût + quota + budget + branche.
- **Nouveau widget `advisor`** : lit `free-models.json` toutes les 2s et
  affiche le worker recommandé (`⇒ groq` vert, `⇄ attente` jaune,
  `✕ quota` rouge) — le conseil de bascule en temps réel, dans l'interface.
- Chaîne de routage complète (10 workers) avec vrai surlignage du worker
  actif (mapping provider → worker corrigé) ; circuit étendu aux 16 providers.

### 💬 Dashboard non-technique + conseil (`quota.py`, `/quota`)
- Réécrit en français courant avec couleurs : argent dépensé (« 0,00 $
  dépensé — tout est passé par du gratuit »), état de chaque worker en
  phrase simple (disponible / en pause quota / en panne / jamais testé),
  et **« 👉 Utilise X en ce moment »** avec secours.
- Zéro coût, lecture seule ; avertit quand le cache dépasse 30 min.

### 🎨 Couleurs
- Sémantique verte/orange/rouge sur conseil, risque, quotas, budget,
  contexte — via les rôles du thème, donc compatibles avec n'importe quel
  thème. Thème de base conservé : `tokyonight` (seule valeur vérifiée du
  schéma ; le choisir via `/themes` dans le TUI pour changer).

## [0.7.0] - 2026-09-10 — Borrowed strengths: redaction, static rules, semantic judge

### 🤫 Secret redaction (pattern Microsoft AGT, 100% local)
- **`secret-redactor.ts`**: AWS, GitHub PAT, OpenAI/Anthropic/Stripe/Slack,
  JWT, PEM, Azure, credential générique + `redactDeep()` pour objets JSON
- **Logs jamais contaminés**: `MerkleAuditTrail.record()` et `logAuditEntry()`
  redactent AVANT hachage/persistance (occurrence tracée, valeur jamais
  stockée) ; la vérification de chaîne reste cohérente car le hash porte sur
  le contenu redacté
- **`plugin/guard.ts`**: hook `tool.execute.after` qui redacte les sorties
  d'outils avant que le modèle les voie

### 🔍 Static rules (esprit red-orbita, sans Semgrep)
- **`static-rules.ts`**: ~25 règles (shell-exec, python-exec, js-exec,
  deserialization, secrets-in-code, crypto-mining, network-exfil) + règles
  custom via `policies/static-rules.json`
- Nouveau stage pipeline après les gardes : findings critical/high → BLOCKED,
  tracés dans le détail Merkle

### 🧠 Semantic judge (sans modèle)
- **`semantic-judge.ts`**: score l'intention de hijack par signaux
  linguistiques (override, persona, scope-shift, cadrage hypothétique, faux
  dialogue, densité impérative) ; BLOCK ≥ 0.7, WARN ≥ 0.4
- Attrape des formulations inédites que les regex ratent (vérifié : 4/4
  BLOCK, bénins à 0–0.25) ; `JudgeProvider`/`NoopJudgeProvider` prêts pour
  brancher un juge modèle free-tier plus tard (4e arg de `execute()`)

### 🧪 Validation
- 133 unit + 12 fuzz, 0 échec ; `tsc` clean ; golden 39/39 (6 nouveaux cas) ;
  chaos 16/0/0

## [0.6.0] - 2026-09-10 — Confinement, persistence, approvals, MCP, budgets, fuzzing

### 🛡️ Workspace confinement + egress (#3)
- **`WorkspaceGuard`** (`src/core/confinement.ts`): resolve + realpath confinement
  against a workspace root — blocks `..`, absolute paths outside root, Windows
  absolutes and symlink escapes
- **`checkEgress`**: parses curl/wget/ssh/scp/URL invocations; **default deny**
  when `policies/egress.yaml` is missing or its allowlist is empty (fail-closed)
- **GuardOverrides** now blocks path traversal, sensitive system paths
  (`/etc`, `/root`, `/proc`, …) and non-allowlisted egress at regex level

### 💾 Persistent detection state (#5)
- **`StateStore`** (`src/core/state-store.ts`): atomic JSON persistence
  (tmp + rename)
- `AnomalyDetector`, `DriftDetector`, `BehavioralFSM` gain `serialize()` /
  `restore()` / `deserialize()`; orchestrator persistence is **opt-in** via a
  `StateStore` constructor argument so behavior stays hermetic by default

### ✍️ Signed human-approval tokens (#6 / EU AI Act Art.14)
- **`approval.ts`**: `issueApproval()` / `verifyApproval()` with HMAC-SHA256
  signature, TTL, clock-skew, nonce replay protection
- `ProofVerifier` derives HUMAN_APPROVAL PASS only from a valid signed token;
  legacy string tokens still accepted (deprecated)
- Orchestrator reuses the caller-supplied `task.id` so tokens bind to the task

### 🔌 MCP governance (#7)
- **`McpGovernance`**: registers manifests with per-tool description hashes;
  rejects changed descriptions (rug-pull), flags added/removed tools, scans
  tool descriptions for injection
- Orchestrator: optional `task.data.mcpManifest` pre-scan → BLOCKED on rejection

### ⏱️ Per-task budget + guard timeout (#8)
- **`TaskBudget`**: maxMs / maxToolCalls / maxTokens with `spend()` /
  `exhausted()`; orchestrator fails closed on any exhaustion
- Guard evaluation wrapped with a 50ms hard timeout (`checkWithTimeout` /
  `checkWithBudget`)

### 🔤 Homoglyph fuzzing findings (#10 → fixes)
- **Fuzz suites** under `tests/fuzz/`: deterministic (seeded LCG) mutations of
  shell commands and destructive descriptions — all must stay BLOCKED /
  DESTRUCTIVE_OP
- **Fixes from fuzzing**: Cyrillic er is ambiguous between p/r — the
  normalizer now emits **both readings** (`normalizeForMatchingVariants`) and
  classifier/guards match all variants; classifier gained destructive keywords
  (`destroy`, `truncate`, `wipe`, `erase`, `drop table`); canonicalizer now
  strips quotes wrapping individual tokens (`"rm" -rf /`)

### 🔢 Single version source (#12)
- **`src/core/version.ts`**: `VERSION` is the one source; `getSummary()`
  reads it

### 🧪 Validation
- 117 unit tests + 12 fuzz tests, 0 failing; `tsc --noEmit` clean
- Golden corpus 33/33; chaos lab 16 scenarios, 0 crashes, 0 unsafe

## [0.5.0] - 2026-09-10 — HMAC audit trail + fixed chaos harness (#4, #11)

### 🔐 HMAC audit trail (#4)
- **Optional HMAC-SHA256 mode** for the Merkle audit: when `EURINHASH_AUDIT_KEY`
  or a `.morph-key` file is present every leaf/parent/internal hash is an
  HMAC (prefix `hmac-sha256:`). Without a key the trail stays plain SHA-256.
- **Forged chains fail:** a trail built with a key does not verify with
  `sha256` and does not verify with a wrong key; `verifyProof(proof, key)`
  and `verifyProofInstance(proof)` cover both modes.
- **External anchoring:** `exportAnchor(path)` / `verifyExternalAnchor(path)` /
  `loadAnchor(path)` let an anchor be stored out-of-band and later used to
  detect truncation even when the attacker controls the log directory.

### 🧪 Chaos harness fix (#11)
- **CHAOS-17 `unsafe` now counts only dangerous approvals** (via
  `isDangerous(task)`) instead of any `L1:APPROVED`; the lab now reports
  `unsafeExecutionScenarios: 0` when the engine behaves as expected.
- **Files:** `src/core/merkle-audit.ts`, `scripts/chaos/chaos-lab.ts`

## [0.4.0] - 2026-09-10 — Reproducible builds, authentic proofs, CI golden gate

### 🔧 Reproducible dev tooling (#1)
- **Tracked `package.json` + `bun.lock`** (previously gitignored) with `test`,
  `typecheck`, `chaos`, `test:golden` and `verify` scripts
- **Dropped orphaned `package-lock.json`** (no manifest, unrelated project)
- A fresh clone can now run `bun install && bun run verify`

### 🧾 Authentic proof evidence (#2)
- **No more fabricated proofs:** `generateProofChain(task, policy, evidence)`
  derives each status from an `EvidenceBundle` (testResult, reviewHash,
  scanReport, approvalToken) — PASS only on real evidence, PENDING when
  missing, FAIL when the evidence is negative
- **`verifyProofChain` re-binds `evidenceHash`** against the supplied evidence
  and keeps task-bound hash tamper checks; evidence swap detected
- **Orchestrator** accepts optional evidence, records provided keys in the
  Merkle detail, and delegates minimum-proof checks to the verifier
- **Files:** `src/core/types.ts`, `src/core/proof-verifier.ts`,
  `src/core/orchestrator.ts`, `src/core/index.ts`

### 🚦 CI + golden attack corpus (#9)
- **`tests/fixtures/attacks.jsonl`:** 33 golden cases (rm variants, `$IFS`
  bypass, homoglyphs, Unicode tags, traversal, egress, injections, fork
  bomb, destructive ops) — all must produce the expected verdict
- **`scripts/verify-golden.ts`:** fresh orchestrator per case, exit 1 on
  mismatch — a CI gate against guard-bypass regressions
- **`.github/workflows/ci.yml`:** install (frozen) → typecheck → tests →
  golden → chaos
- **Files:** `tests/fixtures/attacks.jsonl`,
  `scripts/verify-golden.ts`, `.github/workflows/ci.yml`

### 🧪 Validation
- 83 tests passing, 0 failing; `tsc --noEmit` clean; golden 33/33
- Chaos lab: 16 scenarios, 0 crashes (CHAOS-17 UNSAFE flag is a known
  pre-existing harness false positive, see ROADMAP #11)

## [0.3.1] - 2026-09-10 — Hardened against Agentic AI attack research

### 🛡️ Quick Wins (from 4-agent deep research)

#### MerkleAuditTrail: RFC 6962 Compliance + Head Anchoring
- **RFC 6962 domain separation:** leaf hashes prefixed `0x00`, internal nodes `0x01` — prevents second-preimage attacks
- **Head anchoring:** `head()` + `verifyHead()` expose the latest entry hash; external parties can anchor it to detect log truncation
- **File:** `src/core/merkle-audit.ts`

#### AnomalyDetector: Mahalanobis Distance Scoring
- **Added:** 4-dimensional Mahalanobis distance over [task-type entropy, risk level, description length, burst count]
- Uses Welford-style online covariance tracking; flags at chi-squared threshold (p<0.01)
- **File:** `src/core/anomaly-detection.ts`

#### InjectionDetector: Unicode Tag Smuggling
- **Added category `UNICODE_TAG_SMUGGLING`:** blocks U+E0001-U+E007F invisible tag characters used in CoreBreak/ShareLock attacks
- **File:** `src/core/injection-detection.ts`

### 🔧 Medium Improvements (from OWASP Agentic + Flight Recorder research)

#### GuardOverrides: GuardFall Defense (Shell Canonicalization)
- `canonicalizeShell()` expands bash bypass forms before regex evaluation:
  - `$IFS`, `${IFS}`, `${IFS:...}` → literal space (`rm$IFS-rf` blocked)
  - Backslash escapes stripped (`rm\ -rf` blocked)
  - `$()`/`$((`)/backtick command substitution neutralized
  - Concatenated quoted strings joined
- **File:** `src/core/guard-overrides.ts`

#### GuardOverrides: CoreBreak Defense (Tool Attestation)
- `verifyToolAttestation()` rejects replayed nonces, expired tokens, uncovered tool paths
- `issueAttestation()` enables harness to mint model-issued authorization tokens
- **File:** `src/core/guard-overrides.ts`

#### DriftDetector: ASI Composite Drift (new module)
- Six-dimensional behavioral drift: tool frequency, risk escalation, complexity, description entropy, task diversity, repetition
- Exponential decay counters + baseline learning from first 20 samples
- **File:** `src/core/drift-detection.ts`

#### BehavioralFSM: Goal-Conditioned State Machine (new module)
- O(1) deny-by-default tool-call transition table
- Direct `delete`/`approve` from INIT is a sticky `VIOLATION` state
- **File:** `src/core/behavioral-fsm.ts`

#### Orchestrator: Anomaly Blocking Fix
- **Fixed:** anomaly detection no longer early-exits with `proofStatus: "FAIL"` (was bypassing proof chain); now it blocks via the final verdict path so `proofStatus` reflects the real proof chain (`PENDING` for human approval)
- **File:** `src/core/orchestrator.ts`

### 🧪 Validation
- 78 tests passing (was 61), 0 failing
- `tsc --noEmit` clean

## [0.2.0] - 2026-09-06 — P0 Critical Fixes from Chaos Testing

### 🔴 Critical Security Fixes (P0)

#### PolicyEngine: FAIL-CLOSED Defaults
- **Fixed:** Missing policy match now returns `BLOCKED` instead of falling back to L2-STANDARD with `APPROVED`
- **File:** `src/core/policy-engine.ts` lines 112-123
- **Before:** `"No exact match, using L2 fallback"` → `decision: "APPROVED"`
- **After:** `"No matching policy found - task blocked by default"` → `decision: "BLOCKED"`

#### ProofVerifier: Full Pipeline Integration
- **Fixed:** ProofVerifier was defined but never called in orchestrator
- **File:** `src/core/orchestrator.ts` 
- **Changes:**
  - Import and instantiate `ProofVerifier` in constructor
  - Generate proof chain in `execute()` pipeline
  - Verify proof chain with `verifyProofChain()`
  - Block execution on `proofStatus === "FAIL"`
  - Block execution if human approval required but not yet granted

#### Guard System: WARN → BLOCK for Critical Operations
- **Fixed:** Guard `WARN` previously resulted in `APPROVED` verdict
- **File:** `src/core/orchestrator.ts` line 66-68
- **Change:** `WARN` now results in `BLOCKED` for safety (fail-closed)
- **Rationale:** WARN patterns include force push, hard reset — should require explicit approval

#### Guard Regex: Fixed `/rm -rf /` Pattern Bypass
- **Fixed:** Pattern `/rm\s+-rf\s+\/\s*$/` required trailing space + end-of-string anchor
- **File:** `src/core/orchestrator.ts` line 108
- **Before:** Only matched `rm -rf / ` (with trailing space)
- **After:** Matches `rm -rf /` (without requiring trailing space)
- **Impact:** Prevents bypass of recursive root delete guard

#### Guard Patterns: Added Missing Destructive Operations
- **Added:** 5 new BLOCKED patterns for common destructive operations:
  - `rm -rf *` (wildcard recursive delete)
  - `TRUNCATE TABLE` (SQL table truncate)
  - `DELETE FROM table ;` (unqualified DELETE)
  - `chmod 777` (world-writable permissions)
  - `npm publish` (package publish - WARN, requires review)

#### Worker Execution: Fallback Chain Implementation
- **Implemented:** Full worker fallback chain in `GovernanceOrchestrator`
- **File:** `src/core/orchestrator.ts` lines 150-230
- **Chain:** `worker-codestral` → `worker-groq` → `worker-zhipu` → `worker-novita`
- **Behavior:**
  - On 429 (rate limit): automatically retry with next worker
  - On timeout/error: automatically retry with next worker
  - All workers exhausted → returns failure with `provider: undefined`
  - Simulated execution with realistic timing (50-150ms per worker)

### 🟡 Risk Assessment Consistency (P1) — In Progress

#### PolicyEngine.assessTaskRisk() Alignment
- **Issue:** `PolicyEngine.assessTaskRisk()` had different keywords than `risk-assessor.ts`
- **Fix:** Align both to use identical risk detection logic
- **Status:** In progress

#### Production + Scope → CRITICAL Consistency
- **Issue:** Production environment with sensitive scope didn't consistently produce CRITICAL
- **Fix:** Ensure both risk assessors produce identical CRITICAL for production + scope
- **Status:** Pending

### 📝 Files Modified

| File | Changes |
|------|---------|
| `src/core/policy-engine.ts` | FAIL-CLOSED default on missing policy |
| `src/core/orchestrator.ts` | ProofVerifier integration, guard fixes, worker fallback chain |
| `src/core/types.ts` | `PolicyDecision.policy` made optional for BLOCKED cases |

### 🧪 Validation

All P0 fixes implemented and ready for chaos re-test. The engine now:
1. ✅ Blocks on missing policy (FAIL-CLOSED)
2. ✅ Validates proofs before approval
3. ✅ Blocks on guard WARN for critical ops
4. ✅ Catches `rm -rf /` without trailing space bypass
5. ✅ Catches additional destructive patterns
6. ✅ Has working worker fallback chain

### Next Steps (Post-P0)
- [ ] Complete risk assessment consistency alignment
- [ ] Add performance metrics (P50/P95/P99)
- [ ] Run full chaos test matrix re-verification
- [ ] Document worker integration API