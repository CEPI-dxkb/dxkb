/**
 * Readers for the cards the agents attach to answers (`card.card_payload`).
 * Payloads are model- and gateway-written, so every field is checked; a card
 * that does not read is shown as a notice instead.
 */
import { isRecord, text } from "./steps";
import type {
  CopilotBlockedAction,
  CopilotClarificationQuestion,
  CopilotExecutionAnswer,
} from "./types";

export interface CopilotClarificationCard {
  questions: CopilotClarificationQuestion[];
  /** The agent that asked; answers go back to it. */
  agent: string;
  /**
   * Set when a plan step asked: the answers re-run that step instead of
   * going to the agent directly.
   */
  planStep: { planId: string; stepIndex: number | null; stepId: string | null } | null;
}

export interface CopilotExecutionCard {
  /** The agent whose actions were held back. */
  agent: string | null;
  actions: CopilotBlockedAction[];
  answered: { answer: CopilotExecutionAnswer; text: string | null } | null;
  /** The plan whose step prepared the actions; Yes lets it go on. */
  planId: string | null;
}

function readPlanStepRef(raw: unknown): CopilotClarificationCard["planStep"] {
  if (!isRecord(raw)) return null;
  const planId = text(raw.plan_id);
  if (!planId) return null;
  return {
    planId,
    stepId: text(raw.step_id),
    stepIndex:
      typeof raw.step_index === "number" && Number.isInteger(raw.step_index)
        ? raw.step_index
        : null,
  };
}

/** Agent names the chat route accepts as `targetAgent`. */
export function asTargetAgent(value: unknown): string | null {
  return typeof value === "string" && /^[a-z_]{1,40}$/.test(value) ? value : null;
}

export function readClarificationCard(
  payload: unknown,
): CopilotClarificationCard | null {
  if (!isRecord(payload) || !Array.isArray(payload.questions)) return null;
  const questions = payload.questions.flatMap(
    (raw, index): CopilotClarificationQuestion[] => {
      if (!isRecord(raw)) return [];
      const question = text(raw.question);
      if (!question) return [];
      const options = Array.isArray(raw.options)
        ? raw.options.filter(
            (option): option is string =>
              typeof option === "string" && option.trim() !== "",
          )
        : [];
      return [
        {
          id: text(raw.id) ?? `q${String(index)}`,
          question,
          options,
          required: raw.required === true,
        },
      ];
    },
  );
  if (questions.length === 0) return null;
  return {
    questions,
    agent: asTargetAgent(payload.agent) ?? "planning",
    planStep: readPlanStepRef(payload.plan_step),
  };
}

const executionAnswers = new Set<CopilotExecutionAnswer>(["yes", "no", "other"]);

export function readExecutionCard(payload: unknown): CopilotExecutionCard | null {
  if (!isRecord(payload) || !Array.isArray(payload.blocked_actions)) return null;
  const actions = payload.blocked_actions.filter(
    (action): action is CopilotBlockedAction =>
      isRecord(action) && typeof action.tool === "string" && action.tool !== "",
  );
  if (actions.length === 0) return null;
  const answered = isRecord(payload.answered) ? payload.answered : null;
  const answer = answered?.answer as CopilotExecutionAnswer | undefined;
  return {
    agent: asTargetAgent(payload.agent),
    actions,
    answered:
      answer && executionAnswers.has(answer)
        ? { answer, text: text(answered?.text) }
        : null,
    planId: readPlanStepRef(payload.plan_context)?.planId ?? null,
  };
}

/** "Job" / "Group" for an action's tool, as the BV-BRC card labels them. */
export function actionKind(tool: string): string {
  if (tool === "submit_gowe_job") return "Job";
  if (tool === "create_group" || tool === "edit_group") return "Group";
  return "Action";
}

function counts(actions: CopilotBlockedAction[]) {
  let jobs = 0;
  let groups = 0;
  let edits = 0;
  for (const action of actions) {
    if (action.tool === "create_group") groups += 1;
    else if (action.tool === "edit_group") {
      groups += 1;
      edits += 1;
    } else jobs += 1;
  }
  return { jobs, groups, edits };
}

/** "Submit this job?", "Create these 2 groups?", "Run these 3 actions?" */
export function executionQuestion(actions: CopilotBlockedAction[]): string {
  const { jobs, groups, edits } = counts(actions);
  if (jobs && groups) return `Run these ${String(jobs + groups)} actions?`;
  if (groups) {
    const verb = edits === groups ? "Update" : edits ? "Run" : "Create";
    if (verb === "Run") return `Run these ${String(groups)} group actions?`;
    return groups === 1 ? `${verb} this group?` : `${verb} these ${String(groups)} groups?`;
  }
  return jobs === 1 ? "Submit this job?" : `Submit these ${String(jobs)} jobs?`;
}

export function executionYesLabel(actions: CopilotBlockedAction[]): string {
  const { jobs, groups, edits } = counts(actions);
  if (jobs && groups) return "Yes, run them";
  if (groups) {
    const verb = edits === groups ? "update" : edits ? "run" : "create";
    return groups === 1 ? `Yes, ${verb} it` : `Yes, ${verb} them`;
  }
  return jobs === 1 ? "Yes, submit it" : `Yes, submit all ${String(jobs)}`;
}

/**
 * The message a "Yes" sends with the actions to replay (BV-BRC's wording; the
 * service agent reads it as "run exactly what you prepared").
 */
export function executeRunMessage(actions: CopilotBlockedAction[]): string {
  const tools = new Set(actions.map((action) => action.tool));
  const submits = tools.has("submit_gowe_job");
  const groups = tools.has("create_group");
  if (submits && groups) {
    return "Execute mode is on for this message. Submit the job and create the group exactly as you prepared them above.";
  }
  if (groups) {
    return "Execute mode is on for this message. Create the group exactly as you prepared it above.";
  }
  return "Execute mode is on for this message. Submit the job exactly as you prepared it above.";
}

/**
 * The question text for answers to a clarification card. The planning agent
 * takes the answers from `workflow_context` and gets the original request as
 * the question; any other agent gets the request plus the answers as text.
 */
export function clarificationQuery(
  agent: string,
  originalQuery: string,
  answers: { question: string; answer: string }[],
): string {
  if (agent === "planning") {
    return originalQuery || "Submitted clarification responses.";
  }
  const lines = answers.map(({ question, answer }) => `- ${question} ${answer}`);
  return `${originalQuery ? `${originalQuery}\n\n` : ""}My answers to your questions:\n${lines.join("\n")}`;
}
