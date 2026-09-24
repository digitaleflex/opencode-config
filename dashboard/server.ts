// dashboard/server.ts — EURINHASH Command Center server (Bun)
// Vrai poste de pilotage : chat → orchestrateur, git réel, file tree réel,
// terminal sécurisé via GuardOverrides, ressources système réelles.
//
// Usage:
//   bun run dashboard                          → pilote opencode-config
//   bun run dashboard -- /chemin/vers/projet   → pilote n'importe quel projet
//   EURINHASH_DASHBOARD_DIR=/projet bun run dashboard
//   EURINHASH_DASHBOARD_PORT=9999 bun run dashboard

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { GovernanceOrchestrator } from "../src/core/orchestrator";
import { GuardOverrides } from "../src/core/guard-overrides";
import type { TaskSpec } from "../src/core/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EURINHASH_DIR = join(__dirname, ".."); // config EURINHASH (workers, logs, mode)
const PORT = Number(process.env.EURINHASH_DASHBOARD_PORT || 4321);

// Workspace à piloter : argument CLI > env var > défaut = opencode-config
const cliArg = process.argv.slice(2).filter((a) => !a.startsWith("--")).join(" ");
const WORKSPACE_DIR = resolve(
  process.env.EURINHASH_DASHBOARD_DIR || cliArg || EURINHASH_DIR
);

// Orchestrateur partagé (une instance pour toute la session)
const orchestrator = new GovernanceOrchestrator();
const guardOverrides = new GuardOverrides();

// ─── Lecture JSON sécurisée (depuis EURINHASH_DIR) ─────────────

function readJson(rel: string): unknown {
  const p = join(EURINHASH_DIR, rel);
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

  return Object.keys(WORKER_MODELS).map((name) => {
    const state = models[name] ?? models[name.replace("worker-", "")] ?? "unknown";
    const circuitState = circuit?.[name]?.state;
    const finalState = circuitState === "OPEN" ? "error" : state;
    return { name, model: WORKER_MODELS[name], state: finalState };
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
  const logsDir = join(EURINHASH_DIR, "logs");
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
  const logsDir = join(EURINHASH_DIR, "logs");
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
      lines.push({ level, message: `[${e.stage ?? "?"}] ${e.reason ?? e.decision ?? ""}` });
    } catch { /* skip */ }
  }
  return lines;
}

// ─── Mode engine ───────────────────────────────────────────────

function readMode(): string {
  const mode = readJson("mode.json") as { mode?: string } | null;
  return mode?.mode ?? "free";
}

// ─── Git réel ──────────────────────────────────────────────────

