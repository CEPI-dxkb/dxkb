import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { InteractionsGraph } from "../interactions-graph";
import {
  interactionsGraphRowLimit,
  useInteractions,
  type InteractionsGraphData,
} from "@/lib/interactions/use-interactions";
import type { PpiRecord } from "@/lib/interactions/types";

// InteractionsGraph only reaches SigmaCanvas (WebGL, untestable in jsdom —
// see docs/architecture.md / testing.md canvas exclusion) once useInteractions
// resolves with rows. Mocking it pending keeps the component on its loading
// branch, which is enough to observe what query it asked for. The hook's own
// request shape is covered over MSW in lib/interactions/__tests__.
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

vi.mock("../sigma/sigma-canvas", () => ({
  SigmaCanvas: ({ onReady }: { onReady: () => void }) => (
    <button type="button" data-testid="sigma-canvas" onClick={onReady}>
      Mark canvas ready
    </button>
  ),
}));

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
  vi.mocked(useInteractions).mockReturnValue({
    data: undefined,
    isPending: false,
    isError: true,
    error,
  } as unknown as ReturnType<typeof useInteractions>);
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
    render(
      <InteractionsGraph
        rql="eq(evidence,experimental)"
        keywordValue="  groEL   dnaK "
        onKeywordChange={vi.fn()}
      />,
    );

    // The graph no longer encodes the keyword into RQL itself. That local
    // encoding was a second, differently-escaped clause for the same text as
    // the table's, which is how one input came to mean two datasets.
    expect(useInteractions).toHaveBeenCalledWith(
      "eq(evidence,experimental)",
      "  groEL   dnaK ",
    );
  });

  it("reports keyword edits to the shared owner rather than re-querying on its own", async () => {
    const onKeywordChange = vi.fn();
    render(
      <InteractionsGraph
        rql="eq(evidence,experimental)"
        keywordValue="groEL"
        onKeywordChange={onKeywordChange}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText("Search interaction results..."),
      { target: { value: "dnaK" } },
    );

    // The owner holds the keyword, and the toolbar debounces before handing it
    // over, so the query keeps asking for the committed one meanwhile.
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

// The mock above holds useInteractions on `isPending`, so this exercises the
// real loading branch and guards its wiring: a regression that swaps the
// skeleton back for a blank/centered-text state (the pre-skeleton behavior)
// makes the spinner disappear and fails here.
describe("InteractionsGraph loading state", () => {
  it("renders the loading skeleton while the query is pending", () => {
    render(<InteractionsGraph rql="" keywordValue="" onKeywordChange={vi.fn()} />);

    // Skeleton's Spinner is the single role=status loading announcement.
    expect(screen.getByRole("status")).toBeInTheDocument();
    // Real keyword toolbar stays mounted in every state, loading included.
    expect(
      screen.getByPlaceholderText("Search interaction results..."),
    ).toBeInTheDocument();
  });
});

describe("InteractionsGraph error state", () => {
  it("renders the query's real error message instead of unmounting the subview", () => {
    failed(new Error("DATA_API_URL is not configured."));

    render(<InteractionsGraph rql="" keywordValue="" onKeywordChange={vi.fn()} />);

    expect(
      screen.getByText("DATA_API_URL is not configured."),
    ).toBeInTheDocument();
    // The keyword box survives the error, so the search can still be cleared.
    expect(
      screen.getByPlaceholderText("Search interaction results..."),
    ).toBeInTheDocument();
  });
});

describe("InteractionsGraph empty state", () => {
  it("preserves the graph workspace and replaces only the canvas content", () => {
    resolved({ rows: [], isTruncated: false });

    render(<InteractionsGraph rql="" keywordValue="" onKeywordChange={vi.fn()} />);

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

    render(<InteractionsGraph rql="" keywordValue="" onKeywordChange={vi.fn()} />);

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

    render(<InteractionsGraph rql="" keywordValue="" onKeywordChange={vi.fn()} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("InteractionsGraph data changes", () => {
  it("disables export when a ready populated graph becomes empty", async () => {
    resolved({ rows: graphRows, isTruncated: false });

    const { rerender } = render(
      <InteractionsGraph rql="" keywordValue="" onKeywordChange={vi.fn()} />,
    );

    fireEvent.click(await screen.findByTestId("sigma-canvas"));
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();

    resolved({ rows: [], isTruncated: false });
    rerender(
      <InteractionsGraph rql="" keywordValue="" onKeywordChange={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
  });

  it("clears stale selection and active presets when the query data changes", async () => {
    const user = userEvent.setup();
    resolved({ rows: graphRows, isTruncated: false });

    const { rerender } = render(
      <InteractionsGraph
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
      <InteractionsGraph
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
