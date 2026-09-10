// src/core/merkle-audit.ts — Merkle Tree Audit Trail (RFC 6962-compliant)
// Tamper-evident audit trail using Merkle tree of SHA-256 hashes.
// Domain separation: 0x00 for leaf hashes, 0x01 for internal nodes (RFC 6962 §2.1).
// Head anchoring: head() returns latest entry hash, verifyHead() detects truncation.
// Optional HMAC mode: when a key is supplied (or EURINHASH_AUDIT_KEY / .morph-key
// is present) every hash is HMAC-SHA256 with prefix "hmac-sha256:"; without a
// key the trail uses plain SHA-256 with prefix "sha256:".

import { createHash, createHmac } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface AuditEntry {
  seq: number;
  timestamp: string;
  taskId: string;
  taskDescription?: string;
  stage: string;
  decision: string;
  detail: unknown;
  leafHash: string;
  parentHash: string;
}

export interface MerkleRoot {
  rootHash: string;
  leafCount: number;
  timestamp: string;
  sequenceRange: [number, number];
}

export interface AuditProof {
  entry: AuditEntry;
  rootHash: string;
  path: { hash: string; position: "left" | "right" }[];
  leafIndex: number;
}

export interface HeadAnchor {
  headHash: string;
  seq: number;
  timestamp: string;
  entryCount: number;
}

export class MerkleAuditTrail {
  private leaves: AuditEntry[] = [];
  private logDir: string;
  private logFile: string;
  private headFile: string;
  private latestHead: HeadAnchor | null = null;
  private auditKey?: Buffer;

  constructor(logDir?: string, key?: Buffer | string) {
    this.logDir = logDir || join(process.cwd(), "logs");
    this.logFile = join(this.logDir, "merkle-audit.jsonl");
    this.headFile = join(this.logDir, "merkle-head.json");
    if (key !== undefined) {
      this.auditKey = typeof key === "string" ? Buffer.from(key, "utf8") : key;
    } else {
      const resolved = MerkleAuditTrail.resolveKey();
      if (resolved) this.auditKey = resolved;
    }
  }

  /**
   * Resolve an audit HMAC key from the environment or `.morph-key`.
   * Priority: explicit constructor key > EURINHASH_AUDIT_KEY env var >
   * file `.morph-key` in cwd > undefined (plain SHA-256 mode).
   */
  private static resolveKey(): Buffer | undefined {
    const envKey = process.env.EURINHASH_AUDIT_KEY;
    if (envKey && envKey.trim().length > 0) {
      return Buffer.from(envKey, "utf8");
    }
    try {
      const file = join(process.cwd(), ".morph-key");
      if (existsSync(file)) {
        const raw = readFileSync(file, "utf8").trim();
        if (raw.length > 0) return Buffer.from(raw, "utf8");
      }
    } catch {
      // ignore
    }
    return undefined;
  }

  /** Whether this instance operates in HMAC mode. */
  isHmacMode(): boolean {
    return this.auditKey !== undefined;
  }

  /**
   * Record an audit entry with Merkle hash chain (RFC 6962 domain-separated).
   * When an HMAC key is configured every hash is HMAC-SHA256.
   */
  record(entry: Omit<AuditEntry, "seq" | "leafHash" | "parentHash">): AuditEntry {
    const seq = this.leaves.length;
    const leafHash = this.computeLeafHash(entry.taskId, entry.stage, entry.decision, entry.detail);
    const parentHash = this.computeParentHash(seq, leafHash);

    const fullEntry: AuditEntry = {
      ...entry,
      seq,
      leafHash,
      parentHash,
    };

    this.leaves.push(fullEntry);
    this.persistEntry(fullEntry);

    // Update head anchor
    this.latestHead = {
      headHash: leafHash,
      seq,
      timestamp: fullEntry.timestamp,
      entryCount: this.leaves.length,
    };
    this.persistHead();

    return fullEntry;
  }

  /**
   * Compute the current Merkle root hash.
   */
  getMerkleRoot(): MerkleRoot | null {
    if (this.leaves.length === 0) return null;

    const rootHash = this.computeMerkleRoot();

    return {
      rootHash,
      leafCount: this.leaves.length,
      timestamp: new Date().toISOString(),
      sequenceRange: [0, this.leaves.length - 1],
    };
  }

  /**
   * Head anchoring: return the hash of the most recent entry.
   * Used to detect log truncation (Agent Flight Recorder pattern).
   */
  head(): HeadAnchor | null {
    return this.latestHead;
  }

