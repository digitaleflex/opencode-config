// src/core/confinement.ts — Workspace Confinement + Egress Filtering
// Zero-dep: uses only node:fs and node:path built-ins.

import { resolve, sep, normalize, dirname, join } from "node:path";
import { existsSync, readFileSync, realpathSync, lstatSync } from "node:fs";

// ============================================================================
// WorkspaceGuard
// ============================================================================

export class WorkspaceGuard {
  private root: string;
  private rootReal: string;

  constructor(root: string) {
    const resolved = resolve(root);
    let real: string;
    try {
      real = realpathSync(resolved);
    } catch {
      real = resolved;
    }
    // Normalize to remove trailing sep inconsistencies (except "/" itself)
    this.root = resolved;
    this.rootReal = real;
  }

  /**
   * Resolve a path against the workspace root and verify confinement.
   * - Uses path.resolve(root, input) for traversal normalization
   * - Uses fs.realpathSync with fallback for nonexistent paths (walk parents)
   * - Checks startsWith(rootReal + sep) or === rootReal
   * - Detects symlink escapes via lstat vs realpath
   * - Handles Windows vs POSIX seps (C:\, C:/ patterns)
   */
  resolve(inputPath: string): { allowed: boolean; real: string; reason?: string } {
    if (typeof inputPath !== "string") {
      return { allowed: false, real: "", reason: "PATH_ESCAPE: invalid path type" };
    }

    const trimmed = inputPath.trim();

    // Empty string => treat as workspace root (allowed)
    if (trimmed === "") {
      return { allowed: true, real: this.rootReal };
    }

    // Windows absolute detection: C:\, C:/, \\server\share
    // Even on POSIX, path.resolve("C:\\Windows") would incorrectly resolve inside root,
    // so we explicitly block Windows absolutes that are not inside the workspace.
    const isWinAbs = /^[a-zA-Z]:[\\/]/.test(trimmed) || /^\\\\/.test(trimmed);
    if (isWinAbs) {
      const normalizedWin = trimmed.replace(/\\/g, "/");
      return {
        allowed: false,
        real: normalizedWin,
        reason: `PATH_ESCAPE: Windows absolute path outside workspace: ${trimmed}`,
      };
    }

    // Resolve against root (handles "..", ".", absolute POSIX, relative)
    let resolvedAbs: string;
    try {
      resolvedAbs = resolve(this.root, trimmed);
    } catch {
      return { allowed: false, real: trimmed, reason: `PATH_ESCAPE: unable to resolve ${trimmed}` };
    }

    // Try to get canonical real path (follow symlinks). If path does not exist,
    // walk up to nearest existing ancestor and re-append remainder.
    let realPath: string;
    try {
      realPath = realpathSync(resolvedAbs);
    } catch {
      // Walk parents until we find an existing entry
      let search = resolvedAbs;
      let foundReal: string | null = null;
      let remainder = "";

      // Keep track of remainder suffix to re-attach after realpath of parent
      while (true) {
        if (existsSync(search)) {
          try {
            const realParent = realpathSync(search);
            // realParent + "/" + remainder (remainder is the slice after search)
            // Compute remainder as resolvedAbs substring after search
            if (resolvedAbs.length > search.length) {
              remainder = resolvedAbs.slice(search.length);
              // ensure remainder uses sep
              realPath = normalize(realParent + remainder);
            } else {
              realPath = realParent;
            }
            foundReal = realPath;
            break;
          } catch {
            // realpath failed even though exists (e.g., broken symlink)
            realPath = resolvedAbs;
            foundReal = realPath;
            break;
          }
        }
        const parent = dirname(search);
        if (parent === search) {
          // Reached filesystem root without finding existing parent
          realPath = resolvedAbs;
          foundReal = realPath;
          break;
        }
        search = parent;
      }
      if (foundReal === null) {
        realPath = resolvedAbs;
      } else {
        realPath = foundReal;
      }
    }

    // Confinement check: realPath must be inside rootReal
    const rootWithSep = this.rootReal.endsWith(sep) ? this.rootReal : this.rootReal + sep;
    const isInside = realPath === this.rootReal || realPath.startsWith(rootWithSep);

    // Also normalize for POSIX comparison when sep is '/' but path may contain backslashes
    // (already handled Windows abs earlier, but handle mixed separators)
    let insideAlt = isInside;
    if (!isInside) {
      // Fallback: also test with forward-slash normalization for Windows-style paths on POSIX
      const normRoot = this.rootReal.replace(/\\/g, "/");
      const normReal = realPath.replace(/\\/g, "/");
      const normSep = "/";
      const normRootWithSep = normRoot.endsWith(normSep) ? normRoot : normRoot + normSep;
      insideAlt = normReal === normRoot || normReal.startsWith(normRootWithSep);
    }

    if (!insideAlt) {
      // Detect symlink escape for richer reason
      let reason = `PATH_ESCAPE: ${trimmed} resolves to ${realPath} outside workspace ${this.rootReal}`;
      try {
        const lst = lstatSync(resolvedAbs);
        if (lst.isSymbolicLink()) {
          reason = `PATH_ESCAPE: symlink escape ${trimmed} -> ${realPath} outside workspace`;
        } else {
          // Check if any intermediate component is a symlink that escapes
          // Walk up and test each component via lstat
          let curSearch = resolvedAbs;
          while (curSearch !== this.root && curSearch !== dirname(curSearch)) {
            if (curSearch === "/" || curSearch === ".") break;
            try {
              const st = lstatSync(curSearch);
              if (st.isSymbolicLink()) {
                let tgt: string;
                try {
                  tgt = realpathSync(curSearch);
                } catch {
                  tgt = curSearch;
                }
                if (tgt !== curSearch && !(tgt === this.rootReal || tgt.startsWith(rootWithSep))) {
                  reason = `PATH_ESCAPE: symlink escape ${trimmed} -> ${realPath} (symlink at ${curSearch} -> ${tgt})`;
                  break;
                }
              }
            } catch {
              // ignore missing component
            }
            const p = dirname(curSearch);
            if (p === curSearch) break;
            curSearch = p;
            // stop when we leave resolvedAbs ancestors beyond root prefix
            if (!curSearch.startsWith(this.root) && curSearch.length < this.root.length) break;
          }
        }
      } catch {
        // ignore lstat errors
      }
      return { allowed: false, real: realPath, reason };
    }

    return { allowed: true, real: realPath };
  }

