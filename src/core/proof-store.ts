// src/core/proof-store.ts — Proof Persistence (D2)
//
// Persists every generated ProofChain to logs/proofs/<taskId>/_chain.json
// so verdicts stay re-verifiable after the process exits. Lookup key is
// the taskId already used by governance-audit-*.jsonl and merkle-audit.
//
// Integrity first: the chain is persisted VERBATIM (no redaction) so
// rootHash keeps verifying. By design evidence fields carry hashes and
// metadata (outputHash, reviewHash, token scope), never raw secrets.
// Directory defaults to <cwd>/logs/proofs like every other log sink
// (MerkleAuditTrail, logAuditEntry); override with EURINHASH_PROOFS_DIR.

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import type { ProofChain } from "./types";

export const CHAIN_FILENAME = "_chain.json";

export function defaultProofsDir(): string {
  const override = process.env.EURINHASH_PROOFS_DIR?.trim();
  if (override) return resolve(override);
  return join(process.cwd(), "logs", "proofs");
}

/**
 * taskId is partly caller-supplied (task.id binds Art.14 approval tokens),
 * so it must never become a path traversal. Alphanumerics + -_ pass
 * through; anything else is replaced by a stable sha256-derived name.
 */
export function sanitizeTaskId(taskId: string): string {
  if (/^[A-Za-z0-9][A-Za-z0-9-_]{0,127}$/.test(taskId)) return taskId;
  return "task-" + createHash("sha256").update(taskId, "utf8").digest("hex").slice(0, 32);
}

export class ProofStore {
  constructor(private readonly dir: string = defaultProofsDir()) {}

  pathFor(taskId: string): string {
    return join(this.dir, sanitizeTaskId(taskId), CHAIN_FILENAME);
  }

  async save(chain: ProofChain): Promise<string> {
    if (!chain || typeof chain.taskId !== "string" || chain.taskId.length === 0) {
      throw new Error("saveProofChain: chain.taskId requis");
    }
    const safe = sanitizeTaskId(chain.taskId);
    await mkdir(join(this.dir, safe), { recursive: true });
    const file = join(this.dir, safe, CHAIN_FILENAME);
    await writeFile(file, JSON.stringify(chain, null, 2), "utf-8");
    // Défense : le chemin résolu doit rester sous dir (anti traversal)
    if (!resolve(file).startsWith(resolve(this.dir) + sep)) {
      throw new Error("saveProofChain: chemin hors du dossier proofs");
    }
    return file;
  }

  async load(taskId: string): Promise<ProofChain | null> {
    try {
      const raw = await readFile(this.pathFor(taskId), "utf-8");
      const chain = JSON.parse(raw) as ProofChain;
      if (!chain || chain.taskId !== sanitizeTaskId(taskId) && chain.taskId !== taskId) {
        return null;
      }
      return chain;
    } catch {
      return null;
    }
  }
}

/** Default-dir helpers (fresh instance per call — no cwd captured at import). */
export function saveProofChain(chain: ProofChain): Promise<string> {
  return new ProofStore().save(chain);
}

export function loadProofChain(taskId: string): Promise<ProofChain | null> {
  return new ProofStore().load(taskId);
}
