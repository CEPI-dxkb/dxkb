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
import type { LayoutName, PpiRecord } from "@/lib/interactions/types";
import { createQueryClientWrapper } from "@/test-helpers/react";

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

vi.mock("../sigma/sigma-canvas", () => ({
  SigmaCanvas: ({
    onReady,
    positions,
  }: {
    onReady: () => void;
    positions: Float64Array | null;
  }) => (
    <button
      type="button"
      data-testid="sigma-canvas"
      data-positions={positions ? String(positions.length) : "none"}
      onClick={onReady}
    >
      Mark canvas ready
    </button>
  ),
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
  "layout" | "onLayoutChange"
>;

function GraphHarness(props: GraphHarnessProps) {
  const [layout, setLayout] = useState<LayoutName>(defaultLayout);
  return (
    <InteractionsGraph {...props} layout={layout} onLayoutChange={setLayout} />
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
