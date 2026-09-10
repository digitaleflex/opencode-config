// src/core/secret-redactor.ts — Secret detection + redaction (zero-dep).
// Pattern borrowed from microsoft/agent-governance-toolkit output redaction:
// scan tool/output/audit text for well-known credential shapes and redact
// them before the model or the log store ever sees the value. The audit
// trail records THAT a redaction occurred, never the redacted value.

export interface Redaction {
  type: string;
  count: number;
}

export interface RedactResult {
  text: string;
  redactions: Redaction[];
  redacted: boolean;
}

interface SecretPattern {
  type: string;
  pattern: RegExp;
}

// Ordered most-specific first so generic patterns don't swallow specific ones.
const SECRET_PATTERNS: SecretPattern[] = [
  { type: "AWS_ACCESS_KEY", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { type: "AWS_SECRET_KEY", pattern: /\baws_secret_access_key\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/gi },
  { type: "GITHUB_PAT", pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g },
  { type: "GITHUB_FINE_PAT", pattern: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g },
  { type: "OPENAI_KEY", pattern: /\bsk-(?:proj-)?[A-Za-z0-9]{20,}\b/g },
  { type: "STRIPE_LIVE_KEY", pattern: /\bsk_live_[A-Za-z0-9]{16,}\b/g },
  { type: "ANTHROPIC_KEY", pattern: /\bsk-ant-[A-Za-z0-9\-_]{20,}\b/g },
  { type: "SLACK_TOKEN", pattern: /\bxox[baprs]-[A-Za-z0-9\-]{10,}\b/g },
  { type: "JWT", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  { type: "PEM_PRIVATE_KEY", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { type: "AZURE_STORAGE_KEY", pattern: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;\s]+;?/g },
  { type: "GENERIC_CREDENTIAL", pattern: /\b(?:api[_-]?key|secret|passwd|password|auth[_-]?token|access[_-]?token)\s*[:=]\s*['"]?[A-Za-z0-9_\-./+=]{12,}['"]?/gi },
];

export function scanSecrets(text: string): Redaction[] {
  if (typeof text !== "string" || text.length === 0) return [];
  const out: Redaction[] = [];
  for (const { type, pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches && matches.length > 0) out.push({ type, count: matches.length });
  }
  return out;
}

/**
 * Replace every detected secret with [REDACTED:TYPE].
 * Returns the redacted text plus what was found (types + counts only).
 */
export function redactSecrets(text: string): RedactResult {
  if (typeof text !== "string" || text.length === 0) {
    return { text, redactions: [], redacted: false };
  }
  let out = text;
  const redactions: Redaction[] = [];
  for (const { type, pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    let count = 0;
    out = out.replace(pattern, () => {
      count++;
      return `[REDACTED:${type}]`;
    });
    if (count > 0) redactions.push({ type, count });
  }
  return { text: out, redactions, redacted: redactions.length > 0 };
}

/**
 * Deep-redact every string inside a JSON-compatible value (objects/arrays).
 * Used before persisting audit entries / Merkle detail so logs never hold
 * secrets. Returns the cleaned value and the redaction summary.
 */
export function redactDeep<T>(value: T): { value: T; redactions: Redaction[] } {
  const summary = new Map<string, number>();
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      const r = redactSecrets(v);
      for (const red of r.redactions) {
        summary.set(red.type, (summary.get(red.type) || 0) + red.count);
      }
      return r.text;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const o: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        o[k] = walk(val);
      }
      return o;
    }
    return v;
  };
  const cleaned = walk(value) as T;
  const redactions = [...summary.entries()].map(([type, count]) => ({ type, count }));
  return { value: cleaned, redactions };
}
