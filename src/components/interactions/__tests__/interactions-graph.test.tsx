import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ComponentProps } from "react";

import { InteractionsGraph } from "../interactions-graph";
import {
  interactionsGraphRowLimit,
  useInteractions,
  type InteractionsGraphData,
} from "@/lib/interactions/use-interactions";
import { requestGraphLayout } from "@/lib/interactions/layout-client";
import { defaultLayout } from "@/lib/interactions/renderer-capabilities";
import type {
  GraphCameraView,
  GraphSelection,
  GraphSelectionRef,
  LayoutName,
  PpiRecord,
} from "@/lib/interactions/types";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { settleBackgroundWork as settle } from "@/test-helpers/settle";

// Mocked pending: SigmaCanvas (WebGL) is untestable in jsdom, and this keeps the component on its
// loading branch, enough to observe the query it asked for.
vi.mock("@/lib/interactions/use-interactions", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/interactions/use-interactions")
  >()),
  useInteractions: vi.fn(() => ({
    data: undefined,
    isPending: true,
    isError: false,
    error: null,
  })),
}));

vi.mock("@/lib/interactions/layout-client", () => ({
  requestGraphLayout: vi.fn(),
}));

const canvasInputs = vi.hoisted(() => ({ nodes: [] as unknown[] }));

vi.mock("../sigma/sigma-canvas", () => ({
  SigmaCanvas: ({
    onReady,
    nodes,
    positions,
    selection,
    camera,
    onCameraChange,
  }: {
    onReady: () => void;
    nodes: unknown;
    positions: Float64Array | null;
    selection: GraphSelection;
    camera?: GraphCameraView | null;
    onCameraChange?: (camera: GraphCameraView | null) => void;
  }) => {
    canvasInputs.nodes.push(nodes);
    return (
    <button
      type="button"
      data-testid="sigma-canvas"
      data-positions={positions ? String(positions.length) : "none"}
      data-selection={[...selection.nodes, ...selection.edges]
        .map((item) => item.id)
        .join(",")}
      data-camera={camera ? String(camera.ratio) : "none"}
      onClick={onReady}
      onDoubleClick={() => {
        onCameraChange?.({ ratio: 0.5, x: 0.1, y: 0.2 });
      }}
    >
      Mark canvas ready
    </button>
    );
  },
}));

beforeEach(() => {
  vi.mocked(requestGraphLayout).mockImplementation((request) =>
    Promise.resolve(new Float64Array(2 * request.nodeCount)),
  );
});

function deferredLayout() {
  let resolve: (positions: Float64Array) => void = () => undefined;
  const promise = new Promise<Float64Array>((settle) => {
    resolve = settle;
  });
  vi.mocked(requestGraphLayout).mockReturnValueOnce(promise);
  return resolve;
}

type GraphHarnessProps = Omit<
  ComponentProps<typeof InteractionsGraph>,
  | "layout"
  | "onLayoutChange"
  | "selected"
  | "onSelectedChange"
  | "camera"
  | "onCameraChange"
> & {
  initialSelected?: GraphSelectionRef | null;
  onSelectedChange?: (next: GraphSelectionRef | null) => void;
  camera?: GraphCameraView | null;
  onCameraChange?: (next: GraphCameraView | null) => void;
};

/** Stands in for the shell, which keeps the single selection in the URL. */
function GraphHarness({
  initialSelected = null,
  onSelectedChange,
  camera = null,
  onCameraChange = vi.fn(),
  ...props
}: GraphHarnessProps) {
  const [layout, setLayout] = useState<LayoutName>(defaultLayout);
  const [selected, setSelected] = useState(initialSelected);
  return (
    <InteractionsGraph
      {...props}
      layout={layout}
      onLayoutChange={setLayout}
      selected={selected}
      onSelectedChange={(next) => {
        onSelectedChange?.(next);
        setSelected(next);
      }}
      camera={camera}
      onCameraChange={onCameraChange}
    />
  );
}

function renderGraph(ui: React.ReactElement) {
  return render(ui, { wrapper: createQueryClientWrapper() });
}

