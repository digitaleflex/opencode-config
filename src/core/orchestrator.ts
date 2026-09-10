import { classifyTask } from "./classifier";
import { assessRisk } from "./risk-assessor";
import { PolicyEngine } from "./policy-engine";
import { ProofVerifier } from "./proof-verifier";
import { MerkleAuditTrail } from "./merkle-audit";
import { AnomalyDetector } from "./anomaly-detection";
import { InjectionDetector } from "./injection-detection";
import { GuardOverrides } from "./guard-overrides";
import { TaskBudget, TaskBudgetOpts } from "./budget";
import { StateStore } from "./state-store";
import { McpGovernance, McpManifest } from "./mcp-governance";
import { redactDeep, redactSecrets } from "./secret-redactor";
import { loadMode } from "./mode";
import { judgeSemantic, JudgeProvider } from "./semantic-judge";
import { scanStatic } from "./static-rules";
import { VERSION } from "./version";
import {
  TaskSpec,
  ExecutionResult,
  PolicyDecision,
  TaskType,
  RiskLevel,
  ProofChain,
  Proof,
  ProofType,
  EvidenceBundle,
} from "./types";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { normalizeForMatching } from "./unicode-normalize";

export interface GovernanceAuditEntry {
  timestamp: string;
  taskId: string;
  taskDescription: string;
  stage: "classification" | "risk" | "policy" | "guard" | "proof" | "final";
  input: unknown;
  output: unknown;
  decision: "APPROVED" | "BLOCKED" | "WARN" | "PENDING";
  duration_ms: number;
  reason?: string;
  error?: string;
}

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

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export class GovernanceOrchestrator {
  private policyEngine: PolicyEngine;
  private proofVerifier: ProofVerifier;
  private merkleAudit: MerkleAuditTrail;
  private anomalyDetector: AnomalyDetector;
  private injectionDetector: InjectionDetector;
  private metrics: PerformanceMetrics[];
  private guardOverrides: GuardOverrides;
  private budgetOpts?: TaskBudgetOpts;
  private stateStore: StateStore | null;
  private mcpGovernance: McpGovernance | null = null;
  private static readonly GUARD_TIMEOUT_MS = 50;

  /**
   * @param budgetOpts default per-task budget limits
   * @param stateStore optional persistence store; when provided the anomaly
   *   baseline is loaded at construction and saved after each execute().
   *   Persistence is opt-in so callers keep hermetic behavior by default.
   */
  constructor(budgetOpts?: TaskBudgetOpts, stateStore?: StateStore | null) {
    this.policyEngine = new PolicyEngine();
    this.proofVerifier = new ProofVerifier();
    this.merkleAudit = new MerkleAuditTrail();
    this.anomalyDetector = new AnomalyDetector();
    this.injectionDetector = new InjectionDetector();
    this.metrics = [];
    this.guardOverrides = new GuardOverrides();
    this.budgetOpts = budgetOpts;
    this.stateStore = stateStore ?? null;
    if (this.stateStore) {
      this.anomalyDetector.load(this.stateStore, "anomaly");
    }
  }

  /** Lazy MCP governance (loads trust file / manifests on first use). */
  private getMcpGovernance(): McpGovernance {
    if (!this.mcpGovernance) this.mcpGovernance = new McpGovernance();
    return this.mcpGovernance;
  }

  setBudgetOpts(opts: TaskBudgetOpts): void {
    this.budgetOpts = opts;
  }

  getBudgetOpts(): TaskBudgetOpts | undefined {
    return this.budgetOpts;
  }

  async execute(
    task: TaskSpec,
    evidence: EvidenceBundle = {},
    budgetOverride?: TaskBudget | TaskBudgetOpts,
    judgeProvider?: JudgeProvider
  ): Promise<ExecutionResult> {
    // Resolve budget: per-execute override > constructor opts > defaults
    let budget: TaskBudget;
    if (budgetOverride instanceof TaskBudget) {
      budget = budgetOverride;
    } else if (
      budgetOverride &&
      ((typeof (budgetOverride as TaskBudgetOpts).maxMs !== "undefined" &&
        (budgetOverride as TaskBudgetOpts).maxMs !== null) ||
        typeof (budgetOverride as any)?.maxTokens !== "undefined" ||
        typeof (budgetOverride as any)?.maxToolCalls !== "undefined")
    ) {
      budget = new TaskBudget(budgetOverride as TaskBudgetOpts);
    } else if (this.budgetOpts) {
      budget = new TaskBudget(this.budgetOpts);
    } else {
      budget = new TaskBudget();
    }

    const startTotal = Date.now();
    // Respect caller-supplied id for approval-token binding (Art.14) — otherwise generate
    const taskId = task.id ?? this.generateId();

    let classifyMs = 0;
    let riskMs = 0;
    let policyMs = 0;
    let guardMs = 0;
    let proofMs = 0;
    let injectionMs = 0;
    let anomalyMs = 0;

    let taskType: TaskType | undefined;
    let riskLevel: RiskLevel | undefined;
    let policyDecision: PolicyDecision | undefined;
    let anomalyResult: ReturnType<AnomalyDetector["analyze"]> | undefined;

    const budgetBlocked = (reason: string, stage: string): ExecutionResult => {
      const totalMs = Date.now() - startTotal;
      this.merkleAudit.record({
        timestamp: new Date().toISOString(),
        taskId,
        taskDescription: task.description,
        stage: "final",
        decision: "BLOCKED",
        detail: { reason, stage, budgetExceeded: true, budgetReason: reason },
      });
      this.metrics.push({
        classification_ms: classifyMs,
        risk_assessment_ms: riskMs,
        policy_evaluation_ms: policyMs,
        guard_check_ms: guardMs,
        proof_verification_ms: proofMs,
        pipeline_total_ms: totalMs,
      });
      this.logAuditEntry({
        timestamp: new Date().toISOString(),
        taskId,
        taskDescription: task.description,
        stage: "final",
        input: { stage, reason },
        output: "BLOCKED",
        decision: "BLOCKED",
        duration_ms: totalMs,
        reason,
      });
      const finalTaskType = taskType ?? TaskType.FEATURE_LIMITED;
      const finalRisk = riskLevel ?? RiskLevel.HIGH;
      const pd: PolicyDecision = policyDecision ?? {
        decision: "BLOCKED",
        policy: null,
        proofsRequired: [],
        humanApproval: false,
        reason,
      };
      // ensure fail-closed reason contains budget
      pd.decision = "BLOCKED";
      pd.reason = reason;
      return {
        taskId,
        taskType: finalTaskType,
        riskLevel: finalRisk,
        policyDecision: pd,
        guardDecision: "BLOCKED",
        proofStatus: "FAIL",
        verdict: "BLOCKED",
      };
    };

    const startClassify = Date.now();
    try {
      taskType = classifyTask(task);
    } catch (err) {
      classifyMs = Date.now() - startClassify;
      const totalMs = Date.now() - startTotal;
      budget.spend(classifyMs);
      this.metrics.push({
        classification_ms: classifyMs,
        risk_assessment_ms: 0,
        policy_evaluation_ms: 0,
        guard_check_ms: 0,
        proof_verification_ms: 0,
        pipeline_total_ms: totalMs,
      });
      return {
        taskId,
        taskType: TaskType.FEATURE_LIMITED,
        riskLevel: RiskLevel.HIGH,
        policyDecision: {
          decision: "BLOCKED",
          policy: null,
          proofsRequired: [],
          humanApproval: false,
          reason: (err as Error).message,
        },
        guardDecision: "ALLOWED",
        proofStatus: "FAIL",
        verdict: "BLOCKED",
      };
    }
    const taskWithType = { ...task, taskType: taskType! };
    classifyMs = Date.now() - startClassify;
    budget.spend(classifyMs);
    this.logAuditEntry({
      timestamp: new Date().toISOString(),
      taskId,
      taskDescription: task.description,
      stage: "classification",
      input: task,
      output: taskType,
      decision: "APPROVED",
      duration_ms: classifyMs,
    });

    let ex = budget.exhausted();
    if (ex.exhausted) return budgetBlocked(ex.reason!, "classification");

    const startRisk = Date.now();
    riskLevel = assessRisk(taskWithType);
    const taskWithRisk = { ...taskWithType, risk: riskLevel };
    riskMs = Date.now() - startRisk;
    budget.spend(riskMs);
    this.logAuditEntry({
      timestamp: new Date().toISOString(),
      taskId,
      taskDescription: task.description,
      stage: "risk",
      input: taskWithType,
      output: riskLevel,
      decision: "APPROVED",
      duration_ms: riskMs,
    });

    ex = budget.exhausted();
    if (ex.exhausted) return budgetBlocked(ex.reason!, "risk");

    // --- Injection Detection ---
    const startInjection = Date.now();
    const injectionReport = this.injectionDetector.scanTask(task);
    injectionMs = Date.now() - startInjection;
    budget.spend(injectionMs);
    if (injectionReport.action === "BLOCK") {
      const totalMs = Date.now() - startTotal;
      this.merkleAudit.record({
        timestamp: new Date().toISOString(),
        taskId,
        taskDescription: task.description,
        stage: "injection",
        decision: "BLOCKED",
        detail: { categories: injectionReport.categories, riskScore: injectionReport.riskScore },
      });
      this.metrics.push({
        classification_ms: classifyMs,
        risk_assessment_ms: riskMs,
        policy_evaluation_ms: 0,
        guard_check_ms: 0,
        proof_verification_ms: 0,
        pipeline_total_ms: totalMs,
      });
      return {
        taskId,
        taskType: taskType!,
        riskLevel: riskLevel!,
        policyDecision: {
          decision: "BLOCKED",
          policy: null,
          proofsRequired: [],
          humanApproval: false,
          reason: `Injection detected: ${injectionReport.categories.join(", ")}`,
        },
        guardDecision: "BLOCKED",
        proofStatus: "FAIL",
        verdict: "BLOCKED",
      };
    }

    ex = budget.exhausted();
    if (ex.exhausted) return budgetBlocked(ex.reason!, "injection");

    // --- Semantic intent judgment (novel phrasings that regex lists miss) ---
    const startSemantic = Date.now();
    const semanticResult = judgeSemantic([task.description, task.operation || ""].join(" "));
    const semanticBlocked = semanticResult.action === "BLOCK";
    budget.spend(Date.now() - startSemantic);
    if (semanticBlocked) {
      const totalMs = Date.now() - startTotal;
      this.merkleAudit.record({
        timestamp: new Date().toISOString(),
        taskId,
        taskDescription: task.description,
        stage: "semantic",
        decision: "BLOCKED",
        detail: { score: semanticResult.score, reasons: semanticResult.reasons },
      });
      this.metrics.push({
        classification_ms: classifyMs,
        risk_assessment_ms: riskMs,
        policy_evaluation_ms: 0,
        guard_check_ms: 0,
        proof_verification_ms: 0,
        pipeline_total_ms: totalMs,
      });
      return {
        taskId,
        taskType: taskType!,
        riskLevel: riskLevel!,
        policyDecision: {
          decision: "BLOCKED",
          policy: null,
          proofsRequired: [],
          humanApproval: false,
          reason: `Semantic hijack intent: ${semanticResult.reasons.join(", ")}`,
        },
        guardDecision: "BLOCKED",
        proofStatus: "FAIL",
        verdict: "BLOCKED",
      };
    }
    // Optional model-backed judge (e.g. a free-tier model) consulted only
    // when the heuristic did not already block.
    if (judgeProvider && !semanticBlocked) {
      try {
        const ext = await judgeProvider.judge([task.description, task.operation || ""].join(" "));
        if (ext.flagged && ext.confidence >= 0.7) {
          const totalMs = Date.now() - startTotal;
          this.merkleAudit.record({
            timestamp: new Date().toISOString(),
            taskId,
            taskDescription: task.description,
            stage: "semantic",
            decision: "BLOCKED",
            detail: { provider: true, confidence: ext.confidence, reason: ext.reason },
          });
          this.metrics.push({
            classification_ms: classifyMs,
            risk_assessment_ms: riskMs,
            policy_evaluation_ms: 0,
            guard_check_ms: 0,
            proof_verification_ms: 0,
            pipeline_total_ms: totalMs,
          });
          return {
            taskId,
            taskType: taskType!,
            riskLevel: riskLevel!,
            policyDecision: {
              decision: "BLOCKED",
              policy: null,
              proofsRequired: [],
              humanApproval: false,
              reason: `Model judge flagged: ${ext.reason ?? "hijack intent"}`,
            },
            guardDecision: "BLOCKED",
            proofStatus: "FAIL",
            verdict: "BLOCKED",
          };
        }
      } catch {
        // A failing external judge must never fail the pipeline open or closed.
      }
    }

    ex = budget.exhausted();
    if (ex.exhausted) return budgetBlocked(ex.reason!, "semantic");

    // --- MCP Governance (tool poisoning / rug-pull) ---
    const mcpManifest = (task.data as Record<string, unknown> | undefined)?.mcpManifest as
      McpManifest | undefined;
    if (mcpManifest) {
      const mcpResult = this.getMcpGovernance().verifyManifest(mcpManifest);
      if (!mcpResult.valid) {
        const totalMs = Date.now() - startTotal;
        this.merkleAudit.record({
          timestamp: new Date().toISOString(),
          taskId,
          taskDescription: task.description,
          stage: "mcp",
          decision: "BLOCKED",
          detail: { reason: mcpResult.reason, changes: mcpResult.changes },
        });
        this.metrics.push({
          classification_ms: classifyMs,
          risk_assessment_ms: riskMs,
          policy_evaluation_ms: 0,
          guard_check_ms: 0,
          proof_verification_ms: 0,
          pipeline_total_ms: totalMs,
        });
        return {
          taskId,
          taskType: taskType!,
          riskLevel: riskLevel!,
          policyDecision: {
            decision: "BLOCKED",
            policy: null,
            proofsRequired: [],
            humanApproval: false,
            reason: `MCP manifest rejected: ${mcpResult.reason}`,
          },
          guardDecision: "BLOCKED",
          proofStatus: "FAIL",
          verdict: "BLOCKED",
        };
      }
    }

    // --- Anomaly Detection ---
    const startAnomaly = Date.now();
    anomalyResult = this.anomalyDetector.analyze(taskWithRisk, riskLevel, taskWithType.taskType);
    this.anomalyDetector.updateBaseline(taskWithType.taskType, riskLevel, task.description.length);
    this.persistState();
    anomalyMs = Date.now() - startAnomaly;
    budget.spend(anomalyMs);

    ex = budget.exhausted();
    if (ex.exhausted) return budgetBlocked(ex.reason!, "anomaly");

    const startPolicy = Date.now();
    const engineMode = loadMode().mode;
    policyDecision = this.policyEngine.evaluatePolicy(taskWithRisk, engineMode);
    policyMs = Date.now() - startPolicy;
    budget.spend(policyMs);
    this.logAuditEntry({
      timestamp: new Date().toISOString(),
      taskId,
      taskDescription: task.description,
      stage: "policy",
      input: taskWithRisk,
      output: policyDecision.decision,
      decision: policyDecision.decision as "APPROVED" | "BLOCKED" | "PENDING",
      duration_ms: policyMs,
    });

    ex = budget.exhausted();
    if (ex.exhausted) return budgetBlocked(ex.reason!, "policy");

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
        taskType: taskType!,
        riskLevel: riskLevel!,
        policyDecision,
        guardDecision: "ALLOWED",
        proofStatus: "FAIL",
        verdict: "BLOCKED",
      };
    }

    const startGuard = Date.now();
    ex = budget.exhausted();
    if (ex.exhausted) return budgetBlocked(ex.reason!, "guard");

    if (!task || typeof task.description !== "string" || !task.description.trim()) {
      guardMs = Date.now() - startGuard;
      budget.spend(guardMs);
      const totalMs = Date.now() - startTotal;
      this.merkleAudit.record({
        timestamp: new Date().toISOString(),
        taskId,
        taskDescription: task.description,
        stage: "guard",
        decision: "BLOCKED",
        detail: { reason: "blank description" },
      });
      this.metrics.push({
        classification_ms: classifyMs,
        risk_assessment_ms: riskMs,
        policy_evaluation_ms: policyMs,
        guard_check_ms: guardMs,
        proof_verification_ms: 0,
        pipeline_total_ms: totalMs,
      });
      return {
        taskId,
        taskType: taskType!,
        riskLevel: riskLevel!,
        policyDecision: policyDecision!,
        guardDecision: "ALLOWED",
        proofStatus: "FAIL",
        verdict: "BLOCKED",
      };
    }
    // Guard evaluation with hard timeout (anti Guardrail-DoS)
    const guardCheckStart = Date.now();
    const guardResult = this.checkGuards(task.description);
    const guardCheckElapsed = Date.now() - guardCheckStart;
    if (guardCheckElapsed > GovernanceOrchestrator.GUARD_TIMEOUT_MS) {
      console.warn(
        `[GovernanceOrchestrator] guard timeout after ${guardCheckElapsed}ms (limit ${GovernanceOrchestrator.GUARD_TIMEOUT_MS}ms)`
      );
      guardMs = Date.now() - startGuard;
      budget.spend(guardMs);
      const totalMs = Date.now() - startTotal;
      this.merkleAudit.record({
        timestamp: new Date().toISOString(),
        taskId,
        taskDescription: task.description,
        stage: "guard",
        decision: "BLOCKED",
        detail: { reason: "guard timeout", elapsed: guardCheckElapsed },
      });
      this.metrics.push({
        classification_ms: classifyMs,
        risk_assessment_ms: riskMs,
        policy_evaluation_ms: policyMs,
        guard_check_ms: guardCheckElapsed,
        proof_verification_ms: 0,
        pipeline_total_ms: totalMs,
      });
      this.logAuditEntry({
        timestamp: new Date().toISOString(),
        taskId,
        taskDescription: task.description,
        stage: "guard",
        input: task.description,
        output: "BLOCKED",
        decision: "BLOCKED",
        duration_ms: guardCheckElapsed,
        reason: "guard timeout",
      });
      return {
        taskId,
        taskType: taskType!,
        riskLevel: riskLevel!,
        policyDecision: policyDecision!,
        guardDecision: "BLOCKED",
        proofStatus: "FAIL",
        verdict: "BLOCKED",
      };
    }
    // Also exercise GuardOverrides timeout helper for coverage (sync, trivial)
    // This ensures budget is checked before guard and timeout is enforced.
    const guardOverridesResult = this.guardOverrides.checkWithBudget(
      taskWithRisk,
      budget,
      GovernanceOrchestrator.GUARD_TIMEOUT_MS
    );
    if (
      guardOverridesResult.decision === "BLOCKED" &&
      guardOverridesResult.reason.includes("budget")
    ) {
      return budgetBlocked(guardOverridesResult.reason, "guard");
    }
    if (
      guardOverridesResult.decision === "BLOCKED" &&
      guardOverridesResult.reason === "guard timeout"
    ) {
      guardMs = Date.now() - startGuard;
      budget.spend(guardMs);
      const totalMs = Date.now() - startTotal;
      this.merkleAudit.record({
        timestamp: new Date().toISOString(),
        taskId,
        taskDescription: task.description,
        stage: "guard",
        decision: "BLOCKED",
        detail: { reason: "guard timeout", elapsed: guardCheckElapsed },
      });
      this.metrics.push({
        classification_ms: classifyMs,
        risk_assessment_ms: riskMs,
        policy_evaluation_ms: policyMs,
        guard_check_ms: guardMs,
        proof_verification_ms: 0,
        pipeline_total_ms: totalMs,
      });
      return {
        taskId,
        taskType: taskType!,
        riskLevel: riskLevel!,
        policyDecision: policyDecision!,
        guardDecision: "BLOCKED",
        proofStatus: "FAIL",
        verdict: "BLOCKED",
      };
    }

    guardMs = Date.now() - startGuard;
    budget.spend(guardMs);
    this.logAuditEntry({
      timestamp: new Date().toISOString(),
      taskId,
      taskDescription: task.description,
      stage: "guard",
      input: task.description,
      output: guardResult.decision,
      decision: guardResult.decision === "ALLOWED" ? "APPROVED" : guardResult.decision,
      duration_ms: guardMs,
      reason: guardResult.reason,
    });

    ex = budget.exhausted();
    if (ex.exhausted) return budgetBlocked(ex.reason!, "guard");

    // --- Static rules (Semgrep-spirit code scan) ---
    const startStatic = Date.now();
    const staticReport = scanStatic([task.description, task.operation || ""].join("\n"));
    budget.spend(Date.now() - startStatic);
    this.logAuditEntry({
      timestamp: new Date().toISOString(),
      taskId,
      taskDescription: task.description,
      stage: "guard",
      input: { staticRules: staticReport.rulesEvaluated },
      output: { blocked: staticReport.blocked, findings: staticReport.findings.length },
      decision: staticReport.blocked ? "BLOCKED" : "APPROVED",
      duration_ms: Date.now() - startStatic,
    });

    ex = budget.exhausted();
    if (ex.exhausted) return budgetBlocked(ex.reason!, "static");

    const startProof = Date.now();
    const proofChain = this.proofVerifier.generateProofChain(
      { ...taskWithRisk, id: taskId },
      policyDecision.policy!,
      evidence
    );

    const proofStatus = this.proofVerifier.verifyProofChain(
      proofChain,
      { ...taskWithRisk, id: taskId },
      evidence
    );
    const requiredProofs = policyDecision.proofsRequired || [];
    const hasAllRequiredProofs = this.proofVerifier.checkMinimumProofs(proofChain, requiredProofs);
    proofMs = Date.now() - startProof;
    budget.spend(proofMs);
    this.logAuditEntry({
      timestamp: new Date().toISOString(),
      taskId,
      taskDescription: task.description,
      stage: "proof",
      input: { requiredProofs, proofCount: proofChain.proofs.length },
      output: { proofStatus, hasAllRequiredProofs },
      decision: proofStatus === "PASS" && hasAllRequiredProofs ? "APPROVED" : "BLOCKED",
      duration_ms: proofMs,
    });

    ex = budget.exhausted();
    if (ex.exhausted) {
      const totalMs = Date.now() - startTotal;
      this.merkleAudit.record({
        timestamp: new Date().toISOString(),
        taskId,
        taskDescription: task.description,
        stage: "final",
        decision: "BLOCKED",
        detail: {
          taskType,
          riskLevel,
          policyDecision: policyDecision.decision,
          guardDecision: guardResult.decision,
          proofStatus,
          anomalyScore: anomalyResult!.score,
          injectionDetected: injectionReport.action !== "ALLOW",
          semanticScore: semanticResult.score,
          staticBlocked: staticReport.blocked,
          evidenceProvided: Object.keys(evidence),
          reason: ex.reason,
          budgetExceeded: true,
        },
      });
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
        taskType: taskType!,
        riskLevel: riskLevel!,
        policyDecision: { ...policyDecision!, decision: "BLOCKED", reason: ex.reason! },
        guardDecision: guardResult.decision === "WARN" ? "BLOCKED" : guardResult.decision,
        proofStatus,
        verdict: "BLOCKED",
      };
    }

    let verdict: "APPROVED" | "BLOCKED" | "REJECTED" = "APPROVED";

    if (guardResult.decision === "BLOCKED") {
      verdict = "BLOCKED";
    } else if (guardResult.decision === "WARN") {
      verdict = "BLOCKED";
    } else if (semanticResult.action === "WARN") {
      verdict = "BLOCKED";
    } else if (staticReport.blocked) {
      verdict = "BLOCKED";
    } else if (anomalyResult!.isAnomalous && anomalyResult!.category === "anomalous") {
      verdict = "BLOCKED";
    } else if (proofStatus === "FAIL") {
      verdict = "BLOCKED";
    } else if (proofStatus === "PENDING") {
      verdict = "BLOCKED";
    } else if (!hasAllRequiredProofs) {
      verdict = "BLOCKED";
    } else if (policyDecision.humanApproval && !this.hasHumanApproval(proofChain)) {
      verdict = "BLOCKED";
    }

    const totalMs = Date.now() - startTotal;

    this.logAuditEntry({
      timestamp: new Date().toISOString(),
      taskId,
      taskDescription: task.description,
      stage: "final",
      input: { taskType, riskLevel, guardResult: guardResult.decision },
      output: verdict,
      decision: verdict as "APPROVED" | "BLOCKED",
      duration_ms: totalMs,
    });

    // --- Merkle Audit Trail ---
    this.merkleAudit.record({
      timestamp: new Date().toISOString(),
      taskId,
      taskDescription: task.description,
      stage: "final",
      decision: verdict,
      detail: {
        taskType,
        riskLevel,
        policyDecision: policyDecision.decision,
        guardDecision: guardResult.decision,
        proofStatus,
        anomalyScore: anomalyResult!.score,
        injectionDetected: injectionReport.action !== "ALLOW",
        engineMode,
        semanticScore: semanticResult.score,
        semanticReasons: semanticResult.reasons,
        staticBlocked: staticReport.blocked,
        staticFindings: staticReport.findings.map((f) => `${f.ruleId}:${f.severity}`),
        evidenceProvided: Object.keys(evidence),
      },
    });

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
      taskType: taskType!,
      riskLevel: riskLevel!,
      policyDecision: policyDecision!,
      guardDecision: guardResult.decision === "WARN" ? "BLOCKED" : guardResult.decision,
      proofStatus,
      verdict,
    };
  }

  private checkMinimumProofs(chain: ProofChain, required: ProofType[]): boolean {
    return this.proofVerifier.checkMinimumProofs(chain, required);
  }

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
    const keys = [
      "classification_ms",
      "risk_assessment_ms",
      "policy_evaluation_ms",
      "guard_check_ms",
      "proof_verification_ms",
      "pipeline_total_ms",
    ] as const;
    const result: any = {};
    for (const key of keys) {
      const sorted = [...this.metrics.map((m) => m[key])].sort((a, b) => a - b);
      const index = Math.ceil((parseInt(p) / 100) * sorted.length) - 1;
      result[key] = sorted[Math.max(0, index)];
    }
    return result;
  }

  private computeAverages(): PerformanceMetrics {
    const keys = [
      "classification_ms",
      "risk_assessment_ms",
      "policy_evaluation_ms",
      "guard_check_ms",
      "proof_verification_ms",
      "pipeline_total_ms",
    ] as const;
    const result: any = {};
    const count = this.metrics.length;
    for (const key of keys) {
      result[key] = this.metrics.reduce((sum, m) => sum + (m as any)[key], 0) / count;
    }
    return result;
  }

  clearMetrics(): void {
    this.metrics = [];
  }

  getMetricsCount(): number {
    return this.metrics.length;
  }

  // Human approval (Art.14) — valid only when proof-verifier derived PASS from a signed ApprovalToken
  private hasHumanApproval(chain: ProofChain): boolean {
    const humanProof = chain.proofs.find((p) => p.type === ProofType.HUMAN_APPROVAL);
    return humanProof ? humanProof.status === "PASS" : false;
  }

  private generateId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private normalizeForGuards(text: string): string {
    const confusables: Record<string, string> = {
      "\u0430": "a",
      "\u0435": "e",
      "\u043E": "o",
      "\u0440": "r",
      "\u0441": "c",
      "\u0443": "y",
      "\u0445": "x",
      "\u0432": "B",
      "\u043C": "M",
      "\u043D": "H",
      "\u0442": "T",
      "\u0444": "f",
      "\u0448": "W",
      "\u0433": "r",
      "\u0438": "u",
      "\u043A": "k",
      "\u043B": "b",
      "\u0434": "d",
      "\u0436": "w",
      "\u0437": "z",
      "\u044D": "e",
      "\u044E": "o",
      "\u044F": "q",
      "\uFF41": "a",
      "\uFF42": "b",
      "\uFF43": "c",
      "\uFF44": "d",
      "\uFF45": "e",
      "\uFF46": "f",
      "\uFF47": "g",
      "\uFF48": "h",
      "\uFF49": "i",
      "\uFF4A": "j",
      "\uFF4B": "k",
      "\uFF4C": "l",
      "\uFF4D": "m",
      "\uFF4E": "n",
      "\uFF4F": "o",
      "\uFF50": "p",
      "\uFF51": "q",
      "\uFF52": "r",
      "\uFF53": "s",
      "\uFF54": "t",
      "\uFF55": "u",
      "\uFF56": "v",
      "\uFF57": "w",
      "\uFF58": "x",
      "\uFF59": "y",
      "\uFF5A": "z",
    };
    let result = text.normalize("NFC");
    result = result.replace(/[\u200B-\u200F\uFEFF\u034F\u180E\u2060]/g, "");
    for (const [from, to] of Object.entries(confusables)) {
      result = result.split(from).join(to);
    }
    return result;
  }

  private checkGuards(description: string): {
    decision: "BLOCKED" | "ALLOWED" | "WARN";
    reason: string;
  } {
    const searchText = this.normalizeForGuards(description);
    const dangerousPatterns = [
      {
        pattern: /rm\s+-rf\s+\/\S?/i,
        action: "BLOCKED" as const,
        reason: "Recursive root delete blocked",
      },
      {
        pattern: /rm\s+-rf\s+\*/i,
        action: "BLOCKED" as const,
        reason: "Recursive wildcard delete blocked",
      },
      { pattern: /rm\s+-[rf]/i, action: "BLOCKED" as const, reason: "Recursive delete blocked" },
      { pattern: /mkfs/i, action: "BLOCKED" as const, reason: "Filesystem format blocked" },
      { pattern: /dd\s+if=/i, action: "BLOCKED" as const, reason: "Direct disk write blocked" },
      {
        pattern: /curl\s+.*\|\s*sh/i,
        action: "BLOCKED" as const,
        reason: "Pipe to shell execution blocked",
      },
      {
        pattern: /format\s+.*\.env/i,
        action: "BLOCKED" as const,
        reason: "Env file overwrite blocked",
      },
      {
        pattern: /truncate\s+table/i,
        action: "BLOCKED" as const,
        reason: "Table truncate blocked",
      },
      {
        pattern: /DELETE\s+FROM\s+\w+\s*;/i,
        action: "BLOCKED" as const,
        reason: "Unqualified DELETE blocked",
      },
      {
        pattern: /chmod\s+777/i,
        action: "BLOCKED" as const,
        reason: "World-writable permissions blocked",
      },
      { pattern: /shred\s+/i, action: "BLOCKED" as const, reason: "Secure delete blocked" },
      { pattern: /shutdown/i, action: "BLOCKED" as const, reason: "System shutdown blocked" },
      { pattern: /reboot/i, action: "BLOCKED" as const, reason: "System reboot blocked" },
      { pattern: /halt/i, action: "BLOCKED" as const, reason: "System halt blocked" },
      { pattern: /:\(\)\s*:\|:\s*&/i, action: "BLOCKED" as const, reason: "Fork bomb blocked" },
      {
        pattern: /git\s+push\s+--force/i,
        action: "WARN" as const,
        reason: "Force push requires review",
      },
      {
        pattern: /git\s+reset\s+--hard/i,
        action: "WARN" as const,
        reason: "Hard reset can cause data loss",
      },
      {
        pattern: /npm\s+publish/i,
        action: "WARN" as const,
        reason: "Package publish requires review",
      },
    ];

    for (const guard of dangerousPatterns) {
      if (guard.pattern.test(searchText)) {
        return { decision: guard.action, reason: guard.reason };
      }
    }
    return { decision: "ALLOWED", reason: "No guard match" };
  }

  private async executeWorker(task: TaskSpec): Promise<{
    success: boolean;
    output?: string;
    error?: string;
    provider?: string;
    statusCode?: number;
  }> {
    const WORKER_CHAIN = ["worker-codestral", "worker-groq", "worker-zhipu", "worker-novita"];
    const maxRetries = WORKER_CHAIN.length;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const worker = WORKER_CHAIN[attempt];
      try {
        const result = await this.runWorkerWithTimeout(worker, task);
        if (result.success) {
          return { success: true, output: result.output, provider: worker, statusCode: 200 };
        }
        if (result.statusCode === 429 && attempt < maxRetries - 1) continue;
        return {
          success: false,
          error: result.error,
          provider: worker,
          statusCode: result.statusCode,
        };
      } catch (err) {
        if (attempt < maxRetries - 1) continue;
        return { success: false, error: (err as Error).message, provider: worker };
      }
    }
    return { success: false, error: "All workers exhausted", provider: undefined, statusCode: 0 };
  }

  private async runWorkerWithTimeout(
    worker: string,
    task: TaskSpec
  ): Promise<{ success: boolean; output?: string; error?: string; statusCode?: number }> {
    return new Promise((resolve) => {
      setTimeout(
        () => {
          if (worker === "worker-codestral") {
            resolve({
              success: true,
              output: `Executed by ${worker}: ${task.description.substring(0, 50)}...`,
            });
          } else {
            const is429 = Math.random() > 0.5;
            if (is429) {
              resolve({ success: false, error: "Rate limit exceeded", statusCode: 429 });
            } else {
              resolve({
                success: true,
                output: `Executed by ${worker}: ${task.description.substring(0, 50)}...`,
              });
            }
          }
        },
        50 + Math.random() * 100
      );
    });
  }

  getSummary(): { policiesLoaded: number; version: string } {
    return { policiesLoaded: this.policyEngine.getPolicyCount(), version: VERSION };
  }

  getMerkleAudit(): MerkleAuditTrail {
    return this.merkleAudit;
  }

  getAnomalyDetector(): AnomalyDetector {
    return this.anomalyDetector;
  }

  getInjectionDetector(): InjectionDetector {
    return this.injectionDetector;
  }

  getMcpGovernanceInstance(): McpGovernance {
    return this.getMcpGovernance();
  }

  /** Persist anomaly state when a StateStore was supplied (opt-in). */
  private persistState(): void {
    if (!this.stateStore) return;
    this.anomalyDetector.save(this.stateStore, "anomaly");
  }

  private auditEntries: GovernanceAuditEntry[] = [];

  private logAuditEntry(entry: GovernanceAuditEntry): void {
    // Redact secrets before buffering/persisting (record occurrence, never value).
    const cleanInput = redactDeep(entry.input);
    const cleanOutput = redactDeep(entry.output);
    const cleanDesc =
      typeof entry.taskDescription === "string"
        ? redactSecrets(entry.taskDescription).text
        : entry.taskDescription;
    const redactionCount =
      cleanInput.redactions.reduce((n, r) => n + r.count, 0) +
      cleanOutput.redactions.reduce((n, r) => n + r.count, 0);
    entry = {
      ...entry,
      taskDescription: cleanDesc,
      input: cleanInput.value,
      output: cleanOutput.value,
      ...(redactionCount > 0
        ? { reason: `${entry.reason ?? ""} [${redactionCount} secret(s) redacted]`.trim() }
        : {}),
    };
    this.auditEntries.push(entry);
    const logDir = join(process.cwd(), "logs");
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
    const date = new Date().toISOString().split("T")[0];
    const logFile = join(logDir, `governance-audit-${date}.jsonl`);
    const line = JSON.stringify(entry) + "\n";
    try {
      appendFileSync(logFile, line, "utf8");
    } catch {
      console.error("[Audit] Failed to write to log file");
    }
  }

  getAuditLog(): GovernanceAuditEntry[] {
    return [...this.auditEntries];
  }

  clearAuditLog(): void {
    this.auditEntries = [];
  }
}
