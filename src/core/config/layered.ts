/**
 * EURINHASH layered configuration.
 *
 * Adapted from configuration patterns used by oh-my-opencode-slim:
 * layered configuration, deterministic precedence and agent overrides.
 */

export type ConfigLayer<T extends Record<string, unknown>> = {
  name: string;
  value: Partial<T>;
};

export type LayeredConfigResult<T extends Record<string, unknown>> = {
  value: T;
  sources: Record<string, string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeValue(base: unknown, override: unknown): unknown {
  if (!isRecord(base) || !isRecord(override)) return override;

  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = key in result ? mergeValue(result[key], value) : value;
  }
  return result;
}

export function resolveLayers<T extends Record<string, unknown>>(
  layers: readonly ConfigLayer<T>[],
): LayeredConfigResult<T> {
  let value: Record<string, unknown> = {};
  const sources: Record<string, string> = {};

  for (const layer of layers) {
    value = mergeValue(value, layer.value) as Record<string, unknown>;

    const mark = (object: Record<string, unknown>, prefix = "") => {
      for (const key of Object.keys(object)) {
        const path = prefix ? prefix + "." + key : key;
        sources[path] = layer.name;
        if (isRecord(object[key])) mark(object[key], path);
      }
    };

    mark(layer.value);
  }

  return { value: value as T, sources };
}

export type AgentOverride = Record<string, unknown>;

export function resolveAgentOverride(
  agents: Record<string, AgentOverride> | undefined,
  name: string,
  aliases: Readonly<Record<string, string>> = {},
): AgentOverride | undefined {
  if (!agents) return undefined;

  const canonical = agents[name];
  const alias = Object.entries(aliases).find(([, canonicalName]) => canonicalName === name)?.[0];
  const legacy = alias ? agents[alias] : undefined;

  if (!canonical) return legacy;
  if (!legacy) return canonical;

  return mergeValue(legacy, canonical) as AgentOverride;
}
