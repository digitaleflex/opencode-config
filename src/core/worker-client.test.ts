import { describe, test, expect } from "vitest";
import {
  executeWithWorkers,
  callWorker,
  WORKER_CALLS,
  type WorkerCall,
} from "./worker-client";

const W1: WorkerCall = { name: "w1", url: "https://x.test/1", keyFile: ".groq-key", model: "m1" };
const W2: WorkerCall = { name: "w2", url: "https://x.test/2", keyFile: ".groq-key", model: "m2" };

// fetch factice : jamais de réseau dans ces tests
function fakeFetch(handler: (url: string) => { status: number; body: unknown }) {
  return (async (url: unknown) => {
    const r = handler(String(url));
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      text: async () => JSON.stringify(r.body),
      json: async () => r.body,
    };
  }) as unknown as typeof fetch;
}

describe("worker-client", () => {
  test("WORKER_CALLS ne contient que des endpoints OpenAI-compatibles connus", () => {
    expect(WORKER_CALLS.length).toBeGreaterThanOrEqual(4);
    for (const w of WORKER_CALLS) {
      expect(w.url).toContain("/chat/completions");
      expect(w.keyFile).toMatch(/^\.(groq|zhipu|openrouter|novita)-key$/);
    }
  });

  test("succès au premier worker, ordre respecté", async () => {
    const seen: string[] = [];
    const r = await executeWithWorkers("hello", {
      workers: [W1, W2],
      call: async (w) => {
        seen.push(w.name);
        return { ok: true, output: `out-${w.name}` };
      },
    });
    expect(r).toEqual({ success: true, output: "out-w1", provider: "w1" });
    expect(seen).toEqual(["w1"]);
  });

  test("bascule sur 429 puis succès", async () => {
    const seen: string[] = [];
    const r = await executeWithWorkers("hello", {
      workers: [W1, W2],
      call: async (w) => {
        seen.push(w.name);
        return w.name === "w1"
          ? { ok: false, error: "HTTP 429", status: 429 }
          : { ok: true, output: "out-w2" };
      },
    });
    expect(r.success).toBe(true);
    expect(r.provider).toBe("w2");
    expect(seen).toEqual(["w1", "w2"]);
  });

  test("échec total → dernière erreur, provider renseigné", async () => {
    const r = await executeWithWorkers("hello", {
      workers: [W1, W2],
      call: async (w) => ({ ok: false, error: `boom-${w.name}`, status: 500 }),
    });
    expect(r.success).toBe(false);
    expect(r.error).toBe("boom-w2");
    expect(r.provider).toBe("w2");
  });

  test("aucun worker → erreur explicite", async () => {
    const r = await executeWithWorkers("hello", { workers: [] });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/aucun worker/);
  });

  test("callWorker sans clé → erreur sans réseau", async () => {
    let called = false;
    const r = await callWorker(
      { ...W1, keyFile: ".missing-key-xyz" },
      "hi",
      1000,
      fakeFetch(() => {
        called = true;
        return { status: 200, body: {} };
      })
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/absente/);
    expect(called).toBe(false);
  });
});
