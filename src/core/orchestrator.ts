// src/core/orchestrator.ts — Main Governance Orchestrator

import { classifyTask } from "./classifier";
import { assessRisk } from "./risk-assessor";
import { PolicyEngine } from "./policy-engine";
import { ProofVerifier } from "./proof-verifier";
import { TaskSpec, ExecutionResult, PolicyDecision, TaskType, RiskLevel, ProofChain, Proof, ProofType } from "./types";

/**
 * Performance metrics for the governance pipeline
 */
export interface PerformanceMetrics {
  classification_ms: number;
  risk_assessment_ms: number;
  policy_evaluation_ms: number;
  guard_check_ms: number;
  proof_verification_ms: number;
  pipeline_total_ms: number;
}

export interface BenchmarkResult {
  taskCount: number;
  P50: PerformanceMetrics;
  P95: PerformanceMetrics;
  P99: PerformanceMetrics;
  MAX: PerformanceMetrics;
  AVERAGE: PerformanceMetrics;
}

/**
 * Get percentile value from sorted array
 */
function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Compute metrics from a sorted array of timings
 */
function computeMetrics(timings: number[]): { P50: number; P95: number; P99: number; MAX: number; AVERAGE: number } {
  const sorted = [...timings].sort((a, b) => a - b);
  return {
    P50: percentile(sorted, 50),
    P95: percentile(sorted, 95),
    P99: percentile(sorted, 99),
    MAX: sorted[sorted.length - 1],
    AVERAGE: sorted.reduce((a, b) => a + b, 0) / sorted.length,
  };
}

export class GovernanceOrchestrator {
  private policyEngine: PolicyEngine;
  private proofVerifier: ProofVerifier;
  private metrics: PerformanceMetrics[];

  constructor() {
    this.policyEngine = new PolicyEngine();
    this.proofVerifier = new ProofVerifier();
    this.metrics = [];
  }

  /**
   * Main entry point: classify → assess risk → evaluate policy → check guards → verify proofs
   * All failures result in BLOCKED verdict (fail-closed security model)
   */
  async execute(task: TaskSpec): Promise<ExecutionResult> {
    const startTotal = Date.now();
    const taskId = this.generateId();

    // Step 1: Classify
    const startClassify = Date.now();
    const taskType = classifyTask(task);
    const taskWithType = { ...task, taskType };
    const classifyMs = Date.now() - startClassify;

    // Step 2: Assess Risk
    const startRisk = Date.now();
    const riskLevel = assessRisk(taskWithType);
    const taskWithRisk = { ...taskWithType, risk: riskLevel };
    const riskMs = Date.now() - startRisk;

    // Step 3: Evaluate Policy (fail-closed on no match)
    const startPolicy = Date.now();
    const policyDecision = this.policyEngine.evaluatePolicy(taskWithRisk);
    const policyMs = Date.now() - startPolicy;

    // If no policy matched → BLOCKED
    if (policyDecision.decision === "BLOCKED") {
      const totalMs = Date.now() - startTotal;
      this.metrics.push({
        classification_ms: classifyMs,
        risk_assessment_ms: riskMs,
        policy_evaluation_ms: policyMs,
        guard_check_ms: 0,
        proof_verification_ms: 0,
        pipeline_total_ms: totalMs,
      });
      return {
        taskId,
        taskType,
        riskLevel,
        policyDecision,
        guardDecision: "ALLOWED",
        proofStatus: "FAIL",
        verdict: "BLOCKED",
      };
    }

    // Step 4: Check guards
    const startGuard = Date.now();
    if (!task || typeof task.description !== "string" || !task.description.trim()) {
      return {
        taskId,
        taskType,
        riskLevel,
        policyDecision,
        guardDecision: "ALLOWED",
        proofStatus: "FAIL",
        verdict: "BLOCKED",
      };
    }
    const guardResult = this.checkGuards(task.description);
    const guardMs = Date.now() - startGuard;

    // Step 5: Generate proof chain
    const startProof = Date.now();
    const proofChain = this.proofVerifier.generateProofChain(
      { ...taskWithRisk, id: taskId },
      policyDecision.policy!
    );

    // Step 6: Verify proofs meet requirements
    const proofStatus = this.proofVerifier.verifyProofChain(proofChain, { ...taskWithRisk, id: taskId });
    const proofMs = Date.now() - startProof;

    // Step 7: Determine final verdict (fail-closed)
    let verdict: "APPROVED" | "BLOCKED" | "REJECTED" = "APPROVED";

    if (guardResult.decision === "BLOCKED") {
      verdict = "BLOCKED";
    } else if (guardResult.decision === "WARN") {
      // WARN on critical operations → BLOCKED for safety
      verdict = "BLOCKED";
    } else if (proofStatus === "FAIL") {
      verdict = "BLOCKED";
    } else if (proofStatus === "PENDING") {
      verdict = "BLOCKED";
    } else if (policyDecision.humanApproval && !this.hasHumanApproval(proofChain)) {
      verdict = "BLOCKED";
    }

    const totalMs = Date.now() - startTotal;

    // Record metrics
    this.metrics.push({
      classification_ms: classifyMs,
      risk_assessment_ms: riskMs,
      policy_evaluation_ms: policyMs,
      guard_check_ms: guardMs,
      proof_verification_ms: proofMs,
      pipeline_total_ms: totalMs,
    });

    return {
      taskId,
      taskType,
      riskLevel,
      policyDecision,
      guardDecision: guardResult.decision === "WARN" ? "BLOCKED" : guardResult.decision,
      proofStatus,
      verdict,
    };
  }

