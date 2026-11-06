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

/** The turn this tab is streaming, and where it belongs. */
export interface CopilotActiveTurn {
  sessionId: string;
  turn: CopilotTurn;
  /**
   * Stored messages the session had when the turn was sent. The transcript
   * shows only those plus the live turn, so the saved copy of the question
   * (stored as soon as the gateway gets it) is not shown twice.
   */
  baseCount: number;
  /** Answers to a clarification card, shown in place of the question text. */
  clarificationAnswers: CopilotClarificationAnswer[] | null;
  /** A plan step: its question is not shown (the plan card shows the step). */
  hidden: boolean;
  /** What the question carries, shown on it. */
  attachments: CopilotAttachmentInfo[];
  /**
   * Set when the turn is kept after its reload failed: the session's
   * delivery count then (`copilotSessionDeliveries`). A later fetch that
   * delivers the session (the poll, a refetch, Reload) replaces the turn;
   * `setQueryData` (an optimistic rating or card answer) does not.
   */
  keptAtDelivery?: number;
}

export interface CopilotChatError {
  sessionId: string;
  /**
   * `turn`: the turn failed (or Stop did not reach the gateway). `reload`:
   * the turn ended, but the stored session could not be read back, so the
   * live copy stays on screen until `reload` succeeds.
   */
  kind: "turn" | "reload";
  message: string;
  /** Retry text: set only for a plain visible question (see `retryable`). */
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
  /** Messages the session has stored now (0 for a new chat). */
  storedCount: number;
  /** Do not show the question (a plan step). */
  hidden?: boolean;
}

export type CopilotSendResult =
  /**
   * It ran; `ended` is how (`done`, `stopped`, `error`, or still running if
   * the stream dropped), and `turn` what the stream reported. (A dropped
   * turn whose reload failed is shown as `disconnected`; `ended` stays what
   * the stream reported.) `reloadError`
   * is `null` once the stored session was read back after the turn, else
   * that read's own message (the cache still holds the session from before).
   */
  | {
      status: "sent";
      ended: CopilotTurn["status"];
      turn: CopilotTurn;
      reloadError: string | null;
    }
  /** Another turn (or a stopped one still settling) holds this tab. */
  | { status: "busy" }
  /** Refused before it started: the composer gets the text back. */
  | { status: "refused"; message: string };

/** How long after Stop the gateway is given to save the partial answer. */
const stopSettleMs = 1500;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One turn this tab sends. It owns its controller, which only its own Stop
 * (or an account change) aborts, and it settles exactly once.
 */
interface CopilotRun {
  turnId: string;
  sessionId: string;
  controller: AbortController;
  /** Set by Stop: the stop request, then the abort of this run's stream. */
  stopping: Promise<void> | null;
  /** The account changed (or the hook unmounted): nothing more is shown. */
  abandoned: boolean;
}

interface CopilotRunDeps {
  queryClient: QueryClient;
  /** Shows a frame's turn; false once the run's turn is no longer the live, active one. */
  onFrame: (turn: CopilotTurn) => boolean;
  /** The turn could not be opened, and not because of Stop. */
  refuse: (message: string) => void;
  /** The run ended and the session was read back (or could not be). */
  finish: (turn: CopilotTurn, reloadError: string | null) => void;
}

function openFailureMessage(cause: unknown): string {
  if (cause instanceof CopilotClientError) return cause.message;
  return cause instanceof Error
    ? `Could not reach ${copilotName}: ${cause.message}`
    : `Could not reach ${copilotName}.`;
}

/**
 * A turn from open to settle: open the stream, show its frames, then, after
 * Stop's request and the save wait when the user stopped it, read the stored
 * session back once. Module scope because the React Compiler compiles only
 * components and hooks, and this needs `try` and `for await`.
 */
async function runCopilotTurn(
  run: CopilotRun,
  request: CopilotChatRequest,
  startedTurn: CopilotTurn,
  deps: CopilotRunDeps,
): Promise<CopilotSendResult> {
  let turn = startedTurn;
  // A call, so a check after an `await` is not narrowed to an earlier one.
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
    // Stop ended it while it opened: settle like any stopped turn.
  }

  if (body) {
    let noteCount = 0;
    const noteId = () => `note-${String((noteCount += 1))}`;
    try {
      for await (const frame of readSseFrames(body, run.controller.signal)) {
        const event = decodeCopilotEvent(frame, noteId);
        if (!event) continue;
        const next = reduceCopilotTurn(turn, event);
        // Stop already ended this turn; later frames change nothing.
        if (!deps.onFrame(next)) break;
        turn = next;
        if (!isCopilotTurnActive(turn)) break;
      }
    } catch {
      // The connection dropped (or Stop aborted it). The gateway finishes and
      // saves the turn either way; the session poll picks the answer up.
    }
  }

  // Stop can also arrive while the session is read back (the stream dropped
  // with the turn still running); then it is read again after that stop.
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

