"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  CopilotClientError,
  copilotQueryKeys,
  openCopilotChat,
  stopCopilotTurn,
  titleCopilotSession,
} from "@/lib/copilot/client";
import {
  copilotSessionDeliveries,
  reloadCopilotSession,
  useCopilotSessionDeliveries,
} from "@/hooks/copilot/use-copilot-queries";
import { readSseFrames } from "@/lib/copilot/sse";
import type {
  CopilotAttachmentInfo,
  CopilotChatRequest,
  CopilotClarificationAnswer,
} from "@/lib/copilot/types";
import {
  decodeCopilotEvent,
  isCopilotTurnActive,
  reduceCopilotTurn,
  startCopilotTurn,
  type CopilotTurn,
} from "@/lib/copilot/turn";
import { copilotName } from "@/lib/copilot/name";

export interface CopilotActiveTurn {
  sessionId: string;
  turn: CopilotTurn;
  /** Stored messages when the turn was sent; the transcript shows only those plus the live turn. */
  baseCount: number;
  clarificationAnswers: CopilotClarificationAnswer[] | null;
  hidden: boolean;
  attachments: CopilotAttachmentInfo[];
  /** Set when kept after a failed reload; a later fetch that delivers the session replaces the turn, `setQueryData` does not. */
  keptAtDelivery?: number;
}

export interface CopilotChatError {
  sessionId: string;
  /** `reload`: the turn ended but the stored session could not be read back. */
  kind: "turn" | "reload";
  message: string;
  query: string | null;
}

export interface CopilotSendOptions
  extends Pick<
    CopilotChatRequest,
    | "executionMode"
    | "targetAgent"
    | "clarification"
    | "replayActions"
    | "preparedActions"
    | "planStep"
    | "images"
    | "files"
    | "pdfs"
  > {
  sessionId: string;
  query: string;
  model: string;
  pageContext: string;
  storedCount: number;
  hidden?: boolean;
}

export type CopilotSendResult =
  /** `reloadError` is null once the stored session was read back, else that read's message. */
  | {
      status: "sent";
      ended: CopilotTurn["status"];
      turn: CopilotTurn;
      reloadError: string | null;
    }
  | { status: "busy" }
  | { status: "refused"; message: string };

const stopSettleMs = 1500;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CopilotRun {
  turnId: string;
  sessionId: string;
  controller: AbortController;
  stopping: Promise<void> | null;
  abandoned: boolean;
}

interface CopilotRunDeps {
  queryClient: QueryClient;
  onFrame: (turn: CopilotTurn) => boolean;
  refuse: (message: string) => void;
  finish: (turn: CopilotTurn, reloadError: string | null) => void;
}

function openFailureMessage(cause: unknown): string {
  if (cause instanceof CopilotClientError) return cause.message;
  return cause instanceof Error
    ? `Could not reach ${copilotName}: ${cause.message}`
    : `Could not reach ${copilotName}.`;
}

/** Module scope: the React Compiler skips `try` and `for await`. */
async function runCopilotTurn(
  run: CopilotRun,
  request: CopilotChatRequest,
  startedTurn: CopilotTurn,
  deps: CopilotRunDeps,
): Promise<CopilotSendResult> {
  let turn = startedTurn;
  // A call, so a check after an `await` is not narrowed.
  const isAbandoned = () => run.abandoned;
  const abandoned = (): CopilotSendResult => ({
    status: "sent",
    ended: "stopped",
    turn: reduceCopilotTurn(turn, { type: "cancelled" }),
    reloadError: null,
  });

  let body: ReadableStream<Uint8Array> | null = null;
  try {
    body = await openCopilotChat(request, run.controller.signal);
  } catch (cause) {
    if (isAbandoned()) return abandoned();
    if (!run.stopping && !run.controller.signal.aborted) {
      const message = openFailureMessage(cause);
      deps.refuse(message);
      return { status: "refused", message };
    }
  }

  if (body) {
    let noteCount = 0;
    const noteId = () => `note-${String((noteCount += 1))}`;
    try {
      for await (const frame of readSseFrames(body, run.controller.signal)) {
        const event = decodeCopilotEvent(frame, noteId);
        if (!event) continue;
        const next = reduceCopilotTurn(turn, event);
        if (!deps.onFrame(next)) break;
        turn = next;
        if (!isCopilotTurnActive(turn)) break;
      }
    } catch {
      // The gateway saves the turn either way; the session poll picks it up.
    }
  }

  // Stop can arrive while the session is read back; read again after it.
  let awaited: Promise<void> | null = null;
  let reloadError: string | null = null;
  do {
    if (run.stopping) {
      awaited = run.stopping;
      if (isAbandoned()) return abandoned();
      await awaited;
      if (isAbandoned()) return abandoned();
      await wait(stopSettleMs);
    }
    if (isAbandoned()) return abandoned();
    reloadError = await reloadCopilotSession(deps.queryClient, run.sessionId);
    if (isAbandoned()) return abandoned();
  } while (run.stopping !== awaited);

  if (run.stopping) turn = reduceCopilotTurn(turn, { type: "cancelled" });
  deps.finish(turn, reloadError);
  return {
    status: "sent",
    ended: run.stopping ? "stopped" : turn.status,
    turn,
    reloadError,
  };
}

