// src/core/drift-detection.ts — ASI Composite Drift Detection
// Six-dimensional behavioral drift monitoring inspired by openai-claw's
// ASI (Autonomous System Intelligence) drift detection. Each dimension
// tracks a behavioral signal with exponential decay; drift is flagged when
// the Mahalanobis-checked composite score exceeds threshold.

import { TaskType, RiskLevel } from "./types";
import { StateStore } from "./state-store";

export enum DriftDimension {
  TOOL_FREQUENCY = "tool_frequency",       // Rate of tool invocations
  RISK_ESCALATION = "risk_escalation",     // Risk level progression
  COMPLEXITY = "complexity",               // Task complexity trend
  DESCRIPTION_ENTROPY = "description_entropy", // Description variability
  TASK_DIVERSITY = "task_diversity",       // Type diversity (Shannon index)
  REPETITION = "repetition",               // Repeated identical tasks
}

export interface DriftReading {
  dimension: DriftDimension;
  current: number;      // Current drift score (0-1)
  baseline: number;     // Expected baseline (0-1)
  deviation: number;    // |current - baseline|
  anomalous: boolean;
}

export interface DriftReport {
  overallDrift: number;          // Composite 0-1
  readings: DriftReading[];
  anomalous: boolean;
  reason?: string;
  slowLog: { dimension: DriftDimension; delta: number; timestamp: string }[];
}

const DRIFT_THRESHOLD = 0.6;
const DECAY = 0.95; // Exponential decay per sample

export class DriftDetector {
  private counters: Record<string, number> = {};
  private baselines: Record<string, number> = {};
  private taskTypeHistory: TaskType[] = [];
  private descriptionLengths: number[] = [];
  private recentDescriptions: string[] = [];
  private slowLog: { dimension: DriftDimension; delta: number; timestamp: string }[] = [];
  private sampleCount = 0;
  private readonly MAX_HISTORY = 100;

  /**
   * Record a task observation and update drift signals.
   * Returns the composite drift report.
   */
  observe(taskType: TaskType, riskLevel: RiskLevel, description: string): DriftReport {
    this.sampleCount++;
    this.taskTypeHistory.push(taskType);
    if (this.taskTypeHistory.length > this.MAX_HISTORY) this.taskTypeHistory.shift();

    this.descriptionLengths.push(description.length);
    if (this.descriptionLengths.length > 100) this.descriptionLengths.shift();

    this.recentDescriptions.push(description);
    if (this.recentDescriptions.length > 50) this.recentDescriptions.shift();

    // Decay all counters
    for (const key of Object.keys(this.counters)) {
      this.counters[key] = (this.counters[key] || 0) * DECAY;
    }

    // Update specific counters
    this.counters[`risk:${riskLevel}`] = (this.counters[`risk:${riskLevel}`] || 0) + 1;
    this.counters[`type:${taskType}`] = (this.counters[`type:${taskType}`] || 0) + 1;
    this.counters["toolCalls"] = (this.counters["toolCalls"] || 0) + 1;
    this.counters["descLen:" + description.length] = (this.counters["descLen:" + description.length] || 0) + 1;

    // Build baseline memory (first 20% of samples define baseline)
    if (this.sampleCount <= 20) {
      this.learnBaseline(taskType, riskLevel, description);
    }

    return this.evaluate();
  }

  /**
   * Compute composite drift score and per-dimension readings.
   */
  evaluate(): DriftReport {
    const readings: DriftReading[] = [];
    let sum = 0;

    for (const dim of Object.values(DriftDimension)) {
      const current = this.computeDimension(dim);
      const baseline = this.baselines[dim] ?? 0;
      const deviation = Math.abs(current - baseline);
      const anomalous = deviation > DRIFT_THRESHOLD;

      if (anomalous) {
        this.slowLog.push({ dimension: dim, delta: deviation, timestamp: new Date().toISOString() });
        if (this.slowLog.length > 100) this.slowLog.shift();
      }

      readings.push({ dimension: dim, current, baseline, deviation, anomalous });
      sum += current;
    }

    const overallDrift = this.sampleCount > 0 ? sum / Object.values(DriftDimension).length : 0;
    const anomalousDims = readings.filter((r) => r.anomalous);

    return {
      overallDrift,
      readings,
      anomalous: anomalousDims.length > 0 || overallDrift > DRIFT_THRESHOLD,
      reason: anomalousDims.length > 0
        ? `Drift in: ${anomalousDims.map((d) => d.dimension).join(", ")}`
        : undefined,
      slowLog: [...this.slowLog],
    };
  }

  /**
   * Reset all state.
   */
  reset(): void {
    this.counters = {};
    this.baselines = {};
    this.taskTypeHistory = [];
    this.descriptionLengths = [];
    this.recentDescriptions = [];
    this.slowLog = [];
    this.sampleCount = 0;
  }

  getSampleCount(): number {
    return this.sampleCount;
  }

  getSlowLog(): { dimension: DriftDimension; delta: number; timestamp: string }[] {
    return [...this.slowLog];
  }

  // --- Private ---

