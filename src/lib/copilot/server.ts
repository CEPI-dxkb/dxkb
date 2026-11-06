import "server-only";

/**
 * Server side of `/api/copilot/*`: calls to the BV-BRC Copilot gateway
 * (`BV-BRC-Copilot-API`) with the caller's session token, mapped to the
 * browser-safe shapes in `./types`.
 *
 * The browser never calls the gateway itself: the BV-BRC token lives in an
 * HttpOnly cookie, and the gateway takes it as a bare `Authorization` header
 * (no `Bearer`), which is also how it learns the user — so no `user_id` is
 * sent. Network failures and spent budgets throw `UpstreamError`.
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

/**
 * `COPILOT_API_URL` is not set. Its message names the variable, for the
 * server log only: routes show `userMessage` instead.
 */
export class CopilotConfigurationError extends Error {
  readonly userMessage =
    `${copilotName} is unavailable right now: it is not configured on this server.`;

  constructor() {
    super("Copilot needs COPILOT_API_URL, which is not set.");
    this.name = "CopilotConfigurationError";
  }
}

/**
 * Headers for every gateway call: the caller's bare token, and the user agent
 * that gets the request past Cloudflare in front of the gateway (Node's
 * default draws a "Just a moment..." challenge, HTTP 403).
 */
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

/** The gateway's base (`…/copilot-api`), without a trailing slash. */
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

// ---------------------------------------------------------------------------
// Models

const gatewayModelSchema = z.object({
  model: z.string().min(1),
  model_type: z.string().nullish(),
  active: z.boolean().nullish(),
  priority: z.number().nullish(),
  max_tokens: z.number().nullish(),
  supports_image: z.boolean().nullish(),
  is_default: z.boolean().nullish(),
});

/** `models` is a JSON string holding the array, not the array itself. */
const gatewayModelListSchema = z.object({ models: z.string() });

/**
 * Active chat models, in the gateway's order. An entry the gateway marks
 * `active: false` is dropped; one that leaves `active` out is kept, as the
 * BV-BRC Copilot UI keeps it. A model the gateway lists more than once is kept
 * once, at its first entry: turns name the model only by its name, so a
 * second entry is not a second choice (and would repeat a React key).
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

// ---------------------------------------------------------------------------
// Sessions

/** The gateway caps a page at 100 sessions. */
export const maxCopilotSessionPage = 100;
export const defaultCopilotSessionPage = 20;

/**
 * Mongo `Date`s arrive as ISO strings. Anything else (an old document's odd
 * field) is read as unknown rather than failing the whole page.
 */
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

/**
 * One page of the caller's sessions, newest first, without their messages
 * (the gateway sends every message of every session on the page; the session
 * list needs none of them).
 */
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

// ---------------------------------------------------------------------------
// Rejections the client acts on

/**
 * The gateway refused a request with a 4xx and a reason of its own (a turn
 * already running, an archived session). Routes answer it as `{error, code,
 * copilotCode}` with the gateway's status, so the client can act on the code.
 */
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
 * A non-OK gateway answer as an error: a 4xx with a JSON `message` keeps it
 * (and its `code`), so "That prepared job is no longer in this chat" reaches
 * the user as written; anything else is described by `upstreamResponseError`.
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

// ---------------------------------------------------------------------------
// Session messages

/** Gateway ids are UUIDs; anything else is refused before a call is made. */
const gatewayIdPattern = /^[A-Za-z0-9_-]{1,100}$/;

export function isCopilotId(value: string): boolean {
  return gatewayIdPattern.test(value);
}

/** Auto-generated plan actions the BV-BRC UI hides (`ChatMessage.js`). */
const hiddenUserText =
  /^(Execute plan step:|Execute approved plan:|Skip step and continue|Continue after review)/;

function readRating(value: unknown): CopilotMessage["rating"] {
  return value === -1 || value === 0 || value === 1 ? value : null;
}