const graphRows: PpiRecord[] = [
  {
    id: "edge-1",
    interactor_a: "node-a",
    interactor_b: "node-b",
    gene_a: "geneA",
    gene_b: "geneB",
  },
];

function resolved(data: InteractionsGraphData) {
  vi.mocked(useInteractions).mockReturnValue({
    data,
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useInteractions>);
}

function failed(error: Error) {
  const refetch = vi.fn();
  vi.mocked(useInteractions).mockReturnValue({
    data: undefined,
    isPending: false,
    isError: true,
    error,
    refetch,
  } as unknown as ReturnType<typeof useInteractions>);
  return refetch;
}

class ResizeObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);
vi.stubGlobal("scrollTo", vi.fn());
Element.prototype.scrollIntoView = vi.fn();

describe("InteractionsGraph query inputs", () => {
  it("passes the scope predicate and the shared keyword through untouched", () => {
    renderGraph(
      <GraphHarness
        rql="eq(evidence,experimental)"
        keywordValue="  groEL   dnaK "
        onKeywordChange={vi.fn()}
      />,
    );

    expect(useInteractions).toHaveBeenCalledWith(
      "eq(evidence,experimental)",
      "  groEL   dnaK ",
    );
  });

  it("reports keyword edits to the shared owner rather than re-querying on its own", async () => {
    const onKeywordChange = vi.fn();
    renderGraph(
      <GraphHarness
        rql="eq(evidence,experimental)"
        keywordValue="groEL"
        onKeywordChange={onKeywordChange}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText("Search interaction results..."),
      { target: { value: "dnaK" } },
    );

    expect(useInteractions).toHaveBeenLastCalledWith(
      "eq(evidence,experimental)",
      "groEL",
    );
    await waitFor(() => {
      expect(onKeywordChange).toHaveBeenLastCalledWith("dnaK");
    });
    expect(useInteractions).toHaveBeenLastCalledWith(
      "eq(evidence,experimental)",
      "groEL",
    );
  });
});

describe("InteractionsGraph loading state", () => {
  it("renders the loading skeleton while the query is pending", () => {
    renderGraph(<GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Search interaction results..."),
    ).toBeInTheDocument();
  });
});

