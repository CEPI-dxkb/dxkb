import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { GraphNodeList } from "../graph-node-list";
import { colors } from "@/lib/interactions/graph-theme";
import { stubVirtualListLayout } from "@/test-helpers/virtual-list-layout";
import type { GEdge, GNode } from "@/lib/interactions/types";

// A 320px viewport shows ten 32px rows.
const { scrollTo } = stubVirtualListLayout(320);

const nodes: GNode[] = [
  { id: "fig|1.1", gene: "dnaA", kind: "microbial" },
  { id: "fig|2.2", gene: "recA", kind: "host" },
];
const noIncidence = new Map<string, GEdge[]>();

function dotColorOf(row: HTMLElement): string {
  const dot = row.querySelector('[data-slot="graph-node-dot"]');
  if (!dot) throw new Error("row has no color dot");
  expect(dot).toHaveClass("bg-(--dot-color)");
  return (dot as HTMLElement).style.getPropertyValue("--dot-color");
}

describe("GraphNodeList", () => {
  it("selects a node via keyboard: type to filter, Enter to choose", async () => {
    const user = userEvent.setup();
    const onSelectNode = vi.fn();

    render(
      <GraphNodeList
        nodes={nodes}
        incidence={noIncidence}
        selectedIds={new Set()}
        onSelectNode={onSelectNode}
        onSelectRange={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText("Search proteins…");
    await user.click(input);
    await user.keyboard("recA");
    await user.keyboard("{Enter}");

    expect(onSelectNode).toHaveBeenCalledWith(nodes[1], false);
  });

  it("selects a node via pointer click even with cmdk pointer-selection disabled", async () => {
    const user = userEvent.setup();
    const onSelectNode = vi.fn();

    render(
      <GraphNodeList
        nodes={nodes}
        incidence={noIncidence}
        selectedIds={new Set()}
        onSelectNode={onSelectNode}
        onSelectRange={vi.fn()}
      />,
    );

    await user.click(screen.getByText("dnaA"));

    expect(onSelectNode).toHaveBeenCalledWith(nodes[0], false);
  });

  it("marks the app-selected row without marking it as the current item", () => {
    render(
      <GraphNodeList
        nodes={nodes}
        incidence={noIncidence}
        selectedIds={new Set(["fig|2.2"])}
        onSelectNode={vi.fn()}
        onSelectRange={vi.fn()}
      />,
    );

    const selected = screen.getByText("recA").closest('[role="option"]');
    const other = screen.getByText("dnaA").closest('[role="option"]');

    expect(selected).toHaveAttribute("data-app-selected", "true");
    expect(other).toHaveAttribute("data-app-selected", "false");
    expect(selected).not.toHaveAttribute("aria-current");
    expect(other).not.toHaveAttribute("aria-current");
  });

  it("exposes the app selection to assistive technology", () => {
    render(
      <GraphNodeList
        nodes={nodes}
        incidence={noIncidence}
        selectedIds={new Set(nodes.map((node) => node.id))}
        onSelectNode={vi.fn()}
        onSelectRange={vi.fn()}
      />,
    );

    expect(screen.getByRole("listbox")).toHaveAttribute(
      "aria-multiselectable",
      "true",
    );
    // Every selected row is reported selected, whichever one the keyboard cursor is on.
    for (const option of screen.getAllByRole("option")) {
      expect(option).toHaveAttribute("aria-selected", "true");
    }
  });

  it("reports an unselected row as not selected", () => {
    render(
      <GraphNodeList
        nodes={nodes}
        incidence={noIncidence}
        selectedIds={new Set(["fig|2.2"])}
        onSelectNode={vi.fn()}
        onSelectRange={vi.fn()}
      />,
    );

    const selected = screen
      .getAllByRole("option")
      .map((option) => option.getAttribute("aria-selected"));
    expect(selected.filter((value) => value === "true")).toHaveLength(1);
    expect(selected.filter((value) => value === "false")).toHaveLength(
      nodes.length - 1,
    );
  });

  it("recolors the selected row's dot amber and leaves unselected dots on their kind color", () => {
    render(
      <GraphNodeList
        nodes={nodes}
        incidence={noIncidence}
        selectedIds={new Set(["fig|1.1"])}
        onSelectNode={vi.fn()}
        onSelectRange={vi.fn()}
      />,
    );

    const selectedRow = screen
      .getByText("dnaA")
      .closest('[role="option"]') as HTMLElement;
    const hostRow = screen
      .getByText("recA")
      .closest('[role="option"]') as HTMLElement;

    expect(dotColorOf(selectedRow)).toBe(colors.selected);
    expect(dotColorOf(hostRow)).toBe(colors.host);
  });

  it("highlights every protein in a bulk selection", () => {
    render(
      <GraphNodeList
        nodes={nodes}
        incidence={noIncidence}
        selectedIds={new Set(nodes.map((node) => node.id))}
        onSelectNode={vi.fn()}
        onSelectRange={vi.fn()}
      />,
    );

    for (const label of ["dnaA", "recA"]) {
      const row = screen.getByText(label).closest('[role="option"]') as HTMLElement;
      expect(row).toHaveAttribute("data-app-selected", "true");
      expect(row).not.toHaveAttribute("aria-current");
      expect(dotColorOf(row)).toBe(colors.selected);
    }
  });

  it("uses each node's kind color for the dot when nothing is selected", () => {
    render(
      <GraphNodeList
        nodes={nodes}
        incidence={noIncidence}
        selectedIds={new Set()}
        onSelectNode={vi.fn()}
        onSelectRange={vi.fn()}
      />,
    );

    const microbialRow = screen
      .getByText("dnaA")
      .closest('[role="option"]') as HTMLElement;
    const hostRow = screen
      .getByText("recA")
      .closest('[role="option"]') as HTMLElement;

    expect(dotColorOf(microbialRow)).toBe(colors.microbial);
    expect(dotColorOf(hostRow)).toBe(colors.host);
  });

  it("gives every row a hover highlight distinct from the selected row's", () => {
    render(
      <GraphNodeList
        nodes={nodes}
        incidence={noIncidence}
        selectedIds={new Set(["fig|1.1"])}
        onSelectNode={vi.fn()}
        onSelectRange={vi.fn()}
      />,
    );

    const selectedRow = screen
      .getByText("dnaA")
      .closest('[role="option"]') as HTMLElement;
    const otherRow = screen
      .getByText("recA")
      .closest('[role="option"]') as HTMLElement;

    expect(otherRow).toHaveClass("hover:bg-secondary/15");
    expect(selectedRow).toHaveClass("data-[app-selected=true]:bg-secondary/25");
  });

  it("reports a plain row click as non-additive and a Cmd/Ctrl-click as additive", () => {
    const onSelectNode = vi.fn();
    render(
      <GraphNodeList
        nodes={nodes}
        incidence={noIncidence}
        selectedIds={new Set()}
        onSelectNode={onSelectNode}
        onSelectRange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("dnaA"));
    expect(onSelectNode).toHaveBeenLastCalledWith(nodes[0], false);

    fireEvent.click(screen.getByText("recA"), { metaKey: true });
    expect(onSelectNode).toHaveBeenLastCalledWith(nodes[1], true);

    fireEvent.click(screen.getByText("dnaA"), { ctrlKey: true });
    expect(onSelectNode).toHaveBeenLastCalledWith(nodes[0], true);

    fireEvent.click(screen.getByText("recA"));
    expect(onSelectNode).toHaveBeenLastCalledWith(nodes[1], false);
  });

  it("reports Cmd/Ctrl+Enter on the highlighted row as additive", async () => {
    const user = userEvent.setup();
    const onSelectNode = vi.fn();
    render(
      <GraphNodeList
        nodes={nodes}
        incidence={noIncidence}
        selectedIds={new Set()}
        onSelectNode={onSelectNode}
        onSelectRange={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText("Search proteins…");
    await user.click(input);
    await user.type(input, "dna");
    fireEvent.keyDown(input, { key: "Enter", metaKey: true });

    expect(onSelectNode).toHaveBeenCalledWith(nodes[0], true);
  });

  it("reports Ctrl+Enter on the highlighted row as additive", async () => {
    const user = userEvent.setup();
    const onSelectNode = vi.fn();
    render(
      <GraphNodeList
        nodes={nodes}
        incidence={noIncidence}
        selectedIds={new Set()}
        onSelectNode={onSelectNode}
        onSelectRange={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText("Search proteins…");
    await user.click(input);
    await user.type(input, "dna");
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });

    expect(onSelectNode).toHaveBeenCalledWith(nodes[0], true);
  });
});

describe("GraphNodeList ranking", () => {
  const hub: GNode = {
    id: "fig|9.9.peg.1",
    gene: "hub",
    interactorDesc: "Hub protein",
    refseqLocusTag: "LOC_HUB",
    genome: "Genome One",
    kind: "microbial",
  };
  const alpha: GNode = {
    id: "fig|9.9.peg.2",
    gene: "alpha",
    interactorDesc: "Alpha synthase",
    kind: "microbial",
  };
  const delta: GNode = {
    id: "fig|9.9.peg.3",
    gene: "delta",
    interactorDesc: "Delta synthase",
    kind: "host",
  };
  const gamma: GNode = {
    id: "fig|9.9.peg.4",
    gene: "gamma",
    interactorDesc: "Gamma protein",
    kind: "microbial",
  };
  // Listed least connected first, so the order on screen comes from the ranking.
  const ranked = [gamma, delta, alpha, hub];

  function edge(id: string, source: GNode, target: GNode, experimental: boolean) {
    return {
      id,
      source: source.id,
      target: target.id,
      evidence: "",
      interactionType: "",
      detectionMethod: "",
      experimental,
    } satisfies GEdge;
  }
  const edges = [
    edge("e1", hub, alpha, true),
    edge("e2", hub, gamma, false),
    edge("e3", hub, delta, true),
    edge("e4", alpha, delta, false),
  ];
  const incidence = new Map<string, GEdge[]>();
  for (const e of edges) {
    for (const id of [e.source, e.target]) {
      incidence.set(id, [...(incidence.get(id) ?? []), e]);
    }
  }

  function renderRanked(selectedIds: ReadonlySet<string> = new Set()) {
    return render(
      <GraphNodeList
        nodes={ranked}
        incidence={incidence}
        selectedIds={selectedIds}
        onSelectNode={vi.fn()}
        onSelectRange={vi.fn()}
      />,
    );
  }

  function optionNames(): (string | null)[] {
    return screen
      .getAllByRole("option")
      .map((option) => option.getAttribute("aria-label"));
  }

  // The rank and count are drawn from data attributes (see globals.css), not written as text.
  function rankAndCount(name: string): [string | undefined, string | undefined] {
    const row = screen.getByRole("option", { name });
    return [
      row.querySelector<HTMLElement>('[data-slot="graph-node-rank"]')?.dataset
        .rank,
      row.querySelector<HTMLElement>('[data-slot="graph-node-degree"]')?.dataset
        .degree,
    ];
  }

  it("keeps a row's visible text to its name, so the name contains it", () => {
    renderRanked();

    const row = screen.getByRole("option", { name: "hub" });
    expect(row).toHaveTextContent(/^hub$/);
    expect(row).toHaveAccessibleName("hub");
  });

  it("lists the best-connected protein first and breaks ties by name", () => {
    renderRanked();

    expect(optionNames()).toEqual(["hub", "alpha", "delta", "gamma"]);
  });

  it("shows each row's rank and interaction count", () => {
    renderRanked();

    expect(rankAndCount("hub")).toEqual(["1", "3"]);
    expect(rankAndCount("gamma")).toEqual(["4", "1"]);
  });

  it("sizes each bar by interactions and splits it into verified and predicted", () => {
    renderRanked();

    const hubBar = screen
      .getByRole("option", { name: "hub" })
      .querySelector<HTMLElement>('[data-slot="graph-node-bar"]');
    const gammaBar = screen
      .getByRole("option", { name: "gamma" })
      .querySelector<HTMLElement>('[data-slot="graph-node-bar"]');

    // The hub has the most interactions (3), so its bar spans the row; gamma's one is a third.
    expect(hubBar?.style.getPropertyValue("--bar-width")).toBe("100%");
    expect(
      parseFloat(gammaBar?.style.getPropertyValue("--bar-width") ?? ""),
    ).toBeCloseTo(100 / 3);
    // Two of the hub's three are verified; gamma's one is predicted.
    const verifiedShare = (bar: HTMLElement | null | undefined) =>
      parseFloat(
        bar?.firstElementChild instanceof HTMLElement
          ? bar.firstElementChild.style.getPropertyValue("--verified-share")
          : "",
      );
    expect(verifiedShare(hubBar)).toBeCloseTo(200 / 3);
    expect(verifiedShare(gammaBar)).toBe(0);
  });

  it("names a row by its protein and describes it with the product and counts", () => {
    renderRanked();

    expect(screen.getByRole("option", { name: "hub" })).toHaveAccessibleDescription(
      "Hub protein · 3 interactions, 2 verified",
    );
    expect(
      screen.getByRole("option", { name: "gamma" }),
    ).toHaveAccessibleDescription("Gamma protein · 1 interaction, 0 verified");
  });

  it("says when a protein has no product annotation", () => {
    render(
      <GraphNodeList
        nodes={[{ id: "fig|9.9.peg.5", kind: "microbial" }]}
        incidence={noIncidence}
        selectedIds={new Set()}
        onSelectNode={vi.fn()}
        onSelectRange={vi.fn()}
      />,
    );

    expect(screen.getByRole("option")).toHaveAccessibleDescription(
      "No product annotation · 0 interactions, 0 verified",
    );
  });

  it.each([
    ["a product", "alpha synthase", ["alpha"]],
    ["a locus tag", "loc_hub", ["hub"]],
    ["a genome", "genome one", ["hub"]],
    ["a BRC ID", "peg.4", ["gamma"]],
  ])("searches by %s", async (_what, query, expected) => {
    const user = userEvent.setup();
    renderRanked();

    await user.type(screen.getByPlaceholderText("Search proteins…"), query);

    expect(optionNames()).toEqual(expected);
  });

  it("matches the text typed, not letters spread through a product name", async () => {
    const user = userEvent.setup();
    renderRanked();

    // A fuzzy match would also pull in "Delta synthase" (d…l…s) and "Gamma protein".
    await user.type(screen.getByPlaceholderText("Search proteins…"), "dls");

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No proteins match.")).toBeInTheDocument();
  });

  it("keeps the ranking, and each row's overall rank, while a search narrows the list", async () => {
    const user = userEvent.setup();
    renderRanked();

    await user.type(screen.getByPlaceholderText("Search proteins…"), "synthase");

    expect(optionNames()).toEqual(["alpha", "delta"]);
    expect(rankAndCount("alpha")).toEqual(["2", "2"]);
    expect(rankAndCount("delta")).toEqual(["3", "2"]);
  });

  it("draws the selected protein in the selection colour wherever it ranks", () => {
    renderRanked(new Set([gamma.id]));

    expect(dotColorOf(screen.getByRole("option", { name: "gamma" }))).toBe(
      colors.selected,
    );
  });
});

describe("GraphNodeList Shift-click range", () => {
  // No interactions, so the ranking falls back to name: alpha, beta, delta, epsilon, gamma.
  const named: GNode[] = ["gamma", "alpha", "epsilon", "beta", "delta"].map(
    (gene) => ({ id: `fig|${gene}`, gene, kind: "microbial" }),
  );
  const ids = (genes: string[]) => new Set(genes.map((gene) => `fig|${gene}`));

  // Holds the selection the way the Graph does: a plain pick replaces it, Cmd/Ctrl toggles, a range
  // replaces it whole. `selectedIds` is what the list is given back, so the anchor logic sees it.
  function Harness({ initial = new Set<string>() }: { initial?: Set<string> }) {
    const [selected, setSelected] = useState<ReadonlySet<string>>(initial);
    return (
      <>
        <output data-testid="selected">{[...selected].sort().join(",")}</output>
        <GraphNodeList
          nodes={named}
          incidence={noIncidence}
          selectedIds={selected}
          onSelectNode={(node, additive) => {
            setSelected((previous) => {
              if (!additive) return new Set([node.id]);
              const next = new Set(previous);
              if (!next.delete(node.id)) next.add(node.id);
              return next;
            });
          }}
          onSelectRange={(range) => {
            setSelected(new Set(range.map((node) => node.id)));
          }}
        />
      </>
    );
  }

  function selection(): string {
    return screen.getByTestId("selected").textContent;
  }
  function expectSelected(genes: string[]) {
    expect(selection()).toBe(
      [...ids(genes)].sort().join(","),
    );
  }

  it("selects every protein from the last one clicked to the one Shift-clicked", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("beta"));
    fireEvent.click(screen.getByText("epsilon"), { shiftKey: true });

    expectSelected(["beta", "delta", "epsilon"]);
  });

  it("ranges upward as well as downward", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("epsilon"));
    fireEvent.click(screen.getByText("alpha"), { shiftKey: true });

    expectSelected(["alpha", "beta", "delta", "epsilon"]);
  });

  it("replaces what was selected, and keeps its anchor for the next Shift-click", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("beta"));
    fireEvent.click(screen.getByText("delta"), { shiftKey: true });
    fireEvent.click(screen.getByText("gamma"), { shiftKey: true });

    // From beta, not from delta: a range does not move the anchor.
    expectSelected(["beta", "delta", "epsilon", "gamma"]);

    fireEvent.click(screen.getByText("alpha"), { shiftKey: true });
    expectSelected(["alpha", "beta"]);
  });

  it("anchors on a Cmd/Ctrl-click too", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("alpha"));
    fireEvent.click(screen.getByText("delta"), { metaKey: true });
    fireEvent.click(screen.getByText("gamma"), { shiftKey: true });

    expectSelected(["delta", "epsilon", "gamma"]);
  });

  it("selects just the anchor when the anchor itself is Shift-clicked", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("beta"));
    fireEvent.click(screen.getByText("delta"), { shiftKey: true });
    fireEvent.click(screen.getByText("beta"), { shiftKey: true });

    expectSelected(["beta"]);
  });

  it("runs through the rows the search leaves, not the whole list", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    fireEvent.click(screen.getByText("alpha"));
    // "a" keeps alpha, beta, delta and gamma; epsilon has none.
    await user.type(screen.getByPlaceholderText("Search proteins…"), "a");
    fireEvent.click(screen.getByText("gamma"), { shiftKey: true });

    expectSelected(["alpha", "beta", "delta", "gamma"]);
  });

  it("treats the click as a plain one when the search has filtered the anchor out", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    fireEvent.click(screen.getByText("alpha"));
    await user.type(screen.getByPlaceholderText("Search proteins…"), "epsilon");
    fireEvent.click(screen.getByText("epsilon"), { shiftKey: true });

    expectSelected(["epsilon"]);
  });

  it("treats the click as a plain one when nothing has been chosen yet", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("delta"), { shiftKey: true });

    expectSelected(["delta"]);
  });

  it("starts from a protein selected elsewhere, such as on the canvas", () => {
    render(<Harness initial={ids(["beta"])} />);

    fireEvent.click(screen.getByText("delta"), { shiftKey: true });

    expectSelected(["beta", "delta"]);
  });

  it("keeps the start of a range made from a canvas pick for the next Shift-click", () => {
    render(<Harness initial={ids(["beta"])} />);

    fireEvent.click(screen.getByText("delta"), { shiftKey: true });
    expectSelected(["beta", "delta"]);

    // The selection now holds two proteins, so only the remembered start can anchor this one.
    fireEvent.click(screen.getByText("gamma"), { shiftKey: true });
    expectSelected(["beta", "delta", "epsilon", "gamma"]);
  });

  it("drops an old anchor once the selection has moved on without it", () => {
    const onSelectNode = vi.fn();
    const onSelectRange = vi.fn();
    const props = { nodes: named, incidence: noIncidence, onSelectNode, onSelectRange };
    const { rerender } = render(
      <GraphNodeList {...props} selectedIds={new Set()} />,
    );
    fireEvent.click(screen.getByText("alpha"));

    // A canvas click selected delta; the list's last click, alpha, is no longer selected.
    rerender(<GraphNodeList {...props} selectedIds={ids(["delta"])} />);
    fireEvent.click(screen.getByText("gamma"), { shiftKey: true });

    expect(onSelectRange.mock.lastCall?.[0]).toEqual([
      named.find((node) => node.gene === "delta"),
      named.find((node) => node.gene === "epsilon"),
      named.find((node) => node.gene === "gamma"),
    ]);
  });

  it("is not a range with the keyboard: Shift+Enter picks the highlighted row alone", async () => {
    const user = userEvent.setup();
    const onSelectNode = vi.fn();
    const onSelectRange = vi.fn();
    render(
      <GraphNodeList
        nodes={named}
        incidence={noIncidence}
        selectedIds={ids(["alpha"])}
        onSelectNode={onSelectNode}
        onSelectRange={onSelectRange}
      />,
    );

    await user.type(screen.getByPlaceholderText("Search proteins…"), "gamma");
    fireEvent.keyDown(screen.getByPlaceholderText("Search proteins…"), {
      key: "Enter",
      shiftKey: true,
    });

    expect(onSelectRange).not.toHaveBeenCalled();
    expect(onSelectNode).toHaveBeenCalledWith(
      expect.objectContaining({ gene: "gamma" }),
      false,
    );
  });

  it("keeps a Shift press from starting a text selection", () => {
    render(<Harness />);

    // `fireEvent` returns false when the default was prevented.
    expect(
      fireEvent.mouseDown(screen.getByText("beta"), { shiftKey: true }),
    ).toBe(false);
    expect(fireEvent.mouseDown(screen.getByText("beta"))).toBe(true);
  });
});

