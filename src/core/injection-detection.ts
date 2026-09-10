// src/core/injection-detection.ts — Prompt Injection & Context Poisoning Detection
// Detects prompt injection attempts, system prompt extraction, and context poisoning.
// 13 attack categories, 100+ patterns. Inspired by Aegis & governance-sdk.

import { normalizeForMatching } from "./unicode-normalize";

export interface InjectionResult {
  detected: boolean;
  confidence: number; // 0-1
  category: string;
  pattern: string;
  action: "BLOCK" | "WARN";
  evidence: string;
}

export interface InjectionScanReport {
  detected: boolean;
  detections: InjectionResult[];
  riskScore: number; // 0-1
  action: "ALLOW" | "WARN" | "BLOCK";
  categories: string[];
}

// Injection pattern categories
const INJECTION_PATTERNS: {
  category: string;
  patterns: RegExp[];
  action: "BLOCK" | "WARN";
  severity: number;
}[] = [
  {
    category: "SYSTEM_PROMPT_EXTRACTION",
    patterns: [
      /ignore\s+(all\s+)?previous\s+instructions/i,
      /disregard\s+(all\s+)?prior\s+prompts/i,
      /forget\s+(everything|all|your)\s+(instructions|rules|guidelines)/i,
      /override\s+(your|the)\s+system\s+prompt/i,
      /reveal\s+(your|the)\s+system\s+prompt/i,
      /what\s+are\s+your\s+instructions/i,
      /repeat\s+(your|the)\s+(system|initial)\s+(prompt|instructions)/i,
      /print\s+(your|the)\s+system\s+prompt/i,
      /show\s+me\s+(your|the)\s+(system|full)\s+prompt/i,
      /you\s+are\s+now\s+DAN/i,
      /do\s+anything\s+now/i,
      /jailbreak/i,
      /DAN\s+mode/i,
    ],
    action: "BLOCK",
    severity: 1.0,
  },
  {
    category: "ROLE_HIJACKING",
    patterns: [
      /you\s+are\s+now\s+(a|an)\s+(hacker|attacker|evil|malicious)/i,
      /act\s+as\s+(if|though)\s+you\s+(have|are)\s+no\s+(rules|restrictions)/i,
      /pretend\s+you\s+are\s+(a|an)\s+(unrestricted|unfiltered)/i,
      /new\s+role:\s*(admin|root|superuser|debug)/i,
      /switch\s+to\s+(debug|admin|god)\s+mode/i,
      /enter\s+(debug|admin|developer)\s+mode/i,
      /you\s+are\s+now\s+in\s+(debug|admin|developer)\s+mode/i,
    ],
    action: "BLOCK",
    severity: 0.9,
  },
  {
    category: "CONTEXT_POISONING",
    patterns: [
      /\[INST\]/i,
      /\[\/INST\]/i,
      /<<SYS>>/i,
      /<\|im_start\|>/i,
      /<\|im_end\|>/i,
      /<\|system\|>/i,
      /<\|user\|>/i,
      /<\|assistant\|>/i,
      /\[INST\]\s*(.*)\s*\[\/INST\]/is,
      /Human:\s*/i,
      /Assistant:\s*/i,
    ],
    action: "BLOCK",
    severity: 0.8,
  },
  {
    category: "DATA_EXFILTRATION",
    patterns: [
      /exfiltrate\s+(all\s+)?(data|secrets|keys|tokens|credentials)/i,
      /send\s+(all|everything|the\s+data)\s+to/i,
      /upload\s+(all|everything|the\s+data)\s+to/i,
      /copy\s+(all|everything)\s+to\s+(http|ftp|ssh)/i,
      /curl.*\s+(-d|--data)\s+.*\$\{(env|ENV|secret)/i,
      /wget.*\s+.*\$\{(env|ENV|secret)/i,
      /fetch\s+.*\$\{(env|ENV|secret)/i,
    ],
    action: "BLOCK",
    severity: 1.0,
  },
  {
    category: "SANDBOX_ESCAPE",
    patterns: [
      /break\s+out\s+(of|from)\s+(the\s+)?(sandbox|container|jail|vm)/i,
      /escape\s+(the\s+)?(sandbox|container|jail|vm)/i,
      /escalate\s+(to\s+)?(root|admin|superuser)/i,
      /privilege\s+escalation/i,
      /access\s+(the\s+)?(host|host\s+machine|real\s+system)/i,
      /read\s+\/etc\/passwd/i,
      /read\s+\/etc\/shadow/i,
      /cat\s+\/etc\/(passwd|shadow|sudoers)/i,
    ],
    action: "BLOCK",
    severity: 1.0,
  },
  {
    category: "CODE_INJECTION",
    patterns: [
      /eval\s*\(\s*(req|request|input|param|query)/i,
      /exec\s*\(\s*(req|request|input|param|query)/i,
      /system\s*\(\s*(req|request|input|param|query)/i,
      /subprocess\.(call|run|Popen)\s*\(\s*(req|request|input|param|query)/i,
      /\$\{.*\$\{.*\}/, // nested template literal injection
      /`\s*\$\{[^}]*\}.*\$\{[^}]*\}/, // template literal with multiple interpolations
    ],
    action: "BLOCK",
    severity: 0.9,
  },
  {
    category: "INDIRECT_INJECTION",
    patterns: [
      /\[SYSTEM\]/i,
      /\[\/SYSTEM\]/i,
      /<!--\s*(system|hidden|secret|internal)\s*-->/i,
      /\x00/, // null bytes
      /\\x00/, // escaped null bytes
      /\\u0000/, // unicode null bytes
    ],
    action: "BLOCK",
    severity: 0.7,
  },
  {
    category: "TOKEN_SMUGGLING",
    patterns: [
      /[\u200B-\u200F\uFEFF\u2060\u2061\u2062\u2063\u2064]/,
      /[\u034F\u180E\uFE00-\uFE0F]/,
      /[\u2028\u2029]/,
      /[\u200E\u200F]/,
      /[\u2066-\u2069]/,
    ],
    action: "BLOCK",
    severity: 0.6,
  },
  {
    category: "UNICODE_TAG_SMUGGLING",
    patterns: [
      // U+E0001-U+E007F: Invisible Tag Characters (ISO 14651)
      // Used in CoreBreak attacks to hide instructions from the model
      /[\u{E0001}]/u,
      /[\u{E0002}-\u{E007F}]/u,
      // Variation selectors that can alter rendering of tag sequences
      /[\u{E0100}-\u{E01EF}]/u,
      // Tag space characters used to delimit hidden tag sequences
      /\u{E0020}/u,
    ],
    action: "BLOCK",
    severity: 0.9,
  },
  {
    category: "TOOL_ABUSE",
    patterns: [
      /use\s+(the\s+)?(bash|shell|exec|terminal)\s+to\s+(delete|remove|drop)/i,
      /run\s+(this|the\s+following)\s+(command|script)\s+(on|at)\s+(the\s+)?(host|server|production)/i,
      /execute\s+(the\s+following\s+)?(command|script)\s+with\s+(root|admin|sudo)/i,
    ],
    action: "BLOCK",
    severity: 0.8,
  },
  {
    category: "SOCIAL_ENGINEERING",
    patterns: [
      /the\s+(developer|admin|user)\s+(told|asked|wants)\s+me\s+to/i,
      /I\s+(was|have\s+been)\s+(told|instructed|asked)\s+to/i,
      /this\s+is\s+(a|an)\s+(emergency|urgent|critical)\s+and\s+(I|we)\s+need\s+to/i,
      /please\s+ignore\s+(all\s+)?(safety|security|guardrails)/i,
      /for\s+(testing|debugging|development)\s+purposes\s+only/i,
      /this\s+is\s+just\s+(a|an)\s+(test|demo|example)/i,
    ],
    action: "WARN",
    severity: 0.5,
  },
];

export class InjectionDetector {
  private scanHistory: InjectionScanReport[] = [];

  /**
   * Scan text for injection attempts.
   */
  scan(text: string): InjectionScanReport {
    const normalized = normalizeForMatching(text);
    const detections: InjectionResult[] = [];
    let maxSeverity = 0;

    for (const category of INJECTION_PATTERNS) {
      for (const pattern of category.patterns) {
        if (pattern.test(normalized)) {
          const detection: InjectionResult = {
            detected: true,
            confidence: category.severity,
            category: category.category,
            pattern: pattern.source.slice(0, 80),
            action: category.action,
            evidence: `Matched pattern in category ${category.category}`,
          };
          detections.push(detection);
          maxSeverity = Math.max(maxSeverity, category.severity);
          break; // One detection per category is enough
        }
      }
    }

    const riskScore = detections.length > 0 ? maxSeverity : 0;
    let action: InjectionScanReport["action"] = "ALLOW";
    if (detections.some((d) => d.action === "BLOCK")) action = "BLOCK";
    else if (detections.some((d) => d.action === "WARN")) action = "WARN";

    const categories = [...new Set(detections.map((d) => d.category))];

    const report: InjectionScanReport = {
      detected: detections.length > 0,
      detections,
      riskScore,
      action,
      categories,
    };
    this.scanHistory.push(report);

    return report;
  }

  /**
   * Scan a TaskSpec for injection in description + operation.
   */
  scanTask(task: { description?: string; operation?: string }): InjectionScanReport {
    const combined = [task.description || "", task.operation || ""].join(" ");
    return this.scan(combined);
  }

  getScanCount(): number {
    return this.scanHistory.length;
  }

  getDetectionStats(): {
    total: number;
    blocked: number;
    warned: number;
    categories: Record<string, number>;
  } {
    const categories: Record<string, number> = {};
    let blocked = 0;
    let warned = 0;

    for (const report of this.scanHistory) {
      if (report.action === "BLOCK") blocked++;
      if (report.action === "WARN") warned++;
      for (const cat of report.categories) {
        categories[cat] = (categories[cat] || 0) + 1;
      }
    }

    return { total: this.scanHistory.length, blocked, warned, categories };
  }
}
