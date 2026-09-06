import type { Plugin } from "@opencode-ai/plugin"

// Garde-fou global : bloque les commandes destructrices avant exécution.
// Défense en profondeur (les règles `permission.bash` font déjà le gros).
// Pour désactiver : retirer "./plugin/guard.ts" du tableau `plugin` dans opencode.json.
export default (async () => {
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
  }
}) satisfies Plugin
