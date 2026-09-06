import type { Plugin } from "@opencode-ai/plugin"
import { mkdir, appendFile, readdir, stat, unlink } from "node:fs/promises"
import { join } from "node:path"
import { homedir } from "node:os"

// ---------------------------------------------------------------------------
// Audit logger plugin
// ---------------------------------------------------------------------------
// Hooks:
//   - tool.execute.before  : log tool name, redacted args, sessionId
//   - tool.execute.after   : log tool name, redacted args, title, output,
//                            sessionId
//   - agent.invoked       : log agent name, model, task (truncated 200 chars),
//                            sessionId, parentAgentId  [not in current SDK version]
//
// Logs are appended as JSON Lines (one entry per line) to:
//   ~/.config/opencode/logs/audit-YYYY-MM-DD.jsonl
//
// Requirements:
//   - Async, fire-and-forget (never block tool execution)
//   - Redact keys containing (case-insensitive): apiKey, api_key, password,
//     secret, token, authorization, key
//   - Flag sensitive:true on entries whose args match:
//     DATABASE_URL, migration, deploy, push --force, npm publish,
//     DELETE FROM, DROP TABLE, ALTER TABLE, CREATE USER, GRANT
//   - Log rotation: delete files older than 30 days
// ---------------------------------------------------------------------------

const LOG_DIR = join(homedir(), ".config", "opencode", "logs")
const RETENTION_DAYS = 30
const TASK_TRUNCATE = 200
const ROTATION_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24h

const REDACT_KEY_PATTERN = /(api[_-]?key|password|secret|token|authorization|key)/i

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
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function logFilePath(date: string): string {
  return join(LOG_DIR, `audit-${date}.jsonl`)
}

function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map((v) => redactValue(v))
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT_KEY_PATTERN.test(k) ? "***REDACTED***" : redactValue(v)
    }
    return out
  }
  return value
}

function flattenForScan(value: unknown, acc: string[] = []): string[] {
  if (value === null || value === undefined) return acc
  if (typeof value === "string") { acc.push(value); return acc }
  if (typeof value === "number" || typeof value === "boolean") { acc.push(String(value)); return acc }
  if (Array.isArray(value)) { for (const v of value) flattenForScan(v, acc); return acc }
  if (typeof value === "object") { for (const v of Object.values(value as Record<string, unknown>)) flattenForScan(v, acc) }
  return acc
}

function isSensitive(value: unknown): boolean {
  const haystack = flattenForScan(value).join("\n")
  if (!haystack) return false
  return SENSITIVE_PATTERNS.some((re) => re.test(haystack))
}

async function ensureLogDir(): Promise<void> {
  await mkdir(LOG_DIR, { recursive: true })
}

async function writeEntry(entry: Record<string, unknown>): Promise<void> {
  try {
    await ensureLogDir()
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry })
    await appendFile(logFilePath(todayDate()), line + "\n", "utf8")
  } catch (err) {
    try {
      // eslint-disable-next-line no-console
      console.error("[audit-logger] write failed:", err)
    } catch {
      /* ignore */
    }
  }
}

function fireAndForget(promise: Promise<void>): void {
  void promise // errors handled inside writeEntry
}

async function rotateLogs(): Promise<void> {
  try {
    await ensureLogDir()
    const files = await readdir(LOG_DIR)
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
    for (const name of files) {
      if (!name.startsWith("audit-") || !name.endsWith(".jsonl")) continue
      const full = join(LOG_DIR, name)
      try {
        const st = await stat(full)
        if (st.isFile() && st.mtimeMs < cutoff) await unlink(full)
      } catch {
        /* skip individual file errors */
      }
    }
  } catch (err) {
    try {
      // eslint-disable-next-line no-console
      console.error("[audit-logger] rotate failed:", err)
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const plugin: Plugin = (async () => {
  // Run rotation once at startup, then daily.
  fireAndForget(rotateLogs())
  const interval = setInterval(() => { fireAndForget(rotateLogs()) }, ROTATION_INTERVAL_MS)
  // Keep event loop alive only while the process is running.
  if (typeof (interval as unknown as { unref?: () => void }).unref === "function") {
    (interval as unknown as { unref: () => void }).unref()
  }

  return {
    "tool.execute.before": async (input) => {
      const args = (input as { args?: unknown }).args ?? {}
      fireAndForget(
        writeEntry({
          event: "tool.execute.before",
          tool: input.tool,
          sessionId: input.sessionID,
          callId: input.callID,
          args: redactValue(args),
          sensitive: isSensitive(args),
        })
      )
    },

    "tool.execute.after": async (input) => {
      const args = input.args ?? {}
      fireAndForget(
        writeEntry({
          event: "tool.execute.after",
          tool: input.tool,
          sessionId: input.sessionID,
          callId: input.callID,
          args: redactValue(args),
          title: input.title,
          output: input.output,
          metadata: input.metadata,
          sensitive: isSensitive(args),
        })
      )
    },

    // agent.invoked is not defined in the current @opencode-ai/plugin SDK version.
    // Including it as an extra property; the framework will simply ignore it.
    ...({
      agent: {
        invoked: async (input) => {
          const raw = input.task ?? ""
          const task = raw.length > TASK_TRUNCATE ? raw.slice(0, TASK_TRUNCATE) + "…" : raw
          fireAndForget(
            writeEntry({
              event: "agent.invoked",
              agent: input.agent,
              model: input.model,
              task,
              sessionId: input.sessionId,
              parentAgentId: input.parentAgentId,
              sensitive: isSensitive({ task }),
            })
          )
        },
      },
    } as NonNullable<Plugin extends (input: unknown, options?: unknown) => Promise<infer R> ? R extends { agent?: infer A } ? { agent: A } : never : never>),
  }
}) as unknown as Plugin

export default plugin
