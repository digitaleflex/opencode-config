// src/core/mcp-governance.ts — MCP Governance (tool poisoning / rug-pull defense)
// Zero-dep: uses node:crypto, node:fs, node:path only.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { normalizeForMatching } from "./unicode-normalize";
import { InjectionDetector } from "./injection-detection";

export interface McpTool {
  name: string;
  description: string;
}

export interface McpManifest {
  server: string;
  tools: McpTool[];
  version?: string;
  signature?: string;
}

interface StoredEntry {
  manifest: McpManifest;
  toolHashes: Map<string, string>;
}

export class McpGovernance {
  private trustFile: string;
  private persistPath: string;
  private manifests: Map<string, StoredEntry> = new Map();
  private trustedKeys: Map<string, string | undefined> = new Map();
  private detector: InjectionDetector;

  constructor(trustFile?: string) {
    const explicit = trustFile !== undefined;
    this.trustFile = trustFile ?? join(process.cwd(), "policies/mcp-trust.yaml");
    if (explicit) {
      this.persistPath = join(dirname(this.trustFile), "mcp-manifests.json");
    } else {
      this.persistPath = join(process.cwd(), "logs", "mcp-manifests.json");
    }
    this.detector = new InjectionDetector();
    this.loadTrustFile();
    this.loadPersisted();
  }

  registerManifest(manifest: McpManifest): void {
    if (!manifest || typeof manifest.server !== "string" || !manifest.server.trim() || !Array.isArray(manifest.tools)) {
      return;
    }
    const hashes = new Map<string, string>();
    for (const t of manifest.tools) {
      hashes.set(t.name, this.hashDescription(t.description));
    }
    // deep clone to avoid external mutation
    const clone: McpManifest = JSON.parse(JSON.stringify(manifest));
    this.manifests.set(manifest.server, { manifest: clone, toolHashes: hashes });
    this.persist();
  }

  verifyManifest(manifest: McpManifest): { valid: boolean; reason?: string; changes?: string[] } {
    if (!manifest || typeof manifest.server !== "string" || !manifest.server.trim() || !Array.isArray(manifest.tools)) {
      return { valid: false, reason: "invalid manifest", changes: ["invalid manifest"] };
    }

    // Signature verification if present and trusted key exists
    const sigCheck = this.verifySignature(manifest);
    if (!sigCheck.valid) {
      return { valid: false, reason: sigCheck.reason, changes: ["signature mismatch"] };
    }

    // Scan tool descriptions for injection / poisoning
    for (const tool of manifest.tools) {
      const scan = this.scanToolDescription(tool.description);
      if (scan.suspicious) {
        return {
          valid: false,
          reason: `suspicious tool description in ${tool.name}: ${scan.reason}`,
          changes: [`suspicious description: ${tool.name}`],
        };
      }
    }

    const stored = this.manifests.get(manifest.server);
    const isUnknownServer = this.trustedKeys.size > 0 && !this.trustedKeys.has(manifest.server);

    if (!stored) {
      this.registerManifest(manifest);
      if (isUnknownServer) {
        return { valid: true, reason: "unknown server", changes: ["first seen: unknown server"] };
      }
      return { valid: true, reason: "first seen", changes: ["first seen"] };
    }

    const changes: string[] = [];
    let valid = true;
    const reasonParts: string[] = [];

    if (manifest.version !== stored.manifest.version) {
      if (manifest.version !== undefined || stored.manifest.version !== undefined) {
        changes.push(`version changed: ${stored.manifest.version ?? "undefined"} -> ${manifest.version ?? "undefined"}`);
      }
    }

    const storedHashes = stored.toolHashes;
    const incomingHashes = new Map<string, string>();
    for (const t of manifest.tools) {
      incomingHashes.set(t.name, this.hashDescription(t.description));
    }

    // Added tools
    for (const [name] of incomingHashes) {
      if (!storedHashes.has(name)) {
        changes.push(`added tool: ${name}`);
        valid = false;
        reasonParts.push(`added tool: ${name}`);
      }
    }
    // Removed tools
    for (const [name] of storedHashes) {
      if (!incomingHashes.has(name)) {
        changes.push(`removed tool: ${name}`);
        valid = false;
        reasonParts.push(`removed tool: ${name}`);
      }
    }
    // Rug-pull: description hash changed
    for (const [name, hash] of incomingHashes) {
      if (storedHashes.has(name) && storedHashes.get(name) !== hash) {
        const rugReason = `tool description changed (possible rug-pull): ${name}`;
        const allChanges = [...changes, `tool description changed: ${name}`];
        return { valid: false, reason: rugReason, changes: allChanges };
      }
    }

    if (!valid) {
      return { valid: false, reason: reasonParts.join(", "), changes };
    }

    if (isUnknownServer) {
      const reason = changes.length > 0 ? `unknown server; ${changes.join(", ")}` : "unknown server";
      const ch = changes.length > 0 ? [...changes, "unknown server"] : ["unknown server"];
      return { valid: true, reason, changes: ch };
    }

    if (changes.length > 0) {
      return { valid: true, reason: changes.join(", "), changes };
    }

    return { valid: true, changes: [] };
  }

