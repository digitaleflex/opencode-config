// src/core/guard-overrides.ts — Guard Override System

import { TaskSpec, PolicyDecision, PolicySpec, GuardOverride } from "./types";
import { normalizeForMatching } from "./unicode-normalize";

export class GuardOverrides {
  private overrides: GuardOverride[] = [];

  constructor() {
    this.overrides = this.getDefaultOverrides();
  }

  private getDefaultOverrides(): GuardOverride[] {
    return [
      {
        pattern: /rm\s+-rf\s+\/\S?/i,
        action: "BLOCK",
        policy: "HUMAN_ONLY",
        reason: "Recursive root delete blocked",
      },
      {
        pattern: /mkfs/i,
        action: "BLOCK",
        policy: "HUMAN_ONLY",
        reason: "Filesystem format blocked",
      },
      {
        pattern: /dd\s+if=/i,
        action: "BLOCK",
        policy: "HUMAN_ONLY",
        reason: "Direct disk write blocked",
      },
      {
        pattern: /DROP\s+DATABASE/i,
        action: "BLOCK",
        policy: "HUMAN_ONLY",
        reason: "Database drop blocked",
      },
      {
        pattern: /git\s+push\s+--force/i,
        action: "WARN",
        policy: "REVIEW_REQUIRED",
        reason: "Force push requires review",
      },
      {
        pattern: /git\s+reset\s+--hard/i,
        action: "WARN",
        policy: "REVIEW_REQUIRED",
        reason: "Hard reset can cause data loss",
      },
      {
        pattern: /curl\s+.*\|\s*sh/i,
        action: "BLOCK",
        policy: "HUMAN_ONLY",
        reason: "Pipe to shell execution blocked",
      },
      {
        pattern: /format\s+.*\.env/i,
        action: "BLOCK",
        policy: "HUMAN_ONLY",
        reason: "Env file overwrite blocked",
      },
      {
        pattern: /rm\s+-[rf]/i,
        action: "BLOCK",
        policy: "HUMAN_ONLY",
        reason: "Recursive delete blocked",
      },
      {
        pattern: /del\s+\/[fsq]/i,
        action: "BLOCK",
        policy: "HUMAN_ONLY",
        reason: "Windows force delete blocked",
      },
      {
        pattern: /Remove-Item\s+-Recurse/i,
        action: "BLOCK",
        policy: "HUMAN_ONLY",
        reason: "PowerShell recursive delete blocked",
      },
      {
        pattern: /shred\s+/i,
        action: "BLOCK",
        policy: "HUMAN_ONLY",
        reason: "Secure delete blocked",
      },
      {
        pattern: /shutdown/i,
        action: "BLOCK",
        policy: "HUMAN_ONLY",
        reason: "System shutdown blocked",
      },
      {
        pattern: /reboot/i,
        action: "BLOCK",
        policy: "HUMAN_ONLY",
        reason: "System reboot blocked",
      },
      {
        pattern: /halt/i,
        action: "BLOCK",
        policy: "HUMAN_ONLY",
        reason: "System halt blocked",
      },
      {
        pattern: /poweroff/i,
        action: "BLOCK",
        policy: "HUMAN_ONLY",
        reason: "System power off blocked",
      },
      {
        pattern: /:\(\)\s*\{[^}]*:\|[^}]*:&/i,
        action: "BLOCK",
        policy: "HUMAN_ONLY",
        reason: "Fork bomb blocked",
      },
    ];
  }

  private normalizeForMatching(text: string): string {
    return normalizeForMatching(text);
  }

  check(task: TaskSpec): {
    matched: boolean;
    override?: GuardOverride;
    decision: "BLOCKED" | "WARN" | "ALLOWED";
    reason: string;
  } {
    const rawText = this.buildSearchText(task);
    const searchText = this.normalizeForMatching(rawText);

    for (const override of this.overrides) {
      if (override.pattern.test(searchText)) {
        return {
          matched: true,
          override,
          decision: override.action === "BLOCK" ? "BLOCKED" : "WARN",
          reason: override.reason,
        };
      }
    }

    return {
      matched: false,
      decision: "ALLOWED",
      reason: "No guard match",
    };
  }

  /**
   * Apply guards to a policy decision
   */
  applyToDecision(
    task: TaskSpec,
    decision: PolicyDecision
  ): PolicyDecision {
    const result = this.check(task);

    if (result.decision === "BLOCKED") {
      return {
        ...decision,
        decision: "BLOCKED",
        reason: `Guard: ${result.reason}`,
      };
    }

    if (result.decision === "WARN" && !decision.reason?.includes("WARN")) {
      return {
        ...decision,
        reason: `${decision.reason || ""} | Guard WARN: ${result.reason}`,
      };
    }

    return decision;
  }

  /**
   * Add a custom override
   */
  addOverride(override: GuardOverride): void {
    this.overrides.push(override);
  }

  /**
   * Get all current overrides
   */
  getOverrides(): GuardOverride[] {
    return this.overrides;
  }

  /**
   * Build search text from task description + operation
   */
  private buildSearchText(task: TaskSpec): string {
    return [task.description, task.operation || ""].join(" ");
  }
}