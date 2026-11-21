import { render, screen } from "@testing-library/react";

import { buildIncidenceIndex } from "@/lib/interactions/selection-focus";
import type { GraphCanvasProps } from "@/lib/interactions/types";

import { GraphCanvas } from "../graph-canvas";

// Stands in for the Sigma chunk, which jsdom cannot load. `loads` counts how often its factory
// ran, i.e. how often the chunk was fetched and evaluated: the point of the probe is that without
// WebGL 2 it never is.
const sigmaChunk = vi.hoisted(() => ({ loads: 0 }));
vi.mock("../sigma/sigma-canvas", () => {
  sigmaChunk.loads += 1;
  return { SigmaCanvas: () => <div data-testid="sigma-canvas" /> };
});

vi.mock("@/lib/interactions/webgl-support", () => ({
  supportsWebGl2: () => false,
}));

const props: GraphCanvasProps = {
  nodes: [],
  edges: [],
  incidence: buildIncidenceIndex([]),
  positions: null,
  selection: { nodes: [], edges: [] },
  onSelect: vi.fn(),
  handleRef: { current: null },
  onReady: vi.fn(),
};

// Next resolves the lazy canvas once per page load and keeps the answer, so this file covers only
// the unsupported browser; `interactions-graph.test.tsx` covers the supported one (the canvas
// loads and renders) with the probe stubbed true.
describe("GraphCanvas without WebGL 2", () => {
  it("shows the WebGL 2 notice without loading the Sigma chunk", async () => {
    render(<GraphCanvas {...props} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The graph needs WebGL 2");
    expect(alert).toHaveTextContent("Use the Table view");
    expect(sigmaChunk.loads).toBe(0);
    expect(screen.queryByTestId("sigma-canvas")).not.toBeInTheDocument();
  });

  it("never reports ready without WebGL 2, so the PNG export stays disabled", async () => {
    render(<GraphCanvas {...props} />);

    await screen.findByRole("alert");
    expect(props.onReady).not.toHaveBeenCalled();
    expect(props.handleRef.current).toBeNull();
  });
});
