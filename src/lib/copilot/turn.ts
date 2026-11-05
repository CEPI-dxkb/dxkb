/**
 * One chat turn as the stream reports it: the gateway's SSE events
 * (`GW/services/orchestratorClient.js`) decoded into `CopilotEvent`s, and a
 * pure reducer that folds them into the turn the transcript shows while it
 * runs. Once a turn ends, the stored session replaces it.
 */
import type { CopilotPlanStepStatus, CopilotPlanStepUpdate } from "./plan";
import type { SseFrame } from "./sse";
import {
  isRecord,
  mergeCopilotStep,
  readCopilotCard,
  readCopilotStep,
  text,
} from "./steps";
import type { CopilotCard, CopilotStep } from "./types";

export type CopilotEvent =
  | { type: "queued"; message: string }
  | { type: "started"; jobId: string | null }
  | { type: "step"; step: CopilotStep }
  | { type: "answer"; chunk: string; card: CopilotCard | null }
  | { type: "card"; card: CopilotCard; message: string | null }
  | { type: "planStep"; update: CopilotPlanStepUpdate }
  | { type: "error"; message: string }
  | { type: "cancelled" }
  | { type: "done"; messageId: string | null; cancelled: boolean };

/** The step status each `plan_step_*` event sets (the gateway's map). */
const planStepStatuses: Record<string, CopilotPlanStepStatus> = {
  plan_step_started: "running",
  plan_step_completed: "completed",
  plan_step_failed: "failed",
  plan_step_needs_input: "needs_input",
  plan_step_blocked: "awaiting_approval",
};

function readPlanStepUpdate(
  event: string,
  data: Record<string, unknown>,
): CopilotPlanStepUpdate | null {
  const planId = text(data.plan_id);
  if (!planId) return null;
  const stepIndex =
    typeof data.step_index === "number" &&
    Number.isInteger(data.step_index) &&
    data.step_index >= 0
      ? data.step_index
      : null;
  const stepId = text(data.step_id);
  if (stepId === null && stepIndex === null) return null;
  const submissionIds =
    event === "plan_workflow_submitted"
      ? (Array.isArray(data.submission_ids) ? data.submission_ids : [data.submission_id])
          .filter((id): id is string => typeof id === "string" && id !== "")
      : [];
  return {
    planId,
    stepId,
    stepIndex,
    status: planStepStatuses[event] ?? null,
    resultSummary: text(data.result_summary),
    errorMessage: event === "plan_step_failed" ? (text(data.error) ?? "The step failed.") : null,
    submissionIds,
  };
}

