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
import type { LayoutName, PpiRecord } from "@/lib/interactions/types";
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
  "layout" | "onLayoutChange" | "filters" | "facetRql" | "onFilterChange"
> &
  Partial<Pick<GraphProps, "filters" | "facetRql" | "onFilterChange">>;

const noFilters: GraphProps["filters"] = {};
const noFacetRql = () => undefined;

function GraphHarness({
  filters = noFilters,
  facetRql = noFacetRql,
  onFilterChange = vi.fn(),
  ...props
}: GraphHarnessProps) {
  const [layout, setLayout] = useState<LayoutName>(defaultLayout);
  return (
    <InteractionsGraph
      {...props}
      filters={filters}
      facetRql={facetRql}
      onFilterChange={onFilterChange}
      layout={layout}
      onLayoutChange={setLayout}
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
    expect(screen.getByRole("alert")).toHaveTextContent(
      "use the Table subview to see them all",
    );
  });

  it("stays quiet when every matching interaction is drawn", () => {
    resolved({ rows: graphRows, isTruncated: false });

    renderGraph(<GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />);

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
      expect(screen.queryByText(/ of /)).not.toBeInTheDocument();
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
  it("clears stale selection and active presets when a filter narrows the rql", async () => {
    const user = userEvent.setup();
    resolved({ rows: graphRows, isTruncated: false });
    const scope = "eq(evidence,experimental)";

    const { rerender } = renderGraph(
      <GraphHarness rql={scope} keywordValue="" onKeywordChange={vi.fn()} />,
    );

    await user.click(screen.getByText("geneA"));
    expect(screen.getByText("node-a")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hub Protein" }));
    await user.click(
      screen.getByRole("button", { name: "Most Connected Hub" }),
    );

    rerender(
      <GraphHarness
        rql={`and(${scope},eq(interaction_type,association))`}
        keywordValue=""
        onKeywordChange={vi.fn()}
        filters={{ interaction_type: ["association"] }}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Select a node or edge to see details."),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Hub Protein" })).toBeInTheDocument();
    expect(useInteractions).toHaveBeenLastCalledWith(
      `and(${scope},eq(interaction_type,association))`,
      "",
      undefined,
    );
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

  it("selects the focused protein when its data arrives", () => {
    const { rerender } = renderGraph(
      <GraphHarness
        rql="focused"
        keywordValue=""
        onKeywordChange={vi.fn()}
        focusId="node-a"
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Focus on this protein" }),
    ).not.toBeInTheDocument();

    resolved(focusedData);
    rerender(
      <GraphHarness
        rql="focused"
        keywordValue=""
        onKeywordChange={vi.fn()}
        focusId="node-a"
      />,
    );

    // The detail panel lists the node's BRC ID, which only a selection shows.
    expect(screen.getByText("node-a")).toBeInTheDocument();
    expect(
      screen.queryByText("Select a node or edge to see details."),
    ).not.toBeInTheDocument();
  });

  it("selects it too when the data is already there on mount", () => {
    resolved(focusedData);
    renderGraph(
      <GraphHarness
        rql="focused"
        keywordValue=""
        onKeywordChange={vi.fn()}
        focusId="node-a"
      />,
    );

    expect(screen.getByText("node-a")).toBeInTheDocument();
  });

  it("selects it over a node the user had picked, once new data arrives", async () => {
    const user = userEvent.setup();
    resolved(focusedData);
    const { rerender } = renderGraph(
      <GraphHarness
        rql="focused"
        keywordValue=""
        onKeywordChange={vi.fn()}
        focusId="node-a"
      />,
    );
    await user.click(screen.getByRole("option", { name: "geneC" }));
    expect(screen.getByText("node-c")).toBeInTheDocument();
    expect(screen.queryByText("node-a")).not.toBeInTheDocument();

    resolved({ rows: [...twoNodeRows], isTruncated: false });
    rerender(
      <GraphHarness
        rql="focused"
        keywordValue=""
        onKeywordChange={vi.fn()}
        focusId="node-a"
      />,
    );

    expect(screen.getByText("node-a")).toBeInTheDocument();
    expect(screen.queryByText("node-c")).not.toBeInTheDocument();
  });

  it("selects nothing when the focused protein is not among the rows", () => {
    resolved(focusedData);
    renderGraph(
      <GraphHarness
        rql="focused"
        keywordValue=""
        onKeywordChange={vi.fn()}
        focusId="node-z"
      />,
    );

    expect(
      screen.getByText("Select a node or edge to see details."),
    ).toBeInTheDocument();
  });

  it("still clears the selection on new data without a focus", async () => {
    const user = userEvent.setup();
    resolved(focusedData);
    const { rerender } = renderGraph(
      <GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />,
    );
    await user.click(screen.getByText("geneC"));
    expect(screen.getByText("node-c")).toBeInTheDocument();

    resolved({ rows: [...twoNodeRows], isTruncated: false });
    rerender(<GraphHarness rql="" keywordValue="" onKeywordChange={vi.fn()} />);

    expect(
      screen.getByText("Select a node or edge to see details."),
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

  it("still selects the focused protein in a selection's rows", () => {
    resolved({ rows: graphRows, isTruncated: false });
    renderGraph(
      <GraphHarness
        rql={scope}
        keywordValue=""
        onKeywordChange={vi.fn()}
        focusId="node-a"
        selection={rowSelection(["edge-1"])}
      />,
    );

    expect(screen.getByText("node-a")).toBeInTheDocument();
  });
});
