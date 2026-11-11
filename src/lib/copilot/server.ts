import "server-only";

/**
 * The browser never calls the gateway: the token lives in an HttpOnly cookie, and the gateway takes
 * it as a bare `Authorization` header (no `Bearer`), which is also how it learns the user, so no
 * `user_id` is sent.
 */
import { z } from "zod";
import {
  fetchUpstream,
  UpstreamError,
  upstreamResponseError,
  upstreamServices,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";
import { bvbrcServerUserAgent } from "@/lib/api/server-user-agent";
import { isRecord, readCopilotCard, readCopilotSteps, text } from "./steps";
import type {
  CopilotAttachmentInfo,
  CopilotBlockedAction,
  CopilotCard,
  CopilotChatRequest,
  CopilotClarificationAnswer,
  CopilotExecutionMode,
  CopilotMessage,
  CopilotModel,
  CopilotSessionDetail,
  CopilotSessionSummary,
  CopilotSessionsResponse,
  CopilotWorkflowWatch,
} from "./types";
import { copilotName } from "@/lib/copilot/name";

const service = upstreamServices.copilot;

/** Its message names the variable, for the server log only. */
export class CopilotConfigurationError extends Error {
  readonly userMessage =
    `${copilotName} is unavailable right now: it is not configured on this server.`;

  constructor() {
    super("Copilot needs COPILOT_API_URL, which is not set.");
    this.name = "CopilotConfigurationError";
  }
}

/** Node's default user agent draws a Cloudflare 403 "Just a moment..." challenge. */
function gatewayHeaders(
  token: string,
  headers: Record<string, string>,
): Record<string, string> {
  return {
    ...headers,
    Authorization: token,
    "User-Agent": bvbrcServerUserAgent,
  };
}

function copilotBaseUrl(): string {
  const value = process.env.COPILOT_API_URL?.trim();
  if (!value) throw new CopilotConfigurationError();
  return value.replace(/\/+$/, "");
}

function unreadableAnswer(): UpstreamError {
  return new UpstreamError({
    status: 502,
    code: "upstream_error",
    message: "The BV-BRC Copilot service sent an answer DXKB could not read.",
  });
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) throw await rejection(response);
  try {
    return await response.json();
  } catch {
    throw unreadableAnswer();
  }
}

async function copilotGet(
  path: string,
  token: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetchUpstream(
    `${copilotBaseUrl()}${path}`,
    {
      method: "GET",
      headers: gatewayHeaders(token, { Accept: "application/json" }),
      signal,
    },
    { service, timeoutMs: upstreamTimeoutMs.copilot },
  );
  return readJson(response);
}