/**
 * A stored message as the transcript shows it, or null for one it does not
 * show: other roles, hidden plan actions, and empty answers without a card.
 */
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
 * A message's card. A plan answer carries the plan twice: `card.card_payload`
 * as first written, and `plan`, which the gateway updates as steps run (and
 * `/plan/:id/edit` replaces). The current one is shown.
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

// ---------------------------------------------------------------------------
// Session and message actions

/** POST that only needs to succeed; its body is returned unparsed. */
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

/** Archives the session (the gateway's delete is a soft delete). */
export async function deleteCopilotSession(
  token: string,
  sessionId: string,
): Promise<void> {
  await copilotAction("/chatbrc/delete-session", { session_id: sessionId }, token);
}

/**
 * Asks the model for a title from the first question, saves it, and returns
 * it. Null when the gateway declines (it answers "New Chat" for models it
 * cannot reach for titles); the session keeps its title then.
 */
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

/**
 * Stops the turn running in a session (Stop before `started`, when the job
 * id is not known yet). Null when no turn holds the session.
 */
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

/** Stops a running turn by its job id (from the `started` event). */
export async function abortCopilotJob(token: string, jobId: string): Promise<void> {
  await copilotAction(
    `/chatbrc/job/${encodeURIComponent(jobId)}/abort`,
    { reason: "Stopped by user" },
    token,
  );
}

/** Saves the session's Plan/Execute mode. */
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

/**
 * "No" on an execution card: records the answer on the stored card. Nothing
 * runs and no model turn is spent. The actions identify the card, as for a
 * replay; 409 (`REPLAY_*`) when it is gone or already answered.
 */
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

/**
 * A plan as the client sends it back: the stored plan object, bounded. Its
 * steps go to the planning agent as written.
 */
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

/**
 * Saves an edited plan (its steps, or its status as it runs). The gateway
 * keeps the step outputs it stored; the plan must belong to this session.
 */
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

/** The jobs the gateway watches for a chat, newest first. */
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

// ---------------------------------------------------------------------------
// Chat turn

/** Longest question accepted; the gateway forwards it to the model whole. */
export const maxCopilotQueryLength = 100_000;

/**
 * Prepared actions go back to the gateway verbatim, which checks them against
 * the card it stored; here they are only bounded.
 */
export const copilotActionsSchema = z
  .array(z.looseObject({ tool: z.string().min(1).max(100) }))
  .min(1)
  .max(50)
  .refine((actions) => JSON.stringify(actions).length <= 200_000);
export const maxCopilotPageContextLength = 2_000;

/**
 * The gateway's `/copilot-agent` body for a turn. Only these fields are sent;
 * the user comes from the token.
 *
 * - Answers to a clarification card go back to the agent that asked
 *   (`targetAgent`) as `workflow_context.plan_action: "answer_questions"`,
 *   which the gateway saves as a `user_clarification` message.
 * - "Yes" on an execution card replays its actions once (`execute_once` +
 *   `replay_actions`); "Other" revises them (`prepared_actions`). The gateway
 *   accepts either only when it matches a card stored in this session.
 * - A plan step runs as `workflow_context.plan_action: "execute_next"`, one
 *   step per turn; the client moves on to the next step.
 * - Attachments go as the gateway's `images` (+ `image_attachments` names),
 *   `files` and `pdfs`; it caps them at 3 and checks sizes and content too.
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
    // The gateway merges the step results it stored into
    // completed_step_results, so none are sent from here.
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

/**
 * Opens a chat turn and returns the gateway's `text/event-stream` response for
 * the route to pass through. The budget covers only the wait for its headers.
 */
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
  // A proxy's HTML page or a JSON error with a 200 is not a stream to relay.
  if (
    /^(text\/(html|xml)|application\/(json|xml|xhtml\+xml))\b/i.test(
      response.headers.get("content-type") ?? "",
    )
  ) {
    // Not awaited: the answer does not depend on the stream closing, and
    // under MSW's interceptor the cancel never settles.
    void response.body?.cancel().catch(() => undefined);
    throw unreadableAnswer();
  }
  if (!response.body) throw unreadableAnswer();
  return response;
}
