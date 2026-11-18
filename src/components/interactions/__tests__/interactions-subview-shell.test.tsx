import { useEffect, type ComponentProps } from "react";
import { act, render, screen, fireEvent } from "@testing-library/react";

import type { GNode } from "@/lib/interactions/types";
import { childCollectionOptions } from "@/lib/views/child-collection-state";
import { interactionCollectionOptions } from "@/lib/views/child-resources";

import type { InteractionsGraph } from "../interactions-graph";
import { InteractionsSubviewShell } from "../interactions-subview-shell";

type GraphProps = ComponentProps<typeof InteractionsGraph>;

/**
 * A stand-in scope. The real taxon scope pins no evidence and the Interactions tab adds no default
 * for it, so this one names none: the unfiltered view lists every interaction.
 */
const scope = "eq(genome_id_a,*)";
const experimentalClause = "eq(evidence,experimental)";
const computationalClause = "eq(evidence,computational)";

let tableMountCount = 0;
/** The rows the Table stub's "show-in-graph" button hands to `onShowInGraph`. */
let tableSelectedIds: string[] = [];
// The stubs below record their latest props here; read only after a render.
let lastGraphProps: GraphProps | undefined;
interface TableProfile {
  resource: string;
  guideUrl?: string;
  columns?: readonly { id: string; sortable?: boolean }[];
  facets?: readonly { field: string }[];
  extraFilters?: readonly string[];
  filterLabels?: Readonly<Record<string, string>>;
}
let lastTableProfile: TableProfile | undefined;
/** The props the Table is built from, beside its profile. */
let lastTableOptionProps:
  | { defaultSort: string; defaultFilters?: Readonly<Record<string, readonly string[]>> }
  | undefined;

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
    defaultSort,
    defaultFilters,
    keywordMode,
    keywordValue,
    onKeywordChange,
    onShowInGraph,
  }: {
    urlKey: string;
    resource: string;
    rql: string;
    guideUrl?: string;
    profile?: TableProfile;
    defaultSort: string;
    defaultFilters?: Readonly<Record<string, readonly string[]>>;
    keywordMode?: string;
    keywordValue?: string;
    onKeywordChange?: (value: string) => void;
    onShowInGraph?: (ids: string[]) => void;
  }) => {
    useEffect(() => {
      tableMountCount++;
    }, []);
    lastTableProfile = profile;
    lastTableOptionProps = { defaultSort, defaultFilters };
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
        {onShowInGraph && (
          <button onClick={() => { onShowInGraph([...tableSelectedIds]); }}>
            show-in-graph
          </button>
        )}
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
  tableSelectedIds = ["ppi-1", "ppi-2", "ppi-3"];
  lastGraphProps = undefined;
  lastTableProfile = undefined;
  lastTableOptionProps = undefined;
  window.history.replaceState(null, "", "/");
});

describe("InteractionsSubviewShell", () => {
  it("forwards the table and graph data contracts and mounts the graph lazily", () => {
    render(
      <InteractionsSubviewShell
        rql={scope}
        guideUrl="https://example.test/guide"
      />,
    );

    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-url-key", "interactions");
    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-resource", "ppi");
    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-rql", scope);
    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-guide", "https://example.test/guide");
    expect(screen.queryByTestId("graph-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));
    expect(screen.getByTestId("graph-panel")).toHaveAttribute("data-rql", scope);
  });

  it("keeps the Table subview mounted across a switch to Graph and back (bug #3 root cause)", () => {
    render(<InteractionsSubviewShell rql={scope} />);
    expect(tableMountCount).toBe(1);

    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));
    expect(screen.getByTestId("table-panel").parentElement).toHaveAttribute("inert");

    fireEvent.click(screen.getByRole("tab", { name: "Table" }));

    expect(tableMountCount).toBe(1);
    expect(screen.getByTestId("table-panel").parentElement).not.toHaveAttribute("inert");
  });

  it("scopes both views on one predicate, with the URL fragment stripped once", () => {
    render(
      <InteractionsSubviewShell rql={`${scope}#view_tab=interactions`} />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-rql", scope);
    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-rql",
      scope,
    );
  });

  it("leaves the Table's keyword on the request rather than filtering the loaded page", () => {
    render(<InteractionsSubviewShell rql={scope} />);

    expect(screen.getByTestId("table-panel")).not.toHaveAttribute(
      "data-keyword-mode",
    );
  });

  it("shares keyword text between Table and Graph in both directions", () => {
    render(<InteractionsSubviewShell rql={scope} />);

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
    render(<InteractionsSubviewShell rql={scope} />);

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
    render(<InteractionsSubviewShell rql={scope} />);
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
    render(<InteractionsSubviewShell rql={scope} />);
    fireEvent.click(screen.getByText("set-from-table"));

    replaceUrl("/genome/1.1?interactions.page=3");
    fireEvent.click(screen.getByText("set-from-table"));

    expect(window.location.search).toBe("?interactions.page=3");
  });
});