  /**
   * Get benchmark results for all recorded executions
   */
  getBenchmarkResults(): BenchmarkResult | null {
    if (this.metrics.length === 0) return null;

    const taskCount = this.metrics.length;

    return {
      taskCount,
      P50: this.computePercentiles("P50"),
      P95: this.computePercentiles("P95"),
      P99: this.computePercentiles("P99"),
      MAX: this.computePercentiles("MAX"),
      AVERAGE: this.computeAverages(),
    };
  }

  private computePercentiles(p: string): PerformanceMetrics {
    const keys = ["classification_ms", "risk_assessment_ms", "policy_evaluation_ms", "guard_check_ms", "proof_verification_ms", "pipeline_total_ms"] as const;
    const result: any = {};
    for (const key of keys) {
      const sorted = [...this.metrics.map(m => m[key])].sort((a, b) => a - b);
      const index = Math.ceil((parseInt(p) / 100) * sorted.length) - 1;
      result[key] = sorted[Math.max(0, index)];
    }
    return result;
  }

  private computeAverages(): PerformanceMetrics {
    const keys = ["classification_ms", "risk_assessment_ms", "policy_evaluation_ms", "guard_check_ms", "proof_verification_ms", "pipeline_total_ms"] as const;
    const result: any = {};
    const count = this.metrics.length;
    for (const key of keys) {
      result[key] = this.metrics.reduce((sum, m) => sum + (m as any)[key], 0) / count;
    }
    return result;
  }

  /**
   * Clear recorded metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Get current metrics count
   */
  getMetricsCount(): number {
    return this.metrics.length;
  }

  /**
   * Check if proof chain has human approval (PENDING means not yet approved)
   */
  private hasHumanApproval(chain: ProofChain): boolean {
    const humanProof = chain.proofs.find(p => p.type === ProofType.HUMAN_APPROVAL);
    return humanProof ? humanProof.status === "PASS" : false;
  }