  /** Expose root for testing / debugging */
  getRoot(): string {
    return this.rootReal;
  }
}

// ============================================================================
// Egress filtering
// ============================================================================

function parseAllowlistFromYaml(content: string): string[] | undefined {
  if (!content || typeof content !== "string") return undefined;
  if (!content.includes("allowlist")) return undefined;

  // Try inline array: allowlist: ["a", "b"] or allowlist: []
  const inlineMatch = content.match(/allowlist\s*:\s*\[(.*?)\]/s);
  if (inlineMatch) {
    const inside = inlineMatch[1].trim();
    if (inside === "") return [];
    const items = inside
      .split(",")
      .map((s) =>
        s
          .trim()
          .replace(/^["']|["']$/g, "")
          .trim()
      )
      .filter((s) => s.length > 0)
      .map((s) => s.toLowerCase());
    return items;
  }

  // Block style: allowlist:\n  - host\n  - host2
  const lines = content.split("\n");
  let inAllowlist = false;
  let indentLevel = -1;
  const hosts: string[] = [];
  let foundHeader = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    if (!inAllowlist) {
      // Detect header like "allowlist:" with optional trailing spaces
      const m = line.match(/^(\s*)allowlist\s*:\s*$/);
      if (m) {
        inAllowlist = true;
        foundHeader = true;
        indentLevel = m[1].length;
        continue;
      }
      // Also detect inline single value without brackets: allowlist: host.com
      const single = line.match(/^\s*allowlist\s*:\s*["']?([^"'\s\[\]]+)["']?\s*$/);
      if (single) {
        const val = single[1].trim().replace(/^["']|["']$/g, "");
        if (val && val !== "[]") {
          return [val.toLowerCase()];
        }
      }
    } else {
      // Inside allowlist block — expect list items deeper indented
      const indent = line.match(/^(\s*)/)![1].length;
      // Empty lines already skipped
      if (trimmed.startsWith("-")) {
        // Must be more indented than header
        if (indent <= indentLevel) {
          // Not part of this list (same or outer level) -> end
          break;
        }
        const item = trimmed
          .slice(1)
          .trim()
          .replace(/^["']|["']$/g, "")
          .trim()
          .toLowerCase();
        if (item) hosts.push(item);
        continue;
      }
      // Non-dash line at same or outer indent ends the list
      if (indent <= indentLevel && trimmed.length > 0) {
        break;
      }
      // Deeper but not dash — maybe continuation, ignore
      if (indent > indentLevel && !trimmed.startsWith("-")) {
        // Could be a nested key — treat as end of allowlist section
        // But allow for content like "  # comment"
        continue;
      }
    }
  }

  if (foundHeader) return hosts; // may be empty array meaning explicit empty allowlist
  // If header not found but inline already handled, return undefined to signal no allowlist key
  return undefined;
}

function loadAllowlistFromFile(): string[] | undefined {
  const candidates = [
    join(process.cwd(), "policies", "egress.yaml"),
    join(process.cwd(), "src", "policies", "egress.yaml"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, "utf8");
        const parsed = parseAllowlistFromYaml(content);
        if (parsed !== undefined) return parsed;
        // File exists but no allowlist key => treat as undefined (so caller defaults to deny)
        return undefined;
      } catch {
        return undefined;
      }
    }
  }
  return undefined; // file missing
}

function extractHostsFromUrls(command: string): string[] {
  const hosts: string[] = [];
  const urlRe = /https?:\/\/([^\s"'`<>\]\)]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(command)) !== null) {
    let hostPort = m[1];
    // hostPort may include path, query, port, trailing punctuation
    // Split at first / or ? or #
    hostPort = hostPort.split("/")[0].split("?")[0].split("#")[0];
    // Remove port
    const host = hostPort
      .split(":")[0]
      .replace(/[.,;]+$/, "")
      .toLowerCase();
    if (host) hosts.push(host);
  }
  return hosts;
}

function extractHostsFromTools(command: string): string[] {
  const hosts: string[] = [];
  const toolRe = /\b(curl|wget|nc|ncat|ssh|scp|ftp|sftp|rsync|fetch|aria2c|httpie)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = toolRe.exec(command)) !== null) {
    const after = command.slice(m.index + m[0].length);
    // Limit to segment before next command separator (| ; &)
    const segment = after.split(/[|;&]+/)[0];
    // Check for user@host pattern (ssh/scp)
    const atMatch = segment.match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
    if (atMatch) {
      hosts.push(atMatch[1].toLowerCase().split(":")[0].split("/")[0]);
      continue;
    }
    // Tokenize segment
    const tokens = segment.trim().split(/\s+/);
    for (const rawTok of tokens) {
      if (!rawTok) continue;
      if (rawTok.startsWith("-")) continue; // flag
      // Strip surrounding quotes/brackets
      const tok = rawTok.replace(/^["'`\[\(]+|["'`\]\)]+$/g, "").replace(/[.,;]+$/, "");
      if (tok.includes("://")) continue; // already handled as URL
      // Skip file paths that are absolute or relative without dot
      // But host-like must contain a dot and TLD
      if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(tok)) {
        const hostOnly = tok.split(":")[0].toLowerCase();
        hosts.push(hostOnly);
        break;
      }
      if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(tok)) {
        const hostOnly = tok.split("/")[0].split(":")[0].toLowerCase();
        hosts.push(hostOnly);
        break;
      }
      // Also handle naked host with port: evil.com:22
      if (/^[a-z0-9.-]+\.[a-z]{2,}:\d+$/i.test(tok)) {
        const hostOnly = tok.split(":")[0].toLowerCase();
        hosts.push(hostOnly);
        break;
      }
    }
  }
  return hosts;
}

export function checkEgress(
  command: string,
  allowlist?: string[]
): { allowed: boolean; reason?: string } {
  if (typeof command !== "string" || command.trim() === "") {
    return { allowed: true };
  }

  const toolRegex = /\b(curl|wget|nc|ncat|ssh|scp|ftp|sftp|rsync|fetch|aria2c|httpie)\b/i;
  const hasTool = toolRegex.test(command);
  const urlHosts = extractHostsFromUrls(command);
  const hasUrl = urlHosts.length > 0;

  if (!hasTool && !hasUrl) {
    return { allowed: true };
  }

  // Determine effective allowlist
  let effective: string[] | undefined = allowlist;
  if (effective === undefined) {
    const loaded = loadAllowlistFromFile();
    if (loaded !== undefined) {
      effective = loaded;
    } else {
      effective = []; // missing file => default deny (fail-closed)
    }
  }

  // Normalize allowlist entries
  const normalizedAllow = (effective || []).map((h) => h.trim().toLowerCase()).filter(Boolean);

  // Fail-closed: empty allowlist denies any egress pattern
  if (normalizedAllow.length === 0) {
    const reason =
      hasUrl && urlHosts.length > 0
        ? `EGRESS_DENIED: egress to ${urlHosts[0]} blocked (allowlist empty, fail-closed)`
        : `EGRESS_DENIED: egress tool detected (${command.match(toolRegex)?.[0] || "unknown"}) blocked (allowlist empty, fail-closed)`;
    return { allowed: false, reason };
  }

  // Collect all hosts from URLs and tool invocations
  let allHosts: string[] = [...urlHosts];
  if (allHosts.length === 0 && hasTool) {
    const toolHosts = extractHostsFromTools(command);
    allHosts = toolHosts;
  } else if (hasTool) {
    // Also include tool hosts in addition to URL hosts (e.g., curl evil.com + http URL)
    const toolHosts = extractHostsFromTools(command);
    // Merge unique
    for (const h of toolHosts) {
      if (!allHosts.includes(h)) allHosts.push(h);
    }
  }

  if (allHosts.length === 0) {
    // Tool detected but no host could be extracted => fail-closed
    return {
      allowed: false,
      reason: `EGRESS_DENIED: egress tool detected but host not parseable, blocked (fail-closed)`,
    };
  }

  // Check each host against allowlist (exact or subdomain suffix)
  const blocked: string[] = [];
  for (const host of allHosts) {
    const isAllowlisted = normalizedAllow.some(
      (allowed) => host === allowed || host.endsWith("." + allowed)
    );
    if (!isAllowlisted) blocked.push(host);
  }

  if (blocked.length > 0) {
    return {
      allowed: false,
      reason: `EGRESS_DENIED: host(s) ${blocked.join(", ")} not in allowlist [${normalizedAllow.join(", ")}]`,
    };
  }

  return { allowed: true };
}

// Also export helpers for testing if needed
export const _internal = {
  parseAllowlistFromYaml,
  loadAllowlistFromFile,
  extractHostsFromUrls,
  extractHostsFromTools,
};
