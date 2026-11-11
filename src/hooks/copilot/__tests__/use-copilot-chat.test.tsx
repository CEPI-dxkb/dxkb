import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createElement, type ReactNode } from "react";
import { copilotQueryKeys } from "@/lib/copilot/client";
import { isCopilotTurnActive } from "@/lib/copilot/turn";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper, nextRefetchInterval } from "@/test-helpers/react";
import { useCopilotChat, type CopilotSendResult } from "../use-copilot-chat";
import { useCopilotSession } from "../use-copilot-queries";

const sessionId = "11111111-2222-3333-4444-555555555555";
const otherSessionId = "66666666-7777-8888-9999-000000000000";

function sse(...frames: string[]) {
  return new HttpResponse(frames.join(""), {
    headers: { "Content-Type": "text/event-stream" },
  });
}

const doneFrames = [
  'event: started\ndata: {"job_id":"j1"}\n\n',
  'event: progress\ndata: {"step_id":"s1","phase":"tool","status":"done","label":"Searched"}\n\n',
  'event: final_response\ndata: {"chunk":"Found 12."}\n\n',
  'event: done\ndata: {"job_id":"j1"}\n\n',
];

const sendOptions = {
  sessionId,
  query: "Find Mpox genomes",
  model: "m",
  pageContext: "The user is on DXKB.",
  storedCount: 0,
};

function storedSession(id = sessionId) {
  return HttpResponse.json({
    sessionId: id,
    messages: [],
    executionMode: "plan",
    activeJobId: null,
  });
}

function endlessTurn() {
  const encoder = new TextEncoder();
  let tick: ReturnType<typeof setInterval> | undefined;
  const end = () => {
    clearInterval(tick);
  };
  return {
    end,
    response: (signal: AbortSignal) => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode('event: started\ndata: {"job_id":"j7"}\n\n'),
          );
          tick = setInterval(() => {
            controller.enqueue(
              encoder.encode('event: final_response\ndata: {"chunk":"more "}\n\n'),
            );
          }, 5);
          signal.addEventListener("abort", () => {
            end();
            controller.error(new DOMException("Aborted", "AbortError"));
          });
        },
        cancel: end,
      });
      return new HttpResponse(stream, {
        headers: { "Content-Type": "text/event-stream" },
      });
    },
  };
}