async function copilotPost(
  path: string,
  body: object,
  token: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetchUpstream(
    `${copilotBaseUrl()}${path}`,
    {
      method: "POST",
      headers: gatewayHeaders(token, {
        Accept: "application/json",
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(body),
      signal,
    },
    { service, timeoutMs: upstreamTimeoutMs.copilot },
  );
  return readJson(response);
}

const gatewayModelSchema = z.object({
  model: z.string().min(1),
  model_type: z.string().nullish(),
  active: z.boolean().nullish(),
  priority: z.number().nullish(),
  max_tokens: z.number().nullish(),
  supports_image: z.boolean().nullish(),
  is_default: z.boolean().nullish(),
});

const gatewayModelListSchema = z.object({ models: z.string() });

/**
 * An entry with `active: false` is dropped, one that leaves `active` out is kept; duplicates keep
 * the first, since turns name the model only by name.
 */
export async function readCopilotModels(
  token: string,
  signal?: AbortSignal,
): Promise<CopilotModel[]> {
  const answer = gatewayModelListSchema.safeParse(
    await copilotPost("/db/get-model-list", {}, token, signal),
  );
  if (!answer.success) throw unreadableAnswer();

  let entries: unknown;
  try {
    entries = JSON.parse(answer.data.models);
  } catch {
    throw unreadableAnswer();
  }
  const models = z.array(gatewayModelSchema).safeParse(entries);
  if (!models.success) throw unreadableAnswer();

  const seen = new Set<string>();
  return models.data.flatMap((entry) => {
    if (entry.active === false || seen.has(entry.model)) return [];
    seen.add(entry.model);
    return [
      {
        model: entry.model,
        modelType: entry.model_type ?? null,
        priority: entry.priority ?? null,
        maxTokens: entry.max_tokens ?? null,
        supportsImage: entry.supports_image === true,
        isDefault: entry.is_default === true,
      },
    ];
  });
}

export const maxCopilotSessionPage = 100;
export const defaultCopilotSessionPage = 20;

/** Anything but an ISO string (an old document's odd field) is read as unknown rather than failing the page. */
const dateText = z
  .unknown()
  .transform((value) => (typeof value === "string" && value ? value : null));

const gatewaySessionSchema = z.object({
  session_id: z.string().min(1),
  title: z.string().nullish(),
  created_at: dateText,
  last_modified: dateText,
  messages: z.array(z.unknown()).nullish(),
  execution_mode: z.string().nullish(),
  active_job_id: z.string().nullish(),
});

const gatewaySessionsSchema = z.object({
  sessions: z.array(gatewaySessionSchema),
  total: z.number(),
  has_more: z.boolean(),
});

function toSessionSummary(
  session: z.infer<typeof gatewaySessionSchema>,
): CopilotSessionSummary {
  return {
    sessionId: session.session_id,
    title: session.title?.trim() || "New Chat",
    createdAt: session.created_at,
    lastModified: session.last_modified,
    messageCount: session.messages?.length ?? 0,
    executionMode: session.execution_mode === "execute" ? "execute" : "plan",
    activeJobId: session.active_job_id ?? null,
  };
}

/** Without messages: the gateway sends every message of every session on the page, and the list needs none. */
export async function readCopilotSessions(
  token: string,
  page: { limit: number; offset: number },
  signal?: AbortSignal,
): Promise<CopilotSessionsResponse> {
  const query = new URLSearchParams({
    limit: String(page.limit),
    offset: String(page.offset),
  });
  const answer = gatewaySessionsSchema.safeParse(
    await copilotGet(`/chatbrc/get-all-sessions?${query.toString()}`, token, signal),
  );
  if (!answer.success) throw unreadableAnswer();
  return {
    sessions: answer.data.sessions.map(toSessionSummary),
    total: answer.data.total,
    hasMore: answer.data.has_more,
  };
}

/** A 4xx with a reason of its own; routes answer `{error, code, copilotCode}` so the client can act on the code. */
export class CopilotRejectedError extends Error {
  readonly status: number;
  readonly copilotCode: string | null;

  constructor(message: string, status: number, copilotCode: string | null) {
    super(message);
    this.name = "CopilotRejectedError";
    this.status = status;
    this.copilotCode = copilotCode;
  }
}

/**
 * A 4xx with a JSON `message` keeps it (and its `code`) so it reaches the user as written; anything
 * else goes through `upstreamResponseError`.
 */
async function rejection(response: Response): Promise<Error> {
  if (response.status >= 400 && response.status < 500) {
    const body: unknown = await response
      .clone()
      .json()
      .catch(() => null);
    if (body && typeof body === "object") {
      const record = body as Record<string, unknown>;
      const message = [record.message, record.error].find(
        (value): value is string => typeof value === "string" && value.trim() !== "",
      );
      if (message) {
        return new CopilotRejectedError(
          message,
          response.status,
          typeof record.code === "string" ? record.code : null,
        );
      }
    }
  }
  return upstreamResponseError(response, service);
}

const gatewayIdPattern = /^[A-Za-z0-9_-]{1,100}$/;

export function isCopilotId(value: string): boolean {
  return gatewayIdPattern.test(value);
}

const hiddenUserText =
  /^(Execute plan step:|Execute approved plan:|Skip step and continue|Continue after review)/;

function readRating(value: unknown): CopilotMessage["rating"] {
  return value === -1 || value === 0 || value === 1 ? value : null;
}

export function toCopilotMessage(raw: unknown): CopilotMessage | null {
  if (!isRecord(raw)) return null;
  const role = raw.role;
  if (role !== "user" && role !== "assistant" && role !== "user_clarification") {
    return null;
  }
  const content = typeof raw.content === "string" ? raw.content : "";
  const id = text(raw.message_id);
  if (!id) return null;
  if (role === "user" && hiddenUserText.test(content)) return null;

  const metadata = isRecord(raw.agent_metadata) ? raw.agent_metadata : {};
  const card = readMessageCard(raw);
  if (role === "assistant" && content.trim() === "" && !card) return null;

  return {
    id,
    role: role === "assistant" ? "assistant" : "user",
    content,
    timestamp: text(raw.timestamp),
    model: text(raw.model),
    steps: role === "assistant" ? readCopilotSteps(metadata.steps) : [],
    card,
    rating: readRating(raw.rating),
    persisted: true,
    systemInitiated: metadata.system_initiated === true,
    isClarification: role === "user_clarification",
    clarificationAnswers: readClarificationAnswers(raw.clarificationAnswers),
    attachments: role === "assistant" ? [] : readAttachments(raw.attachments),
  };
}

/**
 * A plan answer carries the plan twice: `card.card_payload` as first written and `plan`, which the
 * gateway updates as steps run; the current one is shown.
 */
function readMessageCard(raw: Record<string, unknown>): CopilotCard | null {
  if (isRecord(raw.plan)) return { cardType: "plan", payload: raw.plan };
  return readCopilotCard(raw.card);
}

const attachmentTypes = new Set<CopilotAttachmentInfo["type"]>([
  "image",
  "file",
  "pdf",
  "execution",
]);

function readAttachments(raw: unknown): CopilotAttachmentInfo[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): CopilotAttachmentInfo[] => {
    if (!isRecord(entry)) return [];
    const type = entry.type as CopilotAttachmentInfo["type"];
    const name = text(entry.name);
    if (!attachmentTypes.has(type) || !name) return [];
    return [
      {
        type,
        name,
        size: typeof entry.size === "number" && entry.size > 0 ? entry.size : null,
      },
    ];
  });
}

