import type { Plugin } from "@opencode-ai/plugin";

/**
 * auto-compact.ts — Compaction intelligente et 100% automatique (2026-09-19)
 *
 * Objectif : la session se compacte TOUTE SEULE quand le contexte approche de
 * la limite, avec une directive de préservation contextuelle (que garder, que
 * jeter), puis reprend automatiquement — sans alerte manuelle, sans clic.
 *
 * Deux hooks :
 *  1. experimental.session.compacting  → injecte la directive de compaction
 *     intelligente dans le prompt du compactor (pratique des grosses équipes :
 *     OpenAI/Anthropic compactent en préservant objectif + décisions + état).
 *  2. experimental.compaction.autocontinue → force enabled:true : après
 *     compaction, un message synthétique "continue" est ajouté automatiquement
 *     et l'agent reprend là où il s'était arrêté.
 */
export default (async () => {
  return {
    "experimental.session.compacting": async (_input: any, output: any) => {
      output.context = output.context ?? [];
      output.context.push(
        "DIRECTIVE DE COMPACTION (à suivre strictement) :\n" +
          "GARDER : l'objectif courant de la session, les décisions techniques " +
          "prises (et pourquoi), les chemins de fichiers modifiés/créés, les " +
          "commandes de vérification utilisées, la prochaine étape prévue, les " +
          "contraintes actives (FREE-only, privacy, garde-fous).\n" +
          "JETER : les sorties d'outils anciennes (logs, diffs volumineux, " +
          "sondages), les allers-retours de diagnostic résolus, le contenu déjà " +
          "appliqué au code.\n" +
          "FORMAT : résumé dense en français, sections courtes, zéro répétition, " +
          "conserver les identifiants exacts (chemins, noms de modèles, commandes)."
      );
    },

    "experimental.compaction.autocontinue": async (_input: any, output: any) => {
      // Toujours reprendre automatiquement après compaction.
      output.enabled = true;
    },
  };
}) satisfies Plugin;