  getManifest(server: string): McpManifest | null {
    const entry = this.manifests.get(server);
    if (!entry) return null;
    return JSON.parse(JSON.stringify(entry.manifest)) as McpManifest;
  }

  scanToolDescription(desc: string): { suspicious: boolean; reason?: string } {
    if (typeof desc !== "string" || desc.trim().length === 0) {
      return { suspicious: false };
    }
    const normalized = normalizeForMatching(desc);

    // Reuse injection detector
    const report = this.detector.scan(desc);
    if (report.detected) {
      return { suspicious: true, reason: `injection pattern detected: ${report.categories.join(", ")}` };
    }

    const toolPoisoningPatterns: RegExp[] = [
      /ignore\s+(all\s+)?previous\s+instructions/i,
      /disregard\s+(all\s+)?prior/i,
      /forget\s+(everything|all|your)\s+(instructions|rules)/i,
      /you\s+are\s+now/i,
      /do\s+anything\s+now/i,
      /reveal\s+(your|the)\s+system\s+prompt/i,
      /override\s+(your|the)\s+system\s+prompt/i,
      /exfiltrate/i,
      /send\s+.*\s+to\s+http/i,
      /upload\s+.*\s+to/i,
      /execute\s+.*\s+command/i,
      /act\s+as\s*(if|though)/i,
      /pretend\s+you\s+are/i,
      /privilege\s+escalation/i,
      /jailbreak/i,
      /system\s+prompt/i,
      /disregard\s+safety/i,
      /ignore\s+safety/i,
    ];
    for (const pat of toolPoisoningPatterns) {
      if (pat.test(normalized)) {
        return { suspicious: true, reason: `imperative/injection instruction detected: ${pat.source.slice(0, 60)}` };
      }
    }

    const imperativeStart = /^\s*(ignore|disregard|forget|reveal|execute|run|delete|send|exfiltrate|override|pretend|act)\b/i;
    if (imperativeStart.test(normalized)) {
      return { suspicious: true, reason: "tool description contains imperative instruction" };
    }

    return { suspicious: false };
  }

  // --- Private helpers ---

  private hashDescription(desc: string): string {
    return createHash("sha256").update(desc ?? "", "utf8").digest("hex");
  }

  private verifySignature(manifest: McpManifest): { valid: boolean; reason?: string } {
    if (!manifest.signature) return { valid: true };
    const key = this.trustedKeys.get(manifest.server);
    if (key === undefined || key === null) {
      // No key for this server — if trust file exists but server unknown, we already handle unknown gracefully
      // For known server without key, skip verification (permissive)
      // If server is unknown and signature present but no key, treat as valid (unknown server path)
      return { valid: true };
    }
    const payload = JSON.stringify({ server: manifest.server, tools: manifest.tools, version: manifest.version });
    const expected = createHmac("sha256", key).update(payload, "utf8").digest("hex");
    const sig = manifest.signature.replace(/^sha256:/, "").replace(/^hmac-sha256:/, "").trim();
    try {
      const expectedBuf = Buffer.from(expected, "hex");
      const sigBuf = Buffer.from(sig, "hex");
      if (expectedBuf.length !== sigBuf.length) {
        return { valid: false, reason: `invalid signature for server ${manifest.server}` };
      }
      if (!timingSafeEqual(expectedBuf, sigBuf)) {
        return { valid: false, reason: `invalid signature for server ${manifest.server}` };
      }
    } catch {
      if (expected !== sig) {
        return { valid: false, reason: `invalid signature for server ${manifest.server}` };
      }
    }
    return { valid: true };
  }

