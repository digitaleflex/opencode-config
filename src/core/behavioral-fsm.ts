// src/core/behavioral-fsm.ts — Goal-Conditioned Behavioral FSM
// Validates tool-call sequences against allowed state transitions.
// Inspired by the pDFA behavioral firewall (O(1) state transitions,
// bounded memory) from Aegis-style monitoring. Each tool call must be a
// legal transition from the current state; illegal sequences (e.g.
// read → write → delete without approval) are flagged.

import { TaskType } from "./types";
import { StateStore } from "./state-store";

export type ToolKind =
  "read" | "write" | "execute" | "delete" | "network" | "secret" | "config" | "approve";

export const ToolKinds: ToolKind[] = [
  "read",
  "write",
  "execute",
  "delete",
  "network",
  "secret",
  "config",
  "approve",
];

export interface StateTransition {
  from: WorkflowState;
  to: WorkflowState;
  tool: ToolKind;
  allowed: boolean;
}

export type WorkflowState =
  "INIT" | "ANALYZE" | "MODIFY" | "VERIFY" | "APPROVAL" | "DONE" | "VIOLATION";

const STATE_ORDER: WorkflowState[] = ["INIT", "ANALYZE", "MODIFY", "VERIFY", "APPROVAL", "DONE"];

// Allowed transitions per state. Deny-by-default: only these are legal.
const TRANSITION_TABLE: Record<WorkflowState, Record<ToolKind, WorkflowState>> = {
  INIT: {
    read: "ANALYZE",
    write: "MODIFY",
    execute: "MODIFY",
    delete: "VIOLATION",
    network: "MODIFY",
    secret: "MODIFY",
    config: "MODIFY",
    approve: "VIOLATION",
  },
  ANALYZE: {
    read: "ANALYZE",
    write: "MODIFY",
    execute: "MODIFY",
    delete: "VIOLATION",
    network: "MODIFY",
    secret: "VIOLATION",
    config: "MODIFY",
    approve: "APPROVAL",
  },
  MODIFY: {
    read: "ANALYZE",
    write: "MODIFY",
    execute: "VERIFY",
    delete: "VERIFY",
    network: "MODIFY",
    secret: "MODIFY",
    config: "MODIFY",
    approve: "APPROVAL",
  },
  VERIFY: {
    read: "ANALYZE",
    write: "MODIFY",
    execute: "VERIFY",
    delete: "VIOLATION",
    network: "MODIFY",
    secret: "MODIFY",
    config: "MODIFY",
    approve: "APPROVAL",
  },
  APPROVAL: {
    read: "ANALYZE",
    write: "MODIFY",
    execute: "VERIFY",
    delete: "VERIFY",
    network: "MODIFY",
    secret: "MODIFY",
    config: "MODIFY",
    approve: "APPROVAL",
  },
  DONE: {
    read: "ANALYZE",
    write: "MODIFY",
    execute: "VERIFY",
    delete: "VIOLATION",
    network: "MODIFY",
    secret: "MODIFY",
    config: "MODIFY",
    approve: "APPROVAL",
  },
  VIOLATION: {
    read: "VIOLATION",
    write: "VIOLATION",
    execute: "VIOLATION",
    delete: "VIOLATION",
    network: "VIOLATION",
    secret: "VIOLATION",
    config: "VIOLATION",
    approve: "VIOLATION",
  },
};

// Disallowed sequences that are high-signal reverse-direction moves
const VIOLATION_SEQUENCES: { from: WorkflowState; tool: ToolKind; to: WorkflowState }[] = [
  { from: "ANALYZE", tool: "delete", to: "VIOLATION" },
  { from: "VERIFY", tool: "delete", to: "VIOLATION" },
  { from: "DONE", tool: "delete", to: "VIOLATION" },
  { from: "INIT", tool: "delete", to: "VIOLATION" },
  { from: "INIT", tool: "approve", to: "VIOLATION" },
  { from: "ANALYZE", tool: "secret", to: "VIOLATION" },
];

export interface FSMEvent {
  tool: ToolKind;
  taskType: TaskType;
  timestamp: number;
}

export interface FSMResult {
  currentState: WorkflowState;
  transitions: StateTransition[];
  violated: boolean;
  violationReason?: string;
}

