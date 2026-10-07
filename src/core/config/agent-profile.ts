import { resolveAgentOverride, type AgentOverride } from "./layered";

export interface AgentProfile extends AgentOverride {
  name: string;
  model?: string | string[];
  skills?: string[];
  mcps?: string[];
  permission?: unknown;
}

export interface AgentProfileSource {
  agent: string;
  source: "project" | "user" | "preset" | "default";
}

/**
 * Resolve an effective agent profile from layered agent maps.
 * The function is intentionally provider-agnostic: model selection belongs
 * to the EURINHASH Router, not the profile resolver.
 */
export function resolveAgentProfile(
  name: string,
  layers: ReadonlyArray<{
    source: AgentProfileSource["source"];
    agents?: Record<string, AgentOverride>;
  }>,
  aliases: Readonly<Record<string, string>> = {},
): { profile: AgentProfile; sources: AgentProfileSource[] } {
  let profile: AgentProfile = { name };
  const sources: AgentProfileSource[] = [];

  for (const layer of layers) {
    const override = resolveAgentOverride(layer.agents, name, aliases);
    if (!override) continue;

    profile = {
      ...profile,
      ...override,
      name,
    };
    sources.push({ agent: name, source: layer.source });
  }

  return { profile, sources };
}
