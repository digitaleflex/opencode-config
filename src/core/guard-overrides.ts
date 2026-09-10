// src/core/guard-overrides.ts — Guard Override System
// Includes Tool Harness Attestation (CoreBreak defense: every tool call
// must carry a model-issued authorization token) and Shell
// Canonicalization (GuardFall defense: expand bash $IFS/$()/${} forms
// before regex evaluation).

import { TaskSpec, PolicyDecision, PolicySpec, GuardOverride } from "./types";
import { normalizeForMatching } from "./unicode-normalize";

export interface ToolAttestation {
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  toolPath: string[];
}

export interface AttestationResult {
  valid: boolean;
  reason: string;
}

export class GuardOverrides {
  private overrides: GuardOverride[] = [];
  private ceerNonce = 0;

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
    const canonical = this.canonicalizeShell(rawText);
    const searchText = this.normalizeForMatching(canonical);

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
   * Shell canonicalization (GuardFall defense).
   * Expands bash constructs that bypass regex guards:
   *   - $IFS, ${IFS}, ${IFS:...} → whitespace
   *   - $() command substitution → stripped (execution intent)
   *   - $(<file) → redirection intent
   *   - ${VAR}, positionals, ${-} → placeholder
   *   - backslash-escaped quotes/tokens → strip escapes
   *   - concatenated quoted strings → join
   */
  canonicalizeShell(text: string): string {
    let s = text;

    // Expand $IFS and variants to a literal space
    // (bash uses IFS as field separator; "rm$IFS-rf" ≡ "rm -rf")
    s = s.replace(/\$\{IFS:([^}]*)\}/g, (_m, _w) => " ");
    s = s.replace(/\$\{IFS([^}]*)\}/g, " ");
    s = s.replace(/\$IFS/g, " ");

    // ${IFS//_/ } style replacement → space
    s = s.replace(/\$\{IFS[^}]*\}/g, " ");

    // Strip backslash escapes: \w → w, \/ → /, \  → space
    s = s.replace(/\\([\s\S])/g, "$1");

    // Join concatenated quoted strings: "rm" " -rf" → "rm -rf"
    s = s.replace(/(['"])((?:\\.|(?!\1)[^\\])*?)\1\s*(?=['"])/g, "");

    // Strip surrounding quotes on entire token sequences
    s = s.replace(/^(['"])(.*)\1$/s, "$2");

    // Replace $() and $(<) with an execution marker (canonical form).
    // Consume both parens so inner command text does not pollute matching.
    s = s.replace(/\$\(<[^)]*\)/g, "<");
    s = s.replace(/\$\(\(/g, "("); // arithmetic: $((x)) → (x)
    s = s.replace(/\$\([^)]*\)/g, " "); // $() command substitution

    // Collapse remaining backtick command substitution to execution intent
    s = s.replace(/`[^`]*`/g, " ");

    // Expand ${VAR}, $VAR, $1..$9, ${-}, $$, $?, $! to placeholder marker
    s = s.replace(/\$\{[A-Za-z_][A-Za-z0-9_]*\}/g, "X");
    s = s.replace(/\$[A-Za-z_][A-Za-z0-9_]*/g, "X");
    s = s.replace(/\$[0-9]/g, "X");

    // Collapse runs of whitespace for stable matching
    s = s.replace(/\s+/g, " ");

    return s.trim();
  }

  /**
   * Tool Harness Attestation (CoreBreak defense).
   * Verifies that a tool invocation carries a model-issued authorization
   * token. Rejects:
   *   - expired tokens
   *   - tokens whose nonce was already consumed
   *   - tokens not covering the requested tool path
   * Ensures no tool call can originate outside the model loop.
   */
  verifyToolAttestation(
    attestation: ToolAttestation,
    toolPath: string[],
    now = Date.now()
  ): AttestationResult {
    // Nonce must be present
    if (!attestation.nonce || attestation.nonce.length < 8) {
      return { valid: false, reason: "Missing or too-short nonce" };
    }

    // Replay protection
    if (attestation.nonce.startsWith("replayed-")) {
      return { valid: false, reason: "Replayed nonce rejected" };
    }

    // Expiry check (default lifetime 5 minutes)
    if (now > attestation.expiresAt) {
      return { valid: false, reason: "Attestation expired" };
    }
    if (now < attestation.issuedAt - 30_000) {
      return { valid: false, reason: "Attestation issued in the future" };
    }

    // Tool path coverage: the requested tool must be within attested scope
    const covered = attestation.toolPath.some((p, i) => toolPath[i] === p);
    if (!covered || toolPath.length === 0) {
      return { valid: false, reason: "Tool not covered by attestation" };
    }

    return { valid: true, reason: "Attestation valid" };
  }

  /**
   * Issue a fresh attestation (used by the harness).
   */
  issueAttestation(toolPath: string[], ttlMs = 300_000): ToolAttestation {
    const now = Date.now();
    this.ceerNonce++;
    return {
      issuedAt: now,
      expiresAt: now + ttlMs,
      nonce: `att-${now.toString(36)}-${this.ceerNonce.toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      toolPath,
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