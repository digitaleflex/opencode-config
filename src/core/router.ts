import { classifyTask } from "./classifier";
import { resolveStrategy, type Candidate, type StrategyName, type WorkerTarget } from "./strategies";
import { assessRisk } from "./risk-assessor";
import {
  RiskLevel,
  TaskComplexity,
  TaskSpec,
  TaskType,
} from "./types";
import { normalizeModelChain, type ModelCandidate, type ModelChain } from "./config/model-chain";

export interface RouteAgentCandidate {
  id: string;
  priority?: number;
  weight?: number;
  tier?: string;
  taskTypes?: TaskType[];
  minComplexity?: TaskComplexity;
  maxRisk?: RiskLevel;
  health?: Candidate["health"];
  estCostUsd?: number;
}

export interface RouteRequest {
  task: TaskSpec;
  preferredAgent?: string;
  availableAgents?: RouteAgentCandidate[];
  modelCandidates?: ModelCandidate[];
  strategy?: StrategyName;
}

export interface RouteDecision {
  taskType: TaskType;
  complexity: TaskComplexity;
  risk: RiskLevel;
  agent?: string;
  agentCandidates: string[];
  modelChain: ModelChain;
  strategy: StrategyName;
  resolved: boolean;
  reason: string;
}

const COMPLEXITY_ORDER: Record<TaskComplexity, number> = {
  [TaskComplexity.L1]: 1,
  [TaskComplexity.L2]: 2,
  [TaskComplexity.L3]: 3,
  [TaskComplexity.L4]: 4,
};

const RISK_ORDER: Record<RiskLevel, number> = {
  [RiskLevel.LOW]: 1,
  [RiskLevel.HIGH]: 2,
  [RiskLevel.CRITICAL]: 3,
};

const DEFAULT_AGENTS: RouteAgentCandidate[] = [
  { id: "builder", taskTypes: [TaskType.TYPO, TaskType.CONFIG, TaskType.FORMAT, TaskType.BUG_LOCALIZED, TaskType.FEATURE_LIMITED, TaskType.REFACTOR_MODULE], maxRisk: RiskLevel.HIGH },
  { id: "planner", taskTypes: [TaskType.FEATURE_LIMITED, TaskType.BUG_LOCALIZED, TaskType.REFACTOR_MODULE, TaskType.API_CHANGE, TaskType.ARCH_DESIGN, TaskType.SECURITY, TaskType.PRODUCTION_DEPLOY, TaskType.SENSITIVE_DATA, TaskType.DESTRUCTIVE_OP], maxRisk: RiskLevel.CRITICAL },
  { id: "architect", taskTypes: [TaskType.API_CHANGE, TaskType.ARCH_DESIGN, TaskType.SECURITY, TaskType.PRODUCTION_DEPLOY, TaskType.SENSITIVE_DATA], minComplexity: TaskComplexity.L3, maxRisk: RiskLevel.CRITICAL },
  { id: "reviewer", taskTypes: [TaskType.BUG_LOCALIZED, TaskType.FEATURE_LIMITED, TaskType.REFACTOR_MODULE, TaskType.API_CHANGE, TaskType.ARCH_DESIGN, TaskType.SECURITY, TaskType.PRODUCTION_DEPLOY, TaskType.SENSITIVE_DATA, TaskType.DESTRUCTIVE_OP], maxRisk: RiskLevel.CRITICAL },
  { id: "security", taskTypes: [TaskType.SECURITY, TaskType.SENSITIVE_DATA, TaskType.DESTRUCTIVE_OP, TaskType.PRODUCTION_DEPLOY], minComplexity: TaskComplexity.L3, maxRisk: RiskLevel.CRITICAL },
  { id: "tester", taskTypes: [TaskType.BUG_LOCALIZED, TaskType.FEATURE_LIMITED, TaskType.REFACTOR_MODULE, TaskType.API_CHANGE, TaskType.SECURITY], maxRisk: RiskLevel.CRITICAL },
];

function inferComplexity(taskType: TaskType): TaskComplexity {
  if ([TaskType.TYPO, TaskType.CONFIG, TaskType.FORMAT, TaskType.DOC_READ, TaskType.DOC_WRITE].includes(taskType)) return TaskComplexity.L1;
  if ([TaskType.BUG_LOCALIZED, TaskType.FEATURE_LIMITED, TaskType.REFACTOR_MODULE].includes(taskType)) return TaskComplexity.L2;
  if ([TaskType.API_CHANGE, TaskType.ARCH_DESIGN, TaskType.SECURITY].includes(taskType)) return TaskComplexity.L3;
  return TaskComplexity.L4;
}

function compatible(candidate: RouteAgentCandidate, taskType: TaskType, complexity: TaskComplexity, risk: RiskLevel): boolean {
  if (candidate.taskTypes && !candidate.taskTypes.includes(taskType)) return false;
  if (candidate.minComplexity && COMPLEXITY_ORDER[complexity] < COMPLEXITY_ORDER[candidate.minComplexity]) return false;
  if (candidate.maxRisk && RISK_ORDER[risk] > RISK_ORDER[candidate.maxRisk]) return false;
  return true;
}

function defaultHealth(): Candidate["health"] {
  return {
    score: () => 1,
    latencyMs: () => 0,
  } as Candidate["health"];
}

export class Router {
  route(request: RouteRequest): RouteDecision {
    const taskType = request.task.taskType ?? classifyTask(request.task);
    const complexity = request.task.complexity ?? inferComplexity(taskType);
    const risk = request.task.risk ?? assessRisk({ ...request.task, taskType, complexity });

    const pool = (request.availableAgents?.length ? request.availableAgents : DEFAULT_AGENTS)
      .filter((candidate) => compatible(candidate, taskType, complexity, risk));

    const candidates = pool.map((agent) => ({
      target: {
        id: agent.id,
        priority: agent.priority,
        weight: agent.weight,
        tier: agent.tier,
      } satisfies WorkerTarget,
      health: agent.health ?? defaultHealth(),
      estCostUsd: agent.estCostUsd,
    }));

    const strategy = resolveStrategy(request.strategy);
    const ordered = strategy.order(candidates);
    const orderedIds = ordered.map((candidate) => candidate.target.id);

    if (request.preferredAgent && orderedIds.includes(request.preferredAgent)) {
      orderedIds.splice(orderedIds.indexOf(request.preferredAgent), 1);
      orderedIds.unshift(request.preferredAgent);
    }

    const modelChain = normalizeModelChain(request.modelCandidates);
    const selectedAgent = orderedIds[0];

    return {
      taskType,
      complexity,
      risk,
      agent: selectedAgent,
      agentCandidates: orderedIds,
      modelChain,
      strategy: strategy.name as StrategyName,
      resolved: Boolean(selectedAgent),
      reason: selectedAgent
        ? `Routed ${taskType}/${complexity}/${risk} to ${selectedAgent} using ${strategy.name}`
        : `No compatible agent for ${taskType}/${complexity}/${risk}`,
    };
  }
}
