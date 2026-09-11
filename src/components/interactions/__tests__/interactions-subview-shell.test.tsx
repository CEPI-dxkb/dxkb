import { useEffect } from "react";
import { render, screen, fireEvent } from "@testing-library/react";

import { InteractionsSubviewShell } from "../interactions-subview-shell";

// Table keeps its table-only state mounted across the Graph round-trip. A mount
// counter verifies the component instance survives while keyword text is shared
// separately by the shell.
let tableMountCount = 0;
vi.mock("@/components/views", () => ({
  ResourceChildCollection: ({
    resource,
    rql,
    guideUrl,
    keywordValue,
    onKeywordChange,
  }: {
    resource: string;
    rql: string;
    guideUrl?: string;
    keywordValue?: string;
    onKeywordChange?: (value: string) => void;
  }) => {
    useEffect(() => {
      tableMountCount++;
    }, []);
    return (
      <div
        data-testid="table-panel"
        data-resource={resource}
        data-q={rql}
        data-guide={guideUrl}
        data-keyword={keywordValue}
      >
        <button onClick={() => onKeywordChange?.("fromTable")}>
          set-from-table
        </button>
      </div>
    );
  },
}));

vi.mock("../interactions-graph", () => ({
  InteractionsGraph: ({
    taxonId,
    q,
    tableFilter,
    keywordValue,
    onKeywordChange,
  }: {
    taxonId: number;
    q: string;
    tableFilter?: string;
    keywordValue?: string;
    onKeywordChange?: (value: string) => void;
  }) => (
    <div
      data-testid="graph-panel"
      data-taxon-id={taxonId}
      data-q={q}
      data-table-filter={tableFilter}
      data-keyword={keywordValue}
    >
      <button onClick={() => { onKeywordChange?.("fromGraph"); }}>set-from-graph</button>
    </div>
  ),
}));

beforeEach(() => {
  tableMountCount = 0;
});

describe("InteractionsSubviewShell", () => {
  it("forwards the table and graph data contracts and mounts the graph lazily", () => {
    render(
      <InteractionsSubviewShell
        taxonId={943}
        q="eq(evidence,experimental)"
        guideUrl="https://example.test/guide"
      />,
    );

    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-resource", "ppi");
    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-q", "eq(evidence,experimental)");
    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-guide", "https://example.test/guide");
    expect(screen.queryByTestId("graph-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));
    expect(screen.getByTestId("graph-panel")).toHaveAttribute("data-taxon-id", "943");
    expect(screen.getByTestId("graph-panel")).toHaveAttribute("data-q", "eq(evidence,experimental)");
  });

  it("keeps the Table subview mounted across a switch to Graph and back (bug #3 root cause)", () => {
    render(<InteractionsSubviewShell taxonId={943} q="eq(evidence,experimental)" />);
    expect(tableMountCount).toBe(1);

    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));
    expect(screen.getByTestId("table-panel").parentElement).toHaveAttribute("inert");

    fireEvent.click(screen.getByRole("tab", { name: "Table" }));

    // Still 1: base-ui's Tabs.Panel keepMounted keeps the same instance alive
    // instead of unmounting on hide and remounting on reveal.
    expect(tableMountCount).toBe(1);
    expect(screen.getByTestId("table-panel").parentElement).not.toHaveAttribute("inert");
  });

  it("hands the graph the keyword text, not a second RQL clause for it (bug #1)", () => {
    render(<InteractionsSubviewShell taxonId={943} q="eq(evidence,experimental)" />);

    fireEvent.click(screen.getByText("set-from-table"));
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

    // The graph owns keyword encoding (one wildcard clause per term). A keyword-only
    // tableFilter here produced a second, differently-encoded clause.
    const graph = screen.getByTestId("graph-panel");
    expect(graph).toHaveAttribute("data-keyword", "fromTable");
    expect(graph).not.toHaveAttribute("data-table-filter");
  });

  it("shares keyword text between Table and Graph in both directions", () => {
    render(<InteractionsSubviewShell taxonId={943} q="eq(evidence,experimental)" />);

    fireEvent.click(screen.getByText("set-from-table"));
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));
    expect(screen.getByTestId("graph-panel")).toHaveAttribute("data-keyword", "fromTable");

    fireEvent.click(screen.getByText("set-from-graph"));
    fireEvent.click(screen.getByRole("tab", { name: "Table" }));
    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-keyword", "fromGraph");
  });
});
