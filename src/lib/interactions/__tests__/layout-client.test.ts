import type { MockInstance } from "vitest";

import { requestGraphLayout, type GraphLayoutWorker } from "../layout-client";
import type {
  GraphLayoutRequest,
  GraphLayoutResponse,
} from "../layout-positions";

type MessageListener = (event: MessageEvent<GraphLayoutResponse>) => void;
type ErrorListener = (event: Event) => void;

class FakeWorker implements GraphLayoutWorker {
  posted: { message: GraphLayoutRequest; transfer: Transferable[] }[] = [];
  terminate = vi.fn();
  private messageListeners: MessageListener[] = [];
  private errorListeners: ErrorListener[] = [];

  postMessage(message: GraphLayoutRequest, transfer: Transferable[]) {
    this.posted.push({ message, transfer });
  }

  addEventListener(type: "message", listener: MessageListener): void;
  addEventListener(type: "error", listener: ErrorListener): void;
  addEventListener(
    type: "message" | "error",
    listener: MessageListener | ErrorListener,
  ) {
    if (type === "message") this.messageListeners.push(listener);
    else this.errorListeners.push(listener as ErrorListener);
  }

  answer(data: GraphLayoutResponse) {
    const event = new MessageEvent("message", { data });
    for (const listener of this.messageListeners) listener(event);
  }

  fail() {
    const event = new Event("error");
    for (const listener of this.errorListeners) listener(event);
  }
}

function makeRequest(): GraphLayoutRequest {
  return { nodeCount: 2, edges: new Uint32Array([0, 1]), layout: "grid" };
}

describe("requestGraphLayout", () => {
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("resolves with the worker's positions and transfers the edges buffer", async () => {
    const worker = new FakeWorker();
    const request = makeRequest();

    const result = requestGraphLayout(request, { createWorker: () => worker });

    expect(worker.posted).toHaveLength(1);
    const [{ message, transfer }] = worker.posted;
    expect(message.nodeCount).toBe(2);
    expect(message.layout).toBe("grid");
    expect(Array.from(message.edges)).toEqual([0, 1]);
    expect(transfer).toEqual([message.edges.buffer]);
    // A copy: the transfer detaches it, and the fallback reads the original.
    expect(transfer[0]).not.toBe(request.edges.buffer);

    const positions = new Float64Array([1, 2, 3, 4]);
    worker.answer({ positions });

    await expect(result).resolves.toBe(positions);
    expect(warn).not.toHaveBeenCalled();
  });

  it("terminates the worker once it answers", async () => {
    const worker = new FakeWorker();
    const result = requestGraphLayout(makeRequest(), {
      createWorker: () => worker,
    });
    expect(worker.terminate).not.toHaveBeenCalled();

    worker.answer({ positions: new Float64Array(4) });
    await result;

    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("rejects with the signal's reason and terminates the worker on abort", async () => {
    const worker = new FakeWorker();
    const controller = new AbortController();
    const result = requestGraphLayout(makeRequest(), {
      signal: controller.signal,
      createWorker: () => worker,
    });

    const reason = new Error("left the Graph tab");
    controller.abort(reason);

    await expect(result).rejects.toBe(reason);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("rejects without starting a worker when the signal is already aborted", async () => {
    const createWorker = vi.fn(() => new FakeWorker());
    const controller = new AbortController();
    controller.abort(new Error("gone"));

    await expect(
      requestGraphLayout(makeRequest(), {
        signal: controller.signal,
        createWorker,
      }),
    ).rejects.toThrow("gone");
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("rejects with the message the worker reports", async () => {
    const worker = new FakeWorker();
    const result = requestGraphLayout(makeRequest(), {
      createWorker: () => worker,
    });

    worker.answer({ error: "Graph.addEdge: source node not found" });

    await expect(result).rejects.toThrow("Graph.addEdge: source node not found");
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("lays out on the main thread, warning once, when the worker fails to load", async () => {
    const worker = new FakeWorker();
    const request = makeRequest();
    const result = requestGraphLayout(request, { createWorker: () => worker });

    worker.fail();
    worker.fail();

    const positions = await result;
    expect(Array.from(positions)).toEqual([0, 0, 1, 0]);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/worker/i);
  });

  it("lays out on the main thread when the worker cannot be created", async () => {
    const positions = await requestGraphLayout(makeRequest(), {
      createWorker: () => {
        throw new Error("Refused to create a worker");
      },
    });

    expect(Array.from(positions)).toEqual([0, 0, 1, 0]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("Refused to create a worker");
  });

  it("rejects with the signal's reason on an abort while the worker's fallback loads", async () => {
    const worker = new FakeWorker();
    const controller = new AbortController();
    const result = requestGraphLayout(makeRequest(), {
      signal: controller.signal,
      createWorker: () => worker,
    });

    worker.fail();
    const reason = new Error("left the Graph tab");
    controller.abort(reason);

    await expect(result).rejects.toBe(reason);
  });

  it("rejects with the signal's reason on an abort while the main-thread layout loads", async () => {
    const controller = new AbortController();
    const result = requestGraphLayout(makeRequest(), {
      signal: controller.signal,
    });

    const reason = new Error("left the Graph tab");
    controller.abort(reason);

    await expect(result).rejects.toBe(reason);
  });

  it("lays out on the main thread where there is no Worker (jsdom)", async () => {
    expect(typeof Worker).toBe("undefined");

    const positions = await requestGraphLayout(makeRequest());

    expect(Array.from(positions)).toEqual([0, 0, 1, 0]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