  private persist(): void {
    try {
      const dir = dirname(this.persistPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const obj: Record<string, unknown> = {};
      for (const [server, entry] of this.manifests.entries()) {
        const hashesObj: Record<string, string> = {};
        for (const [k, v] of entry.toolHashes.entries()) hashesObj[k] = v;
        obj[server] = { manifest: entry.manifest, hashes: hashesObj, storedAt: new Date().toISOString() };
      }
      const tmp = this.persistPath + ".tmp." + Date.now() + "." + Math.random().toString(36).slice(2, 8);
      writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
      renameSync(tmp, this.persistPath);
    } catch {
      // non-fatal
    }
  }

  private loadPersisted(): void {
    if (!existsSync(this.persistPath)) return;
    try {
      const raw = readFileSync(this.persistPath, "utf8");
      if (!raw.trim()) return;
      const data = JSON.parse(raw) as Record<string, unknown>;
      if (Array.isArray(data)) {
        for (const entry of data as unknown[]) {
          const e = entry as Record<string, unknown>;
          if (e && typeof e === "object" && "server" in e && "tools" in e) {
            const m = e as unknown as McpManifest;
            const hashes = new Map<string, string>();
            for (const t of m.tools) hashes.set(t.name, this.hashDescription(t.description));
            this.manifests.set(m.server, { manifest: JSON.parse(JSON.stringify(m)), toolHashes: hashes });
          } else if (e && typeof e === "object" && "manifest" in e) {
            const man = (e as { manifest: McpManifest; hashes?: Record<string, string> }).manifest;
            const hashesRaw = (e as { hashes?: Record<string, string> }).hashes;
            const hashes = new Map<string, string>();
            if (hashesRaw) {
              for (const [k, v] of Object.entries(hashesRaw)) hashes.set(k, v);
            } else {
              for (const t of man.tools) hashes.set(t.name, this.hashDescription(t.description));
            }
            this.manifests.set(man.server, { manifest: JSON.parse(JSON.stringify(man)), toolHashes: hashes });
          }
        }
      } else if (data && typeof data === "object") {
        for (const [server, val] of Object.entries(data as Record<string, unknown>)) {
          const entry = val as Record<string, unknown>;
          if (!entry || typeof entry !== "object") continue;
          if ("manifest" in entry && (entry as { manifest: unknown }).manifest) {
            const man = (entry as { manifest: McpManifest }).manifest;
            const hashesRaw = (entry as { hashes?: Record<string, string> }).hashes;
            const hashes = new Map<string, string>();
            if (hashesRaw && typeof hashesRaw === "object") {
              for (const [k, v] of Object.entries(hashesRaw)) hashes.set(k, v);
            } else if (man && Array.isArray(man.tools)) {
              for (const t of man.tools) hashes.set(t.name, this.hashDescription(t.description));
            }
            if (man && man.server) {
              this.manifests.set(server, { manifest: JSON.parse(JSON.stringify(man)), toolHashes: hashes });
            }
          } else if ("tools" in entry && Array.isArray((entry as { tools: unknown }).tools)) {
            const m = entry as unknown as McpManifest;
            const hashes = new Map<string, string>();
            for (const t of m.tools) hashes.set(t.name, this.hashDescription(t.description));
            this.manifests.set(server, { manifest: JSON.parse(JSON.stringify(m)), toolHashes: hashes });
          }
        }
      }
    } catch {
      // corrupted — start fresh
    }
  }

  private loadTrustFile(): void {
    if (!existsSync(this.trustFile)) return;
    try {
      const raw = readFileSync(this.trustFile, "utf8");
      if (!raw.trim()) return;
      const trimmed = raw.trim();
      // Try JSON first
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(raw);
          this.parseTrustObject(parsed);
          return;
        } catch {
          // fall through to YAML
        }
      }
      // Check if JSON-like but not parsed (fallback)
      try {
        const parsed = JSON.parse(raw);
        this.parseTrustObject(parsed);
        return;
      } catch {
        // not JSON
      }
      this.parseTrustYamlRaw(raw);
    } catch {
      // permissive
    }
  }

  private parseTrustObject(obj: unknown): void {
    if (Array.isArray(obj)) {
      for (const item of obj as unknown[]) {
        if (typeof item === "string") {
          this.trustedKeys.set(item, undefined);
        } else if (item && typeof item === "object") {
          const rec = item as Record<string, unknown>;
          const name = (rec.server ?? rec.name ?? rec.id) as string | undefined;
          const key = (rec.key ?? rec.hmac ?? rec.secret) as string | undefined;
          if (name) this.trustedKeys.set(String(name), key ? String(key) : undefined);
        }
      }
      return;
    }
    if (obj && typeof obj === "object") {
      const o = obj as Record<string, unknown>;
      const candidates = ["trusted_servers", "trustedServers", "allowlist", "servers", "trusted", "mcpServers"];
      for (const c of candidates) {
        if (Array.isArray(o[c])) {
          for (const item of o[c] as unknown[]) {
            if (typeof item === "string") {
              this.trustedKeys.set(item, undefined);
            } else if (item && typeof item === "object") {
              const rec = item as Record<string, unknown>;
              const name = (rec.server ?? rec.name ?? rec.id) as string | undefined;
              const key = (rec.key ?? rec.hmac ?? rec.secret) as string | undefined;
              if (name) this.trustedKeys.set(String(name), key ? String(key) : undefined);
            }
          }
        }
      }
      if (o.keys && typeof o.keys === "object" && !Array.isArray(o.keys)) {
        for (const [k, v] of Object.entries(o.keys as Record<string, unknown>)) {
          this.trustedKeys.set(String(k), String(v));
        }
      }
      if (o.secrets && typeof o.secrets === "object" && !Array.isArray(o.secrets)) {
        for (const [k, v] of Object.entries(o.secrets as Record<string, unknown>)) {
          this.trustedKeys.set(String(k), String(v));
        }
      }
    }
  }

  private parseTrustYamlRaw(raw: string): void {
    const lines = raw.split("\n");
    let pendingServer: string | null = null;
    let inKeysSection = false;
    let inServersSection = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("---")) continue;
      if (/^trusted_servers\s*:\s*$/i.test(trimmed) || /^trustedServers\s*:\s*$/i.test(trimmed) || /^allowlist\s*:\s*$/i.test(trimmed) || /^servers\s*:\s*$/i.test(trimmed)) {
        if (pendingServer) {
          this.trustedKeys.set(pendingServer, undefined);
          pendingServer = null;
        }
        inServersSection = true;
        inKeysSection = false;
        continue;
      }
      if (/^keys\s*:\s*$/i.test(trimmed) || /^secrets\s*:\s*$/i.test(trimmed) || /^hmac_keys\s*:\s*$/i.test(trimmed)) {
        if (pendingServer) {
          this.trustedKeys.set(pendingServer, undefined);
          pendingServer = null;
        }
        inKeysSection = true;
        inServersSection = false;
        continue;
      }
      if (/^\w+\s*:\s*$/.test(trimmed) && !trimmed.startsWith("-")) {
        // unknown section header
        if (pendingServer) {
          this.trustedKeys.set(pendingServer, undefined);
          pendingServer = null;
        }
        // keep sections only if known, else reset
        if (!["trusted_servers", "trustedServers", "allowlist", "servers", "keys", "secrets", "hmac_keys"].includes(trimmed.replace(":", "").trim())) {
          inKeysSection = false;
          inServersSection = false;
        }
        continue;
      }

      if (inKeysSection) {
        const kv = trimmed.match(/^([A-Za-z0-9._-]+)\s*:\s*["']?([^"'\n#]+)["']?\s*$/);
        if (kv) {
          const k = kv[1];
          const v = kv[2].trim().replace(/^["']|["']$/g, "").split(/\s+#/)[0].trim();
          if (k && v) this.trustedKeys.set(k, v);
          continue;
        }
      }

      const dashServer = trimmed.match(/^-\s*server\s*:\s*["']?([^"'\s]+)["']?\s*$/i);
      if (dashServer) {
        if (pendingServer) this.trustedKeys.set(pendingServer, undefined);
        pendingServer = dashServer[1];
        continue;
      }
      const dashName = trimmed.match(/^-\s*name\s*:\s*["']?([^"'\s]+)["']?\s*$/i);
      if (dashName) {
        if (pendingServer) this.trustedKeys.set(pendingServer, undefined);
        pendingServer = dashName[1];
        continue;
      }
      const dashSimple = trimmed.match(/^-\s*["']?([A-Za-z0-9._-]+)["']?\s*$/);
      if (dashSimple && !trimmed.includes(":")) {
        if (pendingServer) {
          this.trustedKeys.set(pendingServer, undefined);
          pendingServer = null;
        }
        const name = dashSimple[1];
        if (name && !["trusted_servers", "allowlist", "servers", "keys"].includes(name)) {
          this.trustedKeys.set(name, undefined);
        }
        continue;
      }
      const serverProp = trimmed.match(/^server\s*:\s*["']?([^"'\s]+)["']?\s*$/i) || trimmed.match(/^name\s*:\s*["']?([^"'\s]+)["']?\s*$/i);
      if (serverProp) {
        if (pendingServer) this.trustedKeys.set(pendingServer, undefined);
        pendingServer = serverProp[1];
        continue;
      }
      const keyProp = trimmed.match(/^key\s*:\s*["']?([^"'\n#]+)["']?\s*$/i) || trimmed.match(/^hmac\s*:\s*["']?([^"'\n#]+)["']?\s*$/i) || trimmed.match(/^secret\s*:\s*["']?([^"'\n#]+)["']?\s*$/i);
      if (keyProp && pendingServer) {
        const keyVal = keyProp[1].trim().replace(/^["']|["']$/g, "").split(/\s+#/)[0].trim();
        this.trustedKeys.set(pendingServer, keyVal);
        pendingServer = null;
        continue;
      }
    }
    if (pendingServer) {
      this.trustedKeys.set(pendingServer, undefined);
    }
  }
}
