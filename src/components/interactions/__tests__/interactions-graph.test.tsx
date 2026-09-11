import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { InteractionsGraph } from "../interactions-graph";
import { useInteractions } from "@/lib/interactions/use-interactions";
import type { PpiRecord } from "@/lib/interactions/types";

// InteractionsGraph only reaches SigmaCanvas (WebGL, untestable in jsdom —
// see docs/architecture.md / testing.md canvas exclusion) once useInteractions
// resolves with rows. Mocking it pending keeps the component on its "Loading
// interactions…" branch, which is enough to observe what query it built.
vi.mock("@/lib/interactions/use-interactions", () => ({
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

class ResizeObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);
vi.stubGlobal("scrollTo", vi.fn());
Element.prototype.scrollIntoView = vi.fn();

describe("InteractionsGraph filter combination", () => {
  it("combines the base query with the table's filter via and() (bug #1)", () => {
    render(
      <InteractionsGraph
        taxonId={943}
        q="eq(evidence,experimental)"
        tableFilter="eq(category,PPI)"
        keywordValue=""
        onKeywordChange={vi.fn()}
      />,
    );

    expect(useInteractions).toHaveBeenCalledWith(
      943,
      "and(eq(evidence,experimental),eq(category,PPI))",
    );
  });

  it("strips the base query's URL fragment before combining a table filter", () => {
    render(
      <InteractionsGraph
        taxonId={943}
        q="eq(evidence,experimental)#view_tab=interactions"
        tableFilter="eq(category,PPI)"
        keywordValue=""
        onKeywordChange={vi.fn()}
      />,
    );

    expect(useInteractions).toHaveBeenCalledWith(
      943,
      "and(eq(evidence,experimental),eq(category,PPI))",
    );
  });

  it("encodes the shared keyword as one wildcard clause per term", () => {
    render(
      <InteractionsGraph
        taxonId={943}
        q="eq(evidence,experimental)"
        keywordValue="  groEL   dnaK "
        onKeywordChange={vi.fn()}
      />,
    );

    // One clause per term, not one clause for the whole string: a single
    // keyword(groEL dnaK*) clause matches nothing the table would show.
    expect(useInteractions).toHaveBeenCalledWith(
      943,
      "and(eq(evidence,experimental),and(keyword(groEL*),keyword(dnaK*)))",
    );
  });

  it("applies the keyword once alongside an unrelated table filter", () => {
    render(
      <InteractionsGraph
        taxonId={943}
        q="eq(evidence,experimental)"
        tableFilter="eq(category,PPI)"
        keywordValue="groEL"
        onKeywordChange={vi.fn()}
      />,
    );

    expect(useInteractions).toHaveBeenCalledWith(
      943,
      "and(eq(evidence,experimental),eq(category,PPI),keyword(groEL*))",
    );
  });

  it("uses the bare base query when the table has no active filter", () => {
    render(
      <InteractionsGraph
        taxonId={943}
        q="eq(evidence,experimental)"
        tableFilter=""
        keywordValue=""
        onKeywordChange={vi.fn()}
      />,
    );

    expect(useInteractions).toHaveBeenCalledWith(
      943,
      "eq(evidence,experimental)",
    );
  });

  it("uses the bare base query when tableFilter is omitted entirely", () => {
    render(
      <InteractionsGraph
        taxonId={943}
        q="eq(evidence,experimental)"
        keywordValue=""
        onKeywordChange={vi.fn()}
      />,
    );

    expect(useInteractions).toHaveBeenCalledWith(
      943,
      "eq(evidence,experimental)",
    );
  });

  it("reports graph keyword edits to the shared owner without duplicating the current keyword query", () => {
    const onKeywordChange = vi.fn();
    render(
      <InteractionsGraph
        taxonId={943}
        q="eq(evidence,experimental)"
        keywordValue="groEL"
        onKeywordChange={onKeywordChange}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText("Search interaction results..."),
      { target: { value: "dnaK" } },
    );

    // The owner holds the keyword; the query still carries exactly one clause for it.
    expect(onKeywordChange).toHaveBeenLastCalledWith("dnaK");
    expect(useInteractions).toHaveBeenLastCalledWith(
      943,
      "and(eq(evidence,experimental),keyword(groEL*))",
    );
  });

  it("preserves table facet filters while reporting graph keyword edits", () => {
    const onKeywordChange = vi.fn();
    render(
      <InteractionsGraph
        taxonId={943}
        q=""
        tableFilter="eq(category,PPI)"
        keywordValue=""
        onKeywordChange={onKeywordChange}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText("Search interaction results..."),
      { target: { value: "dnaK" } },
    );

    expect(onKeywordChange).toHaveBeenLastCalledWith("dnaK");
    expect(useInteractions).toHaveBeenLastCalledWith(943, "eq(category,PPI)");
  });
});

// The mock above holds useInteractions on `isPending`, so this exercises the
// real loading branch and guards its wiring: a regression that swaps the
// skeleton back for a blank/centered-text state (the pre-skeleton behavior)
// makes the spinner disappear and fails here. The query-combination suite above
// runs in the same pending state but only asserts the query — it would not
// notice the loading UI reverting.
describe("InteractionsGraph loading state", () => {
  it("renders the loading skeleton while the query is pending", () => {
    render(
      <InteractionsGraph
        taxonId={943}
        q=""
        keywordValue=""
        onKeywordChange={vi.fn()}
      />,
    );

    // Skeleton's Spinner is the single role=status loading announcement.
    expect(screen.getByRole("status")).toBeInTheDocument();
    // Real keyword toolbar stays mounted in every state, loading included.
    expect(
      screen.getByPlaceholderText("Search interaction results..."),
    ).toBeInTheDocument();
  });
});

describe("InteractionsGraph empty state", () => {
  it("preserves the graph workspace and replaces only the canvas content", () => {
    vi.mocked(useInteractions).mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useInteractions>);

    render(
      <InteractionsGraph
        taxonId={776}
        q=""
        keywordValue=""
        onKeywordChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Microbial protein")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sub-Graph" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Layout" })).toBeInTheDocument();
    expect(screen.getByLabelText("Selection details")).toBeInTheDocument();
    expect(screen.getByText("No Interactions")).toBeInTheDocument();
    expect(screen.queryByTestId("sigma-canvas")).not.toBeInTheDocument();
  });
});

describe("InteractionsGraph data changes", () => {
  it("disables export when a ready populated graph becomes empty", async () => {
    vi.mocked(useInteractions).mockReturnValue({
      data: graphRows,
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useInteractions>);

    const { rerender } = render(
      <InteractionsGraph
        taxonId={943}
        q=""
        keywordValue=""
        onKeywordChange={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByTestId("sigma-canvas"));
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();

    vi.mocked(useInteractions).mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useInteractions>);
    rerender(
      <InteractionsGraph
        taxonId={943}
        q=""
        keywordValue=""
        onKeywordChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
  });

  it("clears stale selection and active presets when the query data changes", async () => {
    const user = userEvent.setup();
    vi.mocked(useInteractions).mockReturnValue({
      data: graphRows,
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useInteractions>);

    const { rerender } = render(
      <InteractionsGraph
        taxonId={943}
        q=""
        tableFilter="keyword(geneA*)"
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

    vi.mocked(useInteractions).mockReturnValue({
      data: [
        {
          ...graphRows[0],
          id: "edge-2",
          interactor_a: "node-c",
          gene_a: "geneC",
        },
      ],
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useInteractions>);
    rerender(
      <InteractionsGraph
        taxonId={943}
        q=""
        tableFilter="keyword(geneC*)"
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
