import {
  computeLayoutPositions,
  type GraphLayoutRequest,
  type GraphLayoutResponse,
} from "./layout-positions";

// Worker entry for the interactions graph layout. Started by
// `requestGraphLayout` (layout-client.ts) with
// `new Worker(new URL("./graph-layout.worker.ts", import.meta.url), { type: "module" })`,
// one worker per request. The project's `tsconfig` has no `webworker` lib, so
// the worker scope is typed with just the two members this file uses.
interface LayoutWorkerScope {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<GraphLayoutRequest>) => void,
  ): void;
  postMessage(message: GraphLayoutResponse, transfer?: Transferable[]): void;
}

const scope = globalThis as unknown as LayoutWorkerScope;

scope.addEventListener("message", (event) => {
  let positions: Float64Array;
  try {
    positions = computeLayoutPositions(event.data);
  } catch (error) {
    scope.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }
  scope.postMessage({ positions }, [positions.buffer]);
});