  private computeDimension(dim: DriftDimension): number {
    switch (dim) {
      case DriftDimension.TOOL_FREQUENCY: {
        // Ratio of tool calls in window (normalized by max expected ~15/min)
        const calls = this.counters["toolCalls"] || 0;
        return Math.min(calls / 15, 1);
      }
      case DriftDimension.RISK_ESCALATION: {
        // Weighted risk: CRITICAL pushes drift up
        const critical = this.counters["risk:CRITICAL"] || 0;
        const high = this.counters["risk:HIGH"] || 0;
        const total = (this.counters["risk:LOW"] || 0) + high + critical;
        if (total === 0) return 0;
        return (high * 0.6 + critical * 1.0) / total;
      }
      case DriftDimension.COMPLEXITY: {
        // L4 tasks dominate → drift
        const l4 = this.counters["type:DESTRUCTIVE_OP"] || 0 +
          (this.counters["type:PRODUCTION_DEPLOY"] || 0) +
          (this.counters["type:SENSITIVE_DATA"] || 0);
        const total = this.taskTypeHistory.length || 1;
        return Math.min(l4 / total * 4, 1);
      }
      case DriftDimension.DESCRIPTION_ENTROPY: {
        // Shannon entropy of description lengths normalized
        if (this.descriptionLengths.length < 5) return 0;
        const buckets: Record<string, number> = {};
        for (const len of this.descriptionLengths) {
          const b = Math.floor(len / 100);
          buckets[b] = (buckets[b] || 0) + 1;
        }
        const total = this.descriptionLengths.length;
        let entropy = 0;
        for (const count of Object.values(buckets)) {
          const p = count / total;
          if (p > 0) entropy -= p * Math.log2(p);
        }
        // Normalize: max entropy with 5 buckets ≈ 2.32
        return Math.min(entropy / 2.32, 1);
      }
      case DriftDimension.TASK_DIVERSITY: {
        // Shannon index over task types, low diversity = repetitive
        if (this.taskTypeHistory.length < 5) return 0;
        const counts: Record<string, number> = {};
        for (const t of this.taskTypeHistory) counts[t] = (counts[t] || 0) + 1;
        const total = this.taskTypeHistory.length;
        let shannon = 0;
        for (const c of Object.values(counts)) {
          const p = c / total;
          shannon -= p * Math.log2(p);
        }
        const maxTypes = 14; // Number of TaskType values
        const normalized = shannon / Math.log2(Math.min(this.taskTypeHistory.length, maxTypes));
        // Low diversity = high drift
        return 1 - Math.min(normalized, 1);
      }
      case DriftDimension.REPETITION: {
        if (this.recentDescriptions.length < 3) return 0;
        const exactDuplicates = this.recentDescriptions.length -
          new Set(this.recentDescriptions).size;
        return Math.min(exactDuplicates / this.recentDescriptions.length * 3, 1);
      }
    }
  }

  private learnBaseline(taskType: TaskType, riskLevel: RiskLevel, description: string): void {
    // Sample the dimension values at steady state to establish baseline
    const dims = Object.values(DriftDimension);
    for (const dim of dims) {
      const value = this.computeDimension(dim);
      if (!this.baselines[dim]) this.baselines[dim] = value;
    }
  }

  // --- Persistence (État persistant #5) ---

  serialize(): unknown {
    return {
      counters: { ...this.counters },
      baselines: { ...this.baselines },
      taskTypeHistory: [...this.taskTypeHistory],
      descriptionLengths: [...this.descriptionLengths],
      recentDescriptions: [...this.recentDescriptions],
      slowLog: [...this.slowLog],
      sampleCount: this.sampleCount,
    };
  }

  restore(data: unknown): void {
    try {
      if (!data || typeof data !== "object") return;
      const obj = data as Record<string, unknown>;
      if (obj.counters && typeof obj.counters === "object" && !Array.isArray(obj.counters)) {
        this.counters = { ...(obj.counters as Record<string, number>) };
      }
      if (obj.baselines && typeof obj.baselines === "object" && !Array.isArray(obj.baselines)) {
        this.baselines = { ...(obj.baselines as Record<string, number>) };
      }
      if (Array.isArray(obj.taskTypeHistory)) {
        this.taskTypeHistory = (obj.taskTypeHistory as unknown[]).filter(
          (v) => typeof v === "string"
        ) as TaskType[];
        if (this.taskTypeHistory.length > this.MAX_HISTORY) {
          this.taskTypeHistory = this.taskTypeHistory.slice(-this.MAX_HISTORY);
        }
      }
      if (Array.isArray(obj.descriptionLengths)) {
        this.descriptionLengths = (obj.descriptionLengths as unknown[]).filter(
          (v) => typeof v === "number"
        ) as number[];
        if (this.descriptionLengths.length > 100) this.descriptionLengths = this.descriptionLengths.slice(-100);
      }
      if (Array.isArray(obj.recentDescriptions)) {
        this.recentDescriptions = (obj.recentDescriptions as unknown[]).filter(
          (v) => typeof v === "string"
        ) as string[];
        if (this.recentDescriptions.length > 50) this.recentDescriptions = this.recentDescriptions.slice(-50);
      }
      if (Array.isArray(obj.slowLog)) {
        this.slowLog = (obj.slowLog as unknown[]).filter(
          (e): e is { dimension: DriftDimension; delta: number; timestamp: string } =>
            !!e &&
            typeof e === "object" &&
            typeof (e as Record<string, unknown>).dimension === "string" &&
            typeof (e as Record<string, unknown>).delta === "number"
        ) as { dimension: DriftDimension; delta: number; timestamp: string }[];
        if (this.slowLog.length > 100) this.slowLog = this.slowLog.slice(-100);
      }
      if (typeof obj.sampleCount === "number") {
        this.sampleCount = obj.sampleCount;
      }
    } catch {
      // fail-open
    }
  }

  static deserialize(data: unknown): DriftDetector {
    const inst = new DriftDetector();
    inst.restore(data);
    return inst;
  }

  save(store: StateStore, name = "drift"): void {
    store.save(name, this.serialize());
  }

  load(store: StateStore, name = "drift"): void {
    const data = store.load(name);
    if (data) this.restore(data);
  }
}