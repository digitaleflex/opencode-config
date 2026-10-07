import { describe, expect, it, vi } from "vitest";
import { PreflightEngine, type PreflightProvider } from "./preflight-engine";

const base = {
  repository: "config",
  branch: "refactor/slim-integration",
  targetPaths: ["src/example.ts"],
  operation: "UPDATE" as const,
};

function provider(overrides: Partial<PreflightProvider> = {}): PreflightProvider {
  return {
    currentBranch: vi.fn(() => base.branch),
    head: vi.fn(() => "abc123"),
    status: vi.fn(() => ({
      clean: true,
      dirtyFiles: [],
      untrackedFiles: [],
      conflictedFiles: [],
    })),
    ...overrides,
  };
}

describe("PreflightEngine", () => {
  it("passes with matching branch and clean tree", () => {
    const result = new PreflightEngine(provider()).run({ ...base, cwd: process.cwd() });
    expect(result.status).toBe("READY");
    expect(result.head).toBe("abc123");
  });

  it("blocks branch mismatch", () => {
    const result = new PreflightEngine(
      provider({ currentBranch: vi.fn(() => "master") }),
    ).run({ ...base, cwd: process.cwd() });
    expect(result.status).toBe("BLOCKED");
    expect(result.reason).toContain("Branch mismatch");
  });

  it("blocks dirty trees instead of silently resetting them", () => {
    const result = new PreflightEngine(
      provider({
        status: vi.fn(() => ({
          clean: false,
          dirtyFiles: ["src/a.ts"],
          untrackedFiles: ["tmp.txt"],
          conflictedFiles: [],
        })),
      }),
    ).run({ ...base, cwd: process.cwd() });
    expect(result.status).toBe("BLOCKED");
    expect(result.workingTree.dirtyFiles).toEqual(["src/a.ts"]);
  });

  it("blocks conflicts", () => {
    const result = new PreflightEngine(
      provider({
        status: vi.fn(() => ({
          clean: false,
          dirtyFiles: ["src/a.ts"],
          untrackedFiles: [],
          conflictedFiles: ["src/a.ts"],
        })),
      }),
    ).run({ ...base, cwd: process.cwd() });
    expect(result.status).toBe("BLOCKED");
    expect(result.reason).toContain("Conflicted");
  });
});