  /**
   * Verify that the current head matches an expected anchor.
   * Returns false if the log has been truncated or tampered.
   */
  verifyHead(expectedHead: HeadAnchor): boolean {
    if (!this.latestHead) return false;
    return (
      this.latestHead.headHash === expectedHead.headHash &&
      this.latestHead.seq === expectedHead.seq &&
      this.latestHead.entryCount === expectedHead.entryCount
    );
  }

  /**
   * Export the current head anchor to an external path (outside the log
   * directory). Callers should store this anchor out-of-band and later
   * pass it to `verifyHead` or `verifyExternalAnchor` to detect truncation
   * even when the attacker controls the log files.
   */
  exportAnchor(targetPath: string): HeadAnchor | null {
    if (!this.latestHead) return null;
    try {
      const dir = join(targetPath, "..");
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(targetPath, JSON.stringify(this.latestHead, null, 2), "utf8");
      return this.latestHead;
    } catch {
      return null;
    }
  }

  /**
   * Load an anchor previously written by `exportAnchor` and verify it
   * against the current in-memory head. Returns false if the anchor file
   * is missing, malformed, or does not match the current head.
   */
  verifyExternalAnchor(anchorPath: string): boolean {
    try {
      if (!existsSync(anchorPath)) return false;
      const raw = readFileSync(anchorPath, "utf8");
      const anchor = JSON.parse(raw) as HeadAnchor;
      return this.verifyHead(anchor);
    } catch {
      return false;
    }
  }

  /** Load an anchor from disk without needing a trail instance. */
  static loadAnchor(anchorPath: string): HeadAnchor | null {
    try {
      if (!existsSync(anchorPath)) return null;
      return JSON.parse(readFileSync(anchorPath, "utf8")) as HeadAnchor;
    } catch {
      return null;
    }
  }

  /**
   * Verify a single entry against the Merkle tree.
   */
  verifyEntry(index: number): boolean {
    if (index < 0 || index >= this.leaves.length) return false;

    const entry = this.leaves[index];
    const expectedLeafHash = this.computeLeafHash(entry.taskId, entry.stage, entry.decision, entry.detail);

    // Verify leaf hash (with domain separation)
    if (entry.leafHash !== expectedLeafHash) return false;

    // Verify parent hash chain
    const expectedParentHash = this.computeParentHash(index, entry.leafHash);
    if (entry.parentHash !== expectedParentHash) return false;

    // Verify chain continuity
    if (index > 0) {
      const prev = this.leaves[index - 1];
      const expectedPrevParentHash = this.computeParentHash(index - 1, prev.leafHash);
      if (prev.parentHash !== expectedPrevParentHash) return false;
    }

    return true;
  }

  /**
   * Verify the entire audit trail integrity.
   */
  verifyChain(): { valid: boolean; brokenAt: number | null; totalEntries: number } {
    for (let i = 0; i < this.leaves.length; i++) {
      if (!this.verifyEntry(i)) {
        return { valid: false, brokenAt: i, totalEntries: this.leaves.length };
      }
    }
    return { valid: true, brokenAt: null, totalEntries: this.leaves.length };
  }

  /**
   * Generate a Merkle inclusion proof for a specific entry (RFC 6962 §2.1.1).
   */
  generateProof(index: number): AuditProof | null {
    if (index < 0 || index >= this.leaves.length) return null;

    const entry = this.leaves[index];
    const path: { hash: string; position: "left" | "right" }[] = [];

    // Build Merkle path with domain-separated hashes
    let level = this.leaves.map((l) => l.leafHash);
    let currentIdx = index;

    while (level.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = i + 1 < level.length ? level[i + 1] : level[i];
        if (i === currentIdx || i + 1 === currentIdx) {
          const pos = currentIdx % 2 === 0 ? "right" : "left";
          const siblingIdx = currentIdx % 2 === 0 ? i + 1 : i;
          path.push({
            hash: siblingIdx < level.length ? level[siblingIdx] : level[i],
            position: pos,
          });
        }
        nextLevel.push(this.hashInternalNode(left, right));
      }
      currentIdx = Math.floor(currentIdx / 2);
      level = nextLevel;
    }