function readClarificationAnswers(raw: unknown): CopilotClarificationAnswer[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const question = text(entry.question);
    const answer = text(entry.answer);
    return question && answer ? [{ question, answer }] : [];
  });
}

const gatewaySessionMessagesSchema = z.object({
  messages: z.array(z.unknown()),
  active_job_id: z.string().nullish(),
  execution_mode: z.string().nullish(),
});

export async function readCopilotSession(
  token: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<CopilotSessionDetail> {
  const query = new URLSearchParams({ session_id: sessionId });
  const response = await fetchUpstream(
    `${copilotBaseUrl()}/chatbrc/get-session-messages?${query.toString()}`,
    {
      method: "GET",
      headers: gatewayHeaders(token, { Accept: "application/json" }),
      signal,
    },
    { service, timeoutMs: upstreamTimeoutMs.copilot },
  );
  if (!response.ok) throw await rejection(response);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw unreadableAnswer();
  }
  const answer = gatewaySessionMessagesSchema.safeParse(body);
  if (!answer.success) throw unreadableAnswer();
  return {
    sessionId,
    messages: answer.data.messages
      .map(toCopilotMessage)
      .filter((message): message is CopilotMessage => message !== null),
    executionMode: answer.data.execution_mode === "execute" ? "execute" : "plan",
    activeJobId: answer.data.active_job_id ?? null,
  };
}