function parseData(data: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(data);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * The event a frame carries, or null for one the transcript does not show
 * (`tool_selected`, `tool_executed`, events this client does not know).
 */
export function decodeCopilotEvent(
  frame: SseFrame,
  noteId: () => string,
): CopilotEvent | null {
  const data = parseData(frame.data);
  switch (frame.event) {
    case "queued":
      return {
        type: "queued",
        message:
          text(data.message) ?? "High usage: responses will be slower.",
      };
    case "started":
      return { type: "started", jobId: text(data.job_id) };
    case "progress": {
      const step = readCopilotStep(data);
      if (step) return { type: "step", step };
      // An older free-text update: the live line only.
      const message = text(data.message);
      if (!message) return null;
      return {
        type: "step",
        step: {
          stepId: noteId(),
          phase: "note",
          status: "running",
          label: message,
          detail: null,
          result: null,
          agentLabel: null,
          tookMs: null,
          transient: true,
        },
      };
    }
    case "final_response": {
      const raw = data.chunk ?? data.delta ?? data.content;
      const chunk =
        typeof raw === "string"
          ? raw
          : raw == null
            ? ""
            : JSON.stringify(raw, null, 2);
      const card = readCopilotCard(data.card);
      return chunk || card ? { type: "answer", chunk, card } : null;
    }
    case "needs_input": {
      const message = text(data.message);
      return message ? { type: "answer", chunk: message, card: null } : null;
    }
    case "ask_questions":
    case "execution_blocked":
    case "plan_created": {
      const card = readCopilotCard(data.card);
      return card ? { type: "card", card, message: text(data.message) } : null;
    }
    case "plan_step_started":
    case "plan_step_completed":
    case "plan_step_failed":
    case "plan_step_needs_input":
    case "plan_step_blocked":
    case "plan_workflow_submitted": {
      const update = readPlanStepUpdate(frame.event, data);
      return update ? { type: "planStep", update } : null;
    }
    case "error":
      return {
        type: "error",
        message:
          text(data.error) ??
          text(data.message) ??
          "The Copilot stopped with an error it did not describe.",
      };
    case "cancelled":
      return { type: "cancelled" };
    case "done":
      return {
        type: "done",
        messageId: text(data.message_id),
        cancelled: data.cancelled === true,
      };
    default:
      return null;
  }
}

export type CopilotTurnStatus =
  | "sending"
  | "queued"
  | "running"
  | "done"
  | "stopped"
  | "error"
  /**
   * The stream dropped before the turn ended and the stored session could
   * not be read back. The gateway may still be answering; nothing in this
   * tab follows the turn any more, so it no longer counts as active.
   */
  | "disconnected";

export interface CopilotTurn {
  /** Client id of the user message this turn answers. */
  id: string;
  query: string;
  status: CopilotTurnStatus;
  jobId: string | null;
  /** The live line ("Searching genomes…"); the latest step's label. */
  liveLabel: string | null;
  queuedMessage: string | null;
  steps: CopilotStep[];
  answer: string;
  card: CopilotCard | null;
  error: string | null;
  /** The saved answer's id, when the gateway reports it. */
  messageId: string | null;
  /** Plan steps this turn ran, as they went. */
  planUpdates: CopilotPlanStepUpdate[];
}

export function startCopilotTurn(id: string, query: string): CopilotTurn {
  return {
    id,
    query,
    status: "sending",
    jobId: null,
    liveLabel: null,
    queuedMessage: null,
    steps: [],
    answer: "",
    card: null,
    error: null,
    messageId: null,
    planUpdates: [],
  };
}

export function isCopilotTurnActive(turn: CopilotTurn | null): boolean {
  return (
    turn !== null &&
    (turn.status === "sending" ||
      turn.status === "queued" ||
      turn.status === "running")
  );
}

/**
 * Appends a chunk of the answer. The gateway may send the whole answer again
 * as one last chunk after streaming it; a multi-character chunk equal to the
 * whole answer so far is that repeat, and is skipped. A chunk that only
 * matches the end of the text ("world" after "Hello world") is real text.
 */
export function appendAnswer(answer: string, chunk: string): string {
  if (chunk.length > 1 && answer === chunk) {
    return answer;
  }
  return answer + chunk;
}

export function reduceCopilotTurn(
  turn: CopilotTurn,
  event: CopilotEvent,
): CopilotTurn {
  // Nothing changes a turn that already ended (a late event after Stop).
  if (!isCopilotTurnActive(turn)) return turn;
  switch (event.type) {
    case "queued":
      return { ...turn, status: "queued", queuedMessage: event.message };
    case "started":
      return {
        ...turn,
        status: "running",
        queuedMessage: null,
        jobId: event.jobId ?? turn.jobId,
      };
    case "step":
      return {
        ...turn,
        status: "running",
        queuedMessage: null,
        liveLabel: event.step.label,
        steps: event.step.transient
          ? turn.steps
          : mergeCopilotStep(turn.steps, event.step),
      };
    case "answer":
      return {
        ...turn,
        status: "running",
        queuedMessage: null,
        answer: appendAnswer(turn.answer, event.chunk),
        card: event.card ?? turn.card,
      };
    case "card":
      return {
        ...turn,
        card: event.card,
        answer:
          event.message && !turn.answer
            ? event.message
            : turn.answer,
      };
    case "planStep":
      return { ...turn, planUpdates: [...turn.planUpdates, event.update] };
    case "error":
      return { ...turn, status: "error", error: event.message };
    case "cancelled":
      return { ...turn, status: "stopped" };
    case "done":
      return {
        ...turn,
        status: event.cancelled ? "stopped" : "done",
        messageId: event.messageId,
      };
  }
}
