#!/usr/bin/env node
/**
 * Nettoyage de la base de sessions opencode.
 *
 * PROBLÈME RÉSOLU
 * ---------------
 * `opencode session delete` nettoie `message`, `part` et `todo` (cascade depuis
 * `session`), mais **PAS** la table `event` : ses events cascadent depuis
 * `event_sequence` (aggregate_id), qui n'a aucun lien vers `session`.
 * Résultat : les events restent orphelins et la base grossit sans fin
 * (constaté : 17 Go, dont 14,2 Go d'events).
 *
 * CE QUE FAIT CE SCRIPT
 * ---------------------
 *   1. Vérifie qu'opencode n'est pas en train d'utiliser la base
 *   2. Supprime les sessions antérieures à une date (par défaut : 2026-08-24)
 *   3. Supprime AUSSI leurs `event_sequence` → ce qui cascade vers `event`
 *   4. VACUUM pour rendre l'espace au système de fichiers
 *
 * USAGE
 * -----
 *   node cleanup-opencode-db.mjs                        # DRY-RUN (n'écrit rien)
 *   node cleanup-opencode-db.mjs --yes                  # exécute
 *   node cleanup-opencode-db.mjs --cutoff 2026-08-24 --yes
 *   node cleanup-opencode-db.mjs --no-vacuum --yes      # sans VACUUM (plus rapide)
 *
 * ⚠️ À lancer opencode FERMÉ. Le script refuse de tourner s'il détecte la base
 *    verrouillée par un process en cours.
 */

import { DatabaseSync } from "node:sqlite";
import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ── Arguments ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const DRY = !argv.includes("--yes");
const NO_VACUUM = argv.includes("--no-vacuum");
const ci = argv.indexOf("--cutoff");
const CUTOFF_STR = ci !== -1 && argv[ci + 1] ? argv[ci + 1] : "2026-08-24";
const CUTOFF = new Date(`${CUTOFF_STR}T00:00:00Z`).getTime();

if (Number.isNaN(CUTOFF)) {
  console.error(`❌ Date invalide : ${CUTOFF_STR} (attendu YYYY-MM-DD)`);
  process.exit(1);
}

const DB = join(homedir(), ".local", "share", "opencode", "opencode.db");
const MB = (b) => `${Math.round(b / 1048576).toLocaleString("fr-FR")} Mo`;
const GB = (b) => `${(b / 1073741824).toFixed(2)} Go`;

if (!existsSync(DB)) {
  console.error(`❌ Base introuvable : ${DB}`);
  process.exit(1);
}

const sizeBefore = statSync(DB).size;

console.log("═".repeat(58));
console.log("  NETTOYAGE BASE OPENCODE");
console.log("═".repeat(58));
console.log(`  Base      : ${DB}`);
console.log(`  Taille    : ${GB(sizeBefore)}`);
console.log(`  Coupure   : sessions créées AVANT le ${CUTOFF_STR} (UTC)`);
console.log(`  Mode      : ${DRY ? "DRY-RUN (aucune écriture)" : "⚠️  EXÉCUTION RÉELLE"}`);
console.log("═".repeat(58));

// ── Ouverture ────────────────────────────────────────────────────────────────
let db;
try {
  db = new DatabaseSync(DB, DRY ? { readOnly: true } : {});
} catch (e) {
  console.error(`\n❌ Impossible d'ouvrir la base : ${e.message}`);
  console.error("   → Ferme opencode et relance le script.\n");
  process.exit(1);
}

// Détection best-effort d'un verrou (opencode en cours d'exécution)
try {
  db.prepare("SELECT COUNT(*) c FROM session").get();
} catch (e) {
  console.error(`\n❌ La base semble verrouillée (${e.message}).`);
  console.error("   → Ferme TOUTES les instances d'opencode puis relance.\n");
  process.exit(1);
}

// ── Analyse ──────────────────────────────────────────────────────────────────
// `SUM(length(data))` sur 14 Go de blobs = plusieurs minutes d'I/O.
// On compte (indexé, rapide) et on estime la taille proportionnellement.
// NB: `LIMIT 500` sans ORDER BY prend les 500 PREMIÈRES lignes, qui sont
// atypiques (petites) — d'où une estimation faussée. On passe par le ratio.
const oldSessions = db
  .prepare("SELECT id FROM session WHERE time_created < ?")
  .all(CUTOFF);

