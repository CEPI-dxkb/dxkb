/**
 * Multi-step plans from the planning agent (`bvbrc-agents/agents/
 * planning_agent/models.py`). The plan is stored on its answer
 * (`message.plan`); the gateway updates each step's status from the
 * `plan_step_*` events of the turn that ran it.
 *
 * The browser drives a plan, as BV-BRC's does: each step is one chat turn
 * (`plan_action: "execute_next"`), and when one completes the client starts
 * the next. A plan stops on its own when a step fails, asks a question, waits
 * for job approval, or submitted a job to wait for. The plan's own status
 * (`draft` → `executing` → `completed`) and the jobs it waits for are saved
 * by the client (`/plan/:id/edit`).
 */
import { isRecord, text } from "./steps";

export type CopilotPlanStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "needs_input"
  | "awaiting_approval";

const stepStatuses = new Set<CopilotPlanStepStatus>([
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
  "needs_input",
  "awaiting_approval",
]);

/** Agents a step can go to (the planning agent's list). */
export const copilotPlanAgents = [
  "data",
  "service",
  "workspace",
  "helpdesk",
  "analysis",
  "direct",
] as const;

export interface CopilotPlanStep {
  stepId: string;
  description: string;
  agent: string;
  dependsOn: string[];
  status: CopilotPlanStepStatus;
  resultSummary: string | null;
  errorMessage: string | null;
}

export interface CopilotPlan {
  planId: string;
  title: string;
  description: string | null;
  /** `draft` until approved; `executing`; `completed`. */
  status: string;
  steps: CopilotPlanStep[];
  /** Job submissions a step started that the plan waits for. */
  waitingFor: string[];
  /** The stored plan object, sent back when the plan runs or is saved. */
  raw: Record<string, unknown>;
}

/** Where the client keeps the jobs a plan waits for (BV-BRC's field). */
const waitingKey = "_waitingForWorkflows";

function readWaiting(raw: Record<string, unknown>): string[] {
  const waiting = raw[waitingKey];
  if (!isRecord(waiting)) return [];
  return Object.entries(waiting)
    .filter(([, entry]) => !isRecord(entry) || entry.status === "active")
    .map(([id]) => id);
}

export function readCopilotPlan(payload: unknown): CopilotPlan | null {
  if (!isRecord(payload) || !Array.isArray(payload.steps)) return null;
  const planId = text(payload.plan_id);
  if (!planId) return null;
  const steps = payload.steps.flatMap((raw): CopilotPlanStep[] => {
    if (!isRecord(raw)) return [];
    const stepId = text(raw.step_id);
    if (!stepId) return [];
    const status = raw.status as CopilotPlanStepStatus;
    return [
      {
        stepId,
        description: text(raw.description) ?? "",
        agent: text(raw.agent) ?? "direct",
        dependsOn: Array.isArray(raw.depends_on)
          ? raw.depends_on.filter((id): id is string => typeof id === "string")
          : [],
        status: stepStatuses.has(status) ? status : "pending",
        resultSummary: text(raw.result_summary),
        errorMessage: text(raw.error_message),
      },
    ];
  });
  if (steps.length === 0) return null;
  return {
    planId,
    title: text(payload.title) ?? text(payload.plan_name) ?? "Plan",
    description: text(payload.description),
    status: text(payload.status) ?? "draft",
    steps,
    waitingFor: readWaiting(payload),
    raw: payload,
  };
}

/** A step's change as a running turn reports it (`plan_step_*` events). */
export interface CopilotPlanStepUpdate {
  planId: string;
  stepId: string | null;
  stepIndex: number | null;
  status: CopilotPlanStepStatus | null;
  resultSummary: string | null;
  errorMessage: string | null;
  /** `plan_workflow_submitted`: jobs the step started. */
  submissionIds: string[];
}

function stepIndexOf(plan: CopilotPlan, update: CopilotPlanStepUpdate): number {
  if (update.stepId) {
    const index = plan.steps.findIndex((step) => step.stepId === update.stepId);
    if (index !== -1) return index;
  }
  return update.stepIndex !== null && update.stepIndex < plan.steps.length
    ? update.stepIndex
    : -1;
}

/**
 * The plan with a running turn's step updates applied, as the gateway will
 * store them (a completed step is not set back to running).
 */
export function applyPlanUpdates(
  plan: CopilotPlan,
  updates: CopilotPlanStepUpdate[],
): CopilotPlan {
  let steps = plan.steps;
  let waitingFor = plan.waitingFor;
  for (const update of updates) {
    if (update.planId !== plan.planId) continue;
    const index = stepIndexOf(plan, update);
    if (index === -1) continue;
    if (update.submissionIds.length > 0) {
      waitingFor = [...new Set([...waitingFor, ...update.submissionIds])];
    }
    const step = steps[index];
    const keepCompleted =
      step.status === "completed" &&
      (update.status === "running" || update.status === "awaiting_approval");
    steps = steps.with(index, {
      ...step,
      status: update.status && !keepCompleted ? update.status : step.status,
      resultSummary: update.resultSummary ?? step.resultSummary,
      errorMessage: update.errorMessage ?? step.errorMessage,
    });
  }
  if (steps === plan.steps && waitingFor === plan.waitingFor) return plan;
  return { ...plan, steps, waitingFor, status: plan.status === "draft" ? "executing" : plan.status };
}

