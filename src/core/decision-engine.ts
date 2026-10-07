import { resolveAgentProfile, type AgentProfile } from "./config/agent-profile";
import type { AgentOverride } from "./config/layered";
import { normalizeModelChain, type ModelPreference, type ModelChain } from "./config/model-chain";
import { isMcpAllowed, isSkillAllowed, resolveMcps, resolveSkills } from "./config/capabilities";
import { PolicyEngine } from "./policy-engine";
import { TaskSpec, type PolicyDecision } from "./types";

export type DecisionVerdict = "ALLOW" | "ASK" | "DENY";

export interface DecisionRequest {
  task: TaskSpec;
  agent?: string;
  requiredSkill?: string;
  requestedMcp?: string;
  model?: ModelPreference;
  configLayers?: ReadonlyArray<{
    source: "project" | "user" | "preset" | "default";
    agents?: Record<string, AgentOverride>;
  }>;
  aliases?: Readonly<Record<string, string>>;
  availableLocalSkills?: readonly string[];
  knownMcps?: readonly string[];
}

export interface DecisionResult {
  verdict: DecisionVerdict;
  reason: string;
  policy: PolicyDecision;
  agent?: AgentProfile;
  selectedAgent?: string;
  modelChain: ModelChain;
  skills: string[];
  mcps: string[];
}

const DEFAULT_AGENTS = ["planner", "architect", "builder", "reviewer", "tester", "security"];

export class DecisionEngine {
  constructor(private readonly policyEngine = new PolicyEngine()) {}

  decide(request: DecisionRequest): DecisionResult {
    const policy = this.policyEngine.evaluatePolicy(request.task);

    if (policy.decision === "BLOCKED") {
      return this.build("DENY", policy.reason ?? "Policy blocked", policy);
    }

    const candidateNames = request.agent
      ? [request.agent]
      : (policy.policy?.agents ?? DEFAULT_AGENTS);

    for (const name of candidateNames) {
      const resolved = resolveAgentProfile(name, request.configLayers ?? [], request.aliases);
      const skills = resolveSkills(resolved.profile, request.availableLocalSkills);
      const mcps = resolveMcps(
        Array.isArray(resolved.profile.mcps) ? resolved.profile.mcps as string[] : undefined,
        request.knownMcps,
      );

      if (request.requiredSkill && !isSkillAllowed(request.requiredSkill, skills)) continue;
      if (request.requestedMcp && !isMcpAllowed(request.requestedMcp, mcps)) continue;

      const preference = request.model ?? resolved.profile.model;
      const modelChain = normalizeModelChain(preference);
      const effectiveChain = modelChain.primary
        ? modelChain
        : normalizeModelChain([
            ...(policy.policy?.modelPlan.primary ?? []),
            ...(policy.policy?.modelPlan.fallback ?? []),
          ]);

      return {
        verdict: policy.decision === "REQUIRES_HUMAN" ? "ASK" : "ALLOW",
        reason: policy.reason ?? "Policy approved",
        policy,
        agent: resolved.profile,
        selectedAgent: name,
        modelChain: effectiveChain,
        skills,
        mcps,
      };
    }

    return this.build(
      "DENY",
      "No policy-approved agent satisfies the requested capabilities",
      policy,
    );
  }

  private build(
    verdict: DecisionVerdict,
    reason: string,
    policy: PolicyDecision,
  ): DecisionResult {
    return {
      verdict,
      reason,
      policy,
      modelChain: { fallbacks: [] },
      skills: [],
      mcps: [],
    };
  }
}
