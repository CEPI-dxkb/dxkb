import { useEffect, type ComponentProps } from "react";
import { act, render, screen, fireEvent } from "@testing-library/react";

import type { InteractionsGraph } from "../interactions-graph";
import { InteractionsSubviewShell } from "../interactions-subview-shell";

type GraphProps = ComponentProps<typeof InteractionsGraph>;

let tableMountCount = 0;
// The stubs below record their latest props here; read only after a render.
let lastGraphProps: GraphProps | undefined;
let lastTableProfile: { resource: string; guideUrl?: string } | undefined;

vi.mock("next/navigation", async () =>
  (await import("@/test-helpers/history-navigation")).historyNavigationMock({
    pathname: "/genome/1.1",
  }),
);

vi.mock("@/components/views/resource-child-collection", () => ({
  ResourceChildCollection: ({
    urlKey,
    resource,
    rql,
    guideUrl,
    profile,
    keywordMode,
    keywordValue,
    onKeywordChange,
  }: {
    urlKey: string;
    resource: string;
    rql: string;
    guideUrl?: string;
    profile?: { resource: string; guideUrl?: string };
    keywordMode?: string;
    keywordValue?: string;
    onKeywordChange?: (value: string) => void;
  }) => {
    useEffect(() => {
      tableMountCount++;
    }, []);
    lastTableProfile = profile;
    return (
      <div
        data-testid="table-panel"
        data-url-key={urlKey}
        data-resource={resource}
        data-rql={rql}
        data-guide={profile?.guideUrl ?? guideUrl}
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
  InteractionsGraph: (props: GraphProps) => {
    lastGraphProps = props;
    const { rql, keywordValue, onKeywordChange, layout, onLayoutChange } =
      props;
    return (
      <div data-testid="graph-panel" data-rql={rql} data-keyword={keywordValue}>
        <button onClick={() => { onKeywordChange("fromGraph"); }}>set-from-graph</button>
        <select
          aria-label="Layout"
          value={layout}
          onChange={(event) => {
            onLayoutChange(event.target.value as GraphProps["layout"]);
          }}
        >
          <option value="forceatlas2">Force Atlas 2</option>
          <option value="circular">Circular</option>
        </select>
      </div>
    );
  },
}));

function graphProps(): GraphProps {
  if (!lastGraphProps) throw new Error("The Graph has not rendered.");
  return lastGraphProps;
}

/** A History API write re-renders the shell (it reads URL state), so it runs in `act`. */
function replaceUrl(url: string) {
  act(() => {
    window.history.replaceState(null, "", url);
  });
}

beforeEach(() => {
  tableMountCount = 0;
  lastGraphProps = undefined;
  lastTableProfile = undefined;
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

    replaceUrl("/genome/1.1?tab=interactions&interactions.page=3");
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

    replaceUrl("/genome/1.1?interactions.page=3");
    fireEvent.click(screen.getByText("set-from-table"));

    expect(window.location.search).toBe("?interactions.page=3");
  });
});

describe("InteractionsSubviewShell filters", () => {
  const scope = "eq(evidence,experimental)";
  const typeClause = "eq(interaction_type,association)";

  it("gives the Table the interaction profile, with the guide, over the unfiltered scope", () => {
    render(
      <InteractionsSubviewShell rql={scope} guideUrl="https://example.test/guide" />,
    );

    expect(lastTableProfile).toEqual(
      expect.objectContaining({
        resource: "ppi",
        guideUrl: "https://example.test/guide",
      }),
    );
    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-rql", scope);
  });

  it("narrows only the Graph's rql by the filters in the URL", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?interactions.interaction_type=association",
    );
    render(<InteractionsSubviewShell rql={`${scope}#view_tab=interactions`} />);
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-rql",
      `and(${scope},${typeClause})`,
    );
    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-rql", scope);
    expect(graphProps().filters).toEqual({ interaction_type: ["association"] });
  });

  it("scopes each facet's counts with every filter but its own", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?interactions.interaction_type=association",
    );
    render(<InteractionsSubviewShell rql={scope} />);
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

    expect(graphProps().facetRql("interaction_type")).toBe(scope);
    expect(graphProps().facetRql("detection_method")).toBe(
      `and(${scope},${typeClause})`,
    );
  });

  it("writes a filter change to the URL and drops the Table's page", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?tab=interactions&interactions.interaction_type=association&interactions.page=3",
    );
    render(<InteractionsSubviewShell rql={scope} />);
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

    act(() => {
      graphProps().onFilterChange({ filters: { interaction_type: [] } });
    });

    expect(window.location.search).toBe("?tab=interactions");
    expect(screen.getByTestId("graph-panel")).toHaveAttribute("data-rql", scope);
  });

  it("adds a pick to the URL and narrows the Graph with it", () => {
    render(<InteractionsSubviewShell rql={scope} />);
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

    act(() => {
      graphProps().onFilterChange({
        filters: { interaction_type: ["association"] },
      });
    });

    expect(window.location.search).toBe(
      "?interactions.interaction_type=association",
    );
    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-rql",
      `and(${scope},${typeClause})`,
    );
  });

  it("sends a keyword in the update down the shared keyword path", () => {
    window.history.replaceState(null, "", "/genome/1.1?interactions.page=3");
    render(<InteractionsSubviewShell rql={scope} />);
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

    act(() => {
      graphProps().onFilterChange({ keyword: "groEL", filters: {} });
    });

    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-keyword",
      "groEL",
    );
    expect(screen.getByTestId("table-panel")).toHaveAttribute(
      "data-keyword",
      "groEL",
    );
    expect(window.location.search).toBe("");
  });
});
