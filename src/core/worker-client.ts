// src/core/worker-client.ts — Free Worker HTTP Client (D1-core)
//
// Exécution réelle des tâches APPROVED via les providers gratuits
// (même endpoints/clés que scripts/free-probe.py : groq, zhipu,
// openrouter, novita). Seuls les endpoints OpenAI-compatibles sont
// couverts (google/gemini et les workers intégrés ont une autre forme
// d'API — voir dashboard/server.ts pour le routage EV complet).
//
// Design : aucune surprise réseau par défaut. L'orchestrateur n'exécute
// que si on lui injecte un WorkerExecutor (le dashboard passe le client
// réel ; les tests passent un stub ou rien). Facturation/latence réseau
// ne doivent jamais être un effet de bord implicite d'une librairie.

import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync } from "node:fs";

export interface WorkerCall {
  name: string;
  url: string;
  keyFile: string;
  model: string;
}

export interface WorkerExecution {
  success: boolean;
  output?: string;
  error?: string;
  provider?: string;
  status?: number;
}

/** Exécuteur injectable dans GovernanceOrchestrator. */
export type WorkerExecutor = (prompt: string) => Promise<WorkerExecution>;

export const WORKER_CALLS: WorkerCall[] = [
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

export function workerKeysDir(): string {
  return join(homedir(), ".config", "opencode");
}

export function readWorkerKey(keyFile: string): string {
  try {
    return readFileSync(join(workerKeysDir(), keyFile), "utf-8").trim();
  } catch {
    return "";
  }
}

const SYSTEM_PROMPT =
  "Tu es EURINHASH, un agent d'ingénierie. Réponds de façon concise et technique.";

type FetchImpl = typeof fetch;

export async function callWorker(
  worker: WorkerCall,
  prompt: string,
  timeoutMs = 30000,
  fetchImpl: FetchImpl = fetch
): Promise<{ ok: boolean; output?: string; error?: string; status?: number }> {
  const key = readWorkerKey(worker.keyFile);
  if (!key) return { ok: false, error: `clé ${worker.keyFile} absente` };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(worker.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: worker.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
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
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const output = data.choices?.[0]?.message?.content?.trim() || "(réponse vide)";
    return { ok: true, output };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erreur";
    return { ok: false, error: err instanceof Error && err.name === "AbortError" ? "timeout" : msg };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Chaîne avec bascule : essaie chaque worker dans l'ordre, passe au
 * suivant sur tout échec (429 comme autre). Retourne le premier succès
 * ou la dernière erreur. `call` injectable => tests 100% hors-ligne.
 */
export async function executeWithWorkers(
  prompt: string,
  opts?: { workers?: WorkerCall[]; call?: typeof callWorker; timeoutMs?: number }
): Promise<WorkerExecution> {
  const workers = opts?.workers ?? WORKER_CALLS;
  const call = opts?.call ?? ((w: WorkerCall, p: string) => callWorker(w, p, opts?.timeoutMs ?? 30000));
  let lastError = "aucun worker configuré";
  let lastProvider: string | undefined;
  for (const worker of workers) {
    const result = await call(worker, prompt);
    if (result.ok) {
      return { success: true, output: result.output, provider: worker.name };
    }
    lastError = result.error || "échec worker";
    lastProvider = worker.name;
  }
  return { success: false, error: lastError, provider: lastProvider };
}

/** Exécuteur réel par défaut, à injecter explicitement (voir entête). */
export function defaultWorkerExecutor(timeoutMs = 30000): WorkerExecutor {
  return (prompt: string) => executeWithWorkers(prompt, { timeoutMs });
}