export class BehavioralFSM {
  private state: WorkflowState = "INIT";
  private transitions: StateTransition[] = [];
  private readonly maxTransitions = 100;
  private taskTypeMap: Record<string, ToolKind> = {
    TYPO: "write",
    CONFIG: "config",
    FORMAT: "write",
    DOC_READ: "read",
    DOC_WRITE: "write",
    BUG_LOCALIZED: "write",
    FEATURE_LIMITED: "write",
    REFACTOR_MODULE: "write",
    API_CHANGE: "write",
    ARCH_DESIGN: "write",
    SECURITY: "secret",
    PRODUCTION_DEPLOY: "execute",
    SENSITIVE_DATA: "secret",
    DESTRUCTIVE_OP: "delete",
  };

  /**
   * Record a tool invocation, transition state, and check legality.
   */
  step(tool: ToolKind, taskType: TaskType, timestamp = Date.now()): FSMResult {
    const from = this.state;

    // Explicit violation sequences take precedence
    const violation = VIOLATION_SEQUENCES.find((v) => v.from === from && v.tool === tool);
    if (violation) {
      this.state = "VIOLATION";
      const t: StateTransition = { from, to: "VIOLATION", tool, allowed: false };
      this.transitions.push(t);
      if (this.transitions.length > this.maxTransitions) this.transitions.shift();
      return {
        currentState: this.state,
        transitions: [t],
        violated: true,
        violationReason: `Illegal transition: ${tool} from state ${from}`,
      };
    }

    const to = TRANSITION_TABLE[from][tool];
    const allowed = to !== "VIOLATION";
    const t: StateTransition = { from, to, tool, allowed };

    this.transitions.push(t);
    if (this.transitions.length > this.maxTransitions) this.transitions.shift();
    this.state = to;

    return {
      currentState: this.state,
      transitions: [t],
      violated: !allowed,
      violationReason: allowed ? undefined : `Blocked ${tool} from state ${from}`,
    };
  }

  /**
   * Convenience: infer tool from task type and step.
   */
  stepTask(taskType: TaskType, timestamp = Date.now()): FSMResult {
    const tool = this.taskTypeMap[taskType] || "read";
    return this.step(tool, taskType, timestamp);
  }

  /**
   * Mark workflow complete.
   */
  complete(): FSMResult {
    return this.step("approve", this.resolveTaskTypeFromState(), Date.now());
  }

  getState(): WorkflowState {
    return this.state;
  }

  reset(): void {
    this.state = "INIT";
    this.transitions = [];
  }

  getTransitionLog(): StateTransition[] {
    return [...this.transitions];
  }

  /**
   * Is the current state consistent with approved output?
   */
  hasCompleted(): boolean {
    return this.state === "APPROVAL" || this.state === "DONE" || this.state === "VERIFY";
  }

  private resolveTaskTypeFromState(): TaskType {
    return TaskType.FEATURE_LIMITED;
  }

  // --- Persistence (État persistant #5) ---

  serialize(): unknown {
    return {
      state: this.state,
      transitions: [...this.transitions],
    };
  }

  restore(data: unknown): void {
    try {
      if (!data || typeof data !== "object") return;
      const obj = data as Record<string, unknown>;
      if (typeof obj.state === "string") {
        const validStates: WorkflowState[] = [
          "INIT",
          "ANALYZE",
          "MODIFY",
          "VERIFY",
          "APPROVAL",
          "DONE",
          "VIOLATION",
        ];
        if ((validStates as string[]).includes(obj.state)) {
          this.state = obj.state as WorkflowState;
        }
      }
      if (Array.isArray(obj.transitions)) {
        const filtered = (obj.transitions as unknown[]).filter(
          (t): t is StateTransition =>
            !!t &&
            typeof t === "object" &&
            typeof (t as Record<string, unknown>).from === "string" &&
            typeof (t as Record<string, unknown>).to === "string" &&
            typeof (t as Record<string, unknown>).tool === "string" &&
            typeof (t as Record<string, unknown>).allowed === "boolean"
        ) as StateTransition[];
        // Cap to maxTransitions (100)
        this.transitions =
          filtered.length > this.maxTransitions ? filtered.slice(-this.maxTransitions) : filtered;
      }
    } catch {
      // fail-open
    }
  }

  static deserialize(data: unknown): BehavioralFSM {
    const inst = new BehavioralFSM();
    inst.restore(data);
    return inst;
  }

  save(store: StateStore, name = "fsm"): void {
    store.save(name, this.serialize());
  }

  load(store: StateStore, name = "fsm"): void {
    const data = store.load(name);
    if (data) this.restore(data);
  }
}
