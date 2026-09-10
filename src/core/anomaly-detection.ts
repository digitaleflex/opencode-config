// src/core/anomaly-detection.ts — Behavioral Anomaly Detection
// Detects unusual patterns in task submissions using Mahalanobis distance
// (multivariate correlation) and frequency baseline deviation.
// Inspired by Aegis (pDFA), OWASP Agentic, Agent Flight Recorder.

import { TaskSpec, TaskType, RiskLevel } from "./types";
import { StateStore } from "./state-store";

export interface AnomalyResult {
  isAnomalous: boolean;
  score: number; // 0-1, higher = more anomalous
  reasons: string[];
  category: "normal" | "suspicious" | "anomalous";
  mahalanobisDistance?: number;
}

export interface Baseline {
  taskTypeCounts: Map<string, number>;
  riskLevelCounts: Map<string, number>;
  avgDescriptionLength: number;
  maxFrequencyPerMinute: Map<string, number>;
  totalTasks: number;
  lastUpdated: string;
  // Mahalanobis: mean and covariance for feature vector [taskTypeEntropy, riskLevel, descLength, burstCount]
  mean: [number, number, number, number];
  covarianceInverse: number[][]; // 4x4 inverse covariance matrix
  sampleCount: number;
}

const RISK_TO_NUM: Record<string, number> = { LOW: 0, MEDIUM: 0.5, HIGH: 1, CRITICAL: 1.5 };
const TASK_TYPE_ORDER = ["FEATURE", "BUGFIX", "REFACTOR", "RESEARCH", "CONFIG", "TEST"];

export class AnomalyDetector {
  private recentTasks: { timestamp: number; taskType: TaskType; riskLevel: RiskLevel }[] = [];
  private baseline: Baseline;
  private readonly WINDOW_MS = 60_000; // 1 minute sliding window
  private readonly ANOMALY_THRESHOLD = 0.7;
  private readonly SUSPICIOUS_THRESHOLD = 0.4;
  private readonly MAHALANOBIS_ANOMALY_THRESHOLD = 3.5; // chi-squared threshold for d=4, p=0.01

  constructor() {
    this.baseline = this.createDefaultBaseline();
  }

  /**
   * Analyze a task for anomalous behavior using Mahalanobis distance + frequency heuristics.
   */
  analyze(task: TaskSpec, riskLevel: RiskLevel, taskType: TaskType): AnomalyResult {
    const now = Date.now();
    const reasons: string[] = [];
    let score = 0;

    // Prune old entries
    this.recentTasks = this.recentTasks.filter((t) => now - t.timestamp < this.WINDOW_MS);

    // 1. Mahalanobis distance (multivariate anomaly)
    const featureVector = this.buildFeatureVector(taskType, riskLevel, task);
    const md = this.mahalanobisDistance(featureVector);
    let mahalanobisDistance: number | undefined;

    if (md > this.MAHALANOBIS_ANOMALY_THRESHOLD) {
      const mdScore = Math.min(md / 6, 1); // Normalize: 6 sigma = max score
      score += mdScore;
      reasons.push(`Mahalanobis distance ${md.toFixed(2)} exceeds threshold`);
      mahalanobisDistance = md;
    }

    // 2. Frequency burst analysis
    const burstScore = this.checkBurstPattern(taskType, now);
    if (burstScore > 0) {
      score += burstScore;
      reasons.push(`Burst of ${taskType} tasks detected`);
    }

    // 3. Risk escalation pattern
    const riskScore = this.checkRiskEscalation(riskLevel);
    if (riskScore > 0) {
      score += riskScore;
      reasons.push("Rapid risk level escalation detected");
    }

    // 4. Deceptive pattern: innocent-then-dangerous sequence
    const patternScore = this.checkDeceptivePattern(taskType, riskLevel);
    if (patternScore > 0) {
      score += patternScore;
      reasons.push("Potentially deceptive task sequence detected");
    }

    // 5. Baseline deviation: task type distribution shift
    const deviationScore = this.checkBaselineDeviation(taskType);
    if (deviationScore > 0) {
      score += deviationScore;
      reasons.push("Task type distribution deviates from baseline");
    }

    // Record this task
    this.recentTasks.push({ timestamp: now, taskType, riskLevel });
    this.updateBaseline(taskType, riskLevel, task.description?.length ?? 0);

    // Normalize score to 0-1
    const normalizedScore = Math.min(score / 1.5, 1);

    let category: AnomalyResult["category"] = "normal";
    if (normalizedScore >= this.ANOMALY_THRESHOLD) category = "anomalous";
    else if (normalizedScore >= this.SUSPICIOUS_THRESHOLD) category = "suspicious";

    return {
      isAnomalous: category !== "normal",
      score: normalizedScore,
      reasons,
      category,
      mahalanobisDistance,
    };
  }

