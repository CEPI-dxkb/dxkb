import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useState, type ComponentProps } from "react";

import { InteractionsGraph } from "../interactions-graph";
import {
  interactionsGraphRowLimit,
  useInteractions,
  useInteractionsTotal,
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
import { server } from "@/test-helpers/msw-server";
import { stubMenuLayout } from "@/test-helpers/menu-layout";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { settleBackgroundWork } from "@/test-helpers/settle";

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
  // The real hook would send a count read through MSW's strict mode.
  useInteractionsTotal: vi.fn(() => ({ data: undefined })),
}));

vi.mock("@/lib/interactions/layout-client", () => ({
  requestGraphLayout: vi.fn(),
}));

const canvasInputs = vi.hoisted(() => ({
  nodes: [] as unknown[],
  incidence: [] as unknown[],
}));

vi.mock("../sigma/sigma-canvas", () => ({
  SigmaCanvas: ({
    onReady,
    nodes,
    incidence,
    positions,
    selection,
    camera,
    onCameraChange,
  }: {
    onReady: () => void;
    nodes: unknown;
    incidence: unknown;
    positions: Float64Array | null;
    selection: GraphSelection;
    camera?: GraphCameraView | null;
    onCameraChange?: (camera: GraphCameraView | null) => void;
  }) => {
    canvasInputs.nodes.push(nodes);
    canvasInputs.incidence.push(incidence);
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
  // `clearMocks` keeps a return value, so each test starts from the pending query again.
  pending();
  vi.mocked(useInteractionsTotal).mockReturnValue({
    data: undefined,
  } as ReturnType<typeof useInteractionsTotal>);
});

function deferredLayout() {
  let resolve: (positions: Float64Array) => void = () => undefined;
  const promise = new Promise<Float64Array>((settle) => {
    resolve = settle;
  });
  vi.mocked(requestGraphLayout).mockReturnValueOnce(promise);
  return resolve;
}

type GraphProps = ComponentProps<typeof InteractionsGraph>;
type GraphHarnessProps = Omit<
  GraphProps,
  | "layout"
  | "onLayoutChange"
  | "filters"
  | "facetRql"
  | "onFilterChange"
  | "scopeRql"
  | "selected"
  | "onSelectedChange"
  | "camera"
  | "onCameraChange"
> &
  Partial<Pick<GraphProps, "filters" | "facetRql" | "onFilterChange">> & {
    /** The unfiltered scope; defaults to `rql`, so a new `rql` is a new scope unless a test says otherwise. */
    scopeRql?: string;
    initialSelected?: GraphSelectionRef | null;
    onSelectedChange?: (next: GraphSelectionRef | null) => void;
    camera?: GraphCameraView | null;
    onCameraChange?: (next: GraphCameraView | null) => void;
  };

const noFilters: GraphProps["filters"] = {};
const noFacetRql = () => undefined;

/** Stands in for the shell, which keeps the single selection in the URL. */
function GraphHarness({
  filters = noFilters,
  facetRql = noFacetRql,
  onFilterChange = vi.fn(),
  scopeRql,
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
      scopeRql={scopeRql ?? props.rql}
      filters={filters}
      facetRql={facetRql}
      onFilterChange={onFilterChange}
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

function pending() {
  vi.mocked(useInteractions).mockReturnValue({
    data: undefined,
    isPending: true,
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

function detailsPane() {
  return within(screen.getByLabelText("Selection details"));
}

stubMenuLayout();
vi.stubGlobal("scrollTo", vi.fn());

interface FacetRequest {
  rql: string | null;
  keyword: string | null;
  facets: string[];
}

/** Answers the Filters menu's count reads (GET) and records what each asked for. */
function serveFacetCounts(
  respond: () => Response = () =>
    HttpResponse.json({
      rows: [],
      total: 15,
      facets: {
        interaction_type: [
          { value: "association", count: 12 },
          { value: "physical association", count: 3 },
        ],
        category: [],
        detection_method: [],
      },
      page: 1,
      pageSize: 1,
    }),
) {
  const requests: FacetRequest[] = [];
  server.use(
    http.get("/api/data/ppi", ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push({
        rql: params.get("rql"),
        keyword: params.get("keyword"),
        facets: params.getAll("facet"),
      });
      return respond();
    }),
  );
  return requests;
}

async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Filters/ }));
  return screen.findByRole("listbox", { name: "Filters" });
}

describe("InteractionsGraph query inputs", () => {
  it("passes the scope predicate and the shared keyword through untouched", () => {
    renderGraph(
      <GraphHarness
        rql="eq(evidence,experimental)"
        keywordValue="  groEL   dnaK "
        onKeywordChange={vi.fn()}
      />,
    );

    // No selection: the third argument is empty.
    expect(useInteractions).toHaveBeenCalledWith(
      "eq(evidence,experimental)",
      "  groEL   dnaK ",
      undefined,
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
      undefined,
    );
    await waitFor(() => {
      expect(onKeywordChange).toHaveBeenLastCalledWith("dnaK");
    });
    expect(useInteractions).toHaveBeenLastCalledWith(
      "eq(evidence,experimental)",
      "groEL",
      undefined,
    );
  });
});

describe("InteractionsGraph filters", () => {
  it("offers the Filters menu while loading, after a failure and once loaded", () => {
    pending();
    const { unmount } = renderGraph(
      <GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /^Filters/ })).toBeInTheDocument();
    unmount();

    failed(new Error("Bad gateway"));
    const failedRender = renderGraph(
      <GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />,
    );
    expect(screen.getByText("Could not load interactions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Filters/ })).toBeInTheDocument();
    failedRender.unmount();

    resolved({ rows: graphRows, isTruncated: false });
    renderGraph(
      <GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />,
    );
    expect(screen.getByText("geneA")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Filters/ })).toBeInTheDocument();
  });

  it("keeps the Filters menu open, and drops the stale selection, while a pick's rows load", async () => {
    const user = userEvent.setup();
    serveFacetCounts();
    const scope = "eq(evidence,experimental)";
    const narrowed = `and(${scope},eq(interaction_type,association))`;
    resolved({ rows: graphRows, isTruncated: false });
    const { rerender } = renderGraph(
      <GraphHarness rql={scope} keywordValue="" onKeywordChange={vi.fn()} />,
    );
    await user.click(screen.getByText("geneA"));
    expect(screen.getByText("node-a")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hub Protein" }));
    await user.click(
      screen.getByRole("button", { name: "Most Connected Hub" }),
    );
    await openFilters(user);

    // A pick: the shell hands down the narrowed rql, whose rows are a new query.
    pending();
    rerender(
      <GraphHarness
        rql={narrowed}
        keywordValue=""
        onKeywordChange={vi.fn()}
        filters={{ interaction_type: ["association"] }}
      />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Filters" })).toBeInTheDocument();

    resolved({ rows: graphRows, isTruncated: false });
    rerender(
      <GraphHarness
        rql={narrowed}
        keywordValue=""
        onKeywordChange={vi.fn()}
        filters={{ interaction_type: ["association"] }}
      />,
    );

    expect(useInteractions).toHaveBeenLastCalledWith(narrowed, "", undefined);
    expect(screen.getByText("geneA")).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Filters" })).toBeInTheDocument();
    expect(
      screen.getByText("Select a node or edge to see details."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hub Protein" })).toBeInTheDocument();
  });

  it("counts each facet over its own scope and the shared keyword, once the menu opens", async () => {
    const user = userEvent.setup();
    const requests = serveFacetCounts();
    resolved({ rows: graphRows, isTruncated: false });
    renderGraph(
      <GraphHarness
        rql="and(eq(evidence,experimental),eq(interaction_type,association))"
        keywordValue="groEL"
        onKeywordChange={vi.fn()}
        filters={{ interaction_type: ["association"] }}
        facetRql={(field) =>
          field === "interaction_type"
            ? "eq(evidence,experimental)"
            : "and(eq(evidence,experimental),eq(interaction_type,association))"
        }
      />,
    );
    expect(requests).toEqual([]);

    await openFilters(user);

    await waitFor(() => {
      expect(requests.flatMap((request) => request.facets).sort()).toEqual([
        "category",
        "detection_method",
        "evidence",
        "interaction_type",
      ]);
    });
    expect(requests).toContainEqual({
      rql: "eq(evidence,experimental)",
      keyword: "groEL",
      facets: ["interaction_type"],
    });
    expect(requests).toContainEqual({
      rql: "and(eq(evidence,experimental),eq(interaction_type,association))",
      keyword: "groEL",
      facets: expect.arrayContaining(["category", "detection_method"]) as string[],
    });
  });

  it("reports a pick to the filter owner with the shared keyword", async () => {
    const user = userEvent.setup();
    serveFacetCounts();
    const onFilterChange = vi.fn();
    const onKeywordChange = vi.fn();
    resolved({ rows: graphRows, isTruncated: false });
    renderGraph(
      <GraphHarness
        rql=""
        keywordValue="groEL"
        onKeywordChange={onKeywordChange}
        onFilterChange={onFilterChange}
      />,
    );

    const menu = await openFilters(user);
    await user.click(
      within(menu).getByRole("option", { name: /^Interaction Type/ }),
    );
    await user.click(
      await within(
        screen.getByRole("listbox", { name: "Interaction Type values" }),
      ).findByRole("option", { name: /^association/ }),
    );

    expect(onFilterChange).toHaveBeenCalledWith({
      keyword: "groEL",
      filters: { interaction_type: ["association"] },
    });
    expect(onKeywordChange).not.toHaveBeenCalled();
  });

  it("shows why the filter values failed, and retries them", async () => {
    const user = userEvent.setup();
    let failing = true;
    const requests = serveFacetCounts(() =>
      failing
        ? HttpResponse.json({ error: "Solr is down" }, { status: 502 })
        : HttpResponse.json({
            rows: [],
            total: 0,
            facets: {},
            page: 1,
            pageSize: 1,
          }),
    );
    resolved({ rows: graphRows, isTruncated: false });
    renderGraph(
      <GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />,
    );

    await openFilters(user);
    // The menu and the toolbar's alert both say it.
    expect(
      await screen.findAllByText(/Could not load filter values: .*Solr is down/),
    ).not.toHaveLength(0);
    const requestsBeforeRetry = requests.length;

    failing = false;
    await user.click(screen.getAllByRole("button", { name: "Retry" })[0]);

    await waitFor(() => {
      expect(
        screen.queryByText(/Could not load filter values/),
      ).not.toBeInTheDocument();
    });
    expect(requests.length).toBeGreaterThan(requestsBeforeRetry);
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
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("use the Table subview to see them all");
    // Each control the banner sends the user to, named as it is labelled.
    expect(alert).toHaveTextContent(/Filters menu/);
    expect(alert).toHaveTextContent(/interaction type/i);
    expect(alert).toHaveTextContent(/detection method/i);
    expect(alert).toHaveTextContent(/evidence/i);
    expect(alert).toHaveTextContent(/Focus on this protein/);
    expect(alert).toHaveTextContent(/Show in Graph/);
    expect(
      screen.getByRole("button", { name: /^Filters/ }),
    ).toBeInTheDocument();
  });

  it("stays quiet when every matching interaction is drawn", () => {
    resolved({ rows: graphRows, isTruncated: false });

    renderGraph(<GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("draws no alert for the open Filters menu either", async () => {
    const user = userEvent.setup();
    serveFacetCounts();
    resolved({ rows: graphRows, isTruncated: false });

    renderGraph(<GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />);
    await openFilters(user);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  describe("total count", () => {
    const scope = "eq(evidence,experimental)";

    function total(data: number | undefined) {
      vi.mocked(useInteractionsTotal).mockReturnValue({
        data,
      } as ReturnType<typeof useInteractionsTotal>);
    }

    it("names how many interactions match once the count is known", () => {
      resolved({ rows: graphRows, isTruncated: true });
      total(124_566);

      renderGraph(<GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />);

      expect(
        screen.getByText(
          `Showing the first ${interactionsGraphRowLimit.toLocaleString()} of 124,566 interactions`,
        ),
      ).toBeInTheDocument();
    });

    it("keeps the title without a count while the count is not known", () => {
      resolved({ rows: graphRows, isTruncated: true });
      total(undefined);

      renderGraph(<GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />);

      expect(
        screen.getByText(
          `Showing the first ${interactionsGraphRowLimit.toLocaleString()} interactions`,
        ),
      ).toBeInTheDocument();
      const alert = screen.getByRole("alert");
      expect(
        within(alert).queryByText(/^Showing the first [\d,]+ of /),
      ).not.toBeInTheDocument();
    });

    it.each([
      // The count and the export are separate reads, so a count can lag a changed result set.
      ["below the row limit", interactionsGraphRowLimit - 10],
      ["exactly the row limit", interactionsGraphRowLimit],
    ])("keeps the plain title for a count %s", (_name, count) => {
      resolved({ rows: graphRows, isTruncated: true });
      total(count);

      renderGraph(<GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />);

      const alert = screen.getByRole("alert");
      expect(
        within(alert).getByText(
          `Showing the first ${interactionsGraphRowLimit.toLocaleString()} interactions`,
        ),
      ).toBeInTheDocument();
      expect(
        within(alert).queryByText(/^Showing the first [\d,]+ of /),
      ).not.toBeInTheDocument();
    });

    it("names the total once it exceeds the row limit by one", () => {
      resolved({ rows: graphRows, isTruncated: true });
      total(interactionsGraphRowLimit + 1);

      renderGraph(<GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />);

      expect(
        screen.getByText(
          `Showing the first ${interactionsGraphRowLimit.toLocaleString()} of ${(interactionsGraphRowLimit + 1).toLocaleString()} interactions`,
        ),
      ).toBeInTheDocument();
    });

    it("asks for the count of the graph's own scope and keyword once the graph is truncated", () => {
      resolved({ rows: graphRows, isTruncated: true });

      renderGraph(
        <GraphHarness rql={scope} keywordValue="groEL" onKeywordChange={vi.fn()} />,
      );

      expect(useInteractionsTotal).toHaveBeenLastCalledWith(scope, "groEL", true);
    });

    it("does not ask for a count when every matching interaction is drawn", () => {
      resolved({ rows: graphRows, isTruncated: false });

      renderGraph(
        <GraphHarness rql={scope} keywordValue="" onKeywordChange={vi.fn()} />,
      );

      expect(useInteractionsTotal).toHaveBeenLastCalledWith(scope, "", false);
    });

    it("does not ask for a count before the rows have loaded", () => {
      renderGraph(
        <GraphHarness rql={scope} keywordValue="" onKeywordChange={vi.fn()} />,
      );

      expect(useInteractionsTotal).toHaveBeenLastCalledWith(scope, "", false);
    });

    it("does not ask for a count while a Table selection is shown", () => {
      resolved({ rows: graphRows, isTruncated: true });

      renderGraph(
        <GraphHarness
          rql={scope}
          keywordValue=""
          onKeywordChange={vi.fn()}
          selection={{ ids: ["edge-1"], version: 1, onClear: vi.fn() }}
        />,
      );

      expect(useInteractionsTotal).toHaveBeenLastCalledWith(scope, "", false);
    });
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

describe("InteractionsGraph narrowed scope", () => {
  it("clears active presets when a filter narrows the rql, and leaves the selection to its owner", async () => {
    const user = userEvent.setup();
    resolved({ rows: graphRows, isTruncated: false });
    const scope = "eq(evidence,experimental)";
    const narrowed = `and(${scope},eq(interaction_type,association))`;

    const { rerender } = renderGraph(
      <GraphHarness rql={scope} keywordValue="" onKeywordChange={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: "Hub Protein" }));
    await user.click(
      screen.getByRole("button", { name: "Most Connected Hub" }),
    );
    expect(detailsPane().getByText("Multiple selection")).toBeInTheDocument();

    const onSelectedChange = vi.fn();
    rerender(
      <GraphHarness
        rql={narrowed}
        scopeRql={scope}
        keywordValue=""
        onKeywordChange={vi.fn()}
        filters={{ interaction_type: ["association"] }}
        onSelectedChange={onSelectedChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Hub Protein" })).toBeInTheDocument();
    });
    expect(
      detailsPane().getByText("Select a node or edge to see details."),
    ).toBeInTheDocument();
    // The shell writes the selection with the pick; the Graph writes none of its own.
    await settleBackgroundWork();
    expect(onSelectedChange).not.toHaveBeenCalled();
    expect(useInteractions).toHaveBeenLastCalledWith(narrowed, "", undefined);
  });
});

describe("InteractionsGraph protein focus", () => {
  const twoNodeRows: PpiRecord[] = [
    ...graphRows,
    {
      id: "edge-2",
      interactor_a: "node-a",
      interactor_b: "node-c",
      gene_a: "geneA",
      gene_b: "geneC",
    },
  ];
  const focusedData = { rows: twoNodeRows, isTruncated: false };

  it("selects the focused protein when the scope changes on its own", async () => {
    resolved(focusedData);
    const onSelectedChange = vi.fn();
    const props = {
      keywordValue: "",
      onKeywordChange: vi.fn(),
      focusId: "node-a",
      onSelectedChange,
    };
    const { rerender } = renderGraph(<GraphHarness {...props} rql="eq(a,1)" />);
    expect(
      detailsPane().getByText("Select a node or edge to see details."),
    ).toBeInTheDocument();

    rerender(<GraphHarness {...props} rql="eq(a,2)" />);

    await waitFor(() => {
      expect(onSelectedChange).toHaveBeenCalledWith({
        kind: "node",
        id: "node-a",
      });
    });
    // The detail panel lists the node's BRC ID, which only a selection shows.
    expect(detailsPane().getByText("node-a")).toBeInTheDocument();
  });

  it("leaves the selection to its owner when the filters change the rql inside one scope", async () => {
    resolved(focusedData);
    const onSelectedChange = vi.fn();
    const props = {
      keywordValue: "",
      onKeywordChange: vi.fn(),
      focusId: "node-a",
      layout: defaultLayout,
      onLayoutChange: vi.fn(),
      filters: {},
      facetRql: () => undefined,
      onFilterChange: vi.fn(),
      onSelectedChange,
      camera: null,
      onCameraChange: vi.fn(),
      scopeRql: "eq(a,*)",
    };
    // A Back step over a focus or a pick: the entry's own selection, the same node on both sides.
    const { rerender } = renderGraph(
      <InteractionsGraph
        {...props}
        rql="and(eq(a,*),eq(interactor,node-a))"
        selected={{ kind: "node", id: "node-c" }}
      />,
    );

    rerender(
      <InteractionsGraph
        {...props}
        rql="eq(a,*)"
        selected={{ kind: "node", id: "node-c" }}
      />,
    );

    expect(detailsPane().getByText("node-c")).toBeInTheDocument();
    await settleBackgroundWork();
    expect(onSelectedChange).not.toHaveBeenCalled();
  });

  it("drops a focused protein the new scope's rows lack, like any stale id", async () => {
    resolved(focusedData);
    const onSelectedChange = vi.fn();
    const props = {
      keywordValue: "",
      onKeywordChange: vi.fn(),
      focusId: "node-z",
      onSelectedChange,
    };
    const { rerender } = renderGraph(<GraphHarness {...props} rql="eq(a,1)" />);

    rerender(<GraphHarness {...props} rql="eq(a,2)" />);

    await waitFor(() => {
      expect(onSelectedChange).toHaveBeenLastCalledWith(null);
    });
    expect(onSelectedChange).toHaveBeenCalledWith({
      kind: "node",
      id: "node-z",
    });
    expect(
      detailsPane().getByText("Select a node or edge to see details."),
    ).toBeInTheDocument();
  });

  it("passes the selected node to onFocusNode from the detail panel", async () => {
    const user = userEvent.setup();
    const onFocusNode = vi.fn();
    resolved(focusedData);
    renderGraph(
      <GraphHarness
        rql=""
        keywordValue=""
        onKeywordChange={vi.fn()}
        onFocusNode={onFocusNode}
      />,
    );

    await user.click(screen.getByText("geneC"));
    await user.click(
      screen.getByRole("button", { name: "Focus on this protein" }),
    );

    expect(onFocusNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: "node-c" }),
    );
  });

  it("offers no focus button without onFocusNode", async () => {
    const user = userEvent.setup();
    resolved(focusedData);
    renderGraph(
      <GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />,
    );

    await user.click(screen.getByText("geneC"));

    expect(screen.getByText("node-c")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Focus on this protein" }),
    ).not.toBeInTheDocument();
  });
});

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
    await settleBackgroundWork();
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
    await settleBackgroundWork();
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
    await settleBackgroundWork();
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
    await settleBackgroundWork();
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
    await settleBackgroundWork();
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

  it("hands the canvas the same incidence index across a selection and a camera write", async () => {
    const user = userEvent.setup();
    resolved({ rows: graphRows, isTruncated: false });
    const props = { rql: "", keywordValue: "", onKeywordChange: vi.fn() };
    canvasInputs.incidence.length = 0;
    const { rerender } = renderGraph(<GraphHarness {...props} />);
    await screen.findByTestId("sigma-canvas");
    const initialIndex = canvasInputs.incidence.at(-1);
    expect(initialIndex).toBeDefined();
    canvasInputs.incidence.length = 0;

    await user.click(screen.getByText("geneA"));
    rerender(
      <GraphHarness {...props} camera={{ ratio: 0.5, x: 0.1, y: 0.2 }} />,
    );

    // A new index would give the canvas a new focus set and reinstall its reducers each time.
    expect(canvasInputs.incidence.length).toBeGreaterThan(0);
    for (const index of canvasInputs.incidence) expect(index).toBe(initialIndex);
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

describe("InteractionsGraph row selection", () => {
  const scope = "eq(evidence,experimental)";

  function rowSelection(
    ids: readonly string[] = ["edge-1", "edge-2", "edge-3"],
    version = 1,
    onClear = vi.fn(),
  ) {
    return { ids, version, onClear };
  }

  it("asks for the selected rows, beside the unchanged rql and keyword", () => {
    const selection = rowSelection();
    renderGraph(
      <GraphHarness
        rql={scope}
        keywordValue="groEL"
        onKeywordChange={vi.fn()}
        selection={selection}
      />,
    );

    expect(useInteractions).toHaveBeenLastCalledWith(scope, "groEL", selection);
  });

  it("replaces the keyword box and Filters menu with the selection chip in every state", () => {
    const expectChip = () => {
      expect(
        screen.getByText("Showing 3 selected interactions"),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Show all" })).toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText("Search interaction results..."),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^Filters/ }),
      ).not.toBeInTheDocument();
    };

    pending();
    const loading = renderGraph(
      <GraphHarness
        rql={scope}
        keywordValue=""
        onKeywordChange={vi.fn()}
        selection={rowSelection()}
      />,
    );
    expectChip();
    loading.unmount();

    failed(new Error("Bad gateway"));
    const failure = renderGraph(
      <GraphHarness
        rql={scope}
        keywordValue=""
        onKeywordChange={vi.fn()}
        selection={rowSelection()}
      />,
    );
    expect(screen.getByText("Could not load interactions")).toBeInTheDocument();
    expectChip();
    failure.unmount();

    resolved({ rows: graphRows, isTruncated: false });
    renderGraph(
      <GraphHarness
        rql={scope}
        keywordValue=""
        onKeywordChange={vi.fn()}
        selection={rowSelection()}
      />,
    );
    expect(screen.getByText("geneA")).toBeInTheDocument();
    expectChip();
  });

  it("counts a single selected interaction in the singular", () => {
    resolved({ rows: graphRows, isTruncated: false });
    renderGraph(
      <GraphHarness
        rql={scope}
        keywordValue=""
        onKeywordChange={vi.fn()}
        selection={rowSelection(["edge-1"])}
      />,
    );

    expect(
      screen.getByText("Showing 1 selected interaction"),
    ).toBeInTheDocument();
  });

  it("goes back to every interaction from Show all", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    resolved({ rows: graphRows, isTruncated: false });
    renderGraph(
      <GraphHarness
        rql={scope}
        keywordValue=""
        onKeywordChange={vi.fn()}
        selection={rowSelection(undefined, 1, onClear)}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Show all" }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("asks for no filter counts while a selection is shown", async () => {
    const user = userEvent.setup();
    const requests = serveFacetCounts();
    resolved({ rows: graphRows, isTruncated: false });
    const { rerender } = renderGraph(
      <GraphHarness
        rql={scope}
        keywordValue=""
        onKeywordChange={vi.fn()}
        facetRql={() => scope}
      />,
    );
    await openFilters(user);
    await waitFor(() => {
      expect(requests.length).toBeGreaterThan(0);
    });
    const requestsBeforeSelection = requests.length;

    // The menu had asked for the counts; a selection (and a keyword the Table changes under it)
    // must not ask again.
    rerender(
      <GraphHarness
        rql={scope}
        keywordValue="groEL"
        onKeywordChange={vi.fn()}
        facetRql={() => scope}
        selection={rowSelection()}
      />,
    );
    await settleBackgroundWork();

    expect(requests).toHaveLength(requestsBeforeSelection);
  });

  it("draws no truncation banner for a selection", () => {
    resolved({ rows: graphRows, isTruncated: false });
    renderGraph(
      <GraphHarness
        rql={scope}
        keywordValue=""
        onKeywordChange={vi.fn()}
        selection={rowSelection()}
      />,
    );

    expect(
      screen.queryByText(/Showing the first/),
    ).not.toBeInTheDocument();
    // The selection chip is a plain badge, not an alert.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the stale node selection and presets when a new selection arrives", async () => {
    const user = userEvent.setup();
    const data = { rows: graphRows, isTruncated: false };
    resolved(data);
    const { rerender } = renderGraph(
      <GraphHarness
        rql={scope}
        keywordValue=""
        onKeywordChange={vi.fn()}
        selection={rowSelection(["edge-1"], 1)}
      />,
    );
    await user.click(screen.getByText("geneA"));
    expect(screen.getByText("node-a")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hub Protein" }));
    await user.click(
      screen.getByRole("button", { name: "Most Connected Hub" }),
    );

    // The same rows object (a cached read): only the version says it is a new selection.
    rerender(
      <GraphHarness
        rql={scope}
        keywordValue=""
        onKeywordChange={vi.fn()}
        selection={rowSelection(["edge-1"], 2)}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Select a node or edge to see details."),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Hub Protein" })).toBeInTheDocument();
  });

  // The shell's Focus leaves a selection, so a selection and a focus meet only when Show in Graph
  // runs on a Table already narrowed to a protein (the focus is in the URL), and the shell then
  // writes the focused protein as the selected node.
  it("selects the focused protein among a selection's rows when the Table was already focused", () => {
    resolved({ rows: graphRows, isTruncated: false });
    renderGraph(
      <GraphHarness
        rql={scope}
        keywordValue=""
        onKeywordChange={vi.fn()}
        focusId="node-a"
        initialSelected={{ kind: "node", id: "node-a" }}
        selection={rowSelection(["edge-1"])}
      />,
    );

    // The detail panel lists the node's BRC ID, which only a selection shows.
    expect(screen.getByText("node-a")).toBeInTheDocument();
    expect(
      screen.queryByText("Select a node or edge to see details."),
    ).not.toBeInTheDocument();
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
      scopeRql: "",
      filters: noFilters,
      facetRql: noFacetRql,
      onFilterChange: vi.fn(),
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
      scopeRql: "",
      filters: noFilters,
      facetRql: noFacetRql,
      onFilterChange: vi.fn(),
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