describe("InteractionsGraph error state", () => {
  it("renders the query's real error message instead of unmounting the subview", () => {
    failed(new Error("DATA_API_URL is not configured."));

    renderGraph(<GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />);

    expect(
      screen.getByText("DATA_API_URL is not configured."),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Search interaction results..."),
    ).toBeInTheDocument();
  });

  it("re-issues the query from a Retry button, like the Table subview does", async () => {
    const refetch = failed(new Error("Bad gateway"));

    renderGraph(<GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />);

    expect(screen.getByText("Could not load interactions")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the failure up, retrying, until the Retry answers", async () => {
    const refetch = failed(new Error("Bad gateway"));
    // What TanStack does to a failed query with no data on refetch: back to pending, error cleared.
    refetch.mockImplementation(() => {
      vi.mocked(useInteractions).mockReturnValue({
        data: undefined,
        isPending: true,
        isError: false,
        error: null,
        isFetching: true,
        refetch,
      } as unknown as ReturnType<typeof useInteractions>);
    });

    const { rerender } = renderGraph(
      <GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    rerender(
      <GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Bad gateway");
    expect(
      within(alert).getByRole("button", { name: "Retrying…" }),
    ).toBeDisabled();
    expect(screen.queryByRole("status")).toBeNull();

    resolved({ rows: [], isTruncated: false });
    rerender(
      <GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />,
    );

    expect(screen.getByText("No Interactions")).toBeInTheDocument();
    expect(screen.queryByText("Could not load interactions")).toBeNull();
  });

  it("falls back to readable text when the query fails with an empty Error", () => {
    failed(new Error("   "));

    renderGraph(<GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />);

    expect(
      screen.getByText("Failed to load interactions."),
    ).toBeInTheDocument();
  });
});

describe("InteractionsGraph empty state", () => {
  it("preserves the graph workspace and replaces only the canvas content", () => {
    resolved({ rows: [], isTruncated: false });

    renderGraph(<GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />);

    expect(screen.getByText("Microbial protein")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sub-Graph" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Layout" })).toBeInTheDocument();
    expect(screen.getByLabelText("Selection details")).toBeInTheDocument();
    expect(screen.getByText("No Interactions")).toBeInTheDocument();
    expect(screen.queryByTestId("sigma-canvas")).not.toBeInTheDocument();
  });
});

describe("InteractionsGraph row ceiling", () => {
  it("says the graph is showing only the first page of an over-limit result", () => {
    resolved({ rows: graphRows, isTruncated: true });

    renderGraph(<GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />);

    expect(
      screen.getByText(
        `Showing the first ${interactionsGraphRowLimit.toLocaleString()} interactions`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "use the Table subview to see them all",
    );
  });

  it("stays quiet when every matching interaction is drawn", () => {
    resolved({ rows: graphRows, isTruncated: false });

    renderGraph(<GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("InteractionsGraph data changes", () => {
  it("disables export when a ready populated graph becomes empty", async () => {
    resolved({ rows: graphRows, isTruncated: false });

    const { rerender } = renderGraph(
      <GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />,
    );

    fireEvent.click(await screen.findByTestId("sigma-canvas"));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
    });

    resolved({ rows: [], isTruncated: false });
    rerender(
      <GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
  });

  it("clears stale selection and active presets when the query data changes", async () => {
    const user = userEvent.setup();
    resolved({ rows: graphRows, isTruncated: false });

    const { rerender } = renderGraph(
      <GraphHarness
        rql=""
        keywordValue="geneA"
        onKeywordChange={vi.fn()}
      />,
    );

    await user.click(screen.getByText("geneA"));
    expect(screen.getByText("node-a")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hub Protein" }));
    await user.click(
      screen.getByRole("button", { name: "Most Connected Hub" }),
    );
    expect(
      screen.getByRole("button", { name: "Most Connected Hub" }),
    ).toBeInTheDocument();

    resolved({
      rows: [
        {
          ...graphRows[0],
          id: "edge-2",
          interactor_a: "node-c",
          gene_a: "geneC",
        },
      ],
      isTruncated: false,
    });
    rerender(
      <GraphHarness
        rql=""
        keywordValue="geneC"
        onKeywordChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Select a node or edge to see details."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Hub Protein" }),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("node-a")).not.toBeInTheDocument();
  });
});

function pending() {
  vi.mocked(useInteractions).mockReturnValue({
    data: undefined,
    isPending: true,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useInteractions>);
}

function detailsPane() {
  return within(screen.getByLabelText("Selection details"));
}

describe("InteractionsGraph selection from the URL", () => {
  it("selects the URL's node once the data has loaded, filling the pane and the canvas", async () => {
    pending();
    const onSelectedChange = vi.fn();
    const { rerender } = renderGraph(
      <GraphHarness
        rql=""
        keywordValue=""
        onKeywordChange={vi.fn()}
        initialSelected={{ kind: "node", id: "node-b" }}
        onSelectedChange={onSelectedChange}
      />,
    );
    expect(screen.queryByLabelText("Selection details")).toBeNull();

    // The first data arrival resets presets and bulk picks; it must not wipe the restored id.
    resolved({ rows: graphRows, isTruncated: false });
    rerender(
      <GraphHarness
        rql=""
        keywordValue=""
        onKeywordChange={vi.fn()}
        initialSelected={{ kind: "node", id: "node-b" }}
        onSelectedChange={onSelectedChange}
      />,
    );

    expect(detailsPane().getByText("BRC ID")).toBeInTheDocument();
    expect(detailsPane().getByText("node-b")).toBeInTheDocument();
    expect(screen.getByTestId("sigma-canvas")).toHaveAttribute(
      "data-selection",
      "node-b",
    );
    expect(
      screen.getByRole("option", { name: "geneB" }),
    ).toHaveAttribute("data-app-selected", "true");
    await settle();
    expect(onSelectedChange).not.toHaveBeenCalled();
  });

  it("selects the URL's edge", () => {
    resolved({ rows: graphRows, isTruncated: false });
    renderGraph(
      <GraphHarness
        rql=""
        keywordValue=""
        onKeywordChange={vi.fn()}
        initialSelected={{ kind: "edge", id: "edge-1" }}
      />,
    );

    expect(detailsPane().getByText("Interaction")).toBeInTheDocument();
    expect(detailsPane().getByText("geneA")).toBeInTheDocument();
    expect(screen.getByTestId("sigma-canvas")).toHaveAttribute(
      "data-selection",
      "edge-1",
    );
  });

  it("ignores an id the loaded data does not hold and drops it once", async () => {
    resolved({ rows: graphRows, isTruncated: false });
    const onSelectedChange = vi.fn();
    renderGraph(
      <GraphHarness
        rql=""
        keywordValue=""
        onKeywordChange={vi.fn()}
        initialSelected={{ kind: "node", id: "not-in-this-dataset" }}
        onSelectedChange={onSelectedChange}
      />,
    );

    expect(
      detailsPane().getByText("Select a node or edge to see details."),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(onSelectedChange).toHaveBeenCalledWith(null);
    });
    await settle();
    expect(onSelectedChange).toHaveBeenCalledTimes(1);
  });

  it("does not drop the id while the data is still loading or failed", async () => {
    pending();
    const onSelectedChange = vi.fn();
    const { rerender } = renderGraph(
      <GraphHarness
        rql=""
        keywordValue=""
        onKeywordChange={vi.fn()}
        initialSelected={{ kind: "node", id: "node-a" }}
        onSelectedChange={onSelectedChange}
      />,
    );
    failed(new Error("Bad gateway"));
    rerender(
      <GraphHarness
        rql=""
        keywordValue=""
        onKeywordChange={vi.fn()}
        initialSelected={{ kind: "node", id: "node-a" }}
        onSelectedChange={onSelectedChange}
      />,
    );
    await settle();
    expect(onSelectedChange).not.toHaveBeenCalled();
  });

  it("reports a single pick from the node list or the pane as the selected id", async () => {
    const user = userEvent.setup();
    resolved({ rows: graphRows, isTruncated: false });
    const onSelectedChange = vi.fn();
    renderGraph(
      <GraphHarness
        rql=""
        keywordValue=""
        onKeywordChange={vi.fn()}
        onSelectedChange={onSelectedChange}
      />,
    );

    await user.click(screen.getByText("geneA"));
    expect(onSelectedChange).toHaveBeenLastCalledWith({
      kind: "node",
      id: "node-a",
    });
    expect(detailsPane().getByText("node-a")).toBeInTheDocument();

    await user.click(detailsPane().getByRole("button", { name: /geneB/ }));
    expect(onSelectedChange).toHaveBeenLastCalledWith({
      kind: "edge",
      id: "edge-1",
    });
    expect(detailsPane().getByText("Interaction")).toBeInTheDocument();
  });

  it("keeps a bulk pick local and drops the single id", async () => {
    const user = userEvent.setup();
    resolved({ rows: graphRows, isTruncated: false });
    const onSelectedChange = vi.fn();
    renderGraph(
      <GraphHarness
        rql=""
        keywordValue=""
        onKeywordChange={vi.fn()}
        initialSelected={{ kind: "node", id: "node-a" }}
        onSelectedChange={onSelectedChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Sub-Graph" }));
    await user.click(screen.getByRole("button", { name: "Largest Subgraph" }));

    expect(onSelectedChange).toHaveBeenLastCalledWith(null);
    expect(detailsPane().getByText("Multiple selection")).toBeInTheDocument();
    expect(screen.getByTestId("sigma-canvas")).toHaveAttribute(
      "data-selection",
      "node-a,node-b,edge-1",
    );
  });

  it("keeps the single selection through a background refetch that still holds it", async () => {
    resolved({ rows: graphRows, isTruncated: false });
    const onSelectedChange = vi.fn();
    const props = {
      rql: "",
      keywordValue: "",
      onKeywordChange: vi.fn(),
      initialSelected: { kind: "node", id: "node-a" } as const,
      onSelectedChange,
    };
    const { rerender } = renderGraph(<GraphHarness {...props} />);
    expect(detailsPane().getByText("node-a")).toBeInTheDocument();

    // Same rql and keyword, a new `data` object with new row objects: the reset block runs.
    resolved({
      rows: [...graphRows.map((row) => ({ ...row })), {
        id: "edge-2",
        interactor_a: "node-a",
        interactor_b: "node-c",
        gene_a: "geneA",
        gene_b: "geneC",
      }],
      isTruncated: false,
    });
    rerender(<GraphHarness {...props} />);

    expect(detailsPane().getByText("node-a")).toBeInTheDocument();
    expect(detailsPane().getByText("Interactions (2)")).toBeInTheDocument();
    expect(screen.getByTestId("sigma-canvas")).toHaveAttribute(
      "data-selection",
      "node-a",
    );
    await settle();
    expect(onSelectedChange).not.toHaveBeenCalled();
  });

  it("drops the selected id when the scope changes", async () => {
    resolved({ rows: graphRows, isTruncated: false });
    const onSelectedChange = vi.fn();
    const { rerender } = renderGraph(
      <GraphHarness
        rql="eq(a,1)"
        keywordValue=""
        onKeywordChange={vi.fn()}
        initialSelected={{ kind: "node", id: "node-a" }}
        onSelectedChange={onSelectedChange}
      />,
    );
    await settle();
    expect(onSelectedChange).not.toHaveBeenCalled();

    rerender(
      <GraphHarness
        rql="eq(a,2)"
        keywordValue=""
        onKeywordChange={vi.fn()}
        initialSelected={{ kind: "node", id: "node-a" }}
        onSelectedChange={onSelectedChange}
      />,
    );

    await waitFor(() => {
      expect(onSelectedChange).toHaveBeenCalledWith(null);
    });
    expect(
      detailsPane().getByText("Select a node or edge to see details."),
    ).toBeInTheDocument();
  });
});

describe("InteractionsGraph camera", () => {
  // The canvas reloads its graph, and re-fits the camera, whenever it gets new node arrays; a
  // selection or camera write must not hand it new ones for the same rows.
  it("hands the canvas the same nodes across a selection and a camera write", async () => {
    const user = userEvent.setup();
    resolved({ rows: graphRows, isTruncated: false });
    const props = { rql: "", keywordValue: "", onKeywordChange: vi.fn() };
    canvasInputs.nodes.length = 0;
    const { rerender } = renderGraph(<GraphHarness {...props} />);
    await screen.findByTestId("sigma-canvas");
    // The baseline is the array from before the selection, so a selection that swaps the array (and a
    // camera write that reuses the swapped one) still fails.
    const initialNodes = canvasInputs.nodes.at(-1);
    expect(initialNodes).toBeDefined();
    canvasInputs.nodes.length = 0;

    await user.click(screen.getByText("geneA"));
    rerender(
      <GraphHarness {...props} camera={{ ratio: 0.5, x: 0.1, y: 0.2 }} />,
    );

    expect(canvasInputs.nodes.length).toBeGreaterThan(0);
    for (const nodes of canvasInputs.nodes) expect(nodes).toBe(initialNodes);
  });

  it("hands the owner's camera to the canvas and reports the canvas's moves", () => {
    resolved({ rows: graphRows, isTruncated: false });
    const onCameraChange = vi.fn();
    renderGraph(
      <GraphHarness
        rql=""
        keywordValue=""
        onKeywordChange={vi.fn()}
        camera={{ ratio: 0.25, x: 0.3, y: 0.7 }}
        onCameraChange={onCameraChange}
      />,
    );

    const canvas = screen.getByTestId("sigma-canvas");
    expect(canvas).toHaveAttribute("data-camera", "0.25");
    fireEvent.doubleClick(canvas);
    expect(onCameraChange).toHaveBeenCalledWith({ ratio: 0.5, x: 0.1, y: 0.2 });
  });
});

describe("InteractionsGraph layout", () => {
  it("covers the canvas with a status while the layout runs, and holds Export", async () => {
    resolved({ rows: graphRows, isTruncated: false });
    const resolveLayout = deferredLayout();

    renderGraph(
      <GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />,
    );

    expect(await screen.findByRole("status")).toHaveTextContent("Laying out…");
    fireEvent.click(screen.getByTestId("sigma-canvas"));
    expect(screen.getByTestId("sigma-canvas")).toHaveAttribute(
      "data-positions",
      "none",
    );
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();

    resolveLayout(new Float64Array(4));

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("sigma-canvas")).toHaveAttribute(
      "data-positions",
      "4",
    );
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
  });

  it("lays out the picked layout and shows its label on the select", async () => {
    const user = userEvent.setup();
    resolved({ rows: graphRows, isTruncated: false });

    renderGraph(
      <GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("sigma-canvas")).toHaveAttribute(
        "data-positions",
        "4",
      );
    });
    expect(vi.mocked(requestGraphLayout).mock.calls.at(-1)?.[0].layout).toBe(
      "forceatlas2",
    );

    const resolveLayout = deferredLayout();
    await user.click(screen.getByRole("combobox", { name: "Layout" }));
    await user.click(await screen.findByRole("option", { name: "Circular" }));

    expect(screen.getByRole("combobox", { name: "Layout" })).toHaveTextContent(
      "Circular",
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Laying out…");
    fireEvent.click(screen.getByTestId("sigma-canvas"));
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
    expect(vi.mocked(requestGraphLayout).mock.calls.at(-1)?.[0].layout).toBe(
      "circular",
    );

    resolveLayout(new Float64Array(4));
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
  });

  it("shows the layout's real error with a Retry that lays out again", async () => {
    const user = userEvent.setup();
    resolved({ rows: graphRows, isTruncated: false });
    vi.mocked(requestGraphLayout).mockRejectedValueOnce(
      new Error("Graph.addEdge: source node not found"),
    );

    renderGraph(
      <GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />,
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not lay out the graph");
    expect(alert).toHaveTextContent("Graph.addEdge: source node not found");
    fireEvent.click(screen.getByTestId("sigma-canvas"));
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();

    await user.click(within(alert).getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.getByTestId("sigma-canvas")).toHaveAttribute(
        "data-positions",
        "4",
      );
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(requestGraphLayout).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
  });
});

describe("InteractionsGraph multi-selection", () => {
  it("adds a node on a Cmd-click in the node list and replaces on a plain click", () => {
    resolved({ rows: graphRows, isTruncated: false });
    renderGraph(
      <GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />,
    );
    const details = screen.getByLabelText("Selection details");

    fireEvent.click(screen.getByRole("option", { name: "geneA" }));
    expect(within(details).getByText("Interactions (1)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "geneB" }), {
      metaKey: true,
    });
    expect(within(details).getByText("Multiple selection")).toBeInTheDocument();
    expect(
      within(details).getByText("2 proteins and 0 interactions selected."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "geneB" }));
    expect(within(details).queryByText("Multiple selection")).toBeNull();
    expect(within(details).getByText("Interactions (1)")).toBeInTheDocument();
    // Both genes show "Interactions (1)", so the BRC ID is what says the click kept geneB only.
    expect(within(details).getByText("node-b")).toBeInTheDocument();
    expect(within(details).queryByText("node-a")).toBeNull();
  });

  // Next renders the URL write behind `selected` in a transition, so a quick Cmd/Ctrl-click can land
  // before the prop has caught up with the plain click before it.
  it("builds on a pick whose URL write the owner has not rendered yet", () => {
    resolved({ rows: graphRows, isTruncated: false });
    const onSelectedChange = vi.fn();
    const props = {
      rql: "",
      keywordValue: "",
      onKeywordChange: vi.fn(),
      layout: defaultLayout,
      onLayoutChange: vi.fn(),
      onSelectedChange,
      camera: null,
      onCameraChange: vi.fn(),
    };
    const { rerender } = renderGraph(
      <InteractionsGraph {...props} selected={null} />,
    );

    fireEvent.click(screen.getByRole("option", { name: "geneA" }));
    expect(onSelectedChange).toHaveBeenLastCalledWith({
      kind: "node",
      id: "node-a",
    });
    expect(detailsPane().getByText("node-a")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "geneB" }), {
      metaKey: true,
    });
    expect(onSelectedChange).toHaveBeenLastCalledWith(null);
    expect(
      detailsPane().getByText("2 proteins and 0 interactions selected."),
    ).toBeInTheDocument();

    // The first write lands after the second click; the local multi-item pick still wins.
    rerender(
      <InteractionsGraph {...props} selected={{ kind: "node", id: "node-a" }} />,
    );
    expect(
      detailsPane().getByText("2 proteins and 0 interactions selected."),
    ).toBeInTheDocument();
  });

  // The held pick must not outlive the owner catching up, or a later change to `selected` from
  // outside (Back, a shared link) would keep showing the old pick.
  it("stops holding a pick once the owner renders it, so a later outside change shows", () => {
    resolved({ rows: graphRows, isTruncated: false });
    const props = {
      rql: "",
      keywordValue: "",
      onKeywordChange: vi.fn(),
      layout: defaultLayout,
      onLayoutChange: vi.fn(),
      onSelectedChange: vi.fn(),
      camera: null,
      onCameraChange: vi.fn(),
    };
    const { rerender } = renderGraph(
      <InteractionsGraph {...props} selected={null} />,
    );

    fireEvent.click(screen.getByRole("option", { name: "geneA" }));
    rerender(
      <InteractionsGraph {...props} selected={{ kind: "node", id: "node-a" }} />,
    );
    expect(detailsPane().getByText("node-a")).toBeInTheDocument();

    // The owner has not rendered this pick yet, so the pane shows it from the held copy.
    fireEvent.click(screen.getByRole("option", { name: "geneB" }));
    expect(detailsPane().getByText("node-b")).toBeInTheDocument();
    expect(detailsPane().queryByText("node-a")).toBeNull();

    rerender(
      <InteractionsGraph {...props} selected={{ kind: "node", id: "node-b" }} />,
    );
    expect(detailsPane().getByText("node-b")).toBeInTheDocument();

    // A change nobody here made: with the held copy gone, the pane follows the prop again.
    rerender(
      <InteractionsGraph {...props} selected={{ kind: "node", id: "node-a" }} />,
    );
    expect(detailsPane().getByText("node-a")).toBeInTheDocument();
    expect(detailsPane().queryByText("node-b")).toBeNull();
  });

  it("writes a multi-item pick as no id and a toggle back to one item as its id", () => {
    resolved({ rows: graphRows, isTruncated: false });
    const onSelectedChange = vi.fn();
    renderGraph(
      <GraphHarness
        rql=""
        keywordValue=""
        onKeywordChange={vi.fn()}
        onSelectedChange={onSelectedChange}
      />,
    );

    fireEvent.click(screen.getByRole("option", { name: "geneA" }));
    fireEvent.click(screen.getByRole("option", { name: "geneB" }), {
      metaKey: true,
    });
    expect(onSelectedChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByTestId("sigma-canvas")).toHaveAttribute(
      "data-selection",
      "node-a,node-b",
    );

    fireEvent.click(screen.getByRole("option", { name: "geneA" }), {
      metaKey: true,
    });
    expect(onSelectedChange).toHaveBeenLastCalledWith({
      kind: "node",
      id: "node-b",
    });
    expect(screen.getByTestId("sigma-canvas")).toHaveAttribute(
      "data-selection",
      "node-b",
    );
  });
});
