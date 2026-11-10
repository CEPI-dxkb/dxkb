import { useEffect } from "react";
import { render, screen, fireEvent } from "@testing-library/react";

import { InteractionsSubviewShell } from "../interactions-subview-shell";

let tableMountCount = 0;
vi.mock("@/components/views/resource-child-collection", () => ({
  ResourceChildCollection: ({
    urlKey,
    resource,
    rql,
    guideUrl,
    keywordMode,
    keywordValue,
    onKeywordChange,
  }: {
    urlKey: string;
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
        data-url-key={urlKey}
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
    layout,
    onLayoutChange,
  }: {
    rql: string;
    keywordValue?: string;
    onKeywordChange?: (value: string) => void;
    layout: string;
    onLayoutChange: (layout: string) => void;
  }) => (
    <div data-testid="graph-panel" data-rql={rql} data-keyword={keywordValue}>
      <button onClick={() => { onKeywordChange?.("fromGraph"); }}>set-from-graph</button>
      <select
        aria-label="Layout"
        value={layout}
        onChange={(event) => {
          onLayoutChange(event.target.value);
        }}
      >
        <option value="forceatlas2">Force Atlas 2</option>
        <option value="circular">Circular</option>
      </select>
    </div>
  ),
}));

beforeEach(() => {
  tableMountCount = 0;
  window.history.replaceState(null, "", "/");
});

describe("InteractionsSubviewShell", () => {
  it("forwards the table and graph data contracts and mounts the graph lazily", () => {
    render(
      <InteractionsSubviewShell
        rql="eq(evidence,experimental)"
        guideUrl="https://example.test/guide"
      />,
    );

    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-url-key", "interactions");
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

    expect(tableMountCount).toBe(1);
    expect(screen.getByTestId("table-panel").parentElement).not.toHaveAttribute("inert");
  });

  it("scopes both views on one predicate, with the URL fragment stripped once", () => {
    render(
      <InteractionsSubviewShell rql="eq(evidence,experimental)#view_tab=interactions" />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

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

  it("drops the Table's URL page when the keyword changes, from either view", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?tab=interactions&interactions.page=3&interactions.sort=id:desc",
    );
    render(<InteractionsSubviewShell rql="eq(evidence,experimental)" />);

    fireEvent.click(screen.getByText("set-from-table"));
    expect(window.location.search).toBe(
      "?tab=interactions&interactions.sort=id:desc",
    );

    window.history.replaceState(
      null,
      "",
      "/genome/1.1?tab=interactions&interactions.page=3",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));
    fireEvent.click(screen.getByText("set-from-graph"));
    expect(window.location.search).toBe("?tab=interactions");
  });

  it("keeps the chosen graph layout across a switch to Table and back", () => {
    render(<InteractionsSubviewShell rql="eq(evidence,experimental)" />);
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));
    expect(screen.getByRole("combobox", { name: "Layout" })).toHaveValue(
      "forceatlas2",
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Layout" }), {
      target: { value: "circular" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Table" }));
    expect(screen.queryByTestId("graph-panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

    expect(screen.getByRole("combobox", { name: "Layout" })).toHaveValue(
      "circular",
    );
  });

  it("keeps the Table's URL page when the keyword is committed again unchanged", () => {
    render(<InteractionsSubviewShell rql="eq(evidence,experimental)" />);
    fireEvent.click(screen.getByText("set-from-table"));

    window.history.replaceState(null, "", "/genome/1.1?interactions.page=3");
    fireEvent.click(screen.getByText("set-from-table"));

    expect(window.location.search).toBe("?interactions.page=3");
  });
});