describe("InteractionsSubviewShell filters", () => {
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

  it("gives the Table no default filters, so the shell and the Table read the URL alike", () => {
    render(<InteractionsSubviewShell rql={scope} />);

    expect(lastTableOptionProps?.defaultFilters).toBeUndefined();
    expect(interactionCollectionOptions.defaultFilters).toBeUndefined();
  });

  it("builds the Table's collection options to equal the ones the shell reads the URL with", () => {
    render(<InteractionsSubviewShell rql={scope} />);

    // The shell reads `interactions.*` through `interactionCollectionOptions`, the Table builds its
    // own from these props (`ResourceChildCollection`); any difference lets one drop the other's
    // param on a write.
    expect(lastTableProfile).toBeDefined();
    expect(
      childCollectionOptions(
        lastTableProfile?.columns ?? [],
        lastTableProfile?.facets,
        lastTableOptionProps?.defaultSort ?? "",
        lastTableOptionProps?.defaultFilters,
        lastTableProfile?.extraFilters,
      ),
    ).toEqual(interactionCollectionOptions);
  });

  it("sends the bare scope in the Graph's rql from an empty URL, naming no evidence", () => {
    render(<InteractionsSubviewShell rql={scope} />);
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

    expect(graphProps().rql).toBe(scope);
    expect(graphProps().rql).not.toContain("evidence");
    expect(graphProps().filters).toEqual({});
    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-rql", scope);
  });

  it.each([
    { pick: "experimental", clause: experimentalClause },
    { pick: "computational", clause: computationalClause },
  ])("sends the picked evidence ($pick) in the Graph's rql", ({ pick, clause }) => {
    window.history.replaceState(
      null,
      "",
      `/genome/1.1?interactions.evidence=${pick}`,
    );
    render(<InteractionsSubviewShell rql={scope} />);
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

    expect(graphProps().rql).toBe(`and(${scope},${clause})`);
    expect(graphProps().filters).toEqual({ evidence: [pick] });
    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-rql", scope);
  });

  it("writes an evidence pick to the URL and drops the Table's page", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?tab=interactions&interactions.page=3",
    );
    render(<InteractionsSubviewShell rql={scope} />);
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

    act(() => {
      graphProps().onFilterChange({ filters: { evidence: ["computational"] } });
    });

    expect(window.location.search).toBe(
      "?tab=interactions&interactions.evidence=computational",
    );
    expect(graphProps().rql).toBe(`and(${scope},${computationalClause})`);
    expect(graphProps().filters).toEqual({ evidence: ["computational"] });
  });

  it("drops the evidence param, writing no marker, when the pick is cleared", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?interactions.evidence=computational",
    );
    render(<InteractionsSubviewShell rql={scope} />);
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

    act(() => {
      graphProps().onFilterChange({ filters: {} });
    });

    expect(window.location.search).toBe("");
    expect(graphProps().rql).toBe(scope);
    expect(graphProps().filters).toEqual({});
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
      "/genome/1.1?interactions.interaction_type=association&interactions.evidence=computational",
    );
    render(<InteractionsSubviewShell rql={scope} />);
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

    expect(graphProps().facetRql("interaction_type")).toBe(
      `and(${scope},${computationalClause})`,
    );
    expect(graphProps().facetRql("detection_method")).toBe(
      `and(${scope},and(${typeClause},${computationalClause}))`,
    );
    // Evidence is counted without its own filter, so both of its values stay listed.
    expect(graphProps().facetRql("evidence")).toBe(`and(${scope},${typeClause})`);
  });

  it.each([
    {
      state: "an empty URL",
      search: "",
      expected: {
        category: scope,
        interaction_type: scope,
        detection_method: scope,
        evidence: scope,
      },
    },
    {
      state: "experimental picked",
      search: "?interactions.evidence=experimental",
      expected: {
        category: `and(${scope},${experimentalClause})`,
        interaction_type: `and(${scope},${experimentalClause})`,
        detection_method: `and(${scope},${experimentalClause})`,
        evidence: scope,
      },
    },
    {
      state: "computational picked",
      search: "?interactions.evidence=computational",
      expected: {
        category: `and(${scope},${computationalClause})`,
        interaction_type: `and(${scope},${computationalClause})`,
        detection_method: `and(${scope},${computationalClause})`,
        evidence: scope,
      },
    },
  ])(
    "counts each facet over the rql the Table counts it over, from $state",
    ({ search, expected }) => {
      window.history.replaceState(null, "", `/genome/1.1${search}`);
      render(<InteractionsSubviewShell rql={scope} />);
      fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

      // The Graph's counts follow the Table's rule (`facetCountState`), so the two Filters menus
      // show the same numbers for the same filters; a facet leaves out only its own filter.
      for (const [field, rql] of Object.entries(expected)) {
        expect(graphProps().facetRql(field)).toBe(rql);
      }
    },
  );

  it("writes a filter change to the URL and drops the Table's page", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?tab=interactions&interactions.interaction_type=association&interactions.page=3",
    );
    render(<InteractionsSubviewShell rql={scope} />);
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

    act(() => {
      // The bar hands back every filter it holds: none once the pick is cleared.
      graphProps().onFilterChange({ filters: {} });
    });

    expect(window.location.search).toBe("?tab=interactions");
    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-rql",
      scope,
    );
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
      graphProps().onFilterChange({
        keyword: "groEL",
        filters: {},
      });
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

