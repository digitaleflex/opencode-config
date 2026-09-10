// src/core/state-store.ts — Atomic JSON State Store
// Persists baselines/counters so detection survives restarts.
// Uses atomic write (tmp + rename) and fails open/silent as spec requires.

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";

export class StateStore {
  private dir: string;

  constructor(dir?: string) {
    this.dir = dir || join(process.cwd(), "logs/state");
  }

  /**
   * Load JSON state by name. Returns parsed JSON or null if missing/corrupt.
   * Fail-open: never throws.
   */
  load<T>(name: string): T | null {
    const file = join(this.dir, `${name}.json`);
    try {
      if (!existsSync(file)) return null;
      const raw = readFileSync(file, "utf8");
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /**
   * Save JSON state atomically: mkdir -p dir, write to tmp file then rename.
   * Fail-silent: never throws.
   */
  save(name: string, data: unknown): void {
    try {
      if (!existsSync(this.dir)) {
        mkdirSync(this.dir, { recursive: true });
      }
      const file = join(this.dir, `${name}.json`);
      const tmp = `${file}.tmp`;
      const payload = JSON.stringify(data, null, 2);
      writeFileSync(tmp, payload, "utf8");
      renameSync(tmp, file);
    } catch {
      // fail-silent per spec
    }
  }

  /** Expose directory for testing/debugging */
  getDir(): string {
    return this.dir;
  }
}