/** Sends questions and streams answers, one turn at a time per tab. */
export function useCopilotChat(account: string | null) {
  const queryClient = useQueryClient();
  const [active, setActive] = useState<CopilotActiveTurn | null>(null);
  const [error, setError] = useState<CopilotChatError | null>(null);
  const [stopping, setStopping] = useState(false);

  const turnRef = useRef<CopilotActiveTurn | null>(null);
  const runRef = useRef<CopilotRun | null>(null);
  const frameRef = useRef<number | null>(null);
  const [pausedPlans, setPausedPlans] = useState<ReadonlySet<string>>(new Set());
  const pausedRef = useRef<ReadonlySet<string>>(pausedPlans);

  function setPlanPaused(planId: string, paused: boolean) {
    const next = new Set(pausedRef.current);
    if (paused) next.add(planId);
    else next.delete(planId);
    pausedRef.current = next;
    setPausedPlans(next);
  }

  useEffect(
    () =>
      function abandonRun() {
        const run = runRef.current;
        if (run) {
          run.abandoned = true;
          run.controller.abort();
          runRef.current = null;
        }
        turnRef.current = null;
        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
        setActive(null);
        setError(null);
        setStopping(false);
        pausedRef.current = new Set();
        setPausedPlans(pausedRef.current);
      },
    [account],
  );

  function commit(next: CopilotActiveTurn | null) {
    turnRef.current = next;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setActive(next);
  }

  function commitSoon(next: CopilotActiveTurn) {
    turnRef.current = next;
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        setActive(turnRef.current);
      });
    }
  }

  async function send(options: CopilotSendOptions): Promise<CopilotSendResult> {
    if (runRef.current !== null) return { status: "busy" };
    setError(null);

    const { storedCount, hidden = false, ...request } = options;
    const { sessionId, query, model } = request;
    const isFirstTurn = storedCount === 0;
    const retryable =
      !hidden &&
      !request.clarification &&
      !request.planStep &&
      !request.replayActions &&
      !request.preparedActions &&
      !request.images?.length &&
      !request.files?.length &&
      !request.pdfs?.length;
    const turn = startCopilotTurn(crypto.randomUUID(), query);
    const run: CopilotRun = {
      turnId: turn.id,
      sessionId,
      controller: new AbortController(),
      stopping: null,
      abandoned: false,
    };
    runRef.current = run;
    commit({
      sessionId,
      turn,
      baseCount: storedCount,
      clarificationAnswers: request.clarification?.answers ?? null,
      hidden,
      attachments: [
        ...(request.images ?? []).map((image) => ({
          type: "image" as const,
          name: image.name,
          size: null,
        })),
        ...(request.files ?? []).map((file) => ({
          type: "file" as const,
          name: file.name,
          size: file.size,
        })),
        ...(request.pdfs ?? []).map((pdf) => ({
          type: "pdf" as const,
          name: pdf.name,
          size: pdf.size,
        })),
      ],
    });

    return runCopilotTurn(run, request, turn, {
      queryClient,
      onFrame: (next) => {
        const latest = turnRef.current;
        if (latest?.turn.id !== run.turnId || !isCopilotTurnActive(latest.turn)) {
          return false;
        }
        const updated = { ...latest, turn: next };
        if (isCopilotTurnActive(next)) commitSoon(updated);
        else commit(updated);
        return true;
      },
      refuse: (message) => {
        if (runRef.current !== run) return;
        runRef.current = null;
        commit(null);
        setError({ sessionId, kind: "turn", message, query: null });
      },
      finish: (ended, reloadError) => {
        if (runRef.current !== run) return;
        runRef.current = null;
        setStopping(false);
        void queryClient.invalidateQueries({ queryKey: copilotQueryKeys.sessions() });
        void queryClient.invalidateQueries({
          queryKey: copilotQueryKeys.workflowWatches(sessionId),
        });
        if (ended.status === "error") {
          setError({
            sessionId,
            kind: "turn",
            message: ended.error ?? `${copilotName} stopped with an error.`,
            query: retryable ? ended.query : null,
          });
        } else if (reloadError !== null) {
          setError({ sessionId, kind: "reload", message: reloadError, query: null });
        }
        // Only one error shows: when an errored turn's reload also failed, the `turn` error wins.
        const latest = turnRef.current;
        if (latest?.turn.id === ended.id) {
          if (reloadError === null) {
            commit(null);
          } else {
            commit({
              ...latest,
              // The stream dropped mid-turn: it must not hold Send, Stop or the poll.
              turn: isCopilotTurnActive(latest.turn)
                ? { ...latest.turn, status: "disconnected" }
                : latest.turn,
              keptAtDelivery: copilotSessionDeliveries(queryClient, sessionId),
            });
          }
        }

        if (isFirstTurn && ended.status === "done") {
          titleCopilotSession(sessionId, model, ended.query)
            .then((title) => {
              if (title) {
                void queryClient.invalidateQueries({ queryKey: copilotQueryKeys.sessions() });
              }
            })
            .catch(() => undefined);
        }
      },
    });
  }

  function stop(): Promise<void> {
    const run = runRef.current;
    const running = turnRef.current;
    if (
      !run ||
      run.stopping ||
      running?.turn.id !== run.turnId ||
      !isCopilotTurnActive(running.turn)
    ) {
      return Promise.resolve();
    }
    commit({
      ...running,
      turn: reduceCopilotTurn(running.turn, { type: "cancelled" }),
    });
    setStopping(true);
    run.stopping = stopCopilotTurn(run.sessionId, running.turn.jobId)
      .catch((cause: unknown) => {
        if (run.abandoned) return;
        setError({
          sessionId: run.sessionId,
          kind: "turn",
          message:
            cause instanceof Error
              ? `Stop did not reach ${copilotName}: ${cause.message}`
              : `Stop did not reach ${copilotName}.`,
          query: null,
        });
      })
      .then(() => {
        run.controller.abort();
      });
    return run.stopping;
  }

  async function reload(sessionId: string): Promise<void> {
    const reloadError = await reloadCopilotSession(queryClient, sessionId);
    if (reloadError === null) {
      const latest = turnRef.current;
      if (latest?.sessionId === sessionId && runRef.current?.turnId !== latest.turn.id) {
        commit(null);
      }
      setError((current) =>
        current?.kind === "reload" && current.sessionId === sessionId ? null : current,
      );
    } else {
      setError((current) =>
        current === null || (current.kind === "reload" && current.sessionId === sessionId)
          ? { sessionId, kind: "reload", message: reloadError, query: null }
          : current,
      );
    }
  }

  // Derived from the delivery count; an optimistic `setQueryData` does not count.
  const kept = active?.keptAtDelivery === undefined ? null : active;
  const deliveries = useCopilotSessionDeliveries(kept?.sessionId ?? null);
  const superseded =
    kept?.keptAtDelivery !== undefined && deliveries > kept.keptAtDelivery;
  const hiddenError =
    superseded && error?.kind === "reload" && error.sessionId === kept.sessionId;
  if (superseded) {
    // Adjust state during render so a hidden error cannot block `reload()` for another session.
    setActive(null);
    if (hiddenError) setError(null);
  }

  return {
    active: superseded ? null : active,
    error: hiddenError ? null : error,
    stopping,
    dismissError: () => {
      setError(null);
    },
    send,
    stop,
    reload,
    pausedPlans,
    pausePlan: (planId: string) => {
      setPlanPaused(planId, true);
    },
    resumePlan: (planId: string) => {
      setPlanPaused(planId, false);
    },
    isPlanPaused: (planId: string) => pausedRef.current.has(planId),
  };
}

export type CopilotChat = ReturnType<typeof useCopilotChat>;
