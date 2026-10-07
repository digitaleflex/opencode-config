import * as fs from "node:fs";
import * as path from "node:path";

export interface LocalSkill {
  name: string;
  path: string;
}

function parseSkillName(content: string): string | undefined {
  const normalized = content.replace(/^\uFEFF/, "");
  const match = normalized.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return undefined;
  const line = match[1].split("\n").find((entry) => /^name\s*:/i.test(entry));
  if (!line) return undefined;
  const value = line.replace(/^name\s*:\s*/i, "").trim();
  return value.replace(/^["']|["']$/g, "") || undefined;
}

function discoverAt(projectDirectory: string): LocalSkill[] {
  const root = path.join(projectDirectory, ".opencode", "skills");
  try {
    const canonicalProject = fs.realpathSync(projectDirectory);
    const canonicalRoot = fs.realpathSync(root);
    if (canonicalRoot !== path.join(canonicalProject, ".opencode", "skills")) return [];
  } catch {
    return [];
  }

  const found: LocalSkill[] = [];
  const visit = (directory: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile() && entry.name === "SKILL.md") {
        try {
          const name = parseSkillName(fs.readFileSync(entryPath, "utf8"));
          if (name) found.push({ name, path: entryPath });
        } catch {
          // Discovery is intentionally non-fatal.
        }
      }
    }
  };
  visit(canonicalRoot(root));
  return found;
}

function canonicalRoot(root: string): string {
  return root;
}

/**
 * Discover project-local skills from the current project and its ancestors.
 * Sibling directories and symlinked external skill trees are excluded.
 */
export function discoverProjectLocalSkills(projectDirectory: string): LocalSkill[] {
  const result = new Map<string, LocalSkill>();
  let current = path.resolve(projectDirectory);

  while (true) {
    for (const skill of discoverAt(current)) {
      if (!result.has(skill.name)) result.set(skill.name, skill);
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function discoverProjectLocalSkillNames(projectDirectory: string): string[] {
  return discoverProjectLocalSkills(projectDirectory).map((skill) => skill.name);
}