describe("GraphNodeList with many proteins", () => {
  // No interactions, so the ranking falls back to name: p000, p001, … p249.
  const named = (count: number): GNode[] =>
    Array.from({ length: count }, (_, index) => ({
      id: `fig|${String(index).padStart(5, "0")}`,
      gene: `p${String(index).padStart(5, "0")}`,
      kind: "microbial",
    }));
  const many = named(250);
  const idOf = (index: number) => `fig|${String(index).padStart(5, "0")}`;
  const nameOf = (index: number) => `p${String(index).padStart(5, "0")}`;

  function renderMany(
    selectedIds: ReadonlySet<string> = new Set(),
    handlers: {
      onSelectNode?: (node: GNode, additive: boolean) => void;
      onSelectRange?: (nodes: GNode[]) => void;
    } = {},
    list: GNode[] = many,
  ) {
    render(
      <GraphNodeList
        nodes={list}
        incidence={noIncidence}
        selectedIds={selectedIds}
        onSelectNode={handlers.onSelectNode ?? vi.fn()}
        onSelectRange={handlers.onSelectRange ?? vi.fn()}
      />,
    );
  }

  const optionCount = () => screen.queryAllByRole("option").length;
  const scrollRegion = () =>
    screen.getByRole("listbox").parentElement as HTMLElement;
  const searchBox = () => screen.getByRole("combobox", { name: "Search proteins" });

  function scrollToRow(index: number) {
    scrollRegion().scrollTop = index * 32;
    fireEvent.scroll(scrollRegion());
  }

  it("draws only the rows in view and a few past each edge", () => {
    renderMany();

    // Ten rows fit the 320px viewport; ten more are drawn below them.
    expect(optionCount()).toBe(20);
    expect(screen.getByRole("option", { name: nameOf(0) })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: nameOf(19) })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: nameOf(20) }),
    ).not.toBeInTheDocument();
  });

  it("draws a few rows of ten thousand proteins, not all of them", () => {
    renderMany(new Set(), {}, named(10_000));

    expect(optionCount()).toBeLessThan(40);
    expect(screen.getByRole("listbox").style.getPropertyValue("--list-height")).toBe(
      `${String(10_000 * 32)}px`,
    );
  });

  it("gives each drawn row its place in the whole list", () => {
    renderMany();

    const row = screen.getByRole("option", { name: nameOf(3) });
    expect(row).toHaveAttribute("aria-posinset", "4");
    expect(row).toHaveAttribute("aria-setsize", "250");
  });

  it("has no Show all button or count footer: every protein is a scroll away", () => {
    renderMany();

    expect(
      screen.queryByRole("button", { name: "Show all" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });

  it("draws the rows a scroll brings into view, and leaves the ones it passed", () => {
    renderMany();

    scrollToRow(200);

    expect(screen.getByRole("option", { name: nameOf(205) })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: nameOf(0) }),
    ).not.toBeInTheDocument();
  });

  it("does not measure every row again when only the scroll position changes", () => {
    // Reading a protein's id is how the list keys a row, so counting the reads counts the rows the
    // virtualizer walked. A key function that is new on every render makes it lay out every row on
    // every scroll frame.
    let reads = 0;
    const counted = named(2000).map((node) => {
      const { id } = node;
      return Object.defineProperty<GNode>({ ...node }, "id", {
        enumerable: true,
        get: () => {
          reads += 1;
          return id;
        },
      });
    });
    renderMany(new Set(), {}, counted);
    const afterMount = reads;

    scrollToRow(100);
    reads = 0;
    scrollToRow(300);

    expect(afterMount).toBeGreaterThan(0);
    // The rows now in view and their overscan, not the 2,000 in the list.
    expect(reads).toBeLessThan(200);
  });

  it("keeps each row's overall rank when it is scrolled to", () => {
    renderMany();

    scrollToRow(230);

    const rank = screen
      .getByRole("option", { name: nameOf(230) })
      .querySelector<HTMLElement>('[data-slot="graph-node-rank"]');
    expect(rank?.dataset.rank).toBe("231");
  });

  it("searches every protein, not only the ones drawn", async () => {
    const user = userEvent.setup();
    renderMany();

    await user.type(screen.getByPlaceholderText("Search proteins…"), "p0024");

    // p00240–p00249, none of them among the first rows drawn.
    expect(optionCount()).toBe(10);
    expect(screen.getByRole("option", { name: nameOf(249) })).toBeInTheDocument();
  });

  it("returns to the top when the search changes", async () => {
    const user = userEvent.setup();
    renderMany();
    scrollToRow(200);
    scrollTo.mockClear();

    await user.type(searchBox(), "p0");

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
  });

  it("brings a protein selected elsewhere into view", () => {
    renderMany(new Set([idOf(230)]));

    expect(scrollTo).toHaveBeenCalled();
    const row = screen.getByRole("option", { name: nameOf(230) });
    expect(row).toHaveAttribute("data-app-selected", "true");
  });

  it("does not pull the list back to the selection while a search narrows it", async () => {
    const user = userEvent.setup();
    // Selected far down the list, so a scroll to it would differ from the scroll back to the top.
    renderMany(new Set([idOf(230)]));
    scrollTo.mockClear();

    await user.type(searchBox(), "p002");

    expect(scrollTo).toHaveBeenCalled();

    // Only the reset to the top, never a scroll to the selected row's index.
    for (const [options] of scrollTo.mock.calls) {
      expect(options.top).toBe(0);
    }
  });

  describe("keyboard cursor", () => {
    const activeId = () => searchBox().getAttribute("aria-activedescendant");
    const optionId = (name: string) =>
      screen.getByRole("option", { name }).getAttribute("id");

    it("starts on the first match and follows the arrow keys", async () => {
      const user = userEvent.setup();
      renderMany();
      await user.click(searchBox());

      expect(activeId()).toBe(optionId(nameOf(0)));
      await user.keyboard("{ArrowDown}{ArrowDown}");
      expect(activeId()).toBe(optionId(nameOf(2)));
      await user.keyboard("{ArrowUp}");
      expect(activeId()).toBe(optionId(nameOf(1)));
    });

    it("stops at the first and last rows", async () => {
      const user = userEvent.setup();
      renderMany(new Set(), {}, many.slice(0, 3));
      await user.click(searchBox());

      await user.keyboard("{ArrowUp}");
      expect(activeId()).toBe(optionId(nameOf(0)));
      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");
      expect(activeId()).toBe(optionId(nameOf(2)));
    });

    it("picks the cursor's row on Enter", async () => {
      const user = userEvent.setup();
      const onSelectNode = vi.fn();
      renderMany(new Set(), { onSelectNode });
      await user.click(searchBox());

      await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

      expect(onSelectNode).toHaveBeenCalledWith(many[2], false);
    });

    it("jumps to the last row with End, drawing it, and back with Home", async () => {
      const user = userEvent.setup();
      const onSelectNode = vi.fn();
      renderMany(new Set(), { onSelectNode });
      await user.click(searchBox());

      await user.keyboard("{End}");
      expect(screen.getByRole("option", { name: nameOf(249) })).toBeInTheDocument();
      expect(activeId()).toBe(optionId(nameOf(249)));
      await user.keyboard("{Enter}");
      expect(onSelectNode).toHaveBeenLastCalledWith(many[249], false);

      await user.keyboard("{Home}");
      expect(activeId()).toBe(optionId(nameOf(0)));
    });

    it("moves a page at a time with PageDown and PageUp", async () => {
      const user = userEvent.setup();
      renderMany();
      await user.click(searchBox());

      // The 320px viewport holds ten rows, so a page is nine.
      await user.keyboard("{PageDown}");
      expect(activeId()).toBe(optionId(nameOf(9)));
      await user.keyboard("{PageUp}");
      expect(activeId()).toBe(optionId(nameOf(0)));
    });

    it("scrolls the cursor into view as it moves past the drawn rows", async () => {
      const user = userEvent.setup();
      renderMany();
      await user.click(searchBox());
      scrollTo.mockClear();

      await user.keyboard("{End}");

      expect(scrollTo).toHaveBeenCalled();
    });

    it("shows the cursor row only while the search box has focus", async () => {
      const user = userEvent.setup();
      renderMany();
      const first = () => screen.getByRole("option", { name: nameOf(0) });

      expect(first()).toHaveAttribute("data-cursor", "false");
      await user.click(searchBox());
      expect(first()).toHaveAttribute("data-cursor", "true");
      await user.tab();
      expect(first()).toHaveAttribute("data-cursor", "false");
    });

    it("points at no row when the search matches nothing", async () => {
      const user = userEvent.setup();
      renderMany();

      await user.type(searchBox(), "zzz");

      expect(searchBox()).not.toHaveAttribute("aria-activedescendant");
      expect(screen.getByText("No proteins match.")).toBeInTheDocument();
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("starts the cursor from the row clicked", async () => {
      const user = userEvent.setup();
      renderMany();

      await user.click(screen.getByRole("option", { name: nameOf(5) }));
      await user.click(searchBox());

      expect(activeId()).toBe(optionId(nameOf(5)));
    });
  });

  it("ranges across rows that are not drawn", () => {
    const onSelectRange = vi.fn();
    renderMany(new Set([idOf(0)]), { onSelectRange });

    scrollToRow(200);
    fireEvent.click(screen.getByRole("option", { name: nameOf(205) }), {
      shiftKey: true,
    });

    const range = onSelectRange.mock.lastCall?.[0] as GNode[];
    expect(range).toHaveLength(206);
    expect(range[0]).toEqual(many[0]);
    expect(range[205]).toEqual(many[205]);
  });
});
