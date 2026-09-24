import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProofStore, sanitizeTaskId, saveProofChain, loadProofChain } from "./proof-store";
import type { ProofChain } from "./types";

function fakeChain(taskId: string): ProofChain {
  return { taskId, proofs: [], verdict: "PASS", rootHash: "abc123" };
}

describe("ProofStore", () => {
  let dir: string;
  let store: ProofStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "proofs-test-"));
    store = new ProofStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("roundtrip save/load", async () => {
    const chain = fakeChain("task-123-abc");
    const file = await store.save(chain);
    expect(file).toContain("task-123-abc");
    expect(file.endsWith("_chain.json")).toBe(true);
    const loaded = await store.load("task-123-abc");
    expect(loaded).toEqual(chain);
  });

  test("traversal taskId reste dans dir", async () => {
    const evil = "../../evil-escape";
    const file = await store.save(fakeChain(evil));
    expect(file.startsWith(dir)).toBe(true);
    expect(file).not.toContain("..");
    // Chargement via le même id malicieux retrouve la chaîne
    const loaded = await store.load(evil);
    expect(loaded?.taskId).toBe(evil);
  });

  test("load id inexistant → null", async () => {
    expect(await store.load("nope-missing")).toBeNull();
  });

  test("save sans taskId → throw", async () => {
    await expect(store.save({ taskId: "", proofs: [], verdict: "FAIL", rootHash: "x" })).rejects.toThrow();
  });

  test("sanitizeTaskId: sûr passe, hostile hashé stable", () => {
    expect(sanitizeTaskId("task-1790183429844-2tvi5ga")).toBe("task-1790183429844-2tvi5ga");
    const h1 = sanitizeTaskId("../../x");
    const h2 = sanitizeTaskId("../../x");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^task-[0-9a-f]{32}$/);
  });

  test("helpers défaut honorent EURINHASH_PROOFS_DIR", async () => {
    const override = await mkdtemp(join(tmpdir(), "proofs-env-"));
    const prev = process.env.EURINHASH_PROOFS_DIR;
    process.env.EURINHASH_PROOFS_DIR = override;
    try {
      const file = await saveProofChain(fakeChain("task-env-1"));
      expect(file.startsWith(override)).toBe(true);
      expect(await loadProofChain("task-env-1")).toEqual(fakeChain("task-env-1"));
    } finally {
      if (prev === undefined) delete process.env.EURINHASH_PROOFS_DIR;
      else process.env.EURINHASH_PROOFS_DIR = prev;
      await rm(override, { recursive: true, force: true });
    }
  });
});