describe("InteractionsSubviewShell protein focus", () => {
  const protein: GNode = { id: "fig|224914.16.peg.635", kind: "microbial" };
  const encodedProtein = "fig%7C224914.16.peg.635";
  const focusClause = `or(eq(interactor_a,${encodedProtein}),eq(interactor_b,${encodedProtein}))`;
  const typeClause = "eq(interaction_type,association)";

  function focusNode(node: GNode) {
    act(() => {
      const { onFocusNode } = graphProps();
      if (!onFocusNode) throw new Error("The Graph was given no onFocusNode.");
      onFocusNode(node);
    });
  }

  it("writes the focus to the URL, drops the Table's page, and leaves the Table alone", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?tab=interactions&interactions.page=3",
    );
    render(<InteractionsSubviewShell rql={scope} />);
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));
    expect(tableMountCount).toBe(1);

    focusNode(protein);

    expect(window.location.search).toBe(
      `?tab=interactions&interactions.interactor=${encodedProtein}`,
    );
    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-rql", scope);
    expect(tableMountCount).toBe(1);
  });

  it("narrows the Graph to the protein and hands its id back as focusId", () => {
    render(<InteractionsSubviewShell rql={scope} />);
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));
    expect(graphProps().focusId).toBeUndefined();

    focusNode(protein);

    expect(graphProps().focusId).toBe("fig|224914.16.peg.635");
    expect(graphProps().filters).toEqual({ interactor: [protein.id] });
    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-rql",
      `and(${scope},${focusClause})`,
    );
  });

  it("keeps the facet picks beside the focus, and the focus beside a pick's counts", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?interactions.interaction_type=association",
    );
    render(<InteractionsSubviewShell rql={scope} />);
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

    focusNode(protein);

    expect(window.location.search).toContain("interactions.interaction_type=association");
    expect(window.location.search).toContain(
      `interactions.interactor=${encodedProtein}`,
    );
    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-rql",
      `and(${scope},and(${focusClause},${typeClause}))`,
    );
    // A facet's counts leave out its own pick only, so they stay inside the focus.
    expect(graphProps().facetRql("interaction_type")).toBe(
      `and(${scope},${focusClause})`,
    );
  });

  it("adds a history entry, so Back undoes the focus", () => {
    render(<InteractionsSubviewShell rql={scope} />);
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));
    const pushState = vi.spyOn(window.history, "pushState");
    try {
      focusNode(protein);
      expect(pushState).toHaveBeenCalledTimes(1);
    } finally {
      pushState.mockRestore();
    }
  });

  it("keeps the shared keyword when focusing", () => {
    render(<InteractionsSubviewShell rql={scope} />);
    fireEvent.click(screen.getByText("set-from-table"));
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

    focusNode(protein);

    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-keyword",
      "fromTable",
    );
    expect(window.location.search).not.toContain("keyword");
  });

  it("removes the focus when the filter bar clears it", () => {
    window.history.replaceState(
      null,
      "",
      `/genome/1.1?interactions.interactor=${encodedProtein}&interactions.page=2`,
    );
    render(<InteractionsSubviewShell rql={scope} />);
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));
    expect(graphProps().focusId).toBe(protein.id);

    act(() => {
      // Clearing the Protein pill leaves the other filters, of which there are none here.
      graphProps().onFilterChange({ filters: {} });
    });

    expect(window.location.search).toBe("");
    expect(graphProps().focusId).toBeUndefined();
    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-rql",
      scope,
    );
  });

  it("reads a focus already in the URL on load", () => {
    window.history.replaceState(
      null,
      "",
      `/genome/1.1?interactions.interactor=${encodedProtein}`,
    );
    render(<InteractionsSubviewShell rql={scope} />);
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

    expect(graphProps().focusId).toBe(protein.id);
    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-rql",
      `and(${scope},${focusClause})`,
    );
    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-rql", scope);
  });

  it("gives the Table the profile whose options name the focus filter", () => {
    render(<InteractionsSubviewShell rql={scope} />);

    expect(lastTableProfile).toEqual(
      expect.objectContaining({
        extraFilters: ["interactor"],
        filterLabels: { interactor: "Protein" },
      }),
    );
  });
});

