/**
 * The browser drives a plan: each step is one chat turn (`plan_action: "execute_next"`) and the
 * client starts the next when one completes.
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
  status: string;
  steps: CopilotPlanStep[];
  waitingFor: string[];
  raw: Record<string, unknown>;
}

const waitingKey = "_waitingForWorkflows";

function readWaiting(raw: Record<string, unknown>): string[] {
  const waiting = raw[waitingKey];
  if (!isRecord(waiting)) return [];
  return Object.entries(waiting).flatMap(([id, entry]) =>
    !isRecord(entry) || entry.status === "active" ? [id] : [],
  );
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

export interface CopilotPlanStepUpdate {
  planId: string;
  stepId: string | null;
  stepIndex: number | null;
  status: CopilotPlanStepStatus | null;
  resultSummary: string | null;
  errorMessage: string | null;
  submissionIds: string[];
}

function stepIndexOf(plan: CopilotPlan, update: CopilotPlanStepUpdate): number {
  if (update.stepId) {
    const index = plan.steps.findIndex((step) => step.stepId === update.stepId);
    if (index !== -1) return index;
  }
  return update.stepIndex !== null &&
    update.stepIndex >= 0 &&
    update.stepIndex < plan.steps.length
    ? update.stepIndex
    : -1;
}

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

function isSettled(step: CopilotPlanStep): boolean {
  return (
    step.status === "completed" ||
    step.status === "skipped" ||
    step.status === "failed"
  );
}

export type CopilotPlanState =
  | { kind: "draft" }
  | { kind: "ready"; stepIndex: number }
  | { kind: "waitingForUser"; stepIndex: number }
  | { kind: "interrupted"; stepIndex: number }
  | { kind: "failed"; stepIndex: number }
  | { kind: "waitingForJobs"; submissionIds: string[] }
  | { kind: "completed" };

/** A step still `running` when no turn is running was interrupted. */
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
      depends_on: step.dependsOn.filter((id) => ids.has(id)),
      status: step.status,
    })),
  };
  const waitingFor = changes.waitingFor ?? plan.waitingFor;
  next[waitingKey] =
    waitingFor.length > 0
      ? Object.fromEntries(waitingFor.map((id) => [id, { status: "active" }]))
      : undefined;
  return next;
}

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

export function planStepQuery(plan: CopilotPlan, stepIndex: number): string {
  const step =
    stepIndex >= 0 && stepIndex < plan.steps.length
      ? plan.steps[stepIndex]
      : undefined;
  return `Execute plan step: ${step?.description || `step ${String(stepIndex + 1)}`}`;
}

export function mustRunAfter(
  step: CopilotPlanStep,
  other: CopilotPlanStep,
): boolean {
  return step.dependsOn.includes(other.stepId);
}

/**
 * Null when the plan moved on under the edit: a step pending in the edit is no longer pending in
 * `live`, or a live non-pending step is missing.
 */
export function mergeEditedSteps(
  live: CopilotPlan,
  edited: CopilotPlanStep[],
): CopilotPlanStep[] | null {
  const liveById = new Map(live.steps.map((step) => [step.stepId, step]));
  const editedIds = new Set(edited.map((step) => step.stepId));
  for (const step of live.steps) {
    if (step.status !== "pending" && !editedIds.has(step.stepId)) return null;
  }
  const merged: CopilotPlanStep[] = [];
  for (const step of edited) {
    const current = liveById.get(step.stepId);
    if (step.status === "pending") {
      if (current && current.status !== "pending") return null;
      merged.push(step);
    } else {
      merged.push(current ?? step);
    }
  }
  return merged;
}

export function newPlanStepId(plan: { steps: { stepId: string }[] }): string {
  const ids = new Set(plan.steps.map((step) => step.stepId));
  let number = plan.steps.length + 1;
  while (ids.has(`step_${String(number)}`)) number += 1;
  return `step_${String(number)}`;
}
