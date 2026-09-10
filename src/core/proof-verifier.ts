// src/core/proof-verifier.ts — Proof Verification Engine
//
// Proofs are derived from authentic evidence supplied by trusted producers
// (CI, human reviewer, scanner). A required proof is never fabricated:
// missing evidence yields PENDING, and the orchestrator fails closed.

import {
  TaskSpec,
  ProofChain,
  Proof,
  ProofType,
  PolicySpec,
  EvidenceBundle,
  ApprovalToken,
} from "./types";
import { createHash } from "node:crypto";
import { verifyApproval } from "./approval";

export class ProofVerifier {
  /**
   * Generate a proof chain for a task from the supplied evidence.
   */
  generateProofChain(
    task: TaskSpec,
    policy: PolicySpec,
    evidence: EvidenceBundle = {}
  ): ProofChain {
    const proofs: Proof[] = [];

    for (const type of policy.proofsRequired) {
      proofs.push(this.buildProof(task, type, evidence));
    }

    const rootHash = this.computeRootHash(proofs);

    let verdict: "PASS" | "FAIL" = "PASS";
    if (proofs.some((p) => p.status === "FAIL")) {
      verdict = "FAIL";
    }

    return {
      taskId: this.generateTaskId(task),
      proofs,
      verdict,
      rootHash,
    };
  }

  /**
   * Verify an existing proof chain.
   * `task` is required to recompute content-bound hashes; without it the
   * chain cannot be authenticated and the result is FAIL (fail-closed).
   * `evidence` is required to re-bind any evidence hashes.
   */
  verifyProofChain(
    chain: ProofChain,
    task?: TaskSpec,
    evidence?: EvidenceBundle
  ): "PASS" | "FAIL" | "PENDING" {
    if (!task) {
      return "FAIL";
    }

    // 1. Content-bound tamper check on every proof.
    for (const proof of chain.proofs) {
      const expectedHash = this.generateHash({ ...task, id: chain.taskId }, proof.type);
      if (proof.hash !== expectedHash) {
        return "FAIL";
      }
    }

    // 2. Re-bind evidence hashes when the chain carries them.
    for (const proof of chain.proofs) {
      if (!proof.evidenceHash) continue;
      const raw = this.rawForType(proof.type, evidence);
      if (raw === undefined) return "FAIL";
      if (this.hashEvidence(raw) !== proof.evidenceHash) return "FAIL";
    }

    // 3. Aggregate statuses.
    if (chain.proofs.some((p) => p.status === "FAIL")) return "FAIL";
    if (chain.proofs.some((p) => p.status === "PENDING")) return "PENDING";
    return chain.proofs.every((p) => p.status === "PASS") ? "PASS" : "FAIL";
  }

  /**
   * Check that all required proof types are present and not rejected.
   */
  checkMinimumProofs(chain: ProofChain, required: ProofType[]): boolean {
    for (const type of required) {
      const proof = chain.proofs.find((p) => p.type === type);
      if (!proof || proof.status === "FAIL") return false;
    }
    return true;
  }

  // --- Private helpers ---

  private buildProof(task: TaskSpec, type: ProofType, evidence: EvidenceBundle): Proof {
    const base = {
      type,
      hash: this.generateHash(task, type),
      timestamp: Date.now(),
    };

    switch (type) {
      case ProofType.TESTS: {
        const t = evidence.testResult;
        if (!t) {
          return {
            ...base,
            status: "PENDING",
            evidence: `No test evidence for: ${task.description}`,
          };
        }
        return {
          ...base,
          status: t.failed === 0 && t.passed > 0 ? "PASS" : "FAIL",
          source: "ci",
          evidence: `Tests passed=${t.passed} failed=${t.failed} (output ${t.outputHash.slice(0, 16)})`,
          evidenceHash: this.hashEvidence(t),
        };
      }
      case ProofType.CODE_REVIEW: {
        const h = evidence.reviewHash;
        if (!h) {
          return {
            ...base,
            status: "PENDING",
            evidence: `No code review evidence for: ${task.description}`,
          };
        }
        return {
          ...base,
          status: "PASS",
          source: "human",
          evidence: `Code review ${h.slice(0, 16)}`,
          evidenceHash: this.hashEvidence({ reviewHash: h }),
        };
      }
      case ProofType.SECURITY_SCAN: {
        const s = evidence.scanReport;
        if (!s) {
          return {
            ...base,
            status: "PENDING",
            evidence: `No security scan evidence for: ${task.description}`,
          };
        }
        return {
          ...base,
          status: s.findings === 0 ? "PASS" : "FAIL",
          source: "scanner",
          evidence: `Security scan findings=${s.findings} (output ${s.outputHash.slice(0, 16)})`,
          evidenceHash: this.hashEvidence(s),
        };
      }
      case ProofType.HUMAN_APPROVAL: {
        const a = evidence.approvalToken;
        if (!a) {
          return {
            ...base,
            status: "PENDING",
            evidence: `Human approval pending for: ${task.description}`,
          };
        }
        // Structured signed token (preferred — EURINHASH #6 / Art.14)
        if (typeof a === "object") {
          const token = a as ApprovalToken;
          const taskId = task.id || ("" as string);
          // verifyApproval enforces taskId binding, expiry, clock-skew, sig, replay
          const result = verifyApproval(token, taskId);
          if (result.valid) {
            return {
              ...base,
              status: "PASS",
              source: "human",
              evidence: `Human approval ${token.approver} scope=${token.scope.join(",") || "default"} nonce=${token.nonce.slice(0, 8)}`,
              evidenceHash: this.hashEvidence({ approvalToken: token }),
            };
          }
          return {
            ...base,
            status: "FAIL",
            source: "human",
            evidence: `Human approval rejected: ${result.reason} for ${task.description}`,
            evidenceHash: this.hashEvidence({ approvalToken: token }),
          };
        }
        // Legacy string token — non-empty => PASS (deprecated, kept for backward compat)
        return {
          ...base,
          status: "PASS",
          source: "human",
          evidence: `Human approval ${(a as string).slice(0, 16)} (legacy)`,
          evidenceHash: this.hashEvidence({ approvalToken: a }),
        };
      }
      default:
        return { ...base, status: "PENDING", evidence: `No evidence for: ${task.description}` };
    }
  }

  private rawForType(type: ProofType, evidence?: EvidenceBundle): unknown {
    if (!evidence) return undefined;
    switch (type) {
      case ProofType.TESTS:
        return evidence.testResult;
      case ProofType.CODE_REVIEW:
        return evidence.reviewHash !== undefined ? { reviewHash: evidence.reviewHash } : undefined;
      case ProofType.SECURITY_SCAN:
        return evidence.scanReport;
      case ProofType.HUMAN_APPROVAL:
        return evidence.approvalToken !== undefined
          ? { approvalToken: evidence.approvalToken }
          : undefined;
      default:
        return undefined;
    }
  }

  private hashEvidence(value: unknown): string {
    return "sha256:" + createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  private generateHash(task: TaskSpec, proofType: ProofType): string {
    const content = `${task.id || "unknown"}|${task.description}|${proofType}`;
    return "sha256:" + createHash("sha256").update(content).digest("hex");
  }

  private generateTaskId(task: TaskSpec): string {
    return task.id || `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private computeRootHash(proofs: Proof[]): string {
    const hashContent = proofs.map((p) => p.hash).join("|");
    return "sha256:" + createHash("sha256").update(hashContent).digest("hex");
  }
}
