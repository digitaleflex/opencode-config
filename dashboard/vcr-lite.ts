// dashboard/vcr-lite.ts — VCR-lite léger pour callWorker
// Inspired by @opencode-ai/http-recorder patterns (cassette record/replay),
// mais sans dépendance Effect : JSON files + hash de clé.
//
// Mode par défaut : "auto" → replay si cassette existe, sinon record.
// EURINHASH_VCR_MODE=record  → force l'enregistrement (écrase les cassettes).
// EURINHASH_VCR_MODE=replay  → force le replay (erreur si cassette absente).
//
// Cassette : logs/cassettes/<hash>.json
// Structure : { worker, model, prompt, response: { ok, output, error, status, usage }, ts }

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

export type VCRMode = "auto" | "record" | "replay";

export interface VCRRecord {
  worker: string;
  model: string;
  prompt: string;
  response: {
    ok: boolean;
    output?: string;
    error?: string;
    status?: number;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  ts: string;
}

const CASSETTE_DIR = join(process.cwd(), "logs", "cassettes");

function getMode(): VCRMode {
  const env = process.env.EURINHASH_VCR_MODE;
  if (env === "record" || env === "replay" || env === "auto") return env;
  return "auto";
}

function cassetteKey(worker: string, model: string, prompt: string): string {
  const raw = `${worker}|${model}|${prompt}`;
  return createHash("sha256").update(raw).digest("hex").substring(0, 16);
}

function cassettePath(key: string): string {
  return join(CASSETTE_DIR, `${key}.json`);
}

function ensureDir(): void {
  if (!existsSync(CASSETTE_DIR)) mkdirSync(CASSETTE_DIR, { recursive: true });
}

export function vcrGet(worker: string, model: string, prompt: string): VCRRecord | null {
  const mode = getMode();
  if (mode === "record") return null; // toujours enregistrer
  const key = cassetteKey(worker, model, prompt);
  const path = cassettePath(key);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf-8");
    const rec: VCRRecord = JSON.parse(raw);
    return rec;
  } catch {
    return null;
  }
}

export function vcrSet(worker: string, model: string, prompt: string, response: VCRRecord["response"]): void {
  const mode = getMode();
  if (mode === "replay") return; // ne jamais enregistrer en replay
  const key = cassetteKey(worker, model, prompt);
  ensureDir();
  const rec: VCRRecord = { worker, model, prompt, response, ts: new Date().toISOString() };
  writeFileSync(cassettePath(key), JSON.stringify(rec, null, 2), "utf-8");
}

export function vcrClear(): number {
  if (!existsSync(CASSETTE_DIR)) return 0;
  const files = readdirSync(CASSETTE_DIR).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    try { unlinkSync(join(CASSETTE_DIR, f)); } catch { /* ignore */ }
  }
  return files.length;
}

export function vcrStats(): { cassettes: number; mode: VCRMode; dir: string } {
  let count = 0;
  if (existsSync(CASSETTE_DIR)) {
    count = readdirSync(CASSETTE_DIR).filter((f) => f.endsWith(".json")).length;
  }
  return { cassettes: count, mode: getMode(), dir: CASSETTE_DIR };
}
