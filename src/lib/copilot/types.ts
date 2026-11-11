export interface CopilotModel {
  model: string;
  modelType: string | null;
  priority: number | null;
  maxTokens: number | null;
  supportsImage: boolean;
  isDefault: boolean;
}

export interface CopilotModelsResponse {
  models: CopilotModel[];
}

export type CopilotExecutionMode = "plan" | "execute";

export interface CopilotSessionSummary {
  sessionId: string;
  title: string;
  createdAt: string | null;
  lastModified: string | null;
  messageCount: number;
  executionMode: CopilotExecutionMode;
  activeJobId: string | null;
}

export interface CopilotSessionsResponse {
  sessions: CopilotSessionSummary[];
  total: number;
  hasMore: boolean;
}

/** A later report with the same `stepId` updates the step (running → done). */
export interface CopilotStep {
  stepId: string;
  phase: "routing" | "thinking" | "tool" | "answer" | "note";
  status: "running" | "done" | "error";
  label: string;
  detail: string | null;
  result: string | null;
  agentLabel: string | null;
  tookMs: number | null;
  transient: boolean;
}

/** For a plan, `payload` is the stored plan (`message.plan`), which the gateway keeps current as steps run. */
export interface CopilotCard {
  cardType: string;
  payload: unknown;
}

export type CopilotMessageRole = "user" | "assistant";

export interface CopilotMessage {
  id: string;
  role: CopilotMessageRole;
  content: string;
  timestamp: string | null;
  model: string | null;
  steps: CopilotStep[];
  card: CopilotCard | null;
  rating: -1 | 0 | 1 | null;
  persisted: boolean;
  systemInitiated: boolean;
  isClarification: boolean;
  clarificationAnswers: CopilotClarificationAnswer[];
  attachments: CopilotAttachmentInfo[];
}

/**
 * Name and kind only (the content is not kept). `execution` marks a question sent in Execute mode
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

export interface CopilotClarificationQuestion {
  id: string;
  question: string;
  options: string[];
  required: boolean;
}

/** Sent back verbatim to run or revise it, so it is kept as the gateway gave it. */
export interface CopilotBlockedAction {
  tool: string;
  summary?: string;
  arguments?: unknown;
  [key: string]: unknown;
}

export type CopilotExecutionAnswer = "yes" | "no" | "other";

export interface CopilotSessionDetail {
  sessionId: string;
  messages: CopilotMessage[];
  executionMode: CopilotExecutionMode;
  activeJobId: string | null;
}

export interface CopilotChatRequest {
  sessionId: string;
  query: string;
  model: string;
  pageContext?: string;
  executionMode?: CopilotExecutionMode;
  targetAgent?: string;
  clarification?: {
    answers: CopilotClarificationAnswer[];
    originalQuery: string;
  };
  replayActions?: CopilotBlockedAction[];
  preparedActions?: CopilotBlockedAction[];
  /** `plan` is the stored plan object, sent back as the gateway gave it. */
  planStep?: {
    plan: Record<string, unknown>;
    stepIndex: number;
  };
  images?: { name: string; dataUrl: string }[];
  files?: { name: string; content: string; mimeType: string; size: number }[];
  pdfs?: { name: string; dataUrl: string; size: number }[];
}

export interface CopilotWorkflowWatch {
  submissionId: string;
  workflowId: string | null;
  status: string;
}

export interface CopilotWorkflowWatchesResponse {
  watches: CopilotWorkflowWatch[];
}

/** `copilotCode` carries the gateway's own code where the client acts on it. */
export interface CopilotErrorBody {
  error: string;
  code: string;
  copilotCode?: string;
}