describe("InteractionsSubviewShell Show in Graph", () => {
  function showInGraph(ids: string[]) {
    tableSelectedIds = ids;
    fireEvent.click(screen.getByRole("button", { name: "show-in-graph" }));
  }

  it("switches to the Graph with the selection, and leaves the Table and the rql alone", () => {
    render(<InteractionsSubviewShell rql={scope} />);
    expect(lastGraphProps).toBeUndefined();

    showInGraph(["ppi-1", "ppi-2", "ppi-3"]);

    expect(screen.getByRole("tab", { name: "Graph" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(graphProps().selection).toEqual(
      expect.objectContaining({
        ids: ["ppi-1", "ppi-2", "ppi-3"],
        version: expect.any(Number) as number,
      }),
    );
    expect(graphProps().rql).toBe(scope);
    expect(screen.getByTestId("table-panel")).toHaveAttribute("data-rql", scope);
    expect(tableMountCount).toBe(1);
  });

  it("returns to the plain Graph when the selection is cleared", () => {
    render(<InteractionsSubviewShell rql={scope} />);
    showInGraph(["ppi-1"]);

    act(() => {
      graphProps().selection?.onClear();
    });

    expect(graphProps().selection).toBeUndefined();
    expect(graphProps().rql).toBe(scope);
    expect(screen.getByRole("tab", { name: "Graph" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("gives every Show in Graph its own version", () => {
    render(<InteractionsSubviewShell rql={scope} />);
    showInGraph(["ppi-1"]);
    const first = graphProps().selection?.version;

    fireEvent.click(screen.getByRole("tab", { name: "Table" }));
    showInGraph(["ppi-2", "ppi-3"]);

    expect(graphProps().selection).toEqual(
      expect.objectContaining({ ids: ["ppi-2", "ppi-3"] }),
    );
    expect(graphProps().selection?.version).not.toBe(first);
  });

  it("gives the same rows picked again a new version too", () => {
    render(<InteractionsSubviewShell rql={scope} />);
    showInGraph(["ppi-1"]);
    const first = graphProps().selection?.version;

    fireEvent.click(screen.getByRole("tab", { name: "Table" }));
    showInGraph(["ppi-1"]);

    expect(graphProps().selection?.version).not.toBe(first);
  });

  it("drops the selection when the scope changes", () => {
    const { rerender } = render(<InteractionsSubviewShell rql={scope} />);
    showInGraph(["ppi-1"]);
    expect(graphProps().selection).toBeDefined();

    rerender(<InteractionsSubviewShell rql="eq(genome_id_b,*)" />);

    expect(graphProps().selection).toBeUndefined();
    expect(graphProps().rql).toBe("eq(genome_id_b,*)");
  });

  it("keeps the selection across a fragment-only change of the scope", () => {
    const { rerender } = render(<InteractionsSubviewShell rql={scope} />);
    showInGraph(["ppi-1"]);

    rerender(<InteractionsSubviewShell rql={`${scope}#view_tab=interactions`} />);

    expect(graphProps().selection).toEqual(
      expect.objectContaining({ ids: ["ppi-1"] }),
    );
  });

  describe("Focus on this protein during a selection", () => {
    const protein: GNode = { id: "fig|224914.16.peg.635", kind: "microbial" };
    const encodedProtein = "fig%7C224914.16.peg.635";
    const focusClause = `or(eq(interactor_a,${encodedProtein}),eq(interactor_b,${encodedProtein}))`;

    function focusNode(node: GNode) {
      act(() => {
        const { onFocusNode } = graphProps();
        if (!onFocusNode) throw new Error("The Graph was given no onFocusNode.");
        onFocusNode(node);
      });
    }

    it("leaves the selection, so the Graph draws the protein's interactions in scope", () => {
      render(<InteractionsSubviewShell rql={scope} />);
      showInGraph(["ppi-1", "ppi-2"]);
      expect(graphProps().selection).toBeDefined();
      // The selection ignores the rql, which is not narrowed by anything yet.
      expect(graphProps().rql).toBe(scope);

      focusNode(protein);

      expect(graphProps().selection).toBeUndefined();
      expect(window.location.search).toBe(
        `?interactions.interactor=${encodedProtein}`,
      );
      expect(graphProps().focusId).toBe(protein.id);
      expect(graphProps().rql).toBe(`and(${scope},${focusClause})`);
      // The Table keeps its scope and stays mounted.
      expect(screen.getByTestId("table-panel")).toHaveAttribute("data-rql", scope);
      expect(tableMountCount).toBe(1);
    });

    it("hands the Graph the selection and the focus together when the Table was already narrowed to a protein", () => {
      window.history.replaceState(
        null,
        "",
        `/genome/1.1?interactions.interactor=${encodedProtein}`,
      );
      render(<InteractionsSubviewShell rql={scope} />);

      showInGraph(["ppi-1"]);

      expect(graphProps().selection).toEqual(
        expect.objectContaining({ ids: ["ppi-1"] }),
      );
      expect(graphProps().focusId).toBe(protein.id);
    });
  });
});
