import {
  computeLayoutPositions,
  type GraphLayoutRequest,
  type GraphLayoutResponse,
} from "./layout-positions";

// Started per request by `requestGraphLayout` (layout-client.ts). The tsconfig has no `webworker`
// lib, so the worker scope is typed with just the two members this file uses.
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
