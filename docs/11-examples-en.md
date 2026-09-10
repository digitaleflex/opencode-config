# Worked governance examples

Each example shows input → pipeline → **actual** verdict (reproduced by
`src/core/core.test.ts` and `tests/fixtures/attacks.jsonl`).

> Convention: without evidence, any task requiring proofs is BLOCKED /
> PENDING (fail-closed). Intentional, not a bug.

| # | Input | Pipeline | Verdict |
|---|---|---|---|
| 1 | `fix typo in readme` | CONFIG / LOW / L1-SIMPLE, 0 proofs | APPROVED |
| 2 | `update the readme file` | Same as 1 | APPROVED |
| 3 | `refactor loader module in src` (no evidence) | REFACTOR_MODULE / L2-STANDARD needs `[tests, code_review]` → PENDING | BLOCKED |
| 3b | Same + `EvidenceBundle` (`passed: 12, failed: 0` + `reviewHash`) | Proofs PASS | APPROVED |
| 3c | Same + failing tests (`failed: 2`) | Proof FAIL | BLOCKED |
| 4 | `add feature to export CSV` | FEATURE_LIMITED / L2, same rule as 3 | BLOCKED → APPROVED with evidence |
| 5 | `design the payments api` | API_CHANGE / L3-COMPLEX + human approval required | BLOCKED until signed approval |
| 6 | Security fix (`taskType: SECURITY`) | L3-COMPLEX, proofs + approval required | BLOCKED until complete |
| 7 | `deploy service to production` | DESTRUCTIVE_OP / CRITICAL / L4-CRITICAL (4 proofs) | BLOCKED/PENDING; APPROVED only with all 4 valid proofs incl. signed token |
| 8 | `run rm -rf / to clean disk` (+ operation) | Guard match before proofs | BLOCKED |

More blocked examples: `DROP DATABASE`, `TRUNCATE TABLE`, `curl | sh`,
fork bomb, `$IFS` bypasses, Cyrillic homoglyphs, invisible Unicode tags —
see the golden corpus.

Replay: `bun test src/core/core.test.ts`, `bun run scripts/verify-golden.ts`,
`bun run scripts/chaos/chaos-lab.ts`.
