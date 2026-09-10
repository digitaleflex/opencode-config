import type { Plugin } from "@opencode-ai/plugin"
import { redactDeep } from "../src/core/secret-redactor"

// Garde-fou global : bloque les commandes destructrices avant exécution.
// Défense en profondeur (les règles `permission.bash` font déjà le gros).
// Pour désactiver : retirer "./plugin/guard.ts" du tableau `plugin` dans opencode.json.
export default (async () => {
  // Lazy redactor accessor so a broken import can never crash the plugin host.
  const redactOutput = (value: any): { value: any; count: number } => {
    try {
      const { value: clean, redactions } = redactDeep(value)
      const count = redactions.reduce((n, r) => n + r.count, 0)
      return { value: clean, count }
    } catch {
      return { value, count: 0 }
    }
  }

  return {
    "tool.execute.before": async (input: any) => {
      if (input?.tool !== "bash") return
      const cmd = JSON.stringify(input?.args ?? "")
      const blocked =
        /(^|[\s;&|])(rm\s+-rf\s+\/|mkfs(\.|$|\s)|dd\s+[^&;|]*of=\/dev\/)/.test(
          cmd
        ) || /git\s+push\s+--force/.test(cmd)
      if (blocked) {
        throw new Error(
          "Bloqué par guard.ts : commande destructive interdite (rm -rf /, mkfs, dd vers /dev, git push --force)."
        )
      }
    },

    // Redact secrets from tool outputs before the model sees them
    // (parity with microsoft/agent-governance-toolkit output redaction).
    // Conservative: only well-known credential shapes are touched.
    "tool.execute.after": async (input: any, output: any) => {
      if (output === undefined || output === null) return
      // Common shapes: raw string, { output }, { result }, { content }, { text }
      if (typeof output === "string") return // immutable primitive: nothing to patch in place
      if (typeof output !== "object") return
      for (const key of ["output", "result", "content", "text", "data", "stdout", "stderr"]) {
        const v = (output as any)[key]
        if (typeof v === "string" && v.length > 0) {
          const { value, count } = redactOutput(v)
          if (count > 0) (output as any)[key] = value
        }
      }
    },
  }
}) satisfies Plugin
