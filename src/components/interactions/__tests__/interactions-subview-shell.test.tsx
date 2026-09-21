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
    keywordMode,
    keywordValue,
    onKeywordChange,
  }: {
    resource: string;
    rql: string;
    guideUrl?: string;
    keywordMode?: string;
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
        data-rql={rql}
        data-guide={guideUrl}
        data-keyword-mode={keywordMode}
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
    rql,
    keywordValue,
    onKeywordChange,
  }: {
    rql: string;
    keywordValue?: string;
    onKeywordChange?: (value: string) => void;
  }) => (
    <div data-testid="graph-panel" data-rql={rql} data-keyword={keywordValue}>
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
        rql="eq(evidence,experimental)"
        guideUrl="https://example.test/guide"
      />,
    );

    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-resource", "ppi");
    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-rql", "eq(evidence,experimental)");
    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-guide", "https://example.test/guide");
    expect(screen.queryByTestId("graph-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));
    expect(screen.getByTestId("graph-panel")).toHaveAttribute("data-rql", "eq(evidence,experimental)");
  });

  it("keeps the Table subview mounted across a switch to Graph and back (bug #3 root cause)", () => {
    render(<InteractionsSubviewShell rql="eq(evidence,experimental)" />);
    expect(tableMountCount).toBe(1);

    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));
    expect(screen.getByTestId("table-panel").parentElement).toHaveAttribute("inert");

    fireEvent.click(screen.getByRole("tab", { name: "Table" }));

    // Still 1: base-ui's Tabs.Panel keepMounted keeps the same instance alive
    // instead of unmounting on hide and remounting on reveal.
    expect(tableMountCount).toBe(1);
    expect(screen.getByTestId("table-panel").parentElement).not.toHaveAttribute("inert");
  });

  it("scopes both views on one predicate, with the URL fragment stripped once", () => {
    render(
      <InteractionsSubviewShell rql="eq(evidence,experimental)#view_tab=interactions" />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

    // Stripping in the Graph only (as it once did) left the Table querying the
    // raw string, so the two views could scope differently before a keyword was
    // even typed.
    expect(screen.getByTestId("table-panel")).toHaveAttribute(
      "data-rql",
      "eq(evidence,experimental)",
    );
    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-rql",
      "eq(evidence,experimental)",
    );
  });

  it("leaves the Table's keyword on the request rather than filtering the loaded page", () => {
    render(<InteractionsSubviewShell rql="eq(evidence,experimental)" />);

    // Loaded mode filtered only the 200 rows already on screen while the Graph
    // ran a real backend query, so the shared box meant two different things.
    expect(screen.getByTestId("table-panel")).not.toHaveAttribute(
      "data-keyword-mode",
    );
  });

  it("shares keyword text between Table and Graph in both directions", () => {
    render(<InteractionsSubviewShell rql="eq(evidence,experimental)" />);

    fireEvent.click(screen.getByText("set-from-table"));
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));
    expect(screen.getByTestId("graph-panel")).toHaveAttribute("data-keyword", "fromTable");

    fireEvent.click(screen.getByText("set-from-graph"));
    fireEvent.click(screen.getByRole("tab", { name: "Table" }));
    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-keyword", "fromGraph");
  });
});
