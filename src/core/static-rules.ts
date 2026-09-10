// src/core/static-rules.ts — Lightweight static analysis rules (zero-dep).
// Semgrep-spirit rule engine without the dependency: a bundled rule pack
// covering shell/python/js execution sinks, deserialization, secrets in
// code and crypto-mining indicators, plus optional custom rules loaded
// from policies/static-rules.json. Inspired by
// red-orbita/opencode-security-agent's rule packs (ai-mcp, python-exec,
// python-deser, python-secrets, javascript-exec, generic-secrets,
// generic-shells), reimplemented as plain RegExp rules.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type RuleSeverity = "critical" | "high" | "medium" | "low";
export type RuleCategory =
  | "shell-exec"
  | "python-exec"
  | "js-exec"
  | "deserialization"
  | "secrets-in-code"
  | "crypto-mining"
  | "network-exfil"
  | "custom";

export interface StaticRule {
  id: string;
  category: RuleCategory;
  severity: RuleSeverity;
  pattern: string;
  flags?: string;
  description: string;
}

export interface StaticFinding {
  ruleId: string;
  category: RuleCategory;
  severity: RuleSeverity;
  description: string;
  line: number;
  excerpt: string;
}

export interface StaticScanReport {
  findings: StaticFinding[];
  critical: number;
  high: number;
  blocked: boolean;
  rulesEvaluated: number;
}

/** Bundled rule pack. Patterns target code content, not prose. */
const BUNDLED_RULES: StaticRule[] = [
  // --- shell-exec ---
  { id: "SHELL-001", category: "shell-exec", severity: "critical", pattern: "\\bexec\\s*\\(", description: "exec() dynamic execution" },
  { id: "SHELL-002", category: "shell-exec", severity: "critical", pattern: "\\beval\\s*\\(['\"]?\\$|\\beval\\s+\\$\\(", description: "eval on dynamic input" },
  { id: "SHELL-003", category: "shell-exec", severity: "high", pattern: "curl\\s+[^|]*\\|\\s*(ba)?sh", flags: "i", description: "curl piped to shell" },
  { id: "SHELL-004", category: "shell-exec", severity: "high", pattern: "wget\\s+[^|]*\\|\\s*(ba)?sh", flags: "i", description: "wget piped to shell" },
  { id: "SHELL-005", category: "shell-exec", severity: "critical", pattern: "/dev/tcp/", description: "bash /dev/tcp reverse shell" },
  { id: "SHELL-006", category: "shell-exec", severity: "critical", pattern: "\\b(nc|ncat|netcat)\\b\\s+.*\\s+-e\\s+", flags: "i", description: "netcat with -e (reverse shell)" },
  // --- python-exec ---
  { id: "PY-001", category: "python-exec", severity: "critical", pattern: "\\bos\\.system\\s*\\(", description: "os.system call" },
  { id: "PY-002", category: "python-exec", severity: "high", pattern: "subprocess\\.(call|run|Popen|check_output)\\s*\\(", description: "subprocess execution" },
  { id: "PY-003", category: "python-exec", severity: "critical", pattern: "\\beval\\s*\\(|\\bexec\\s*\\(", description: "eval/exec dynamic code" },
  { id: "PY-004", category: "python-exec", severity: "high", pattern: "__import__\\s*\\(|\\bcompile\\s*\\(", description: "dynamic import/compile" },
  // --- js-exec ---
  { id: "JS-001", category: "js-exec", severity: "critical", pattern: "child_process\\s*\\.\\s*(exec|execSync|spawn|spawnSync)\\s*\\(", description: "child_process execution" },
  { id: "JS-002", category: "js-exec", severity: "critical", pattern: "(?<!\\.)\\beval\\s*\\(", description: "eval() call" },
  { id: "JS-003", category: "js-exec", severity: "high", pattern: "new\\s+Function\\s*\\(", description: "Function constructor" },
  { id: "JS-004", category: "js-exec", severity: "high", pattern: "require\\s*\\(\\s*['\"]child_process['\"]\\s*\\)", description: "child_process import" },
  // --- deserialization ---
  { id: "DESER-001", category: "deserialization", severity: "critical", pattern: "pickle\\.loads?\\s*\\(", description: "pickle deserialization" },
  { id: "DESER-002", category: "deserialization", severity: "high", pattern: "yaml\\.(load|unsafe_load)\\s*\\(", description: "unsafe yaml load" },
  { id: "DESER-003", category: "deserialization", severity: "high", pattern: "marshal\\.loads?\\s*\\(", description: "marshal deserialization" },
  { id: "DESER-004", category: "deserialization", severity: "high", pattern: "jsonpickle\\.(decode|loads?)\\s*\\(", description: "jsonpickle decode" },
  // --- secrets-in-code ---
  { id: "SEC-001", category: "secrets-in-code", severity: "high", pattern: "(password|passwd|pwd)\\s*=\\s*['\"][^'\"]{4,}['\"]", flags: "i", description: "hardcoded password" },
  { id: "SEC-002", category: "secrets-in-code", severity: "high", pattern: "api[_-]?key\\s*=\\s*['\"][^'\"]{8,}['\"]", flags: "i", description: "hardcoded API key" },
  { id: "SEC-003", category: "secrets-in-code", severity: "high", pattern: "-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----", description: "embedded private key" },
  // --- crypto-mining ---
  { id: "MIN-001", category: "crypto-mining", severity: "high", pattern: "stratum\\+tcp://", flags: "i", description: "mining pool stratum URL" },
  { id: "MIN-002", category: "crypto-mining", severity: "medium", pattern: "\\bxmrig\\b|\\bcgminer\\b|\\bethminer\\b", flags: "i", description: "known miner binary" },
  // --- network-exfil ---
  { id: "NET-001", category: "network-exfil", severity: "high", pattern: "\\bexfiltrate\\b", flags: "i", description: "exfiltration keyword in code" },
  { id: "NET-002", category: "network-exfil", severity: "medium", pattern: "requests\\.(post|put)\\s*\\(\\s*['\"]https?://", flags: "i", description: "HTTP POST to URL in code" },
];