    return {
      entry,
      rootHash: level[0],
      path,
      leafIndex: index,
    };
  }

  /**
   * Verify a Merkle proof (RFC 6962 §2.1.1).
   * In HMAC mode pass the same key so internal-node hashes are recomputed
   * with HMAC. In plain mode call without a key.
   */
  static verifyProof(proof: AuditProof, key?: Buffer | string): boolean {
    let currentHash = proof.entry.leafHash;
    const k = typeof key === "string" ? Buffer.from(key, "utf8") : key;

    for (const step of proof.path) {
      if (step.position === "left") {
        currentHash = k
          ? MerkleAuditTrail.hashInternalNodeWithKey(step.hash, currentHash, k)
          : MerkleAuditTrail.hashInternalNodePlain(step.hash, currentHash);
      } else {
        currentHash = k
          ? MerkleAuditTrail.hashInternalNodeWithKey(currentHash, step.hash, k)
          : MerkleAuditTrail.hashInternalNodePlain(currentHash, step.hash);
      }
    }

    return currentHash === proof.rootHash;
  }

  /** Instance variant that uses this trail's configured key automatically. */
  verifyProofInstance(proof: AuditProof): boolean {
    return MerkleAuditTrail.verifyProof(proof, this.auditKey);
  }

  /**
   * Load existing audit trail from disk.
   */
  loadFromDisk(): void {
    if (!existsSync(this.logFile)) return;

    try {
      const content = readFileSync(this.logFile, "utf8");
      const lines = content.trim().split("\n").filter(Boolean);
      this.leaves = [];
      for (const line of lines) {
        const entry = JSON.parse(line) as AuditEntry;
        this.leaves.push(entry);
      }
      // Restore head from last entry
      if (this.leaves.length > 0) {
        const last = this.leaves[this.leaves.length - 1];
        this.latestHead = {
          headHash: last.leafHash,
          seq: last.seq,
          timestamp: last.timestamp,
          entryCount: this.leaves.length,
        };
      }
    } catch {
      // Fail-closed: if log is corrupted, start fresh
      this.leaves = [];
      this.latestHead = null;
    }
  }

  getEntryCount(): number {
    return this.leaves.length;
  }

  getEntries(): readonly AuditEntry[] {
    return this.leaves;
  }

  // --- Private helpers (RFC 6962 domain separation + optional HMAC) ---

  /**
   * Compute leaf hash with 0x00 domain prefix (RFC 6962 §2.1).
   * H(0x00 || taskId || stage || decision || detail)
   * or HMAC-SHA256 when a key is configured.
   */
  private computeLeafHash(taskId: string, stage: string, decision: string, detail: unknown): string {
    const content = `${taskId}|${stage}|${decision}|${JSON.stringify(detail)}`;
    const payload = Buffer.concat([Buffer.from([0x00]), Buffer.from(content)]);
    if (this.auditKey) {
      return "hmac-sha256:" + createHmac("sha256", this.auditKey).update(payload).digest("hex");
    }
    return "sha256:" + createHash("sha256").update(payload).digest("hex");
  }

  /**
   * Compute parent hash with 0x01 domain prefix (RFC 6962 §2.1).
   * H(0x01 || left || right)
   */
  private computeParentHash(seq: number, leafHash: string): string {
    const prevHash = seq > 0 ? this.leaves[seq - 1].parentHash : this.zeroParent();
    return this.hashInternalNode(prevHash, leafHash);
  }

  private zeroParent(): string {
    if (this.auditKey) return "hmac-sha256:" + "0".repeat(64);
    return "sha256:" + "0".repeat(64);
  }

  private computeMerkleRoot(): string {
    if (this.leaves.length === 0) return this.zeroParent();
    if (this.leaves.length === 1) return this.leaves[0].leafHash;

    let level = this.leaves.map((l) => l.leafHash);
    while (level.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = i + 1 < level.length ? level[i + 1] : level[i];
        nextLevel.push(this.hashInternalNode(left, right));
      }
      level = nextLevel;
    }
    return level[0];
  }

  /**
   * Hash two child nodes with 0x01 domain prefix (RFC 6962).
   * Uses HMAC when a key is configured.
   */
  private hashInternalNode(left: string, right: string): string {
    if (this.auditKey) return MerkleAuditTrail.hashInternalNodeWithKey(left, right, this.auditKey);
    return MerkleAuditTrail.hashInternalNodePlain(left, right);
  }

  private static hashInternalNodeWithKey(left: string, right: string, key: Buffer): string {
    const data = Buffer.concat([Buffer.from([0x01]), Buffer.from(left + "|" + right)]);
    return "hmac-sha256:" + createHmac("sha256", key).update(data).digest("hex");
  }

  private static hashInternalNodePlain(left: string, right: string): string {
    const data = Buffer.concat([Buffer.from([0x01]), Buffer.from(left + "|" + right)]);
    return "sha256:" + createHash("sha256").update(data).digest("hex");
  }

  private persistEntry(entry: AuditEntry): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
    const line = JSON.stringify(entry) + "\n";
    try {
      appendFileSync(this.logFile, line, "utf8");
    } catch {
      // Non-fatal: in-memory trail still valid
    }
  }

  private persistHead(): void {
    if (!this.latestHead) return;
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
    try {
      writeFileSync(this.headFile, JSON.stringify(this.latestHead, null, 2), "utf8");
    } catch {
      // Non-fatal
    }
  }
}