/**
 * Sends questions and streams the answers. One turn at a time per tab: the
 * gateway refuses a second turn in the same session anyway (409
 * `TURN_IN_FLIGHT`). The turn keeps streaming when the user switches session
 * or surface; it is shown again when they come back.
 */
export function useCopilotChat(account: string | null) {
  const queryClient = useQueryClient();
  const [active, setActive] = useState<CopilotActiveTurn | null>(null);
  const [error, setError] = useState<CopilotChatError | null>(null);
  // Stop was sent and the stopped turn has not settled yet.
  const [stopping, setStopping] = useState(false);

  // The latest turn, ahead of `active` between animation frames.
  const turnRef = useRef<CopilotActiveTurn | null>(null);
  const runRef = useRef<CopilotRun | null>(null);
  const frameRef = useRef<number | null>(null);
  // Plans the user paused; a running plan stops before its next step.
  const [pausedPlans, setPausedPlans] = useState<ReadonlySet<string>>(new Set());
  const pausedRef = useRef<ReadonlySet<string>>(pausedPlans);

  function setPlanPaused(planId: string, paused: boolean) {
    const next = new Set(pausedRef.current);
    if (paused) next.add(planId);
    else next.delete(planId);
    pausedRef.current = next;
    setPausedPlans(next);
  }

  // A turn belongs to the account that sent it. On a change of account (or
  // unmount) the run is dropped: its stream closes, and it shows, reloads
  // and titles nothing.
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

  // Answer text can arrive in hundreds of small chunks; render once a frame.
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
    // Retry resends only the text, so only a plain visible question offers it.
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
        // The turn may have submitted jobs the gateway now watches.
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
        // Without the stored copy the live turn stays, so the question and
        // answer do not vanish. Only one error shows: when an errored turn's
        // reload also failed, the live turn stays with its `turn` error (and
        // Retry), and the reload failure is only in the returned
        // `reloadError`.
        const latest = turnRef.current;
        if (latest?.turn.id === ended.id) {
          if (reloadError === null) {
            commit(null);
          } else {
            commit({
              ...latest,
              // The stream dropped mid-turn: no run follows it any more, so it
              // must not hold Send, Stop or the session poll.
              turn: isCopilotTurnActive(latest.turn)
                ? { ...latest.turn, status: "disconnected" }
                : latest.turn,
              keptAtDelivery: copilotSessionDeliveries(queryClient, sessionId),
            });
          }
        }

        if (isFirstTurn && ended.status === "done") {
          // Best effort: a chat without a generated title keeps "New Chat".
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

  /**
   * Stops the running turn. The gateway saves what was written so far with
   * "Stopped." appended; the run reads the stored session back after the
   * stop request and a short wait, and `send` stays busy until then. The
   * promise is the stop request (and the stream's abort after it).
   */
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

  /**
   * Reads a session back after a failed reload. On success the stored
   * session replaces a live turn left in it, unless a run still owns that
   * turn (it settles the turn itself).
   */
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
      // A turn error (with its Retry) or another session's error stays.
      setError((current) =>
        current === null || (current.kind === "reload" && current.sessionId === sessionId)
          ? { sessionId, kind: "reload", message: reloadError, query: null }
          : current,
      );
    }
  }

  // A turn kept after a failed reload gives way to any later fetch that
  // delivers its session (the poll, a refetch on focus), as after Reload,
  // and so does that session's reload error. Derived from the delivery
  // count; an optimistic `setQueryData` does not count.
  const kept = active?.keptAtDelivery === undefined ? null : active;
  const deliveries = useCopilotSessionDeliveries(kept?.sessionId ?? null);
  const superseded =
    kept?.keptAtDelivery !== undefined && deliveries > kept.keptAtDelivery;
  const hiddenError =
    superseded && error?.kind === "reload" && error.sessionId === kept.sessionId;
  if (superseded) {
    // Drop what the saved conversation replaced (state adjusted during
    // render), so a hidden error cannot block `reload()` for another session.
    // `turnRef` may still hold the turn until the next commit; nothing reads
    // it for a turn no run owns except `reload`, which drops it too.
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
