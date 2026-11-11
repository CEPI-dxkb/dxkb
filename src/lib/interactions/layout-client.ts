import type {
  GraphLayoutRequest,
  GraphLayoutResponse,
} from "./layout-positions";

export interface GraphLayoutWorker {
  postMessage(message: GraphLayoutRequest, transfer: Transferable[]): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<GraphLayoutResponse>) => void,
  ): void;
  addEventListener(type: "error", listener: (event: Event) => void): void;
  terminate(): void;
}

export interface GraphLayoutOptions {
  signal?: AbortSignal;
  createWorker?: () => GraphLayoutWorker;
}

// The literal `new Worker(new URL(…, import.meta.url), { type: "module" })` form is the one
// Turbopack emits as its own chunk.
const defaultCreateWorker = (): GraphLayoutWorker =>
  new Worker(new URL("./graph-layout.worker.ts", import.meta.url), {
    type: "module",
  });

/**
 * The graph still has to render when the worker is unavailable (jsdom, old browser, failed chunk),
 * so lay it out here and say why once. Rejects with `signal.reason` when the caller aborts before
 * the layout runs.
 */
async function layOutOnMainThread(
  request: GraphLayoutRequest,
  cause: string,
  signal: AbortSignal | undefined,
): Promise<Float64Array> {
  console.warn(
    `Interactions graph: laying out on the main thread because ${cause}.`,
  );
  const { computeLayoutPositions } = await import("./layout-positions");
  signal?.throwIfAborted();
  return computeLayoutPositions(request);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function startWorker(
  createWorker: () => GraphLayoutWorker,
): { worker: GraphLayoutWorker } | { cause: string } {
  if (createWorker === defaultCreateWorker && typeof Worker === "undefined") {
    return { cause: "this browser has no Web Workers" };
  }
  try {
    return { worker: createWorker() };
  } catch (error) {
    return { cause: `the layout worker could not start (${errorMessage(error)})` };
  }
}

/**
 * Resolves with positions `[x0, y0, x1, y1, …]` in node order; rejects with the worker's error
 * message, or `signal.reason` on abort.
 */
export function requestGraphLayout(
  request: GraphLayoutRequest,
  { signal, createWorker = defaultCreateWorker }: GraphLayoutOptions = {},
): Promise<Float64Array> {
  if (signal?.aborted) return Promise.reject(signal.reason as Error);

  const started = startWorker(createWorker);
  if ("cause" in started) {
    return layOutOnMainThread(request, started.cause, signal);
  }
  const { worker } = started;

  return new Promise<Float64Array>((resolve, reject) => {
    let settled = false;
    function settle(finish: () => void) {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      worker.terminate();
      finish();
    }
    function onAbort() {
      settle(() => {
        reject(signal?.reason as Error);
      });
    }

    worker.addEventListener("message", (event) => {
      const response = event.data;
      settle(() => {
        if ("error" in response) reject(new Error(response.error));
        else resolve(response.positions);
      });
    });
    worker.addEventListener("error", () => {
      settle(() => {
        resolve(
          layOutOnMainThread(
            request,
            "the layout worker failed to load",
            signal,
          ),
        );
      });
    });
    signal?.addEventListener("abort", onAbort, { once: true });

    // Transfer a copy: the transfer detaches the buffer, and the main-thread fallback still needs
    // the original.
    const edges = request.edges.slice();
    worker.postMessage({ ...request, edges }, [edges.buffer]);
  });
}
