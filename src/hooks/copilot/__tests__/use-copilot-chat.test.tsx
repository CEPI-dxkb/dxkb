import { act, renderHook, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { useCopilotChat } from "../use-copilot-chat";

const sessionId = "11111111-2222-3333-4444-555555555555";

function sse(...frames: string[]) {
  return new HttpResponse(frames.join(""), {
    headers: { "Content-Type": "text/event-stream" },
  });
}

const sendOptions = {
  sessionId,
  query: "Find Mpox genomes",
  model: "m",
  pageContext: "The user is on DXKB.",
  storedCount: 0,
};

function storedSession() {
  return HttpResponse.json({
    sessionId,
    messages: [],
    executionMode: "plan",
    activeJobId: null,
  });
}

describe("useCopilotChat", () => {
  it("streams a turn, reloads the stored session, then titles a first chat", async () => {
    const titled = vi.fn();
    server.use(
      http.post("*/api/copilot/chat", () =>
        sse(
          'event: started\ndata: {"job_id":"j1"}\n\n',
          'event: progress\ndata: {"step_id":"s1","phase":"tool","status":"done","label":"Searched"}\n\n',
          'event: final_response\ndata: {"chunk":"Found 12."}\n\n',
          'event: done\ndata: {"job_id":"j1"}\n\n',
        ),
      ),
      http.get("*/api/copilot/sessions/:id", () => storedSession()),
      http.post("*/api/copilot/sessions/:id/title", async ({ request }) => {
        titled(await request.json());
        return HttpResponse.json({ title: "Mpox genomes" });
      }),
    );
    const { result } = renderHook(() => useCopilotChat(), {
      wrapper: createQueryClientWrapper(),
    });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.send(sendOptions);
    });

    expect(outcome).toEqual(
      expect.objectContaining({ status: "sent", ended: "done" }),
    );
    // The live turn is dropped once the stored session is read back.
    expect(result.current.active).toBeNull();
    expect(result.current.error).toBeNull();
    await waitFor(() => {
      expect(titled).toHaveBeenCalledWith({ model: "m", question: "Find Mpox genomes" });
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
    );
    const { result } = renderHook(() => useCopilotChat(), {
      wrapper: createQueryClientWrapper(),
    });

    let outcome: unknown;
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
    const { result } = renderHook(() => useCopilotChat(), {
      wrapper: createQueryClientWrapper(),
    });

    await act(async () => {
      await result.current.send(sendOptions);
    });

    expect(result.current.error).toEqual({
      sessionId,
      message: "The model is unavailable.",
      query: "Find Mpox genomes",
    });
  });

  it("stops a running turn by its job id", async () => {
    const aborted = vi.fn();
    server.use(
      http.post("*/api/copilot/chat", () => {
        const encoder = new TextEncoder();
        // Starts, then never ends on its own.
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('event: started\ndata: {"job_id":"j7"}\n\n'));
            controller.enqueue(encoder.encode('event: final_response\ndata: {"chunk":"Partial"}\n\n'));
          },
        });
        return new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream" } });
      }),
      http.post("*/api/copilot/jobs/:jobId/abort", ({ params }) => {
        aborted(params.jobId);
        return new HttpResponse(null, { status: 202 });
      }),
      http.get("*/api/copilot/sessions/:id", async () => {
        await delay(10);
        return storedSession();
      }),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useCopilotChat(), {
      wrapper: createQueryClientWrapper(),
    });

    let sending: Promise<unknown> = Promise.resolve();
    act(() => {
      sending = result.current.send(sendOptions);
    });
    await waitFor(() => {
      expect(result.current.active?.turn.jobId).toBe("j7");
    });

    let stopping: Promise<void> = Promise.resolve();
    act(() => {
      stopping = result.current.stop();
    });
    expect(result.current.active?.turn.status).toBe("stopped");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
      await stopping;
      await sending;
    });

    expect(aborted).toHaveBeenCalledWith("j7");
    expect(result.current.active).toBeNull();
    vi.useRealTimers();
  });
});
