/**
 * Browser-safe shapes the `/api/copilot/*` routes answer with. The gateway's
 * own wire shapes, and the mapping from them, live in `server.ts`.
 */

/** One chat model the gateway offers (`POST /db/get-model-list`). */
export interface CopilotModel {
  model: string;
  modelType: string | null;
  priority: number | null;
  maxTokens: number | null;
  supportsImage: boolean;
  isDefault: boolean;
}

/** `/api/copilot/models` */
export interface CopilotModelsResponse {
  models: CopilotModel[];
}

export type CopilotExecutionMode = "plan" | "execute";

/**
 * A session as the session list shows it: the gateway's document without its
 * `messages`, which `get-all-sessions` returns in full for every session.
 */
export interface CopilotSessionSummary {
  sessionId: string;
  title: string;
  createdAt: string | null;
  lastModified: string | null;
  messageCount: number;
  executionMode: CopilotExecutionMode;
  /** Set while a turn runs in this session (it shows as busy). */
  activeJobId: string | null;
}

/** `/api/copilot/sessions` */
export interface CopilotSessionsResponse {
  sessions: CopilotSessionSummary[];
  total: number;
  hasMore: boolean;
}

/**
 * One step of an agent's work, as the gateway's `progress` events and a stored
 * answer's `agent_metadata.steps` describe it. A later report with the same
 * `stepId` updates the step (running → done).
 */
export interface CopilotStep {
  stepId: string;
  phase: "routing" | "thinking" | "tool" | "answer" | "note";
  status: "running" | "done" | "error";
  label: string;
  detail: string | null;
  result: string | null;
  agentLabel: string | null;
  tookMs: number | null;
  /** Replaces the live line only; never listed as a row. */
  transient: boolean;
}

/**
 * A card the agents attach to an answer (a plan, a question, a job waiting for
 * approval). For a plan, `payload` is the stored plan (`message.plan`), which
 * the gateway keeps current as steps run.
 */
export interface CopilotCard {
  cardType: string;
  payload: unknown;
}

export type CopilotMessageRole = "user" | "assistant";

export interface CopilotMessage {
  /** The gateway's `message_id`; a client id until the message is saved. */
  id: string;
  role: CopilotMessageRole;
  content: string;
  timestamp: string | null;
  model: string | null;
  /** What the agents did for an answer ("What I did"). */
  steps: CopilotStep[];
  card: CopilotCard | null;
  rating: -1 | 0 | 1 | null;
  /** Saved by the gateway, so it can be rated. */
  persisted: boolean;
  /** A message the gateway wrote on its own (a job finished). */
  systemInitiated: boolean;
  /** Answers to an agent's questions, shown as a user message. */
  isClarification: boolean;
  /** The question/answer pairs of a clarification message. */
  clarificationAnswers: CopilotClarificationAnswer[];
  /** What a question carried (files, images), as the gateway recorded it. */
  attachments: CopilotAttachmentInfo[];
}

/**
 * An attachment as a stored question lists it: its name and kind only (the
 * content is not kept). `execution` marks a question sent in Execute mode
 * once, or one that revised prepared jobs.
 */
export interface CopilotAttachmentInfo {
  type: "image" | "file" | "pdf" | "execution";
  name: string;
  size: number | null;
}

export interface CopilotClarificationAnswer {
  question: string;
  answer: string;
}

/** One question of a `clarification` card. */
export interface CopilotClarificationQuestion {
  id: string;
  question: string;
  options: string[];
  required: boolean;
}

/**
 * An action an agent prepared but did not run (an `execution_blocked` card).
 * Sent back verbatim to run or revise it, so it is kept as the gateway gave it.
 */
export interface CopilotBlockedAction {
  tool: string;
  summary?: string;
  arguments?: unknown;
  [key: string]: unknown;
}

export type CopilotExecutionAnswer = "yes" | "no" | "other";

/** `/api/copilot/sessions/[id]` */
export interface CopilotSessionDetail {
  sessionId: string;
  messages: CopilotMessage[];
  executionMode: CopilotExecutionMode;
  /** Set while a turn runs in this session. */
  activeJobId: string | null;
}

/** `POST /api/copilot/chat` body. */
export interface CopilotChatRequest {
  sessionId: string;
  query: string;
  model: string;
  /** One or two sentences about the page the user is on. */
  pageContext?: string;
  /** The session's Plan/Execute mode (plan when absent). */
  executionMode?: CopilotExecutionMode;
  /** Pins the turn to one agent (answers go back to the agent that asked). */
  targetAgent?: string;
  /** Answers to a `clarification` card. */
  clarification?: {
    answers: CopilotClarificationAnswer[];
    originalQuery: string;
  };
  /** "Yes" on an `execution_blocked` card: run these actions once, verbatim. */
  replayActions?: CopilotBlockedAction[];
  /** "Other" on an `execution_blocked` card: revise these actions. */
  preparedActions?: CopilotBlockedAction[];
  /**
   * Runs one step of a plan (`workflow_context.plan_action: "execute_next"`).
   * `plan` is the stored plan object, sent back as the gateway gave it.
   */
  planStep?: {
    plan: Record<string, unknown>;
    stepIndex: number;
  };
  /** Images as `data:image/…;base64,` URLs, for models that read images. */
  images?: { name: string; dataUrl: string }[];
  /** Text files, as text. */
  files?: { name: string; content: string; mimeType: string; size: number }[];
  /** PDFs as `data:application/pdf;base64,` URLs. */
  pdfs?: { name: string; dataUrl: string; size: number }[];
}

/** A job the gateway watches for a chat (`/session/:id/workflow-watches`). */
export interface CopilotWorkflowWatch {
  submissionId: string;
  workflowId: string | null;
  /** `active` until the job ends, then `completed` or `failed`. */
  status: string;
}

/** `/api/copilot/sessions/[id]/workflow-watches` */
export interface CopilotWorkflowWatchesResponse {
  watches: CopilotWorkflowWatch[];
}

/**
 * The `{error, code}` body of a failed `/api/copilot/*` call. `copilotCode`
 * carries the gateway's own code where the client acts on it
 * (`TURN_IN_FLIGHT`, `SESSION_ARCHIVED`, `NO_TURN`).
 */
export interface CopilotErrorBody {
  error: string;
  code: string;
  copilotCode?: string;
}
