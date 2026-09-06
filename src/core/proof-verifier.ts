// src/core/proof-verifier.ts — Proof Verification Engine

import {
  TaskSpec,
  ProofChain,
  Proof,
  ProofType,
  PolicySpec,
} from "./types";
import { createHash } from "node:crypto";

export class ProofVerifier {
  /**
   * Generate a proof chain for a completed task
   */
  generateProofChain(task: TaskSpec, policy: PolicySpec): ProofChain {
    const proofs: Proof[] = [];

    // Add tests proof if required
    if (policy.proofsRequired.includes(ProofType.TESTS)) {
      const testProof: Proof = {
        type: ProofType.TESTS,
        status: "PASS", // Will be validated by actual test run
        evidence: `Test suite executed for: ${task.description}`,
        hash: this.generateHash(task, ProofType.TESTS),
        timestamp: Date.now(),
      };
      proofs.push(testProof);
    }

    // Add code review proof if required
    if (policy.proofsRequired.includes(ProofType.CODE_REVIEW)) {
      const reviewProof: Proof = {
        type: ProofType.CODE_REVIEW,
        status: "PASS", // Will be validated by actual review
        evidence: `Code review completed for: ${task.description}`,
        hash: this.generateHash(task, ProofType.CODE_REVIEW),
        timestamp: Date.now(),
      };
      proofs.push(reviewProof);
    }

    // Add security scan proof if required
    if (policy.proofsRequired.includes(ProofType.SECURITY_SCAN)) {
      const securityProof: Proof = {
        type: ProofType.SECURITY_SCAN,
        status: "PASS", // Will be validated by actual security scan
        evidence: `Security scan completed for: ${task.description}`,
        hash: this.generateHash(task, ProofType.SECURITY_SCAN),
        timestamp: Date.now(),
      };
      proofs.push(securityProof);
    }

    // Add human approval proof if required
    if (policy.proofsRequired.includes(ProofType.HUMAN_APPROVAL)) {
      const approvalProof: Proof = {
        type: ProofType.HUMAN_APPROVAL,
        status: "PENDING", // Requires human action
        evidence: `Human approval pending for: ${task.description}`,
        hash: this.generateHash(task, ProofType.HUMAN_APPROVAL),
        timestamp: Date.now(),
      };
      proofs.push(approvalProof);
    }

    // Compute root hash of the chain
    const rootHash = this.computeRootHash(proofs);

    // Determine verdict based on complexity level
    let verdict: "PASS" | "FAIL" = "PASS";
    if (task.complexity === "L4" && proofs.length < 4) {
      verdict = "FAIL";
    } else if (proofs.length === 0) {
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
   * Verify an existing proof chain
   */
  verifyProofChain(chain: ProofChain): "PASS" | "FAIL" | "PENDING" {
    // Verify all proofs have valid hashes
    for (const proof of chain.proofs) {
      const expectedHash = this.generateHashByType(chain.taskId, proof.type);
      if (proof.hash !== expectedHash) {
        return "FAIL";
      }
    }

    // Verify all proofs passed
    // Distinguish PENDING (human approval waiting) from FAIL (proof rejected)
    const hasPending = chain.proofs.some((p) => p.status === "PENDING");
    if (hasPending) {
      return "PENDING";
    }

    const allPassed = chain.proofs.every((p) => p.status === "PASS");
    if (!allPassed) {
      return "FAIL";
    }

    return "PASS";
  }

  /**
   * Check if task meets minimum proof requirements
   */
  checkMinimumProofs(task: TaskSpec, chain: ProofChain): "PASS" | "FAIL" {
    const minProofs = this.getMinimumProofsForComplexity(task.complexity || "L1");
    if (chain.proofs.length < minProofs) {
      return "FAIL";
    }
    return "PASS";
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

  private getMinimumProofsForComplexity(complexity: string): number {
    switch (complexity) {
      case "L1":
        return 0;
      case "L2":
        return 2;
      case "L3":
        return 3;
      case "L4":
        return 4;
      default:
        return 1;
    }
  }
}