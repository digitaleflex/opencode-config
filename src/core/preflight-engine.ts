import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

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
}

export interface PreflightResult {
  status: PreflightStatus;
  repository: string;
  branch: string;
  head: string;
  workingTree: WorkingTreeSnapshot;
  scopeValid: boolean;
  reason: string;
}

export interface PreflightProvider {
  currentBranch(cwd: string): string;
  head(cwd: string): string;
  status(cwd: string): WorkingTreeSnapshot;
}

function runGit(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
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
}

export class PreflightEngine {
  constructor(private readonly provider: PreflightProvider = new GitPreflightProvider()) {}

  run(request: PreflightRequest): PreflightResult {
    const cwd = request.cwd ?? process.cwd();
    if (!existsSync(cwd)) {
      return this.block(request, "", "Preflight working directory does not exist");
    }

    try {
      const actualBranch = this.provider.currentBranch(cwd);
      const head = this.provider.head(cwd);
      const workingTree = this.provider.status(cwd);

      if (!actualBranch || actualBranch !== request.branch) {
        return {
          status: "BLOCKED",
          repository: request.repository,
          branch: actualBranch,
          head,
          workingTree,
          scopeValid: false,
          reason: `Branch mismatch: expected ${request.branch}, got ${actualBranch || "DETACHED"}`,
        };
      }

      if (workingTree.conflictedFiles.length > 0) {
        return {
          status: "BLOCKED",
          repository: request.repository,
          branch: actualBranch,
          head,
          workingTree,
          scopeValid: false,
          reason: `Conflicted working tree: ${workingTree.conflictedFiles.join(", ")}`,
        };
      }

      if (!workingTree.clean && request.operation !== "CREATE") {
        return {
          status: "BLOCKED",
          repository: request.repository,
          branch: actualBranch,
          head,
          workingTree,
          scopeValid: false,
          reason: "Working tree is dirty; execution requires an explicit clean workspace",
        };
      }

      return {
        status: "READY",
        repository: request.repository,
        branch: actualBranch,
        head,
        workingTree,
        scopeValid: request.targetPaths.length > 0,
        reason: request.targetPaths.length > 0 ? "Preflight passed" : "No target paths supplied",
      };
    } catch (error) {
      return this.block(
        request,
        "",
        `Preflight failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private block(request: PreflightRequest, head: string, reason: string): PreflightResult {
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
      reason,
    };
  }
}