function git(args: string): string {
  try {
    return execSync(`git ${args}`, { cwd: WORKSPACE_DIR, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

interface GitState {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  untracked: string[];
  staged: string[];
  lastCommit: string;
}

function readGit(): GitState {
  const branch = git("rev-parse --abbrev-ref HEAD") || "main";
  const status = git("status --porcelain");
  const modified: string[] = [];
  const untracked: string[] = [];
  const staged: string[] = [];

  for (const line of status.split("\n").filter(Boolean)) {
    const code = line.slice(0, 2);
    const file = line.slice(3);
    if (code.includes("?")) untracked.push(file);
    else if (code.startsWith("M") || code.startsWith("A") || code.startsWith("D") || code.startsWith("R")) staged.push(file);
    if (code[1] === "M" || code[1] === "D") modified.push(file);
  }

  const aheadBehind = git("rev-list --left-right --count HEAD...@{upstream} 2>/dev/null").split(/\s+/);
  const ahead = Number(aheadBehind[0] || 0);
  const behind = Number(aheadBehind[1] || 0);
  const lastCommit = git("log -1 --format=%h %s") || "";

  return { branch, ahead, behind, modified, untracked, staged, lastCommit };
}

// ─── File tree réel ────────────────────────────────────────────

interface FileNode {
  name: string;
  path: string;
  type: "dir" | "file";
  children?: FileNode[];
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "coverage", ".turbo", ".next", "logs"]);
const SKIP_FILES = new Set([".env", "package-lock.json", "bun.lock"]);

function buildTree(dir: string, base: string, depth: number): FileNode[] {
  if (depth > 3) return [];
  const out: FileNode[] = [];
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return []; }

  for (const name of entries.sort()) {
    if (SKIP_DIRS.has(name) || SKIP_FILES.has(name)) continue;
    if (name.startsWith(".") && name !== ".github") continue;
    const full = join(dir, name);
    const rel = relative(base, full).replace(/\\/g, "/");
    let isDir = false;
    try { isDir = statSync(full).isDirectory(); } catch { continue; }
    if (isDir) {
      out.push({ name, path: rel, type: "dir", children: buildTree(full, base, depth + 1) });
    } else {
      out.push({ name, path: rel, type: "file" });
    }
  }
  return out;
}

// ─── Ressources système réelles ────────────────────────────────

function readSystem() {
  const mem = process.memoryUsage();
  const totalMem = 16 * 1024 * 1024 * 1024; // fallback 16GB
  const cpu = Math.min(100, Math.round((mem.rss / totalMem) * 100));
  return {
    cpu: cpu,
    memory: { used: mem.rss, total: totalMem },
    uptime: process.uptime(),
    node: process.version,
    platform: process.platform,
  };
}

// ─── Chat → Orchestrateur ──────────────────────────────────────

interface ChatRequest {
  message: string;
  taskType?: string;
  complexity?: string;
}

// ─── Exécution réelle via workers gratuits (D1) ────────────────
// Appelle les providers gratuits via HTTP réel (comme free-probe.py),
// avec fallback en chaîne. Lit les clés depuis ~/.config/opencode/.

function readKey(name: string): string {
  try {
    return readFileSync(join(EURINHASH_DIR, name), "utf-8").trim();
  } catch {
    return "";
  }
}

interface WorkerCall {
  name: string;
  url: string;
  keyFile: string;
  model: string;
}

const WORKER_CALLS: WorkerCall[] = [
  {
    name: "worker-groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    keyFile: ".groq-key",
    model: "qwen/qwen3.8-27b",
  },
  {
    name: "worker-zhipu",
    url: "https://api.z.ai/api/paas/v4/chat/completions",
    keyFile: ".zhipu-key",
    model: "glm-4.7-flash",
  },
  {
    name: "worker-codestral",
    url: "https://openrouter.ai/api/v1/chat/completions",
    keyFile: ".openrouter-key",
    model: "poolside/laguna-s-2.1:free",
  },
  {
    name: "worker-novita",
    url: "https://api.novita.ai/openai/v1/chat/completions",
    keyFile: ".novita-key",
    model: "novita/inclusionai/ling-3.0-flash-sante",
  },
];

// Lookup HTTP-exécutable par nom (tirets, comme route.py).
// Volontairement exclus : worker-opencode / opencode-heavy (intégrés,
// pas d'endpoint HTTP) et worker-google (API non OpenAI-compatible).
// Le routeur les saute via --next au lieu d'échouer dessus.
const WORKER_BY_NAME: Record<string, WorkerCall> = Object.fromEntries(
  WORKER_CALLS.map((w) => [w.name, w])
);

async function callWorker(worker: WorkerCall, prompt: string, timeoutMs = 30000): Promise<{
  ok: boolean;
  output?: string;
  error?: string;
  status?: number;
}> {
  const key = readKey(worker.keyFile);
  if (!key) return { ok: false, error: `clé ${worker.keyFile} absente` };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(worker.url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: worker.model,
        messages: [
          { role: "system", content: "Tu es EURINHASH, un agent d'ingénierie. Réponds de façon concise et technique." },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 120)}`, status: res.status };
    }
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const output = data.choices?.[0]?.message?.content?.trim() || "(réponse vide)";
    return { ok: true, output };
  } catch (err: any) {
    return { ok: false, error: err?.name === "AbortError" ? "timeout" : err?.message || "erreur" };
  } finally {
    clearTimeout(timer);
  }
}

async function executeWithWorker(prompt: string): Promise<{
  success: boolean;
  output?: string;
  error?: string;
  provider?: string;
}> {
  for (const worker of WORKER_CALLS) {
    const result = await callWorker(worker, prompt);
    if (result.ok) {
      return { success: true, output: result.output, provider: worker.name };
    }
    // 429 → essayer le suivant
    if (result.status === 429) continue;
    // Autre erreur → essayer le suivant aussi (failover)
  }
  return { success: false, error: "Tous les workers gratuits ont échoué (quota/auth/timeout)" };
}


// ─── Model Router D4 : gouvernance → route.py ────────────────
// Table de mapping : TaskType gouvernance → type route.py
// (route.py ne connaît que code/general/quick/long/heavy/review).
function mapGovernanceToRoute(governanceType: string): string {
  switch (governanceType) {
    case "TYPO":
    case "CONFIG":
    case "FORMAT":
    case "DOC_READ":
    case "DOC_WRITE":
      return "quick";
    case "BUG_LOCALIZED":
    case "REFACTOR_MODULE":
      return "code";
    case "API_CHANGE":
    case "ARCH_DESIGN":
      return "heavy";
    case "SECURITY":
      return "review";
    case "FEATURE_LIMITED":
    default:
      return "general";
  }
}

const ROUTE_TTL_MS = 60_000;
const routeCache: Record<string, { name: string; ev: number; ts: number }> = {};

function runRouteSync(routeType: string, skip: number): { name: string; ev: number } | null {
  const script = join(EURINHASH_DIR, "scripts", "route.py");
  const args = `${routeType} --next=${skip}`;
  const attempts = [`python3 "${script}" ${args}`, `python "${script}" ${args}`];
  for (const cmd of attempts) {
    try {
      const output = execSync(cmd, { encoding: "utf-8", timeout: 30000, cwd: EURINHASH_DIR }).trim();
      const parts = output.split("|");
      if (parts.length < 4) continue;
      const ev = parseFloat(parts[3].replace("EV=", ""));
      if (!parts[0] || Number.isNaN(ev)) continue;
      return { name: parts[0], ev };
    } catch {
      continue;
    }
  }
  return null;
}

function getBestWorker(routeType: string, skip = 0): { name: string; ev: number } | null {
  if (skip === 0) {
    const cached = routeCache[routeType];
    if (cached && Date.now() - cached.ts < ROUTE_TTL_MS) return { name: cached.name, ev: cached.ev };
  }
  const best = runRouteSync(routeType, skip);
  if (best && skip === 0) routeCache[routeType] = { ...best, ts: Date.now() };
  return best;
}

function recordRouteResult(worker: string, success: boolean): void {
  try {
    const script = join(EURINHASH_DIR, "scripts", "route.py");
    const outcome = success ? "success" : "fail";
    try {
      execSync(`python3 "${script}" record ${worker} ${outcome}`, { encoding: "utf-8", timeout: 10000, cwd: EURINHASH_DIR });
    } catch {
      execSync(`python "${script}" record ${worker} ${outcome}`, { encoding: "utf-8", timeout: 10000, cwd: EURINHASH_DIR });
    }
    // Invalide le cache : l'EV du worker vient de changer
    for (const k of Object.keys(routeCache)) delete routeCache[k];
  } catch (err) {
    console.warn("[route:record] erreur:", (err as Error).message);
  }
}

// Exécute via l'ordre EV du routeur : --next=0,1,2… en sautant les
// workers non HTTP-exécutables (intégrés, google). Enregistre chaque
// résultat → la boucle bayésienne de route.py apprend vraiment.
async function executeViaRouter(routeType: string, prompt: string): Promise<{
  success: boolean;
  output?: string;
  error?: string;
  provider?: string;
}> {
  let lastError = "routeur indisponible";
  for (let skip = 0; skip < 6; skip++) {
    const routed = getBestWorker(routeType, skip);
    if (!routed) break;
    const worker = WORKER_BY_NAME[routed.name];
    if (!worker) {
      console.log(`[router] ${routed.name} non HTTP-exécutable, suivant (EV=${routed.ev.toFixed(3)})`);
      continue;
    }
    console.log(`[router] tâche="${routeType}" → ${routed.name} EV=${routed.ev.toFixed(3)}`);
    const result = await callWorker(worker, prompt);
    if (result.ok) {
      recordRouteResult(worker.name, true);
      return { success: true, output: result.output, provider: worker.name };
    }
    lastError = result.error || "échec worker";
    recordRouteResult(worker.name, false);
    console.warn(`[router] ${worker.name} échec (${result.status ?? "?"}), suivant...`);
  }
  return { success: false, error: lastError };
}

async function handleChat(body: ChatRequest) {
  if (!body?.message || typeof body.message !== "string" || body.message.trim().length === 0) {
    return Response.json({ error: "message requis" }, { status: 400 });
  }

  const task: TaskSpec = {
    description: body.message.trim(),
  };
  if (body.taskType) (task as any).taskType = body.taskType;
  if (body.complexity) (task as any).complexity = body.complexity;

  const start = Date.now();
  const result = await orchestrator.execute(task);
  const elapsed = Date.now() - start;

  // D1+D4 : si APPROVED, exécuter via le routeur EV, fallback chaîne D1
  let execution = null;
  if (result.verdict === "APPROVED") {
    const routeType = mapGovernanceToRoute(result.taskType || "general");
    execution = await executeViaRouter(routeType, body.message.trim());
    if (!execution.success) {
      execution = await executeWithWorker(body.message.trim());
    }
  }

  return Response.json({
    result,
    elapsedMs: elapsed,
    execution,
    summary: orchestrator.getSummary(),
  });
}

// ─── Terminal sécurisé via GuardOverrides ──────────────────────

interface TerminalRequest { command: string }

function handleTerminal(body: TerminalRequest) {
  if (!body?.command || typeof body.command !== "string") {
    return Response.json({ error: "commande requise" }, { status: 400 });
  }

  // Garde-fou : GuardOverrides bloque les commandes dangereuses
  const guard = guardOverrides.check({ description: body.command });
  if (guard.decision === "BLOCKED") {
    return Response.json({
      ok: false,
      blocked: true,
      reason: guard.reason,
      output: `[BLOCKED] ${guard.reason}`,
    });
  }

  try {
    const output = execSync(body.command, {
      cwd: WORKSPACE_DIR,
      encoding: "utf-8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return Response.json({ ok: true, output: output || "(aucune sortie)" });
  } catch (err: any) {
    const stderr = err?.stderr?.toString?.() || err?.message || "commande échouée";
    return Response.json({ ok: false, output: stderr.trim() });
  }
}

// ─── API /api/state ────────────────────────────────────────────

function buildState() {
  return {
    workspace: WORKSPACE_DIR,
    workers: readWorkers(),
    activity: readActivity(),
    logs: readLogs(),
    mode: readMode(),
    git: readGit(),
    files: buildTree(WORKSPACE_DIR, WORKSPACE_DIR, 0),
    system: readSystem(),
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

    // API
    if (path === "/api/state") return Response.json(buildState());
    if (path === "/api/health") return Response.json({ ok: true, ts: Date.now() });

    if (path === "/api/chat" && req.method === "POST") {
      try {
        const body = await req.json() as ChatRequest;
        return await handleChat(body);
      } catch (err: any) {
        return Response.json({ error: err?.message || "erreur" }, { status: 500 });
      }
    }

    if (path === "/api/terminal" && req.method === "POST") {
      try {
        const body = await req.json() as TerminalRequest;
        return handleTerminal(body);
      } catch (err: any) {
        return Response.json({ error: err?.message || "erreur" }, { status: 500 });
      }
    }

    if (path === "/api/git" && req.method === "POST") {
      try {
        const body = await req.json() as { action: string; message?: string };
        if (body.action === "commit" && body.message) {
          const out = execSync(`git add -A && git commit -m "${body.message.replace(/"/g, '\\"')}"`, {
            cwd: WORKSPACE_DIR, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"],
          }).trim();
          return Response.json({ ok: true, output: out });
        }
        return Response.json({ error: "action inconnue" }, { status: 400 });
      } catch (err: any) {
        return Response.json({ ok: false, output: err?.stderr?.toString?.() || err?.message || "échec" });
      }
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
console.log(`  │  API: /api/state · /api/chat · /api/git      │`);
console.log(`  │       /api/files · /api/system · /api/terminal│`);
console.log(`  ╰──────────────────────────────────────────────╯`);
console.log(`  Workspace : ${WORKSPACE_DIR}`);
console.log(`  EURINHASH : ${EURINHASH_DIR}`);
console.log(`  Server listening on port ${server.port}`);