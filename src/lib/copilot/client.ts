/**
 * Browser side of `/api/copilot/*`, kept apart from `./server.ts` so no zod
 * schema or gateway URL reaches a client bundle. Answers are cached by
 * TanStack Query only, so `queryClient.clear()` on an account change covers
 * them: there is no module-level cache to register with `account-caches`.
 */
import type {
  CopilotBlockedAction,
  CopilotChatRequest,
  CopilotExecutionMode,
  CopilotModel,
  CopilotSessionDetail,
  CopilotSessionsResponse,
  CopilotWorkflowWatch,
  CopilotWorkflowWatchesResponse,
} from "./types";

export const copilotQueryKeys = {
  all: ["copilot"] as const,
  models: () => [...copilotQueryKeys.all, "models"] as const,
  sessions: () => [...copilotQueryKeys.all, "sessions"] as const,
  session: (sessionId: string) =>
    [...copilotQueryKeys.all, "session", sessionId] as const,
  workflowWatches: (sessionId: string) =>
    [...copilotQueryKeys.all, "workflow-watches", sessionId] as const,
};

/**
 * A failed `/api/copilot/*` call. The message is the route's `error`, used
 * verbatim; `status` lets the app-wide retry policy skip an outage, and
 * `copilotCode` is the gateway's own code (`TURN_IN_FLIGHT`, …).
 */
export class CopilotClientError extends Error {
  readonly status: number;
  readonly copilotCode: string | null;

  constructor(message: string, status: number, copilotCode: string | null) {
    super(message);
    this.name = "CopilotClientError";
    this.status = status;
    this.copilotCode = copilotCode;
  }
}

export async function copilotFailure(
  response: Response,
): Promise<CopilotClientError> {
  const payload: unknown = await response.json().catch(() => null);
  const record =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const message =
    typeof record.error === "string" && record.error.trim() !== ""
      ? record.error
      : `Copilot request failed (${String(response.status)} ${response.statusText})`;
  return new CopilotClientError(
    message,
    response.status,
    typeof record.copilotCode === "string" ? record.copilotCode : null,
  );
}

/** The session is not this user's to open (archived, or another account's). */
export function isCopilotSessionGone(error: unknown): boolean {
  return (
    error instanceof CopilotClientError &&
    (error.copilotCode === "SESSION_ARCHIVED" || error.status === 403)
  );
}

function sessionPath(sessionId: string): string {
  return `/api/copilot/sessions/${encodeURIComponent(sessionId)}`;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { credentials: "include", signal });
  if (!response.ok) throw await copilotFailure(response);
  return (await response.json()) as T;
}

async function send(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: object,
): Promise<Response> {
  const response = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw await copilotFailure(response);
  return response;
}

export async function fetchCopilotModels(
  signal?: AbortSignal,
): Promise<CopilotModel[]> {
  return (await getJson<{ models: CopilotModel[] }>("/api/copilot/models", signal))
    .models;
}

export function fetchCopilotSessions(
  page: { limit: number; offset: number },
  signal?: AbortSignal,
): Promise<CopilotSessionsResponse> {
  return getJson(
    `/api/copilot/sessions?limit=${String(page.limit)}&offset=${String(page.offset)}`,
    signal,
  );
}

export function fetchCopilotSession(
  sessionId: string,
  signal?: AbortSignal,
): Promise<CopilotSessionDetail> {
  return getJson(sessionPath(sessionId), signal);
}

export async function renameCopilotSession(
  sessionId: string,
  title: string,
): Promise<void> {
  await send(sessionPath(sessionId), "PATCH", { title });
}

export async function setCopilotExecutionMode(
  sessionId: string,
  executionMode: CopilotExecutionMode,
): Promise<void> {
  await send(sessionPath(sessionId), "PATCH", { executionMode });
}

/** "No" on an execution card: nothing runs; the card records the answer. */
export async function declineCopilotExecution(
  sessionId: string,
  actions: CopilotBlockedAction[],
): Promise<void> {
  await send(`${sessionPath(sessionId)}/execution-answer`, "POST", { actions });
}

/** Saves a plan: its edited steps, or its status as it runs. */
export async function saveCopilotPlan(
  sessionId: string,
  planId: string,
  plan: Record<string, unknown>,
): Promise<void> {
  await send(
    `${sessionPath(sessionId)}/plans/${encodeURIComponent(planId)}`,
    "PUT",
    { plan },
  );
}

export async function fetchCopilotWorkflowWatches(
  sessionId: string,
  signal?: AbortSignal,
): Promise<CopilotWorkflowWatch[]> {
  return (
    await getJson<CopilotWorkflowWatchesResponse>(
      `${sessionPath(sessionId)}/workflow-watches`,
      signal,
    )
  ).watches;
}

export async function deleteCopilotSession(sessionId: string): Promise<void> {
  await send(sessionPath(sessionId), "DELETE");
}

export async function titleCopilotSession(
  sessionId: string,
  model: string,
  question: string,
): Promise<string | null> {
  const response = await send(`${sessionPath(sessionId)}/title`, "POST", {
    model,
    question,
  });
  return ((await response.json()) as { title: string | null }).title;
}

export async function rateCopilotMessage(
  messageId: string,
  rating: -1 | 0 | 1,
): Promise<void> {
  await send(
    `/api/copilot/messages/${encodeURIComponent(messageId)}/rating`,
    "POST",
    { rating },
  );
}

/**
 * Stops a running turn: by its job id once the stream named it, otherwise by
 * session. A session stop that finds no turn yet (the request may still be on
 * its way to the gateway) is tried once more after a second.
 */
export async function stopCopilotTurn(
  sessionId: string,
  jobId: string | null,
  wait: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<void> {
  if (jobId) {
    await send(`/api/copilot/jobs/${encodeURIComponent(jobId)}/abort`, "POST");
    return;
  }
  try {
    await send(`${sessionPath(sessionId)}/stop`, "POST");
  } catch (error) {
    if (!(error instanceof CopilotClientError) || error.copilotCode !== "NO_TURN") {
      throw error;
    }
    await wait(1000);
    await send(`${sessionPath(sessionId)}/stop`, "POST").catch(
      (retryError: unknown) => {
        // Still nothing running: the turn already ended.
        if (
          !(retryError instanceof CopilotClientError) ||
          retryError.copilotCode !== "NO_TURN"
        ) {
          throw retryError;
        }
      },
    );
  }
}

/** Opens a chat turn and returns its event stream. */
export async function openCopilotChat(
  request: CopilotChatRequest,
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch("/api/copilot/chat", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) throw await copilotFailure(response);
  if (!response.body) {
    throw new CopilotClientError(
      "The Copilot answer arrived without a body.",
      502,
      null,
    );
  }
  return response.body;
}
