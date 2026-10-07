/**
 * Named preset resolution for EURINHASH.
 *
 * Presets are configuration layers, not a second routing engine.
 * They may inherit another preset; the active root agent configuration
 * remains the highest-precedence layer.
 */

import { resolveAgentOverride, type AgentOverride } from "./layered";

export interface PresetDefinition {
  agents: Record<string, AgentOverride>;
  extends?: string;
}

export type PresetInput = PresetDefinition | Record<string, AgentOverride | string>;

export interface PresetLayer {
  source: "user" | "project";
  presets: Record<string, PresetDefinition>;
}

export class PresetResolutionError extends Error {
  readonly kind: "missing" | "cycle";
  readonly chain: readonly string[];

  constructor(kind: "missing" | "cycle", chain: readonly string[]) {
    const message =
      kind === "missing"
        ? `Preset "${chain.at(-2) ?? chain[0]}" extends missing preset "${chain.at(-1)}" (chain: ${chain.join(" -> ")})`
        : `Preset inheritance cycle detected: ${chain.join(" -> ")}`;
    super(message);
    this.name = "PresetResolutionError";
    this.kind = kind;
    this.chain = chain;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeAgents(
  base: Record<string, AgentOverride>,
  override: Record<string, AgentOverride>,
): Record<string, AgentOverride> {
  const result: Record<string, AgentOverride> = { ...base };

  for (const [name, overrideValue] of Object.entries(override)) {
    const baseValue = resolveAgentOverride(base, name);
    result[name] = baseValue
      ? { ...baseValue, ...overrideValue }
      : { ...overrideValue };
  }

  return result;
}

/**
 * Accept both the canonical { agents: {...}, extends? } form and the compact
 * flat form used by early configurations.
 */
export function normalizePreset(input: PresetInput): PresetDefinition {
  if (
    isRecord(input) &&
    "agents" in input &&
    isRecord(input.agents)
  ) {
    const { agents, extends: parent } = input;
    return {
      agents: agents as Record<string, AgentOverride>,
      ...(typeof parent === "string" ? { extends: parent } : {}),
    };
  }

  const record = input as Record<string, unknown>;
  const agents: Record<string, AgentOverride> = {};

  for (const [name, value] of Object.entries(record)) {
    if (name === "extends" && typeof value === "string") continue;
    if (isRecord(value)) agents[name] = value;
  }

  return {
    agents,
    ...(typeof record.extends === "string"
      ? { extends: record.extends }
      : {}),
  };
}

export function resolvePreset(
  name: string,
  presets: Record<string, PresetInput>,
): PresetDefinition {
  const cache = new Map<string, PresetDefinition>();
  const visiting = new Set<string>();
  const stack: string[] = [];

  const visit = (current: string): PresetDefinition => {
    const cached = cache.get(current);
    if (cached) return cached;

    const input = presets[current];
    if (!input) {
      throw new PresetResolutionError("missing", [...stack, current]);
    }

    if (visiting.has(current)) {
      const start = stack.indexOf(current);
      throw new PresetResolutionError("cycle", [
        ...stack.slice(start),
        current,
      ]);
    }

    visiting.add(current);
    stack.push(current);

    const normalized = normalizePreset(input);
    const parent = normalized.extends
      ? visit(normalized.extends)
      : { agents: {} };

    const resolved: PresetDefinition = {
      agents: mergeAgents(parent.agents, normalized.agents),
      ...(normalized.extends ? { extends: normalized.extends } : {}),
    };

    stack.pop();
    visiting.delete(current);
    cache.set(current, resolved);
    return resolved;
  };

  return visit(name);
}

export function mergePresetMaps(
  base?: Record<string, PresetInput>,
  override?: Record<string, PresetInput>,
): Record<string, PresetInput> | undefined {
  if (!base && !override) return undefined;
  if (!base) return override;
  if (!override) return base;

  const result: Record<string, PresetInput> = { ...base };

  for (const [name, input] of Object.entries(override)) {
    if (!base[name]) {
      result[name] = input;
      continue;
    }

    const left = normalizePreset(base[name]);
    const right = normalizePreset(input);
    result[name] = {
      agents: mergeAgents(left.agents, right.agents),
      ...(right.extends ?? left.extends
        ? { extends: right.extends ?? left.extends }
        : {}),
    };
  }

  return result;
}

export interface PresetSelection {
  name?: string;
  definition?: PresetDefinition;
  source?: "user" | "project";
}

export function resolveActivePreset(
  name: string | undefined,
  layers: readonly PresetLayer[],
): PresetSelection {
  if (!name) return {};

  const merged: Record<string, PresetInput> = {};
  let source: PresetSelection["source"];

  for (const layer of layers) {
    if (!layer.presets) continue;
    Object.assign(merged, layer.presets);
    if (Object.hasOwn(layer.presets, name)) source = layer.source;
  }

  if (!Object.hasOwn(merged, name)) {
    throw new PresetResolutionError("missing", [name]);
  }

  return {
    name,
    definition: resolvePreset(name, merged),
    source,
  };
}
