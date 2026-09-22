// dashboard/server.ts — EURINHASH Command Center server (Bun)
// Sert le dashboard statique + API /api/state lisant les données réelles.
//
// Usage: bun run dashboard/server.ts  →  http://localhost:4321

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PORT = Number(process.env.EURINHASH_DASHBOARD_PORT || 4321);

// ─── Lecture JSON sécurisée ────────────────────────────────────

function readJson(rel: string): unknown {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

// ─── Workers (free-models.json + provider_circuit.json) ────────

interface WorkerInfo {
  name: string;
  model: string;
  state: string;
  latency?: number;
}

const WORKER_MODELS: Record<string, string> = {
  "worker-opencode": "opencode/deepseek-v4-flash",
  "worker-opencode-heavy": "opencode/glm-5",
  "worker-codestral": "openrouter/poolside/laguna-s-2.1:free",
  "worker-groq": "groq/qwen/qwen3.8-27b",
  "worker-novita": "novita/inclusionai/ling-3.0-flash-sante",
  "worker-zhipu": "zhipu/glm-4.7-flash",
  "worker-google": "google/gemini-2.5-flash",
  "worker-pollinations": "pollinations/openai",
  "worker-ollama": "ollama/devstral",
  "worker-zenmux": "zenmux/anthropic/claude-sonnet-5-free",
};

function readWorkers(): WorkerInfo[] {
  const freeModels = readJson("free-models.json") as { models?: Record<string, string> } | null;
  const circuit = readJson("provider_circuit.json") as Record<string, { state?: string }> | null;
  const models = freeModels?.models ?? {};

  const names = Object.keys(WORKER_MODELS);
  return names.map((name) => {
    const state = models[name] ?? models[name.replace("worker-", "")] ?? "unknown";
    const circuitState = circuit?.[name]?.state;
    // Circuit OPEN domine le statut
    const finalState = circuitState === "OPEN" ? "error" : state;
    return {
      name,
      model: WORKER_MODELS[name],
      state: finalState,
      latency: undefined,
    };
  });
}

// ─── Activity (audit logs) ─────────────────────────────────────

interface ActivityEntry {
  category: string;
  title: string;
  detail: string;
  time: number;
}

const AUDIT_CATEGORY: Record<string, string> = {
  classification: "classify",
  risk: "risk",
  policy: "policy",
  guard: "guard",
  proof: "proof",
  final: "system",
  injection: "risk",
  semantic: "risk",
  mcp: "mcp",
};

function readActivity(): ActivityEntry[] {
  const logsDir = join(ROOT, "logs");
  if (!existsSync(logsDir)) return [];
  const files = readdirSync(logsDir)
    .filter((f) => /^governance-audit-.*\.jsonl$/.test(f))
    .sort()
    .slice(-3);

  const entries: ActivityEntry[] = [];
  for (const file of files) {
    const content = readFileSync(join(logsDir, file), "utf-8");
    for (const line of content.split("\n").filter(Boolean)) {
      try {
        const e = JSON.parse(line) as {
          stage?: string; decision?: string; taskDescription?: string;
          timestamp?: string; reason?: string;
        };
        entries.push({
          category: AUDIT_CATEGORY[e.stage ?? ""] ?? "system",
          title: e.stage ?? "event",
          detail: `${e.decision ?? ""} · ${(e.taskDescription ?? "").slice(0, 60)}`,
          time: e.timestamp ? Date.parse(e.timestamp) : Date.now(),
        });
      } catch { /* skip malformed */ }
    }
  }
  return entries.sort((a, b) => b.time - a.time).slice(0, 10);
}

// ─── Logs terminal (audit tail) ────────────────────────────────

interface LogLine { level: string; message: string }

function readLogs(): LogLine[] {
  const logsDir = join(ROOT, "logs");
  if (!existsSync(logsDir)) return [];
  const files = readdirSync(logsDir)
    .filter((f) => /^governance-audit-.*\.jsonl$/.test(f))
    .sort()
    .slice(-1);
  if (files.length === 0) return [];

  const content = readFileSync(join(logsDir, files[0]), "utf-8");
  const lines: LogLine[] = [];
  for (const line of content.split("\n").filter(Boolean).slice(-15)) {
    try {
      const e = JSON.parse(line) as { stage?: string; decision?: string; reason?: string };
      const level = e.decision === "BLOCKED" ? "ERROR" : e.decision === "WARN" ? "WARN" : "INFO";
      lines.push({
        level,
        message: `[${e.stage ?? "?"}] ${e.reason ?? e.decision ?? ""}`,
      });
    } catch { /* skip */ }
  }
  return lines;
}

// ─── Mode engine ───────────────────────────────────────────────

function readMode(): string {
  const mode = readJson("mode.json") as { mode?: string } | null;
  return mode?.mode ?? "free";
}

// ─── API /api/state ────────────────────────────────────────────

function buildState() {
  return {
    workers: readWorkers(),
    activity: readActivity(),
    logs: readLogs(),
    mode: readMode(),
    reposConnected: 3,
    agent: { status: "running", model: "Claude 3.5 Sonnet" },
    timestamp: Date.now(),
  };
}

// ─── Serveur ───────────────────────────────────────────────────

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/api/state") {
      return Response.json(buildState());
    }

    if (path === "/api/health") {
      return Response.json({ ok: true, ts: Date.now() });
    }

    // Fichiers statiques du dashboard
    const filePath = path === "/" ? "index.html" : path.replace(/^\//, "");
    const full = join(__dirname, filePath);
    if (existsSync(full)) {
      const ext = filePath.slice(filePath.lastIndexOf("."));
      const body = readFileSync(full);
      return new Response(body, {
        headers: { "Content-Type": MIME[ext] ?? "application/octet-stream" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`\n  ╭──────────────────────────────────────────────╮`);
console.log(`  │  EURINHASH Command Center                    │`);
console.log(`  │  http://localhost:${PORT}                       │`);
console.log(`  │  API: /api/state · /api/health               │`);
console.log(`  ╰──────────────────────────────────────────────╯\n`);
console.log(`  Server listening on port ${server.port}`);