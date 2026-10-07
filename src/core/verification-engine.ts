import { ProofVerifier } from "./proof-verifier";
import { ProofType, type EvidenceBundle, type PolicySpec, type ProofChain, type TaskSpec } from "./types";

export type VerificationStatus = "PASS" | "FAIL" | "PENDING";

export interface EvidenceContract {
  taskId: string;
  executionId?: string;
  commitSha?: string;
  collectedAt: number;
  tests?: EvidenceBundle["testResult"];
  reviewHash?: string;
  securityScan?: EvidenceBundle["scanReport"];
  build?: EvidenceBundle["buildResult"];
  approvalToken?: EvidenceBundle["approvalToken"];
}

export interface VerificationResult {
  status: VerificationStatus;
  taskId: string;
  required: ProofType[];
  chain: ProofChain;
  missing: ProofType[];
  failures: ProofType[];
  reason: string;
}

export class VerificationEngine {
  constructor(private readonly proofVerifier = new ProofVerifier()) {}

  verify(
    task: TaskSpec,
    policy: PolicySpec,
    evidence: EvidenceContract | undefined,
  ): VerificationResult {
    const required = [...policy.proofsRequired];
    const bundle = this.toEvidenceBundle(evidence);
    const chain = this.proofVerifier.generateProofChain(task, policy, bundle);
    const missing = required.filter(
      (type) => !chain.proofs.some((proof) => proof.type === type && proof.status !== "FAIL"),
    );
    const failures = chain.proofs
      .filter((proof) => proof.status === "FAIL")
      .map((proof) => proof.type);

    const verified = this.proofVerifier.verifyProofChain(chain, task, bundle);
    const status: VerificationStatus =
      verified === "FAIL" || failures.length > 0
        ? "FAIL"
        : verified === "PENDING" || missing.length > 0
          ? "PENDING"
          : "PASS";

    return {
      status,
      taskId: chain.taskId,
      required,
      chain,
      missing,
      failures,
      reason:
        status === "PASS"
          ? "All required evidence was verified"
          : status === "PENDING"
            ? `Missing or incomplete evidence: ${missing.join(", ") || "verification pending"}`
            : `Verification failed: ${failures.join(", ") || "proof integrity failure"}`,
    };
  }

  private toEvidenceBundle(evidence: EvidenceContract | undefined): EvidenceBundle {
    if (!evidence) return {};
    return {
      testResult: evidence.tests,
      reviewHash: evidence.reviewHash,
      scanReport: evidence.securityScan,
      buildResult: evidence.build,
      approvalToken: evidence.approvalToken,
    };
  }
}