function renderChat(account: string | null = "user-a") {
  return renderHook(
    ({ account: current }: { account: string | null }) => {
      useCopilotSession(sessionId, { enabled: true, streaming: false });
      return useCopilotChat(current);
    },
    { wrapper: createQueryClientWrapper(), initialProps: { account } },
  );
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useCopilotChat", () => {
  it("streams a turn, reloads the stored session once, then titles a first chat", async () => {
    const titled = vi.fn();
    const sessionGets = vi.fn();
    let releaseReload: () => void = () => undefined;
    const reloadGate = new Promise<void>((resolve) => {
      releaseReload = resolve;
    });
    server.use(
      http.post("*/api/copilot/chat", () => sse(...doneFrames)),
      http.get("*/api/copilot/sessions/:id", async () => {
        sessionGets();
        if (sessionGets.mock.calls.length > 1) await reloadGate;
        return storedSession();
      }),
      http.post("*/api/copilot/sessions/:id/title", async ({ request }) => {
        titled(await request.json());
        return HttpResponse.json({ title: "Mpox genomes" });
      }),
    );
    const { result } = renderChat();
    await waitFor(() => {
      expect(sessionGets).toHaveBeenCalledTimes(1);
    });

    let sending = Promise.resolve<CopilotSendResult>({ status: "busy" });
    act(() => {
      sending = result.current.send(sendOptions);
    });
    await waitFor(() => {
      expect(sessionGets).toHaveBeenCalledTimes(2);
    });
    expect(result.current.active?.turn.status).toBe("done");

    releaseReload();
    await act(async () => {
      await expect(sending).resolves.toEqual(
        expect.objectContaining({ status: "sent", ended: "done", reloadError: null }),
      );
    });
    expect(sessionGets).toHaveBeenCalledTimes(2);
    expect(result.current.active).toBeNull();
    expect(result.current.error).toBeNull();
    await waitFor(() => {
      expect(titled).toHaveBeenCalledWith({ model: "m", question: "Find Mpox genomes" });
    });
  });

  it("keeps the ended turn and reports the reload when the stored session cannot be read", async () => {
    let failing = false;
    const sessionGets = vi.fn();
    server.use(
      http.post("*/api/copilot/chat", () => sse(...doneFrames)),
      http.get("*/api/copilot/sessions/:id", () => {
        sessionGets();
        return failing
          ? HttpResponse.json(
              { error: "The BV-BRC Copilot service did not respond.", code: "upstream" },
              { status: 500 },
            )
          : storedSession();
      }),
      http.post("*/api/copilot/sessions/:id/title", () =>
        HttpResponse.json({ title: null }),
      ),
    );
    const { result } = renderChat();
    await waitFor(() => {
      expect(sessionGets).toHaveBeenCalledTimes(1);
    });
    failing = true;

    let outcome: CopilotSendResult | undefined;
    await act(async () => {
      outcome = await result.current.send(sendOptions);
    });

    expect(outcome).toEqual(
      expect.objectContaining({
        status: "sent",
        ended: "done",
        reloadError: "The BV-BRC Copilot service did not respond.",
      }),
    );
    expect(result.current.active?.sessionId).toBe(sessionId);
    expect(result.current.active?.turn).toEqual(
      expect.objectContaining({ status: "done", answer: "Found 12." }),
    );
    expect(result.current.error).toEqual({
      sessionId,
      kind: "reload",
      message: "The BV-BRC Copilot service did not respond.",
      query: null,
    });

    failing = false;
    await act(async () => {
      await result.current.reload(sessionId);
    });

    expect(result.current.active).toBeNull();
    expect(result.current.error).toBeNull();
  });

  describe("a stream that drops before the turn ends", () => {
    const droppedFrames = [
      'event: started\ndata: {"job_id":"j9"}\n\n',
      'event: final_response\ndata: {"chunk":"Partial"}\n\n',
    ];

    function renderPanelChat() {
      const state = { failing: false, dropped: true };
      const sessionGets = vi.fn();
      server.use(
        http.post("*/api/copilot/chat", () =>
          state.dropped ? sse(...droppedFrames) : sse(...doneFrames),
        ),
        http.get("*/api/copilot/sessions/:id", () => {
          sessionGets();
          return state.failing
            ? HttpResponse.json(
                { error: "The BV-BRC Copilot service did not respond.", code: "upstream" },
                { status: 500 },
              )
            : HttpResponse.json({
                sessionId,
                messages: [],
                executionMode: "plan",
                activeJobId: "j9",
              });
        }),
        http.post("*/api/copilot/sessions/:id/title", () =>
          HttpResponse.json({ title: null }),
        ),
      );
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
      const rendered = renderHook(
        () => {
          const chat = useCopilotChat("user-a");
          useCopilotSession(sessionId, {
            enabled: true,
            streaming: isCopilotTurnActive(chat.active?.turn ?? null),
          });
          return chat;
        },
        { wrapper },
      );
      return { ...rendered, queryClient, state, sessionGets };
    }

    it("ends the live turn when the reload fails, so Send and the poll work again", async () => {
      const { result, queryClient, state, sessionGets } = renderPanelChat();
      await waitFor(() => {
        expect(sessionGets).toHaveBeenCalledTimes(1);
      });
      state.failing = true;

      let outcome: CopilotSendResult | undefined;
      await act(async () => {
        outcome = await result.current.send(sendOptions);
      });

      expect(outcome).toEqual(
        expect.objectContaining({
          status: "sent",
          ended: "running",
          reloadError: "The BV-BRC Copilot service did not respond.",
        }),
      );
      expect(result.current.active?.turn).toEqual(
        expect.objectContaining({ status: "disconnected", answer: "Partial" }),
      );
      expect(isCopilotTurnActive(result.current.active?.turn ?? null)).toBe(false);
      expect(result.current.error).toEqual({
        sessionId,
        kind: "reload",
        message: "The BV-BRC Copilot service did not respond.",
        query: null,
      });
      expect(nextRefetchInterval(queryClient, copilotQueryKeys.session(sessionId))).toBe(
        3000,
      );
      await act(async () => {
        await result.current.stop();
      });
      expect(result.current.active?.turn.status).toBe("disconnected");

      state.failing = false;
      state.dropped = false;
      let next: CopilotSendResult | undefined;
      await act(async () => {
        next = await result.current.send(sendOptions);
      });
      expect(next).toEqual(
        expect.objectContaining({ status: "sent", ended: "done", reloadError: null }),
      );
      expect(result.current.active).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("replaces the disconnected turn with the stored session on a successful reload", async () => {
      const { result, state, sessionGets } = renderPanelChat();
      await waitFor(() => {
        expect(sessionGets).toHaveBeenCalledTimes(1);
      });
      state.failing = true;
      await act(async () => {
        await result.current.send(sendOptions);
      });
      expect(result.current.active?.turn.status).toBe("disconnected");

      state.failing = false;
      await act(async () => {
        await result.current.reload(sessionId);
      });

      expect(result.current.active).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("gives way to the saved conversation when a later read of the session succeeds", async () => {
      const { result, queryClient, state, sessionGets } = renderPanelChat();
      await waitFor(() => {
        expect(sessionGets).toHaveBeenCalledTimes(1);
      });
      state.failing = true;
      await act(async () => {
        await result.current.send(sendOptions);
      });
      expect(result.current.active?.turn.status).toBe("disconnected");
      const sessionKey = copilotQueryKeys.session(sessionId);

      await act(async () => {
        await queryClient.refetchQueries({ queryKey: sessionKey });
      });
      expect(result.current.active?.turn.status).toBe("disconnected");
      expect(result.current.error).toEqual(expect.objectContaining({ kind: "reload" }));

      state.failing = false;
      await act(async () => {
        await queryClient.refetchQueries({ queryKey: sessionKey });
      });
      expect(result.current.active).toBeNull();
      expect(result.current.error).toBeNull();

      state.failing = true;
      await act(async () => {
        await result.current.reload(otherSessionId);
      });
      expect(result.current.error).toEqual({
        sessionId: otherSessionId,
        kind: "reload",
        message: "The BV-BRC Copilot service did not respond.",
        query: null,
      });
    });

    it("keeps the turn and its reload error over an optimistic cache write", async () => {
      const { result, queryClient, state, sessionGets } = renderPanelChat();
      await waitFor(() => {
        expect(sessionGets).toHaveBeenCalledTimes(1);
      });
      state.failing = true;
      await act(async () => {
        await result.current.send(sendOptions);
      });
      expect(result.current.active?.turn.status).toBe("disconnected");

      act(() => {
        queryClient.setQueryData(copilotQueryKeys.session(sessionId), {
          sessionId,
          messages: [],
          executionMode: "plan",
          activeJobId: null,
        });
      });

      expect(result.current.active?.turn).toEqual(
        expect.objectContaining({ status: "disconnected", answer: "Partial" }),
      );
      expect(result.current.error).toEqual(
        expect.objectContaining({ sessionId, kind: "reload" }),
      );
    });
  });

  it("gives the text back when the gateway refuses the turn before it starts", async () => {
    server.use(
      http.post("*/api/copilot/chat", () =>
        HttpResponse.json(
          {
            error: "A response is already being generated in this chat.",
            code: "validation",
            copilotCode: "TURN_IN_FLIGHT",
          },
          { status: 409 },
        ),
      ),
      http.get("*/api/copilot/sessions/:id", () => storedSession()),
    );
    const { result } = renderChat();

    let outcome: CopilotSendResult | undefined;
    await act(async () => {
      outcome = await result.current.send(sendOptions);
    });

    expect(outcome).toEqual({
      status: "refused",
      message: "A response is already being generated in this chat.",
    });
    expect(result.current.active).toBeNull();
    expect(result.current.error).toEqual({
      sessionId,
      kind: "turn",
      message: "A response is already being generated in this chat.",
      query: null,
    });
  });

  it("reports a stream error with the question for Retry", async () => {
    server.use(
      http.post("*/api/copilot/chat", () =>
        sse('event: error\ndata: {"error":"The model is unavailable."}\n\n'),
      ),
      http.get("*/api/copilot/sessions/:id", () => storedSession()),
    );
    const { result } = renderChat();

    await act(async () => {
      await result.current.send(sendOptions);
    });

    expect(result.current.error).toEqual({
      sessionId,
      kind: "turn",
      message: "The model is unavailable.",
      query: "Find Mpox genomes",
    });
  });

  it.each([
    ["with an image", { images: [{ name: "a.png", dataUrl: "data:image/png;base64,AA==" }] }],
    ["as a hidden plan step", { hidden: true }],
  ])("offers no Retry for a failed turn sent %s", async (_label, extra) => {
    server.use(
      http.post("*/api/copilot/chat", () =>
        sse('event: error\ndata: {"error":"The model is unavailable."}\n\n'),
      ),
      http.get("*/api/copilot/sessions/:id", () => storedSession()),
    );
    const { result } = renderChat();

    await act(async () => {
      await result.current.send({ ...sendOptions, ...extra });
    });

    expect(result.current.error).toEqual(
      expect.objectContaining({ kind: "turn", message: "The model is unavailable.", query: null }),
    );
  });

  describe("Stop", () => {
    function stopHandlers() {
      const turn = endlessTurn();
      let releaseAbort: () => void = () => undefined;
      const abortGate = new Promise<void>((resolve) => {
        releaseAbort = resolve;
      });
      const aborted = vi.fn();
      const sessionGets = vi.fn();
      const chatRequests: Request[] = [];
      let result: ReturnType<typeof renderChat>["result"] | undefined;
      server.use(
        http.post("*/api/copilot/chat", ({ request }) => {
          chatRequests.push(request);
          return chatRequests.length === 1
            ? turn.response(request.signal)
            : sse(...doneFrames);
        }),
        http.post("*/api/copilot/jobs/:jobId/abort", async ({ params }) => {
          aborted(params.jobId);
          await abortGate;
          return new HttpResponse(null, { status: 202 });
        }),
        http.get("*/api/copilot/sessions/:id", ({ params }) => {
          sessionGets(result?.current.active?.turn.status ?? null);
          return storedSession(String(params.id));
        }),
        http.post("*/api/copilot/sessions/:id/title", () =>
          HttpResponse.json({ title: null }),
        ),
      );
      return {
        turn,
        aborted,
        sessionGets,
        chatRequests,
        releaseAbort: () => {
          releaseAbort();
        },
        setResult: (next: ReturnType<typeof renderChat>["result"]) => {
          result = next;
        },
      };
    }

    async function startStoppedTurn(handlers: ReturnType<typeof stopHandlers>) {
      vi.useFakeTimers();
      const rendered = renderChat();
      handlers.setResult(rendered.result);
      await advance(10);
      expect(handlers.sessionGets).toHaveBeenCalledTimes(1);

      let sending: Promise<CopilotSendResult> = Promise.resolve<CopilotSendResult>({ status: "busy" });
      act(() => {
        sending = rendered.result.current.send(sendOptions);
      });
      await advance(50);
      expect(rendered.result.current.active?.turn).toEqual(
        expect.objectContaining({ status: "running", jobId: "j7" }),
      );

      act(() => {
        void rendered.result.current.stop();
      });
      expect(rendered.result.current.active?.turn.status).toBe("stopped");
      expect(rendered.result.current.stopping).toBe(true);
      return { ...rendered, sending };
    }

    it("reads the stored session once, after the stop request and the save wait", async () => {
      const handlers = stopHandlers();
      const { result, sending } = await startStoppedTurn(handlers);

      await advance(200);
      expect(handlers.aborted).toHaveBeenCalledWith("j7");
      expect(handlers.sessionGets).toHaveBeenCalledTimes(1);
      expect(result.current.active?.turn.status).toBe("stopped");

      handlers.releaseAbort();
      await advance(1499);
      expect(handlers.sessionGets).toHaveBeenCalledTimes(1);
      expect(result.current.active?.turn.status).toBe("stopped");

      await advance(1);
      await advance(10);
      expect(handlers.sessionGets).toHaveBeenCalledTimes(2);
      expect(handlers.sessionGets).toHaveBeenLastCalledWith("stopped");
      expect(result.current.active).toBeNull();
      expect(result.current.stopping).toBe(false);
      await expect(sending).resolves.toEqual(
        expect.objectContaining({ status: "sent", ended: "stopped", reloadError: null }),
      );
      expect(handlers.sessionGets).toHaveBeenCalledTimes(2);
    });

    it("stays busy until the stopped turn settles, then sends without aborting the next", async () => {
      const handlers = stopHandlers();
      const { result, sending } = await startStoppedTurn(handlers);

      let refused: CopilotSendResult | undefined;
      await act(async () => {
        refused = await result.current.send({ ...sendOptions, sessionId: otherSessionId });
      });
      expect(refused).toEqual({ status: "busy" });

      handlers.releaseAbort();
      await advance(1600);
      await expect(sending).resolves.toEqual(
        expect.objectContaining({ ended: "stopped" }),
      );

      let next: Promise<CopilotSendResult> = Promise.resolve<CopilotSendResult>({ status: "busy" });
      act(() => {
        next = result.current.send({ ...sendOptions, sessionId: otherSessionId });
      });
      await advance(50);
      await expect(next).resolves.toEqual(
        expect.objectContaining({ status: "sent", ended: "done", reloadError: null }),
      );
      expect(handlers.chatRequests).toHaveLength(2);
      expect(handlers.chatRequests[1]?.signal.aborted).toBe(false);
    });

    it("settles a turn Stop cancelled while it opened like any stopped turn", async () => {
      const sessionGets = vi.fn();
      const sessionStops = vi.fn();
      server.use(
        http.post("*/api/copilot/chat", ({ request }) =>
          new Promise<Response>((_resolve, reject) => {
            request.signal.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
        ),
        http.post("*/api/copilot/sessions/:id/stop", () => {
          sessionStops();
          return new HttpResponse(null, { status: 202 });
        }),
        http.get("*/api/copilot/sessions/:id", () => {
          sessionGets();
          return storedSession();
        }),
      );
      vi.useFakeTimers();
      const { result } = renderChat();
      await advance(10);
      expect(sessionGets).toHaveBeenCalledTimes(1);

      let sending = Promise.resolve<CopilotSendResult>({ status: "busy" });
      act(() => {
        sending = result.current.send(sendOptions);
      });
      act(() => {
        void result.current.stop();
      });
      await advance(10);
      expect(sessionStops).toHaveBeenCalledTimes(1);
      expect(result.current.active?.turn.status).toBe("stopped");

      await advance(1480);
      expect(sessionGets).toHaveBeenCalledTimes(1);
      await advance(20);
      await advance(10);
      expect(sessionGets).toHaveBeenCalledTimes(2);
      await expect(sending).resolves.toEqual(
        expect.objectContaining({ status: "sent", ended: "stopped", reloadError: null }),
      );
      expect(result.current.active).toBeNull();
      expect(result.current.error).toBeNull();
      expect(sessionGets).toHaveBeenCalledTimes(2);
    });

    it("reads the session again after a Stop that arrived during the reload", async () => {
      let releaseReload: () => void = () => undefined;
      const reloadGate = new Promise<void>((resolve) => {
        releaseReload = resolve;
      });
      const sessionGets = vi.fn();
      const aborted = vi.fn();
      server.use(
        http.post("*/api/copilot/chat", () =>
          sse(
            'event: started\ndata: {"job_id":"j9"}\n\n',
            'event: final_response\ndata: {"chunk":"Partial"}\n\n',
          ),
        ),
        http.post("*/api/copilot/jobs/:jobId/abort", ({ params }) => {
          aborted(params.jobId);
          return new HttpResponse(null, { status: 202 });
        }),
        http.get("*/api/copilot/sessions/:id", async () => {
          sessionGets();
          if (sessionGets.mock.calls.length === 2) await reloadGate;
          return storedSession();
        }),
      );
      vi.useFakeTimers();
      const { result } = renderChat();
      await advance(10);

      let sending = Promise.resolve<CopilotSendResult>({ status: "busy" });
      act(() => {
        sending = result.current.send(sendOptions);
      });
      await advance(50);
      expect(sessionGets).toHaveBeenCalledTimes(2);
      expect(result.current.active?.turn.status).toBe("running");

      act(() => {
        void result.current.stop();
      });
      releaseReload();
      await advance(10);
      expect(aborted).toHaveBeenCalledWith("j9");
      expect(sessionGets).toHaveBeenCalledTimes(2);
      expect(result.current.active?.turn.status).toBe("stopped");

      await advance(1480);
      expect(sessionGets).toHaveBeenCalledTimes(2);
      await advance(20);
      await advance(10);
      expect(sessionGets).toHaveBeenCalledTimes(3);
      await expect(sending).resolves.toEqual(
        expect.objectContaining({ status: "sent", ended: "stopped", reloadError: null }),
      );
      expect(result.current.active).toBeNull();
      expect(result.current.stopping).toBe(false);
    });
  });

  it("drops a running turn when the account changes", async () => {
    const turn = endlessTurn();
    const sessionGets = vi.fn();
    const chatRequests: Request[] = [];
    server.use(
      http.post("*/api/copilot/chat", ({ request }) => {
        chatRequests.push(request);
        return turn.response(request.signal);
      }),
      http.get("*/api/copilot/sessions/:id", () => {
        sessionGets();
        return storedSession();
      }),
    );
    const { result, rerender } = renderChat("user-a");
    await waitFor(() => {
      expect(sessionGets).toHaveBeenCalledTimes(1);
    });

    let sending: Promise<CopilotSendResult> = Promise.resolve<CopilotSendResult>({ status: "busy" });
    act(() => {
      sending = result.current.send(sendOptions);
    });
    await waitFor(() => {
      expect(result.current.active?.turn.jobId).toBe("j7");
    });

    rerender({ account: "user-b" });

    expect(result.current.active).toBeNull();
    expect(result.current.error).toBeNull();
    expect(chatRequests[0]?.signal.aborted).toBe(true);
    await expect(sending).resolves.toEqual(
      expect.objectContaining({ status: "sent", ended: "stopped", reloadError: null }),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sessionGets).toHaveBeenCalledTimes(1);
    expect(result.current.active).toBeNull();
    turn.end();
  });
});