async function copilotAction(
  path: string,
  body: object,
  token: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetchUpstream(
    `${copilotBaseUrl()}${path}`,
    {
      method: "POST",
      headers: gatewayHeaders(token, {
        Accept: "application/json",
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(body),
      signal,
    },
    { service, timeoutMs: upstreamTimeoutMs.copilot },
  );
  if (!response.ok) throw await rejection(response);
  return response.json().catch(() => null);
}

export const maxCopilotTitleLength = 200;

export async function renameCopilotSession(
  token: string,
  sessionId: string,
  title: string,
): Promise<void> {
  await copilotAction(
    "/chatbrc/update-session-title",
    { session_id: sessionId, title },
    token,
  );
}

export async function deleteCopilotSession(
  token: string,
  sessionId: string,
): Promise<void> {
  await copilotAction("/chatbrc/delete-session", { session_id: sessionId }, token);
}

/** Null when the gateway declines (it answers "New Chat" for models it cannot reach for titles). */
export async function titleCopilotSession(
  token: string,
  sessionId: string,
  model: string,
  firstQuestion: string,
): Promise<string | null> {
  const answer = await copilotAction(
    "/chatbrc/generate-title-from-messages",
    { model, messages: [firstQuestion.slice(0, 2000)] },
    token,
  );
  const raw = isRecord(answer) ? text(answer.response) : null;
  const title = raw
    ?.trim()
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim()
    .slice(0, maxCopilotTitleLength);
  if (!title || title === "New Chat") return null;
  await renameCopilotSession(token, sessionId, title);
  return title;
}

/** Null when no turn holds the session. */
export async function stopCopilotSession(
  token: string,
  sessionId: string,
): Promise<{ jobId: string | null } | null> {
  try {
    const answer = await copilotAction(
      `/chatbrc/session/${encodeURIComponent(sessionId)}/stop`,
      {},
      token,
    );
    return { jobId: isRecord(answer) ? text(answer.job_id) : null };
  } catch (error) {
    if (error instanceof CopilotRejectedError && error.copilotCode === "NO_TURN") {
      return null;
    }
    throw error;
  }
}

export async function abortCopilotJob(token: string, jobId: string): Promise<void> {
  await copilotAction(
    `/chatbrc/job/${encodeURIComponent(jobId)}/abort`,
    { reason: "Stopped by user" },
    token,
  );
}

export async function setCopilotExecutionMode(
  token: string,
  sessionId: string,
  executionMode: CopilotExecutionMode,
): Promise<void> {
  await copilotAction(
    "/chatbrc/update-session-execution-mode",
    { session_id: sessionId, execution_mode: executionMode },
    token,
  );
}

/** Nothing runs and no model turn is spent; 409 (`REPLAY_*`) when the card is gone or already answered. */
export async function declineCopilotExecution(
  token: string,
  sessionId: string,
  actions: CopilotBlockedAction[],
): Promise<void> {
  await copilotAction(
    "/chatbrc/execution-question/answer",
    { session_id: sessionId, actions, answer: "no" },
    token,
  );
}

export const copilotPlanSchema = z
  .looseObject({
    plan_id: z.string().refine(isCopilotId),
    steps: z
      .array(
        z.looseObject({
          step_id: z.string().min(1).max(100),
          description: z.string().max(4000),
          agent: z.string().regex(/^[a-z_]{1,40}$/),
        }),
      )
      .min(1)
      .max(30),
  })
  .refine((plan) => JSON.stringify(plan).length <= 500_000);

/** The gateway keeps the step outputs it stored; the plan must belong to this session. */
export async function editCopilotPlan(
  token: string,
  sessionId: string,
  planId: string,
  plan: Record<string, unknown>,
): Promise<void> {
  await copilotAction(
    `/chatbrc/plan/${encodeURIComponent(planId)}/edit`,
    { session_id: sessionId, plan },
    token,
  );
}

const gatewayWatchesSchema = z.object({
  watches: z.array(
    z.object({
      submission_id: z.string().min(1),
      workflow_id: z.string().nullish(),
      status: z.string().nullish(),
    }),
  ),
});

export async function readCopilotWorkflowWatches(
  token: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<CopilotWorkflowWatch[]> {
  const answer = gatewayWatchesSchema.safeParse(
    await copilotGet(
      `/chatbrc/session/${encodeURIComponent(sessionId)}/workflow-watches`,
      token,
      signal,
    ),
  );
  if (!answer.success) throw unreadableAnswer();
  return answer.data.watches.map((watch) => ({
    submissionId: watch.submission_id,
    workflowId: watch.workflow_id ?? null,
    status: watch.status ?? "active",
  }));
}

export async function rateCopilotMessage(
  token: string,
  messageId: string,
  rating: -1 | 0 | 1,
): Promise<void> {
  await copilotAction(
    "/chatbrc/rate-message",
    { message_id: messageId, rating },
    token,
  );
}

export const maxCopilotQueryLength = 100_000;

/** Prepared actions go back verbatim; the gateway checks them against the card it stored. */
export const copilotActionsSchema = z
  .array(z.looseObject({ tool: z.string().min(1).max(100) }))
  .min(1)
  .max(50)
  .refine((actions) => JSON.stringify(actions).length <= 200_000);
export const maxCopilotPageContextLength = 2_000;

/**
 * Only these fields are sent; the user comes from the token. The gateway accepts "Yes"
 * (`execute_once` + `replay_actions`) or "Other" (`prepared_actions`) only when it matches a card
 * stored in this session.
 */
export function copilotTurnBody(turn: CopilotChatRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    query: turn.query,
    model: turn.model,
    session_id: turn.sessionId,
    system_prompt: turn.pageContext ?? "",
    save_chat: true,
    include_history: true,
    stream: true,
    execution_mode: turn.executionMode ?? "plan",
  };
  if (turn.targetAgent) body.target_agent = turn.targetAgent;
  if (turn.clarification) {
    body.workflow_context = {
      plan_action: "answer_questions",
      clarification_answers: turn.clarification.answers,
      clarification_summary: turn.clarification.answers
        .map(({ question, answer }) => `${question}: ${answer}`)
        .join("\n"),
      original_query: turn.clarification.originalQuery,
    };
  }
  if (turn.planStep) {
    // The gateway merges stored step results into completed_step_results, so none are sent.
    body.workflow_context = {
      plan: turn.planStep.plan,
      plan_action: "execute_next",
      current_step_index: turn.planStep.stepIndex,
      completed_step_results: {},
    };
  }
  if (turn.replayActions) {
    body.execute_once = true;
    body.replay_actions = turn.replayActions;
  } else if (turn.preparedActions) {
    body.prepared_actions = turn.preparedActions;
  }
  if (turn.images?.length) {
    body.images = turn.images.map((image) => image.dataUrl);
    body.image_attachments = turn.images.map((image) => ({
      type: "image",
      source: "upload",
      name: image.name,
    }));
  }
  if (turn.files?.length) {
    body.files = turn.files.map((file) => ({
      name: file.name,
      content: file.content,
      mime_type: file.mimeType,
      size: file.size,
    }));
  }
  if (turn.pdfs?.length) {
    body.pdfs = turn.pdfs.map((pdf) => ({
      name: pdf.name,
      content: pdf.dataUrl,
      mime_type: "application/pdf",
      size: pdf.size,
    }));
  }
  return body;
}

/** The budget covers only the wait for the headers. */
export async function openCopilotTurn(
  token: string,
  turn: CopilotChatRequest,
  signal: AbortSignal,
): Promise<Response> {
  const response = await fetchUpstream(
    `${copilotBaseUrl()}/chatbrc/copilot-agent`,
    {
      method: "POST",
      headers: gatewayHeaders(token, {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(copilotTurnBody(turn)),
      signal,
    },
    { service, timeoutMs: upstreamTimeoutMs.copilot, streamBody: true },
  );
  if (!response.ok) throw await rejection(response);
  if (
    /^(text\/(html|xml)|application\/(json|xml|xhtml\+xml))\b/i.test(
      response.headers.get("content-type") ?? "",
    )
  ) {
    // Not awaited: under MSW's interceptor the cancel never settles.
    void response.body?.cancel().catch(() => undefined);
    throw unreadableAnswer();
  }
  if (!response.body) throw unreadableAnswer();
  return response;
}
