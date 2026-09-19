#!/usr/bin/env node
/**
 * BILAN DE SESSION — qui a travaillé, combien ça a coûté, quel modèle choisir.
 *
 * Lit la base opencode (SQLite) et produit un rapport exploitable :
 *   - coût et tokens par AGENT   → qui consomme
 *   - coût et tokens par MODÈLE  → quoi remplacer
 *   - taux de cache              → le levier d'économie n°1
 *   - recommandations             → modèles moins coûteux à qualité égale
 *
 * USAGE
 *   node session-review.mjs                 # 7 derniers jours
 *   node session-review.mjs --days 1        # aujourd'hui
 *   node session-review.mjs --days 30
 *   node session-review.mjs --json          # sortie machine
 */

import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const argv = process.argv.slice(2);
const di = argv.indexOf("--days");
const DAYS = di !== -1 ? Number(argv[di + 1]) : 7;
const AS_JSON = argv.includes("--json");

const DB = join(homedir(), ".local", "share", "opencode", "opencode.db");
if (!existsSync(DB)) {
  console.error(`❌ Base introuvable : ${DB}`);
  process.exit(1);
}

const since = Date.now() - DAYS * 86400000;
const db = new DatabaseSync(DB, { readOnly: true });

const rows = db
  .prepare(
    `SELECT agent, model, cost,
            COALESCE(tokens_input,0)       AS tin,
            COALESCE(tokens_output,0)      AS tout,
            COALESCE(tokens_reasoning,0)   AS treason,
            COALESCE(tokens_cache_read,0)  AS tcr,
            COALESCE(tokens_cache_write,0) AS tcw
       FROM session
      WHERE time_updated > ?`
  )
  .all(since);

db.close();

// Le champ `model` est un JSON stocké en texte : {"id":"...","providerID":"..."}
function modelId(m) {
  if (!m) return "(inconnu)";
  try {
    const j = JSON.parse(m);
    return j.id || j.modelID || String(m);
  } catch {
    return String(m).slice(0, 40);
  }
}

const agg = (keyFn) => {
  const map = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    const e = map.get(k) || { key: k, n: 0, cost: 0, tin: 0, tout: 0, tcr: 0, tcw: 0 };
    e.n++;
    e.cost += r.cost || 0;
    e.tin += r.tin;
    e.tout += r.tout;
    e.tcr += r.tcr;
    e.tcw += r.tcw;
    map.set(k, e);
  }
  return [...map.values()].sort((a, b) => b.cost - a.cost || b.tin - a.tin);
};

const byAgent = agg((r) => r.agent || "(defaut)");
const byModel = agg((r) => modelId(r.model));

const total = rows.reduce(
  (a, r) => {
    a.cost += r.cost || 0;
    a.tin += r.tin;
    a.tout += r.tout;
    a.tcr += r.tcr;
    a.tcw += r.tcw;
    return a;
  },
  { cost: 0, tin: 0, tout: 0, tcr: 0, tcw: 0 }
);

if (AS_JSON) {
  console.log(JSON.stringify({ days: DAYS, sessions: rows.length, total, byAgent, byModel }, null, 2));
  process.exit(0);
}

// ── Rendu ────────────────────────────────────────────────────────────────────
const n = (x) => x.toLocaleString("fr-FR");
const k = (x) => (x >= 1e6 ? `${(x / 1e6).toFixed(2)}M` : x >= 1e3 ? `${(x / 1e3).toFixed(0)}k` : String(x));
const $ = (x) => `$${x.toFixed(4)}`;
const pad = (s, l) => String(s).padEnd(l).slice(0, l);
const padr = (s, l) => String(s).padStart(l);

console.log("═".repeat(78));
console.log(`  BILAN DE SESSION — ${DAYS} dernier(s) jour(s) · ${n(rows.length)} sessions`);
console.log("═".repeat(78));

if (rows.length === 0) {
  console.log("\n  Aucune session sur la période.\n");
  process.exit(0);
}