function loadCustomRules(): StaticRule[] {
  const candidates = [
    join(process.cwd(), "policies", "static-rules.json"),
    join(process.cwd(), "src", "policies", "static-rules.json"),
  ];
  for (const p of candidates) {
    try {
      if (!existsSync(p)) continue;
      const raw = JSON.parse(readFileSync(p, "utf8")) as { rules?: StaticRule[] };
      if (Array.isArray(raw.rules)) {
        return raw.rules.filter(
          (r) => r && typeof r.id === "string" && typeof r.pattern === "string"
        );
      }
    } catch {
      // ignore malformed custom rules (fail-closed = bundled pack still runs)
    }
  }
  return [];
}

/**
 * Scan code/text content against the bundled + custom rule pack.
 * `blockOn`: severities that flip the report to blocked (default critical+high).
 */
export function scanStatic(
  content: string,
  opts?: { blockOn?: RuleSeverity[]; extraRules?: StaticRule[] }
): StaticScanReport {
  const blockOn = opts?.blockOn ?? (["critical", "high"] as RuleSeverity[]);
  const rules = [...BUNDLED_RULES, ...(opts?.extraRules ?? []), ...loadCustomRules()];
  const findings: StaticFinding[] = [];

  if (typeof content !== "string" || content.length === 0) {
    return { findings, critical: 0, high: 0, blocked: false, rulesEvaluated: rules.length };
  }

  const lines = content.split("\n");
  for (const rule of rules) {
    let re: RegExp;
    try {
      re = new RegExp(rule.pattern, rule.flags ?? "");
    } catch {
      continue; // skip invalid custom patterns
    }
    // Avoid lastIndex statefulness across rules/lines
    const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
    const global = new RegExp(re.source, flags);
    for (let i = 0; i < lines.length; i++) {
      global.lastIndex = 0;
      if (global.test(lines[i])) {
        findings.push({
          ruleId: rule.id,
          category: rule.category,
          severity: rule.severity,
          description: rule.description,
          line: i + 1,
          excerpt: lines[i].slice(0, 120),
        });
        break; // one finding per rule is enough
      }
    }
  }

  const critical = findings.filter((f) => f.severity === "critical").length;
  const high = findings.filter((f) => f.severity === "high").length;
  const blocked = findings.some((f) => blockOn.includes(f.severity));
  return { findings, critical, high, blocked, rulesEvaluated: rules.length };
}

/** Number of bundled rules (for tests/metrics). */
export function bundledRuleCount(): number {
  return BUNDLED_RULES.length;
}
