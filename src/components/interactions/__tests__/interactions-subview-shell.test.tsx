import { useEffect } from "react";
import { render, screen, fireEvent } from "@testing-library/react";

import { InteractionsSubviewShell } from "../interactions-subview-shell";

// The subview, keyword and selection live in the URL, so the address must re-render on History API
// writes as Next's does.
vi.mock("next/navigation", async () =>
  (await import("@/test-helpers/history-navigation")).historyNavigationMock({
    pathname: "/genome/1.1",
  }),
);

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
    selected,
    onSelectedChange,
    camera,
    onCameraChange,
  }: {
    rql: string;
    keywordValue?: string;
    onKeywordChange?: (value: string) => void;
    layout: string;
    onLayoutChange: (layout: string) => void;
    selected: { kind: string; id: string } | null;
    onSelectedChange: (next: { kind: string; id: string } | null) => void;
    camera: { ratio: number; x: number; y: number } | null;
    onCameraChange: (
      next: { ratio: number; x: number; y: number } | null,
    ) => void;
  }) => (
    <div
      data-testid="graph-panel"
      data-rql={rql}
      data-keyword={keywordValue}
      data-selected={selected ? `${selected.kind}:${selected.id}` : "none"}
      data-camera={
        camera
          ? `${String(camera.ratio)},${String(camera.x)},${String(camera.y)}`
          : "none"
      }
    >
      <button
        onClick={() => {
          onCameraChange({ ratio: 0.5, x: 0.1, y: 0.2 });
        }}
      >
        move-camera
      </button>
      <button onClick={() => { onKeywordChange?.("fromGraph"); }}>set-from-graph</button>
      <button
        onClick={() => {
          onSelectedChange({ kind: "node", id: "fig|584.1.peg.7" });
        }}
      >
        select-node
      </button>
      <button
        onClick={() => {
          onSelectedChange(null);
        }}
      >
        select-many
      </button>
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

// A failing assertion must not leave a history spy installed for the next test.
afterEach(() => {
  vi.restoreAllMocks();
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
      "?tab=interactions&interactions.sort=id:desc&interactionsGraph.q=fromTable",
    );

    window.history.replaceState(
      null,
      "",
      "/genome/1.1?tab=interactions&interactions.page=3",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));
    fireEvent.click(screen.getByText("set-from-graph"));
    expect(window.location.search).toBe(
      "?tab=interactions&interactionsGraph.view=graph&interactionsGraph.q=fromGraph",
    );
  });

  it("writes a new keyword and drops the Table's page in one History API write", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?tab=interactions&interactions.page=3&interactionsGraph.node=peg.1&interactionsGraph.cam=0.25,0.3,0.7#legacy",
    );
    render(<InteractionsSubviewShell rql="eq(evidence,experimental)" />);
    const replaceState = vi.spyOn(window.history, "replaceState");
    const pushState = vi.spyOn(window.history, "pushState");

    // A later write would leave one render pairing the new keyword with the stale page.
    fireEvent.click(screen.getByText("set-from-table"));

    expect(replaceState).toHaveBeenCalledOnce();
    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/genome/1.1?tab=interactions&interactionsGraph.q=fromTable#legacy",
    );
    expect(pushState).not.toHaveBeenCalled();
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

    window.history.replaceState(
      null,
      "",
      "/genome/1.1?interactionsGraph.q=fromTable&interactions.page=3",
    );
    fireEvent.click(screen.getByText("set-from-table"));

    expect(window.location.search).toBe(
      "?interactionsGraph.q=fromTable&interactions.page=3",
    );
  });
});