console.log(`\n  COÛT TOTAL         : ${$(total.cost)}`);
console.log(`  Tokens entrée      : ${n(total.tin)}`);
console.log(`  Tokens sortie      : ${n(total.tout)}`);
const cacheRate = total.tin + total.tcr > 0 ? (total.tcr / (total.tin + total.tcr)) * 100 : 0;
console.log(`  Cache (lecture)    : ${n(total.tcr)}  (${cacheRate.toFixed(1)} % des entrées)`);

// ── Par agent ────────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(78));
console.log("  PAR AGENT");
console.log("─".repeat(78));
console.log(`  ${pad("AGENT", 18)}${padr("SESS", 6)}${padr("COÛT", 12)}${padr("IN", 10)}${padr("OUT", 9)}${padr("%COÛT", 8)}`);
for (const a of byAgent) {
  const pct = total.cost > 0 ? ((a.cost / total.cost) * 100).toFixed(0) + "%" : "—";
  console.log(
    `  ${pad(a.key, 18)}${padr(a.n, 6)}${padr($(a.cost), 12)}${padr(k(a.tin), 10)}${padr(k(a.tout), 9)}${padr(pct, 8)}`
  );
}

// ── Par modèle ───────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(78));
console.log("  PAR MODÈLE");
console.log("─".repeat(78));
console.log(`  ${pad("MODÈLE", 34)}${padr("COÛT", 12)}${padr("IN", 10)}${padr("OUT", 9)}${padr("$/M in", 9)}`);
for (const m of byModel) {
  const perM = m.tin > 0 ? (m.cost / (m.tin / 1e6)) : 0;
  console.log(
    `  ${pad(m.key, 34)}${padr($(m.cost), 12)}${padr(k(m.tin), 10)}${padr(k(m.tout), 9)}${padr("$" + perM.toFixed(2), 9)}`
  );
}

// ── Recommandations ──────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(78));
console.log("  RECOMMANDATIONS");
console.log("─".repeat(78));

const freeCost = byAgent.filter((a) => a.cost === 0).reduce((s, a) => s + a.tin, 0);
const paidCost = total.cost;
const recs = [];

if (freeCost > 0) {
  recs.push(
    `✅ ${k(freeCost)} tokens traités par des workers GRATUITS — conserve ce réflexe pour le volume.`
  );
}

if (paidCost > 0 && cacheRate < 30) {
  recs.push(
    `⚠️  Cache à ${cacheRate.toFixed(1)} % — c'est le levier n°1. Un contexte stable et réutilisé ` +
      `coûte jusqu'à 10× moins cher. Évite de re-transmettre des blocs qui changent.`
  );
}

const top = byAgent[0];
if (top && top.cost > 0 && top.cost / total.cost > 0.6) {
  recs.push(
    `⚠️  ${top.key} concentre ${((top.cost / total.cost) * 100).toFixed(0)} % du coût. ` +
      `Réduis SA taille de contexte (recherches ciblées, pas de relecture) avant de changer de modèle.`
  );
}

for (const m of byModel) {
  const perM = m.tin > 0 ? m.cost / (m.tin / 1e6) : 0;
  if (perM > 0.5 && m.cost > 0.05) {
    recs.push(
      `💡 ${m.key} coûte $${perM.toFixed(2)}/M en entrée. Les variantes *-flash tournent ` +
        `autour de $0.15/M — soit ~${Math.round(perM / 0.15)}× moins cher. À réserver aux cas difficiles.`
    );
  }
}

if (recs.length === 0) recs.push("Aucune anomalie détectée sur la période.");
for (const r of recs) console.log("  " + r);

console.log("\n" + "═".repeat(78));
console.log("  Rappel : le coût dominant n'est pas le tarif du modèle, c'est");
console.log("  la TAILLE DU CONTEXTE transmis à chaque tour.");
console.log("═".repeat(78) + "\n");
