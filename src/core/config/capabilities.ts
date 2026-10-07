/**
 * Effective per-agent capabilities.
 *
 * Skills are declarative capabilities; MCPs are explicit tool-server grants.
 * This module only resolves configuration. Authorization remains in the
 * governance/decision layer.
 */

export interface SkillDirectives {
  skills?: string[];
  skills_add?: string[];
  skills_remove?: string[];
  skills_include_local?: boolean;
}

export interface AgentCapabilities extends SkillDirectives {
  mcps?: string[];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

export function resolveSkills(
  directives: SkillDirectives | undefined,
  availableLocalSkills: readonly string[] = [],
): string[] {
  if (!directives) return [];
  const base = unique(directives.skills ?? []);
  const additions = unique(directives.skills_add ?? []);
  const local = directives.skills_include_local ? unique(availableLocalSkills) : [];
  const effective = unique([...base, ...additions, ...local]);
  const removed = new Set(unique(directives.skills_remove ?? []));
  return effective.filter((skill) => !removed.has(skill));
}

/** Resolve MCP grants with explicit exclusions. */
export function resolveMcps(
  configured: readonly string[] | undefined,
  knownMcps: readonly string[] = [],
): string[] {
  if (!configured) return [];
  const known = unique(knownMcps);
  const includeAll = configured.includes("*");
  const excluded = new Set(configured.filter((name) => name.startsWith("!")).map((name) => name.slice(1)));
  const selected = includeAll ? known : configured.filter((name) => !name.startsWith("!"));
  return unique(selected).filter((name) => !excluded.has(name));
}

export function isSkillAllowed(skill: string, effectiveSkills: readonly string[]): boolean {
  return effectiveSkills.includes("*") || effectiveSkills.includes(skill);
}

export function isMcpAllowed(mcp: string, effectiveMcps: readonly string[]): boolean {
  return effectiveMcps.includes("*") || effectiveMcps.includes(mcp);
}