  /**
   * Update the baseline with a new task observation.
   */
  updateBaseline(taskType: TaskType, riskLevel: RiskLevel, descriptionLength: number): void {
    this.baseline.taskTypeCounts.set(taskType, (this.baseline.taskTypeCounts.get(taskType) || 0) + 1);
    this.baseline.riskLevelCounts.set(riskLevel, (this.baseline.riskLevelCounts.get(riskLevel) || 0) + 1);
    this.baseline.totalTasks++;

    // Running average for description length
    this.baseline.avgDescriptionLength =
      (this.baseline.avgDescriptionLength * (this.baseline.totalTasks - 1) + descriptionLength) /
      this.baseline.totalTasks;

    // Incrementally update mean and covariance (Welford's online algorithm)
    this.baseline.sampleCount++;
    this.updateCovarianceOnline();

    this.baseline.lastUpdated = new Date().toISOString();
  }

  getBaseline(): Baseline {
    return {
      ...this.baseline,
      mean: [...this.baseline.mean],
      covarianceInverse: this.baseline.covarianceInverse.map((row) => [...row]),
    };
  }

  // --- Mahalanobis distance ---

  private buildFeatureVector(taskType: TaskType, riskLevel: RiskLevel, task: TaskSpec): [number, number, number, number] {
    // Feature 1: task type entropy (how unexpected is this type given baseline)
    const typeIdx = TASK_TYPE_ORDER.indexOf(taskType);
    const typeEntropy = typeIdx >= 0 ? typeIdx / (TASK_TYPE_ORDER.length - 1) : 0.5;

    // Feature 2: risk level numeric
    const riskNum = RISK_TO_NUM[riskLevel] ?? 0.5;

    // Feature 3: description length (normalized)
    const descLen = Math.min((task.description?.length ?? 0) / 500, 1);

    // Feature 4: burst count (tasks of this type in window)
    const now = Date.now();
    const burstCount = Math.min(
      this.recentTasks.filter((t) => t.taskType === taskType && now - t.timestamp < this.WINDOW_MS).length / 10,
      1
    );

    return [typeEntropy, riskNum, descLen, burstCount];
  }