describe("InteractionsSubviewShell URL state (Back from a linked page)", () => {
  function graphTab() {
    return screen.getByRole("tab", { name: "Graph" });
  }

  it("opens the Graph subview when the URL names it", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?tab=interactions&interactionsGraph.view=graph",
    );
    render(<InteractionsSubviewShell rql="eq(evidence,experimental)" />);

    expect(graphTab()).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("graph-panel")).toBeInTheDocument();
  });

  it("writes the subview with replaceState and omits the Table default", () => {
    window.history.replaceState(null, "", "/genome/1.1?tab=interactions");
    const lengthBefore = window.history.length;
    const pushState = vi.spyOn(window.history, "pushState");
    render(<InteractionsSubviewShell rql="eq(evidence,experimental)" />);

    fireEvent.click(graphTab());
    expect(window.location.search).toBe(
      "?tab=interactions&interactionsGraph.view=graph",
    );
    expect(screen.getByTestId("graph-panel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Table" }));
    expect(window.location.search).toBe("?tab=interactions");
    expect(window.history.length).toBe(lengthBefore);
    expect(pushState).not.toHaveBeenCalled();
  });

  it("keeps the shared keyword in the URL and reads it back on both views", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?tab=interactions&interactionsGraph.q=dnaK",
    );
    render(<InteractionsSubviewShell rql="eq(evidence,experimental)" />);

    expect(screen.getByTestId("table-panel")).toHaveAttribute(
      "data-keyword",
      "dnaK",
    );
    fireEvent.click(graphTab());
    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-keyword",
      "dnaK",
    );
  });

  it("passes the URL's selection to the Graph and writes a single selection back without a history entry", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?tab=interactions&interactionsGraph.view=graph&interactionsGraph.edge=ppi-1",
    );
    const lengthBefore = window.history.length;
    render(<InteractionsSubviewShell rql="eq(evidence,experimental)" />);
    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-selected",
      "edge:ppi-1",
    );

    fireEvent.click(screen.getByText("select-node"));
    expect(window.location.search).toBe(
      "?tab=interactions&interactionsGraph.view=graph&interactionsGraph.node=fig%7C584.1.peg.7",
    );
    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-selected",
      "node:fig|584.1.peg.7",
    );

    fireEvent.click(screen.getByText("select-many"));
    expect(window.location.search).toBe(
      "?tab=interactions&interactionsGraph.view=graph",
    );
    expect(window.history.length).toBe(lengthBefore);
  });

  it("clears the selection when the keyword changes, and keeps it when the same keyword is committed", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?interactionsGraph.view=graph&interactionsGraph.q=fromGraph&interactionsGraph.node=peg.1",
    );
    render(<InteractionsSubviewShell rql="eq(evidence,experimental)" />);

    fireEvent.click(screen.getByText("set-from-graph"));
    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-selected",
      "node:peg.1",
    );

    fireEvent.click(screen.getByText("set-from-table"));
    expect(window.location.search).toBe(
      "?interactionsGraph.view=graph&interactionsGraph.q=fromTable",
    );
    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-selected",
      "none",
    );
  });

  it("restores the subview, keyword and selection when the page mounts again (Back)", () => {
    window.history.replaceState(null, "", "/genome/1.1?tab=interactions");
    const { unmount } = render(
      <InteractionsSubviewShell rql="eq(evidence,experimental)" />,
    );
    fireEvent.click(graphTab());
    fireEvent.click(screen.getByText("set-from-graph"));
    fireEvent.click(screen.getByText("select-node"));
    unmount();

    render(<InteractionsSubviewShell rql="eq(evidence,experimental)" />);

    expect(graphTab()).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-keyword",
      "fromGraph",
    );
    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-selected",
      "node:fig|584.1.peg.7",
    );
  });

  it("reads the layout and camera from the URL and writes the Graph's camera reports", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?tab=interactions&interactionsGraph.view=graph&interactionsGraph.layout=circular&interactionsGraph.cam=0.25,0.3,0.7",
    );
    const lengthBefore = window.history.length;
    render(<InteractionsSubviewShell rql="eq(evidence,experimental)" />);

    expect(screen.getByRole("combobox", { name: "Layout" })).toHaveValue(
      "circular",
    );
    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-camera",
      "0.25,0.3,0.7",
    );

    fireEvent.click(screen.getByText("move-camera"));
    expect(window.location.search).toBe(
      "?tab=interactions&interactionsGraph.view=graph&interactionsGraph.layout=circular&interactionsGraph.cam=0.5,0.1,0.2",
    );
    expect(window.history.length).toBe(lengthBefore);
  });

  it("drops the camera with a layout pick, and omits the default layout", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?interactionsGraph.view=graph&interactionsGraph.cam=0.25,0.3,0.7",
    );
    render(<InteractionsSubviewShell rql="eq(evidence,experimental)" />);

    fireEvent.change(screen.getByRole("combobox", { name: "Layout" }), {
      target: { value: "circular" },
    });
    expect(window.location.search).toBe(
      "?interactionsGraph.view=graph&interactionsGraph.layout=circular",
    );

    fireEvent.click(screen.getByText("move-camera"));
    fireEvent.change(screen.getByRole("combobox", { name: "Layout" }), {
      target: { value: "forceatlas2" },
    });
    expect(window.location.search).toBe("?interactionsGraph.view=graph");
  });

  it("drops the camera when the keyword changes", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?interactionsGraph.view=graph&interactionsGraph.cam=0.25,0.3,0.7",
    );
    render(<InteractionsSubviewShell rql="eq(evidence,experimental)" />);

    fireEvent.click(screen.getByText("set-from-graph"));

    expect(window.location.search).toBe(
      "?interactionsGraph.view=graph&interactionsGraph.q=fromGraph",
    );
    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-camera",
      "none",
    );
  });

  it("restores the layout and camera when the page mounts again (Back)", () => {
    window.history.replaceState(null, "", "/genome/1.1?tab=interactions");
    const { unmount } = render(
      <InteractionsSubviewShell rql="eq(evidence,experimental)" />,
    );
    fireEvent.click(graphTab());
    fireEvent.change(screen.getByRole("combobox", { name: "Layout" }), {
      target: { value: "circular" },
    });
    fireEvent.click(screen.getByText("move-camera"));
    unmount();

    render(<InteractionsSubviewShell rql="eq(evidence,experimental)" />);

    expect(screen.getByRole("combobox", { name: "Layout" })).toHaveValue(
      "circular",
    );
    expect(screen.getByTestId("graph-panel")).toHaveAttribute(
      "data-camera",
      "0.5,0.1,0.2",
    );
  });
});