/** Steps that ended one way or another. */
function isSettled(step: CopilotPlanStep): boolean {
  return (
    step.status === "completed" ||
    step.status === "skipped" ||
    step.status === "failed"
  );
}

export type CopilotPlanState =
  /** Not approved yet. */
  | { kind: "draft" }
  /** This step runs next. */
  | { kind: "ready"; stepIndex: number }
  /** A step waits for the user: its question, or its jobs' approval. */
  | { kind: "waitingForUser"; stepIndex: number }
  /** A step stopped before it finished (Stop, or a dropped connection). */
  | { kind: "interrupted"; stepIndex: number }
  | { kind: "failed"; stepIndex: number }
  /** Jobs a step submitted are still running. */
  | { kind: "waitingForJobs"; submissionIds: string[] }
  | { kind: "completed" };

/**
 * What a stored plan does next, read when no turn is running. A step still
 * `running` then was interrupted.
 */
export function copilotPlanState(plan: CopilotPlan): CopilotPlanState {
  if (plan.status === "draft") return { kind: "draft" };
  const find = (status: CopilotPlanStepStatus) =>
    plan.steps.findIndex((step) => step.status === status);

  const asking = Math.max(find("needs_input"), find("awaiting_approval"));
  if (asking !== -1) return { kind: "waitingForUser", stepIndex: asking };
  const failed = find("failed");
  if (failed !== -1) return { kind: "failed", stepIndex: failed };
  const running = find("running");
  if (running !== -1) return { kind: "interrupted", stepIndex: running };
  if (plan.waitingFor.length > 0) {
    return { kind: "waitingForJobs", submissionIds: plan.waitingFor };
  }
  const next = find("pending");
  if (next !== -1) return { kind: "ready", stepIndex: next };
  return plan.steps.every(isSettled) ? { kind: "completed" } : { kind: "ready", stepIndex: 0 };
}

/** The stored plan object with `changes` and the given steps written in. */
export function copilotPlanObject(
  plan: CopilotPlan,
  changes: { status?: string; steps?: CopilotPlanStep[]; waitingFor?: string[] } = {},
): Record<string, unknown> {
  const rawSteps = Array.isArray(plan.raw.steps) ? plan.raw.steps : [];
  const rawById = new Map(
    rawSteps.flatMap((step) =>
      isRecord(step) && typeof step.step_id === "string"
        ? [[step.step_id, step] as const]
        : [],
    ),
  );
  const steps = changes.steps ?? plan.steps;
  const ids = new Set(steps.map((step) => step.stepId));
  const next: Record<string, unknown> = {
    ...plan.raw,
    status: changes.status ?? plan.status,
    steps: steps.map((step) => ({
      reasoning: "Added by the user.",
      expects: [],
      ...rawById.get(step.stepId),
      step_id: step.stepId,
      description: step.description,
      agent: step.agent,
      // A deleted step is no longer something to wait for.
      depends_on: step.dependsOn.filter((id) => ids.has(id)),
      status: step.status,
    })),
  };
  const waitingFor = changes.waitingFor ?? plan.waitingFor;
  // Present only while the plan waits (a cleared wait drops the field).
  next[waitingKey] =
    waitingFor.length > 0
      ? Object.fromEntries(waitingFor.map((id) => [id, { status: "active" }]))
      : undefined;
  return next;
}

/** The plan with one step's status changed. */
export function withStepStatus(
  plan: CopilotPlan,
  stepIndex: number,
  status: CopilotPlanStepStatus,
): CopilotPlan {
  return {
    ...plan,
    steps: plan.steps.map((step, index) =>
      index === stepIndex ? { ...step, status } : step,
    ),
  };
}

/** The (hidden) question of a step turn; BV-BRC's wording. */
export function planStepQuery(plan: CopilotPlan, stepIndex: number): string {
  const step = plan.steps.at(stepIndex);
  return `Execute plan step: ${step?.description || `step ${String(stepIndex + 1)}`}`;
}

/** A new step id, unused in the plan. */
export function newPlanStepId(plan: { steps: { stepId: string }[] }): string {
  const ids = new Set(plan.steps.map((step) => step.stepId));
  let number = plan.steps.length + 1;
  while (ids.has(`step_${String(number)}`)) number += 1;
  return `step_${String(number)}`;
}
