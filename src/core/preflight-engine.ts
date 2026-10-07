import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import * as path from "node:path";

export type PreflightStatus = "READY" | "BLOCKED";

export interface WorkingTreeSnapshot {
  clean: boolean;
  dirtyFiles: string[];
  untrackedFiles: string[];
  conflictedFiles: string[];
}

export interface PreflightRequest {
  repository: string;
  branch: string;
  targetPaths: string[];
  operation: "CREATE" | "UPDATE" | "DELETE";
  cwd?: string;
  expectedRemote?: string;
}

export interface PreflightResult {
  status: PreflightStatus;
  repository: string;
  branch: string;
  head: string;
  workingTree: WorkingTreeSnapshot;
  scopeValid: boolean;
  repositoryIdentityValid: boolean;
  reason: string;
}

export interface PreflightProvider {
  currentBranch(cwd: string): string;
  head(cwd: string): string;
  status(cwd: string): WorkingTreeSnapshot;
  remoteUrl?(cwd: string): string;
}

function runGit(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function normalizeRemote(value: string): string {
  return value
    .trim()
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/^ssh:\/\/git@github\.com\//, "https://github.com/")
    .replace(/\.git$/, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

function normalizeTarget(target: string): string | undefined {
  const normalized = path.posix.normalize(target.replaceAll("\\", "/"));
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized.startsWith("/")) {
    return undefined;
  }
  return normalized;
}

function isPathWithinTarget(target: string, allowed: string): boolean {
  const normalizedTarget = normalizeTarget(target);
  const normalizedAllowed = normalizeTarget(allowed);
  if (!normalizedTarget || !normalizedAllowed) return false;
  return (
    normalizedTarget === normalizedAllowed ||
    normalizedTarget.startsWith(normalizedAllowed.endsWith("/") ? normalizedAllowed : normalizedAllowed + "/")
  );
}

export class GitPreflightProvider implements PreflightProvider {
  currentBranch(cwd: string): string {
    return runGit(cwd, ["branch", "--show-current"]);
  }

  head(cwd: string): string {
    return runGit(cwd, ["rev-parse", "HEAD"]);
  }

  status(cwd: string): WorkingTreeSnapshot {
    const porcelain = runGit(cwd, ["status", "--porcelain=v1"]);
    const dirtyFiles: string[] = [];
    const untrackedFiles: string[] = [];
    const conflictedFiles: string[] = [];

    for (const line of porcelain.split("\n").filter(Boolean)) {
      const code = line.slice(0, 2);
      const file = line.slice(3);
      if (code === "??") {
        untrackedFiles.push(file);
      } else {
        dirtyFiles.push(file);
      }
      if (code.includes("U") || code === "AA" || code === "DD") {
        conflictedFiles.push(file);
      }
    }

    return {
      clean: porcelain.length === 0,
      dirtyFiles,
      untrackedFiles,
      conflictedFiles,
    };
  }

  remoteUrl(cwd: string): string {
    return runGit(cwd, ["remote", "get-url", "origin"]);
  }
}

export class PreflightEngine {
  constructor(private readonly provider: PreflightProvider = new GitPreflightProvider()) {}

  run(request: PreflightRequest): PreflightResult {
    const cwd = request.cwd ?? process.cwd();
    if (!existsSync(cwd)) {
      return this.block(request, "", false, "Preflight working directory does not exist");
    }

    try {
      const actualBranch = this.provider.currentBranch(cwd);
      const head = this.provider.head(cwd);
      const workingTree = this.provider.status(cwd);

      if (request.expectedRemote && !this.provider.remoteUrl) {
        return this.block(request, head, false, "Repository identity unavailable: remote URL cannot be inspected");
      }

      if (request.expectedRemote && this.provider.remoteUrl) {
        const actualRemote = normalizeRemote(this.provider.remoteUrl(cwd));
        const expectedRemote = normalizeRemote(request.expectedRemote);
        if (!actualRemote || actualRemote !== expectedRemote) {
          return this.block(
            request,
            head,
            false,
            `Repository identity mismatch: expected ${request.expectedRemote}, got ${actualRemote || "UNKNOWN"}`,
          );
        }
      }

      if (!actualBranch || actualBranch !== request.branch) {
        return this.block(
          request,
          head,
          false,
          `Branch mismatch: expected ${request.branch}, got ${actualBranch || "DETACHED"}`,
        );
      }

      if (workingTree.conflictedFiles.length > 0) {
        return this.block(
          request,
          head,
          false,
          `Conflicted working tree: ${workingTree.conflictedFiles.join(", ")}`,
        );
      }

      if (!workingTree.clean) {
        return this.block(
          request,
          head,
          false,
          "Working tree is dirty; execution requires an explicit clean workspace",
        );
      }

      const invalidTargets = request.targetPaths.filter((target) => !normalizeTarget(target));
      if (invalidTargets.length > 0) {
        return this.block(
          request,
          head,
          false,
          `Invalid target path(s): ${invalidTargets.join(", ")}`,
        );
      }

      if (request.targetPaths.length === 0) {
        return this.block(request, head, false, "No target paths supplied");
      }

      return {
        status: "READY",
        repository: request.repository,
        branch: actualBranch,
        head,
        workingTree,
        scopeValid: true,
        repositoryIdentityValid: true,
        reason: "Preflight passed",
      };
    } catch (error) {
      return this.block(
        request,
        "",
        false,
        `Preflight failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  static pathWithinScope(targetPath: string, allowedPath: string): boolean {
    return isPathWithinTarget(targetPath, allowedPath);
  }

  private block(
    request: PreflightRequest,
    head: string,
    repositoryIdentityValid: boolean,
    reason: string,
  ): PreflightResult {
    return {
      status: "BLOCKED",
      repository: request.repository,
      branch: request.branch,
      head,
      workingTree: {
        clean: false,
        dirtyFiles: [],
        untrackedFiles: [],
        conflictedFiles: [],
      },
      scopeValid: false,
      repositoryIdentityValid,
      reason,
    };
  }
}