  /**
   * Generate a unique task ID
   */
  private generateId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Check guards against dangerous operations
   * All guarded patterns are BLOCKED or require explicit human approval
   */
  private checkGuards(description: string): { decision: "BLOCKED" | "ALLOWED" | "WARN"; reason: string } {
    const dangerousPatterns = [
      // BLOCKED - Critical destructive operations
      { pattern: /rm\s+-rf\s+\/\S?/, action: "BLOCKED" as const, reason: "Recursive root delete blocked" },
      { pattern: /rm\s+-rf\s+\*/, action: "BLOCKED" as const, reason: "Recursive wildcard delete blocked" },
      { pattern: /mkfs/, action: "BLOCKED" as const, reason: "Filesystem format blocked" },
      { pattern: /dd\s+if=/, action: "BLOCKED" as const, reason: "Direct disk write blocked" },
      { pattern: /DROP\s+DATABASE/i, action: "BLOCKED" as const, reason: "Database drop blocked" },
      { pattern: /curl\s+.*\|\s*sh/, action: "BLOCKED" as const, reason: "Pipe to shell execution blocked" },
      { pattern: /format\s+.*\.env/i, action: "BLOCKED" as const, reason: "Env file overwrite blocked" },
      { pattern: /truncate\s+table/i, action: "BLOCKED" as const, reason: "Table truncate blocked" },
      { pattern: /DELETE\s+FROM\s+\w+\s*;/i, action: "BLOCKED" as const, reason: "Unqualified DELETE blocked" },
      { pattern: /chmod\s+777/, action: "BLOCKED" as const, reason: "World-writable permissions blocked" },
      // WARN - Potentially dangerous but recoverable with review
      { pattern: /git\s+push\s+--force/, action: "WARN" as const, reason: "Force push requires review" },
      { pattern: /git\s+reset\s+--hard/, action: "WARN" as const, reason: "Hard reset can cause data loss" },
      { pattern: /npm\s+publish/, action: "WARN" as const, reason: "Package publish requires review" },
    ];

    for (const guard of dangerousPatterns) {
      if (guard.pattern.test(description)) {
        return { decision: guard.action, reason: guard.reason };
      }
    }

    return { decision: "ALLOWED", reason: "No guard match" };
  }

  /**
   * Execute a task via the worker pool with fallback chain
   * Implements the EURINHASH FREE-first worker policy:
   *   primary:  [worker-codestral, worker-groq]
   *   fallback: [worker-zhipu, worker-novita]
   *   On 429: retry with next worker in chain
   */
  private async executeWorker(task: TaskSpec): Promise<{
    success: boolean;
    output?: string;
    error?: string;
    provider?: string;
    statusCode?: number;
  }> {
    const WORKER_CHAIN = [
      "worker-codestral",
      "worker-groq",
      "worker-zhipu",
      "worker-novita",
    ];

    const maxRetries = WORKER_CHAIN.length;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const worker = WORKER_CHAIN[attempt];
      try {
        // Simulate worker execution with timeout
        const result = await this.runWorkerWithTimeout(worker, task);
        if (result.success) {
          return { success: true, output: result.output, provider: worker, statusCode: 200 };
        }
        // If 429, try next worker
        if (result.statusCode === 429 && attempt < maxRetries - 1) {
          continue;
        }
        // Other error → stop trying
        return { success: false, error: result.error, provider: worker, statusCode: result.statusCode };
      } catch (err) {
        // Timeout or unexpected error → try next worker
        if (attempt < maxRetries - 1) {
          continue;
        }
        return { success: false, error: (err as Error).message, provider: worker };
      }
    }

    // All workers exhausted
    return { success: false, error: "All workers exhausted", provider: undefined, statusCode: 0 };
  }

  /**
   * Run a single worker with timeout protection
   */
  private async runWorkerWithTimeout(worker: string, task: TaskSpec): Promise<{ success: boolean; output?: string; error?: string; statusCode?: number }> {
    // Simulate a worker execution with timeout
    // In production, this would call the actual worker pool
    return new Promise(resolve => {
      setTimeout(() => {
        // Simulate: codestral works, others get 429 or timeout on complex tasks
        const isComplex = task.complexity && task.complexity === "L4";
        if (worker === "worker-codestral") {
          // Codestral succeeds on most tasks
          resolve({ success: true, output: `Executed by ${worker}: ${task.description.substring(0, 50)}...` });
        } else {
          // Other workers simulated - may return 429 for rate-limited scenarios
          const is429 = Math.random() > 0.5; // Simulate occasional 429
          if (is429) {
            resolve({ success: false, error: "Rate limit exceeded", statusCode: 429 });
          } else {
            resolve({ success: true, output: `Executed by ${worker}: ${task.description.substring(0, 50)}...` });
          }
        }
      }, 50 + Math.random() * 100); // 50-150ms simulated execution
    });
  }

  /**
   * Get a summary of the current governance state
   */
  getSummary(): {
    policiesLoaded: number;
    version: string;
  } {
    return {
      policiesLoaded: this.policyEngine.getPolicyCount(),
      version: "0.2.0",
    };
  }
}