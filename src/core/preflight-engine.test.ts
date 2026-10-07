import { describe, expect, it, vi } from "vitest";
import { PreflightEngine, type PreflightProvider } from "./preflight-engine";

const base = {
  repository: "config",
  branch: "refactor/slim-integration",
  targetPaths: ["src/example.ts"],
  operation: "UPDATE" as const,
  expectedRemote: "https://github.com/digitaleflex/opencode-config",
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
    remoteUrl: vi.fn(() => base.expectedRemote),
    ...overrides,
  };
}

describe("PreflightEngine", () => {
  it("passes with matching branch, clean tree and repository identity", () => {
    const result = new PreflightEngine(provider()).run({ ...base, cwd: process.cwd() });
    expect(result.status).toBe("READY");
    expect(result.head).toBe("abc123");
    expect(result.repositoryIdentityValid).toBe(true);
    expect(result.scopeValid).toBe(true);
  });

  it("blocks repository identity mismatch", () => {
    const result = new PreflightEngine(
      provider({ remoteUrl: vi.fn(() => "https://github.com/other/repo") }),
    ).run({ ...base, cwd: process.cwd() });
    expect(result.status).toBe("BLOCKED");
    expect(result.repositoryIdentityValid).toBe(false);
    expect(result.reason).toContain("Repository identity mismatch");
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

  it("blocks traversal and absolute target paths", () => {
    for (const targetPath of ["../outside.ts", "/tmp/outside.ts", "src/../../outside.ts"]) {
      const result = new PreflightEngine(provider()).run({
        ...base,
        targetPaths: [targetPath],
        cwd: process.cwd(),
      });
      expect(result.status).toBe("BLOCKED");
      expect(result.scopeValid).toBe(false);
      expect(result.reason).toContain("Invalid target path");
    }
  });

  it("checks path containment deterministically", () => {
    expect(PreflightEngine.pathWithinScope("src/core/router.ts", "src/**")).toBe(false);
    expect(PreflightEngine.pathWithinScope("src/core/router.ts", "src/core")).toBe(true);
    expect(PreflightEngine.pathWithinScope("src/core/router.ts", "src")).toBe(true);
    expect(PreflightEngine.pathWithinScope("srcx/router.ts", "src")).toBe(false);
  });
});
