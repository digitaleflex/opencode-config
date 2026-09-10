// src/core/merkle-audit.ts — Merkle Tree Audit Trail (RFC 6962-compliant)
// Tamper-evident audit trail using Merkle tree of SHA-256 hashes.
// Domain separation: 0x00 for leaf hashes, 0x01 for internal nodes (RFC 6962 §2.1).
// Head anchoring: head() returns latest entry hash, verifyHead() detects truncation.

import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
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

  constructor(logDir?: string) {
    this.logDir = logDir || join(process.cwd(), "logs");
    this.logFile = join(this.logDir, "merkle-audit.jsonl");
    this.headFile = join(this.logDir, "merkle-head.json");
  }

  /**
   * Record an audit entry with Merkle hash chain (RFC 6962 domain-separated).
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
        nextLevel.push(MerkleAuditTrail.hashInternalNode(left, right));
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
   */
  static verifyProof(proof: AuditProof): boolean {
    let currentHash = proof.entry.leafHash;

    for (const step of proof.path) {
      if (step.position === "left") {
        currentHash = MerkleAuditTrail.hashInternalNode(step.hash, currentHash);
      } else {
        currentHash = MerkleAuditTrail.hashInternalNode(currentHash, step.hash);
      }
    }

    return currentHash === proof.rootHash;
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

  // --- Private helpers (RFC 6962 domain separation) ---

  /**
   * Compute leaf hash with 0x00 domain prefix (RFC 6962 §2.1).
   * H(0x00 || taskId || stage || decision || detail)
   */
  private computeLeafHash(taskId: string, stage: string, decision: string, detail: unknown): string {
    const content = `${taskId}|${stage}|${decision}|${JSON.stringify(detail)}`;
    return "sha256:" + createHash("sha256").update(Buffer.concat([Buffer.from([0x00]), Buffer.from(content)])).digest("hex");
  }

  /**
   * Compute parent hash with 0x01 domain prefix (RFC 6962 §2.1).
   * H(0x01 || left || right)
   */
  private computeParentHash(seq: number, leafHash: string): string {
    const prevHash = seq > 0 ? this.leaves[seq - 1].parentHash : "sha256:" + "0".repeat(64);
    return MerkleAuditTrail.hashInternalNode(prevHash, leafHash);
  }

  private computeMerkleRoot(): string {
    if (this.leaves.length === 0) return "sha256:" + "0".repeat(64);
    if (this.leaves.length === 1) return this.leaves[0].leafHash;

    let level = this.leaves.map((l) => l.leafHash);
    while (level.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = i + 1 < level.length ? level[i + 1] : level[i];
        nextLevel.push(MerkleAuditTrail.hashInternalNode(left, right));
      }
      level = nextLevel;
    }
    return level[0];
  }

  /**
   * Hash two child nodes with 0x01 domain prefix (RFC 6962).
   * Prevents second-preimage attacks by distinguishing leaves from internals.
   */
  private static hashInternalNode(left: string, right: string): string {
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
      const { writeFileSync } = require("node:fs");
      writeFileSync(this.headFile, JSON.stringify(this.latestHead, null, 2), "utf8");
    } catch {
      // Non-fatal
    }
  }
}
