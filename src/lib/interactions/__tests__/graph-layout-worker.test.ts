type Listener = (event: { data: unknown }) => void;

// The worker entry registers on its global scope at import time. jsdom's window
// stands in for the worker scope: capture the listener it adds and the replies
// it posts.
async function loadWorker() {
  const listeners: Listener[] = [];
  const addEventListener = vi
    .spyOn(globalThis, "addEventListener")
    .mockImplementation((type: string, listener: unknown) => {
      if (type === "message") listeners.push(listener as Listener);
    });
  const postMessage = vi
    .spyOn(globalThis, "postMessage")
    .mockImplementation(() => undefined);
  vi.resetModules();
  await import("../graph-layout.worker");
  addEventListener.mockRestore();
  return { listeners, postMessage };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("graph-layout.worker", () => {
  it("posts the positions back with their buffer transferred", async () => {
    const { listeners, postMessage } = await loadWorker();
    expect(listeners).toHaveLength(1);

    listeners[0]({
      data: { nodeCount: 2, edges: new Uint32Array([0, 1]), layout: "grid" },
    });

    expect(postMessage).toHaveBeenCalledTimes(1);
    const [reply, transfer] = postMessage.mock.calls[0] as unknown as [
      { positions: Float64Array },
      Transferable[],
    ];
    expect(Array.from(reply.positions)).toEqual([0, 0, 1, 0]);
    expect(transfer).toEqual([reply.positions.buffer]);
  });

  it("posts the error message when the layout throws", async () => {
    const { listeners, postMessage } = await loadWorker();

    // An edge to a node index that does not exist.
    listeners[0]({
      data: { nodeCount: 1, edges: new Uint32Array([0, 5]), layout: "grid" },
    });

    const [reply] = postMessage.mock.calls[0] as unknown as [
      Partial<{ positions: Float64Array; error: string }>,
    ];
    expect(reply.positions).toBeUndefined();
    // graphology's own message, naming the missing node.
    expect(reply.error).toContain('"5"');
  });
});