const eventsFreed = db
  .prepare(
    "SELECT COUNT(*) c FROM event WHERE aggregate_id IN (SELECT id FROM session WHERE time_created < ?)"
  )
  .get(CUTOFF).c;

const totalEvents = db.prepare("SELECT COUNT(*) c FROM event").get().c;

// La table `event` occupe ~82 % du fichier (mesuré : 14,2 Go sur 17,3 Go).
const EVENT_SHARE = 0.82;
const bytesFreed = Math.round(sizeBefore * EVENT_SHARE * (eventsFreed / totalEvents));

const msgCount = db
  .prepare(
    "SELECT COUNT(*) c FROM message WHERE session_id IN (SELECT id FROM session WHERE time_created < ?)"
  )
  .get(CUTOFF).c;

const recent = db.prepare("SELECT COUNT(*) c FROM session").get().c - oldSessions.length;

console.log("\n📊 ANALYSE");
console.log(`  À SUPPRIMER : ${oldSessions.length.toLocaleString("fr-FR")} sessions`);
console.log(`     └─ ${eventsFreed.toLocaleString("fr-FR")} events (${GB(bytesFreed)})`);
console.log(`     └─ ${msgCount.toLocaleString("fr-FR")} messages`);
console.log(`  À CONSERVER : ${recent.toLocaleString("fr-FR")} sessions`);

if (oldSessions.length === 0) {
  console.log("\n✅ Rien à supprimer pour cette date. Augmente --cutoff.\n");
  db.close();
  process.exit(0);
}

const before = db.prepare("PRAGMA freelist_count").get();
const pageSize = Object.values(db.prepare("PRAGMA page_size").get())[0];
const freeBefore = Object.values(before)[0] * pageSize;
console.log(`  Espace libre avant : ${freeBefore === 0 ? "0 Mo (base pleine)" : GB(freeBefore)}`);

// ── Exécution ────────────────────────────────────────────────────────────────
if (DRY) {
  console.log("\n🔍 DRY-RUN : aucune modification effectuée.");
  console.log("   Pour exécuter réellement :");
  console.log(`   node ${process.argv[1]} --cutoff ${CUTOFF_STR} --yes\n`);
  db.close();
  process.exit(0);
}

console.log("\n🧹 SUPPRESSION");
const delSeq = db.prepare("DELETE FROM event_sequence WHERE aggregate_id = ?");
const delSes = db.prepare("DELETE FROM session WHERE id = ?");

db.exec("BEGIN");
try {
  let done = 0;
  for (const s of oldSessions) {
    // 1) event_sequence d'abord → CASCADE supprime les events
    delSeq.run(s.id);
    // 2) puis la session → CASCADE supprime messages/parts/todos
    delSes.run(s.id);
    done++;
    if (done % 100 === 0) process.stdout.write(`\r  ${done}/${oldSessions.length} sessions…`);
  }
  db.exec("COMMIT");
  console.log(`\r  ✅ ${done} sessions supprimées (+ leurs events)`);
} catch (e) {
  db.exec("ROLLBACK");
  console.error(`\n❌ Erreur, ROLLBACK effectué (aucune donnée perdue) : ${e.message}\n`);
  db.close();
  process.exit(1);
}

// ── VACUUM ───────────────────────────────────────────────────────────────────
if (!NO_VACUUM) {
  console.log("\n🗜️  VACUUM (compactage — peut prendre plusieurs minutes sur cette taille)…");
  const t0 = Date.now();
  try {
    db.exec("VACUUM");
    console.log(`  ✅ VACUUM terminé en ${Math.round((Date.now() - t0) / 1000)} s`);
  } catch (e) {
    console.error(`  ⚠️  VACUUM échoué : ${e.message}`);
    console.error("     (les données sont bien supprimées, mais le fichier ne rétrécira pas)");
    console.error("     → vérifie l'espace disque libre : VACUUM a besoin d'une copie temporaire");
  }
} else {
  console.log("\n⏭️  VACUUM ignoré (--no-vacuum)");
}

db.close();

// ── Bilan ────────────────────────────────────────────────────────────────────
const sizeAfter = statSync(DB).size;
console.log("\n" + "═".repeat(58));
console.log(`  Avant : ${GB(sizeBefore)}`);
console.log(`  Après : ${GB(sizeAfter)}`);
console.log(`  Gain  : ${GB(Math.max(0, sizeBefore - sizeAfter))}`);
console.log("═".repeat(58) + "\n");
