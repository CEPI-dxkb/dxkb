"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  CopilotClientError,
  copilotQueryKeys,
  openCopilotChat,
  stopCopilotTurn,
  titleCopilotSession,
} from "@/lib/copilot/client";
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
}

export interface CopilotChatError {
  sessionId: string;
  message: string;
  /** The question to send again from Retry, when it was sent at all. */
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
   * the stream dropped), and `turn` what the stream reported.
   */
  | { status: "sent"; ended: CopilotTurn["status"]; turn: CopilotTurn }
  | { status: "busy" }
  /** Refused before it started: the composer gets the text back. */
  | { status: "refused"; message: string };

/** How long after Stop the gateway is given to save the partial answer. */
const stopSettleMs = 1500;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends questions and streams the answers. One turn at a time per tab: the
 * gateway refuses a second turn in the same session anyway (409
 * `TURN_IN_FLIGHT`). The turn keeps streaming when the user switches session
 * or surface; it is shown again when they come back.
 */
export function useCopilotChat() {
  const queryClient = useQueryClient();
  const [active, setActive] = useState<CopilotActiveTurn | null>(null);
  const [error, setError] = useState<CopilotChatError | null>(null);

  // The latest turn, ahead of `active` between animation frames.
  const turnRef = useRef<CopilotActiveTurn | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const frameRef = useRef<number | null>(null);
  const settledRef = useRef<string | null>(null);
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

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
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
    frameRef.current ??= requestAnimationFrame(() => {
      frameRef.current = null;
      setActive(turnRef.current);
    });
  }

  /** Reloads the stored session, then drops the live copy of the turn. */
  async function settle(sessionId: string, turn: CopilotTurn, model: string, isFirstTurn: boolean) {
    if (settledRef.current === turn.id) return;
    settledRef.current = turn.id;
    await queryClient
      .refetchQueries({ queryKey: copilotQueryKeys.session(sessionId), exact: true })
      .catch(() => undefined);
    void queryClient.invalidateQueries({ queryKey: copilotQueryKeys.sessions() });
    // The turn may have submitted jobs the gateway now watches.
    void queryClient.invalidateQueries({
      queryKey: copilotQueryKeys.workflowWatches(sessionId),
    });
    if (turn.status === "error") {
      setError({ sessionId, message: turn.error ?? "The Copilot stopped with an error.", query: turn.query });
    }
    if (turnRef.current?.turn.id === turn.id) commit(null);

    if (isFirstTurn && turn.status === "done") {
      // Best effort: a chat without a generated title keeps "New Chat".
      titleCopilotSession(sessionId, model, turn.query)
        .then((title) => {
          if (title) {
            void queryClient.invalidateQueries({ queryKey: copilotQueryKeys.sessions() });
          }
        })
        .catch(() => undefined);
    }
  }

  async function send(options: CopilotSendOptions): Promise<CopilotSendResult> {
    if (isCopilotTurnActive(turnRef.current?.turn ?? null)) return { status: "busy" };
    setError(null);

    const { storedCount, hidden = false, ...request } = options;
    const { sessionId, query, model } = request;
    const isFirstTurn = storedCount === 0;
    let current: CopilotActiveTurn = {
      sessionId,
      turn: startCopilotTurn(crypto.randomUUID(), query),
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
    };
    commit(current);

    const controller = new AbortController();
    controllerRef.current = controller;
    let noteCount = 0;
    const noteId = () => `note-${String((noteCount += 1))}`;

    let body: ReadableStream<Uint8Array>;
    try {
      body = await openCopilotChat(request, controller.signal);
    } catch (cause) {
      commit(null);
      if (controller.signal.aborted) {
        return { status: "sent", ended: "stopped", turn: current.turn };
      }
      const message =
        cause instanceof CopilotClientError
          ? cause.message
          : cause instanceof Error
            ? `Could not reach the Copilot: ${cause.message}`
            : "Could not reach the Copilot.";
      setError({ sessionId, message, query: null });
      return { status: "refused", message };
    }

    try {
      for await (const frame of readSseFrames(body, controller.signal)) {
        const event = decodeCopilotEvent(frame, noteId);
        if (!event) continue;
        // Stop already ended this turn; later frames change nothing.
        const latest = turnRef.current;
        if (latest?.turn.id !== current.turn.id || !isCopilotTurnActive(latest.turn)) {
          break;
        }
        current = { ...current, turn: reduceCopilotTurn(current.turn, event) };
        if (isCopilotTurnActive(current.turn)) {
          commitSoon(current);
        } else {
          commit(current);
          break;
        }
      }
    } catch {
      // The connection dropped (or Stop aborted it). The gateway finishes and
      // saves the turn either way; the session poll picks the answer up.
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }

    if (!controller.signal.aborted) {
      await settle(sessionId, current.turn, model, isFirstTurn);
    }
    return {
      status: "sent",
      ended: controller.signal.aborted ? "stopped" : current.turn.status,
      turn: current.turn,
    };
  }

  /**
   * Stops the running turn. The gateway saves what was written so far with
   * "Stopped." appended; the stored session replaces the live turn shortly
   * after.
   */
  async function stop(): Promise<void> {
    const running = turnRef.current;
    if (!running || !isCopilotTurnActive(running.turn)) return;
    const stopped: CopilotActiveTurn = {
      ...running,
      turn: reduceCopilotTurn(running.turn, { type: "cancelled" }),
    };
    commit(stopped);
    try {
      await stopCopilotTurn(running.sessionId, running.turn.jobId);
    } catch (cause) {
      setError({
        sessionId: running.sessionId,
        message:
          cause instanceof Error
            ? `Stop did not reach the Copilot: ${cause.message}`
            : "Stop did not reach the Copilot.",
        query: null,
      });
    } finally {
      controllerRef.current?.abort();
    }
    await wait(stopSettleMs);
    await settle(running.sessionId, stopped.turn, "", false);
  }

  return {
    active,
    error,
    dismissError: () => {
      setError(null);
    },
    send,
    stop,
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
