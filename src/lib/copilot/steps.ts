/**
 * Reading the agents' progress steps, shared by the stream (`progress`
 * events) and stored answers (`agent_metadata.steps`). The step format is
 * `bvbrc-agents/shared/progress.py`. Plain checks rather than zod, so the
 * browser bundle for the stream stays small.
 */
import type { CopilotCard, CopilotStep } from "./types";

const phases = new Set<CopilotStep["phase"]>([
  "routing",
  "thinking",
  "tool",
  "answer",
  "note",
]);
const statuses = new Set<CopilotStep["status"]>(["running", "done", "error"]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** A step from its wire form, or null when it has no id or label. */
export function readCopilotStep(raw: unknown): CopilotStep | null {
  if (!isRecord(raw)) return null;
  const stepId = text(raw.step_id);
  const label = text(raw.label) ?? text(raw.message);
  if (!stepId || !label) return null;
  const phase = raw.phase as CopilotStep["phase"];
  const status = raw.status as CopilotStep["status"];
  return {
    stepId,
    phase: phases.has(phase) ? phase : "note",
    status: statuses.has(status) ? status : "running",
    label,
    detail: text(raw.detail),
    result: text(raw.result),
    agentLabel: text(raw.agent_label),
    tookMs: count(raw.took_ms),
    transient: raw.transient === true,
  };
}

/** Steps from a stored answer, in order, dropping unreadable ones. */
export function readCopilotSteps(raw: unknown): CopilotStep[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(readCopilotStep)
    .filter((step): step is CopilotStep => step !== null && !step.transient);
}

/** Inserts or updates `step` by `stepId`, keeping first-seen order. */
export function mergeCopilotStep(
  steps: CopilotStep[],
  step: CopilotStep,
): CopilotStep[] {
  const index = steps.findIndex((existing) => existing.stepId === step.stepId);
  if (index === -1) return [...steps, step];
  const next = steps.slice();
  next[index] = step;
  return next;
}

/** `{card_type, card_payload}` as a `CopilotCard`, or null. */
export function readCopilotCard(raw: unknown): CopilotCard | null {
  if (!isRecord(raw)) return null;
  const cardType = text(raw.card_type);
  return cardType ? { cardType, payload: raw.card_payload ?? null } : null;
}