  private mahalanobisDistance(x: [number, number, number, number]): number {
    const { mean, covarianceInverse } = this.baseline;
    if (this.baseline.sampleCount < 10) return 0; // Not enough data

    // d = sqrt((x - mu)^T * Sigma^{-1} * (x - mu))
    const dx = [x[0] - mean[0], x[1] - mean[1], x[2] - mean[2], x[3] - mean[3]];

    // Matrix multiply: dx^T * Sigma^{-1} * dx
    let sum = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        sum += dx[i] * covarianceInverse[i][j] * dx[j];
      }
    }

    return Math.sqrt(Math.max(sum, 0));
  }

  private updateCovarianceOnline(): void {
    const n = this.baseline.sampleCount;
    if (n < 2) return;

    // Simplified: recompute from recent observations (last 50)
    const recent = this.recentTasks.slice(-50);
    if (recent.length < 5) return;

    const vectors = recent.map((t) => {
      const typeIdx = TASK_TYPE_ORDER.indexOf(t.taskType);
      return [
        typeIdx >= 0 ? typeIdx / (TASK_TYPE_ORDER.length - 1) : 0.5,
        RISK_TO_NUM[t.riskLevel] ?? 0.5,
        0.5, // avg desc length placeholder
        0.5, // avg burst placeholder
      ];
    });

    // Compute mean
    const mean: [number, number, number, number] = [0, 0, 0, 0];
    for (const v of vectors) {
      for (let i = 0; i < 4; i++) mean[i] += v[i];
    }
    for (let i = 0; i < 4; i++) mean[i] /= vectors.length;
    this.baseline.mean = mean;

    // Compute covariance
    const cov: number[][] = Array.from({ length: 4 }, () => Array(4).fill(0));
    for (const v of vectors) {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          cov[i][j] += (v[i] - mean[i]) * (v[j] - mean[j]);
        }
      }
    }
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        cov[i][j] /= vectors.length - 1;
      }
    }

    // Add small regularization to prevent singular matrix
    for (let i = 0; i < 4; i++) cov[i][i] += 0.01;

    // Compute inverse (4x4 explicit)
    this.baseline.covarianceInverse = this.invert4x4(cov);
  }

  private invert4x4(m: number[][]): number[][] {
    // Gauss-Jordan elimination for 4x4 matrix
    const n = 4;
    const augmented = m.map((row, i) => [...row, ...Array(n).fill(0).map((_, j) => (i === j ? 1 : 0))]);

    for (let col = 0; col < n; col++) {
      // Find pivot
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) maxRow = row;
      }
      [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

      const pivot = augmented[col][col];
      if (Math.abs(pivot) < 1e-10) continue; // Singular, skip

      for (let j = 0; j < 2 * n; j++) augmented[col][j] /= pivot;

      for (let row = 0; row < n; row++) {
        if (row === col) continue;
        const factor = augmented[row][col];
        for (let j = 0; j < 2 * n; j++) augmented[row][j] -= factor * augmented[col][j];
      }
    }

    return augmented.map((row) => row.slice(n));
  }

  // --- Existing heuristic checks ---

  private checkBurstPattern(taskType: TaskType, now: number): number {
    const recentOfType = this.recentTasks.filter(
      (t) => t.taskType === taskType && now - t.timestamp < this.WINDOW_MS
    );

    if (recentOfType.length > 15) return 1.5;
    if (recentOfType.length > 10) return 1.0;
    if (recentOfType.length > 5) return 0.5;
    return 0;
  }

  private checkRiskEscalation(currentRisk: RiskLevel): number {
    if (this.recentTasks.length < 2) return 0;

    const recent = this.recentTasks.slice(-5);
    const riskOrder: Record<string, number> = { LOW: 0, MEDIUM: 0.5, HIGH: 1, CRITICAL: 2 };
    let escalationCount = 0;

    for (let i = 1; i < recent.length; i++) {
      if ((riskOrder[recent[i].riskLevel] ?? 0) > (riskOrder[recent[i - 1].riskLevel] ?? 0)) {
        escalationCount++;
      }
    }

    if (escalationCount >= 3) return 1.0;
    if (escalationCount >= 2) return 0.5;
    return 0;
  }

  private checkDeceptivePattern(taskType: TaskType, riskLevel: RiskLevel): number {
    if (this.recentTasks.length < 3) return 0;

    const recent = this.recentTasks.slice(-10);
    const lowCount = recent.filter((t) => t.riskLevel === "LOW").length;
    const highCount = recent.filter((t) => t.riskLevel === "CRITICAL" || t.riskLevel === "HIGH").length;

    if (lowCount >= 5 && riskLevel === "CRITICAL" && highCount === 0) return 0.8;
    if (lowCount >= 3 && riskLevel === "CRITICAL") return 0.4;

    return 0;
  }

  private checkBaselineDeviation(taskType: TaskType): number {
    if (this.baseline.totalTasks < 10) return 0;

    const expectedRatio = (this.baseline.taskTypeCounts.get(taskType) || 0) / this.baseline.totalTasks;
    const recentCount = this.recentTasks.filter((t) => t.taskType === taskType).length;
    const recentRatio = this.recentTasks.length > 0 ? recentCount / this.recentTasks.length : 0;

    if (expectedRatio > 0 && recentRatio > expectedRatio * 3) return 0.5;

    return 0;
  }

  // --- Persistence (État persistant #5) ---

  /**
   * Serialize detector state to a plain JSON-compatible object.
   * Maps are converted to arrays of entries for stable round-trip.
   */
  serialize(): unknown {
    return {
      baseline: {
        taskTypeCounts: Array.from(this.baseline.taskTypeCounts.entries()),
        riskLevelCounts: Array.from(this.baseline.riskLevelCounts.entries()),
        avgDescriptionLength: this.baseline.avgDescriptionLength,
        maxFrequencyPerMinute: Array.from(this.baseline.maxFrequencyPerMinute.entries()),
        totalTasks: this.baseline.totalTasks,
        lastUpdated: this.baseline.lastUpdated,
        mean: [...this.baseline.mean] as [number, number, number, number],
        covarianceInverse: this.baseline.covarianceInverse.map((row) => [...row]),
        sampleCount: this.baseline.sampleCount,
      },
      recentTasks: [...this.recentTasks],
    };
  }

  /**
   * Restore detector state from serialized data. Fail-open on corrupt input.
   */
  restore(data: unknown): void {
    try {
      if (!data || typeof data !== "object") return;
      const obj = data as Record<string, unknown>;

      if (obj.baseline && typeof obj.baseline === "object") {
        const b = obj.baseline as Record<string, unknown>;
        const taskTypeCounts = Array.isArray(b.taskTypeCounts)
          ? new Map<string, number>(b.taskTypeCounts as [string, number][])
          : new Map<string, number>();
        const riskLevelCounts = Array.isArray(b.riskLevelCounts)
          ? new Map<string, number>(b.riskLevelCounts as [string, number][])
          : new Map<string, number>();
        const maxFrequencyPerMinute = Array.isArray(b.maxFrequencyPerMinute)
          ? new Map<string, number>(b.maxFrequencyPerMinute as [string, number][])
          : new Map<string, number>();

        this.baseline = {
          taskTypeCounts,
          riskLevelCounts,
          avgDescriptionLength: typeof b.avgDescriptionLength === "number" ? b.avgDescriptionLength : 50,
          maxFrequencyPerMinute,
          totalTasks: typeof b.totalTasks === "number" ? b.totalTasks : 0,
          lastUpdated: typeof b.lastUpdated === "string" ? b.lastUpdated : new Date().toISOString(),
          mean: Array.isArray(b.mean) && (b.mean as number[]).length === 4
            ? ([...(b.mean as number[])] as [number, number, number, number])
            : [0.5, 0.25, 0.1, 0.1],
          covarianceInverse: Array.isArray(b.covarianceInverse)
            ? (b.covarianceInverse as number[][]).map((row) => [...row])
            : [
                [4, 0, 0, 0],
                [0, 4, 0, 0],
                [0, 0, 4, 0],
                [0, 0, 0, 4],
              ],
          sampleCount: typeof b.sampleCount === "number" ? b.sampleCount : 0,
        };
      }

      if (Array.isArray(obj.recentTasks)) {
        this.recentTasks = (obj.recentTasks as unknown[]).filter(
          (t): t is { timestamp: number; taskType: TaskType; riskLevel: RiskLevel } =>
            !!t &&
            typeof t === "object" &&
            typeof (t as Record<string, unknown>).timestamp === "number" &&
            typeof (t as Record<string, unknown>).taskType === "string" &&
            typeof (t as Record<string, unknown>).riskLevel === "string"
        ).map((t) => ({ ...t }));
        // Enforce window cap implicitly by keeping as-is (orchestrator prunes on next analyze)
      }
    } catch {
      // fail-open: keep current state on corrupt data
    }
  }

  /**
   * Static factory that deserializes a new instance from data.
   */
  static deserialize(data: unknown): AnomalyDetector {
    const inst = new AnomalyDetector();
    inst.restore(data);
    return inst;
  }

  /** Convenience: persist to a StateStore under the given name (default: "anomaly"). */
  save(store: StateStore, name = "anomaly"): void {
    store.save(name, this.serialize());
  }

  /** Convenience: load from a StateStore (fail-open). */
  load(store: StateStore, name = "anomaly"): void {
    const data = store.load(name);
    if (data) this.restore(data);
  }

  private createDefaultBaseline(): Baseline {
    return {
      taskTypeCounts: new Map(),
      riskLevelCounts: new Map(),
      avgDescriptionLength: 50,
      maxFrequencyPerMinute: new Map(),
      totalTasks: 0,
      lastUpdated: new Date().toISOString(),
      mean: [0.5, 0.25, 0.1, 0.1],
      covarianceInverse: [
        [4, 0, 0, 0],
        [0, 4, 0, 0],
        [0, 0, 4, 0],
        [0, 0, 0, 4],
      ],
      sampleCount: 0,
    };
  }
}
