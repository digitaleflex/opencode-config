// src/core/governance-events.ts — Governance Audit Stream (D3)
//
// Émet les décisions de gouvernance dans le MÊME flux que le plugin
// audit-logger (`~/.config/opencode/logs/audit-YYYY-MM-DD.jsonl`) :
// une seule timeline outil-executions + décisions de gouvernance,
// corrélable par taskId/sessionId.
//
// Pourquoi un module core plutôt qu'un appel direct au plugin :
// plugin/audit-logger.ts s'exécute au import (rotation + interval) —
// l'importer depuis l'orchestrateur polluerait tests et scripts.
// Ce module est import-safe (aucun effet au chargement) ; le plugin
// le ré-exporte pour garder une surface canonique unique.
// Rotation : inutile ici, le plugin pivote déjà ces fichiers (30j).
//
// Garde-fous : fire-and-forget (jamais de blocage pipeline), try/catch
// total (une erreur disque ne doit jamais faire échouer une décision),
// redaction via secret-redactor (même moteur que logAuditEntry).

import { mkdir, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { redactDeep } from "./secret-redactor";

export type GovernanceEventName =
  | "governance.classify"
  | "governance.risk"
  | "governance.policy"
  | "governance.guard"
  | "governance.proof";

export interface GovernanceEventFields {
  taskId: string;
  decision: "APPROVED" | "BLOCKED" | "PENDING";
  [key: string]: unknown;
}

// Miroir de SENSITIVE_PATTERNS dans plugin/audit-logger.ts (source de
// vérité côté plugin). Copié plutôt qu'importé : importer le plugin
// exécuterait sa rotation + son interval au chargement du module.
const SENSITIVE_PATTERNS: RegExp[] = [
  /\bDATABASE_URL\b/,
  /\bmigration\b/i,
  /\bdeploy\b/i,
  /push\s+--force/,
  /npm\s+publish/,
  /DELETE\s+FROM/i,
  /DROP\s+TABLE/i,
  /ALTER\s+TABLE/i,
  /CREATE\s+USER\b/i,
  /\bGRANT\b/i,
];

export function governanceLogDir(): string {
  return join(homedir(), ".config", "opencode", "logs");
}

function isSensitive(value: unknown): boolean {
  try {
    const haystack = JSON.stringify(value) ?? "";
    return SENSITIVE_PATTERNS.some((re) => re.test(haystack));
  } catch {
    return false;
  }
}

// Parité avec plugin/audit-logger.ts : redactDeep ne voit que les
// VALEURS à motif connu ; ici on masque aussi toute valeur sous une
// clé à nom sensible (même regex que le plugin, même fichier cible).
const REDACT_KEY_PATTERN = /(api[_-]?key|password|secret|token|authorization|key)/i;

function maskKeyedSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskKeyedSecrets);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT_KEY_PATTERN.test(k) ? "***REDACTED***" : maskKeyedSecrets(v);
    }
    return out;
  }
  return value;
}

/**
 * Émet un événement de gouvernance. Synchrone en apparence, écriture
 * réellement asynchrone et ignorée en cas d'échec. Ne throw jamais.
 */
export function logGovernanceEvent(
  event: GovernanceEventName,
  fields: GovernanceEventFields,
  dir?: string
): void {
  try {
    const { value: clean } = redactDeep(fields);
    const entry = {
      ts: new Date().toISOString(),
      event,
      ...(maskKeyedSecrets(clean) as Record<string, unknown>),
      sensitive: isSensitive(fields),
    };
    const line = JSON.stringify(entry) + "\n";
    const target = dir ?? governanceLogDir();
    const file = join(target, `audit-${new Date().toISOString().split("T")[0]}.jsonl`);
    void (async () => {
      try {
        await mkdir(target, { recursive: true });
        await appendFile(file, line, "utf8");
      } catch (err) {
        try {
          console.error("[governance-events] write failed:", err);
        } catch {
          /* ignore */
        }
      }
    })();
  } catch {
    /* un événement d'audit ne doit jamais casser le pipeline */
  }
}
