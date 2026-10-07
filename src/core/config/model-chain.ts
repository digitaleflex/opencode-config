/**
 * Ordered model-chain helpers.
 *
 * Configuration may provide one model or an ordered chain. Runtime routing,
 * health and policy remain responsible for deciding whether a candidate is
 * actually eligible.
 */

export interface ModelCandidate {
  id: string;
  variant?: string;
}

export type ModelPreference = string | ModelCandidate | Array<string | ModelCandidate>;

export interface ModelChain {
  primary?: ModelCandidate;
  fallbacks: ModelCandidate[];
}

function normalize(value: string | ModelCandidate): ModelCandidate {
  return typeof value === "string" ? { id: value } : value;
}

export function normalizeModelChain(
  preference: ModelPreference | undefined,
): ModelChain {
  if (preference === undefined) return { fallbacks: [] };

  const values = Array.isArray(preference) ? preference : [preference];
  const candidates = values
    .map(normalize)
    .filter((candidate) => candidate.id.trim().length > 0);

  const unique: ModelCandidate[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const key = candidate.variant
      ? candidate.id + ":" + candidate.variant
      : candidate.id;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }

  return {
    primary: unique[0],
    fallbacks: unique.slice(1),
  };
}

/**
 * Select the first eligible model while preserving configured order.
 * This is deliberately deterministic: health/cost/latency ranking belongs
 * to the Router and can reorder the eligible candidates before this helper.
 */
export function selectFirstEligible(
  chain: ModelChain,
  isEligible: (candidate: ModelCandidate) => boolean,
): ModelCandidate | undefined {
  const candidates = [
    ...(chain.primary ? [chain.primary] : []),
    ...chain.fallbacks,
  ];
  return candidates.find(isEligible);
}
