import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { OrganismTaxonomy } from "@/lib/services/organisms/types";
import type { TaxonRecord } from "../taxon-tree-types";

const { mockPush, treePropsSpy } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  treePropsSpy: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Replace the real tree (virtualizer + TanStack Query + facet fetches) with a
// stub that exposes buttons to drive onSelect, plus expansion and filter state of
// its own. This test covers the panel's action wiring and the workspace's treatment
// of the tree's mount, not the tree.
vi.mock("../taxonomy-tree", () => ({
  TaxonomyTree: ({
    rootTaxa,
    onSelect,
  }: {
    rootTaxa: readonly OrganismTaxonomy[];
    onSelect?: (rows: TaxonRecord[]) => void;
  }) => {
    treePropsSpy(rootTaxa);
    // The real tree keeps expanded node ids and its keyword filter in its own
    // instance, so only the tree's own mount can carry them across a resize.
    const [expanded, setExpanded] = useState<string[]>([]);
    const [filter, setFilter] = useState("");
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            setExpanded((current) => [
              ...current,
              `node-${String(current.length + 1)}`,
            ]);
          }}
        >
          expand-node
        </button>
        <output aria-label="expanded nodes">{expanded.join(",")}</output>
        <input
          aria-label="tree filter"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
          }}
        />
        <button
          type="button"
          onClick={() =>
            onSelect?.([
              { taxon_id: 234, taxon_name: "Brucella", taxon_rank: "genus" },
            ])
          }
        >
          select-one
        </button>
        <button
          type="button"
          onClick={() =>
            onSelect?.([
              { taxon_id: 234, taxon_name: "Brucella", taxon_rank: "genus" },
              {
                taxon_id: 10239,
                taxon_name: "Viruses",
                taxon_rank: "superkingdom",
              },
            ])
          }
        >
          select-two
        </button>
      </div>
    );
  },
}));

import { TaxonomyTreePanel } from "../taxonomy-tree-panel";

beforeAll(() => {
  // ResourceWorkspace's resizable panels need ResizeObserver, absent in jsdom.
  globalThis.ResizeObserver = class {
    observe = () => undefined;
    unobserve = () => undefined;
    disconnect = () => undefined;
  };
});

beforeEach(() => {
  mockPush.mockClear();
  treePropsSpy.mockClear();
  vi.restoreAllMocks();
});

const taxon = {
  taxonId: 234,
  taxonName: "Brucella",
  taxonRank: "genus",
} as unknown as OrganismTaxonomy;

describe("TaxonomyTreePanel", () => {
  it("forwards every root to the tree in order", () => {
    const viruses = {
      taxonId: 10239,
      taxonName: "Viruses",
      taxonRank: "superkingdom",
    } as unknown as OrganismTaxonomy;

    render(<TaxonomyTreePanel taxa={[taxon, viruses]} />);

    expect(treePropsSpy).toHaveBeenLastCalledWith([taxon, viruses]);
  });

  it("navigates to the taxon overview when Taxon Overview is clicked with one row", async () => {
    render(<TaxonomyTreePanel taxa={[taxon]} />);

    await userEvent.click(screen.getByRole("button", { name: "select-one" }));
    await userEvent.click(
      screen.getByRole("button", { name: /taxon\s*overview/i }),
    );

    expect(mockPush).toHaveBeenCalledWith("/taxonomy/234?tab=overview");
  });

  it("navigates to the selected taxon's Genomes and Features tabs", async () => {
    render(<TaxonomyTreePanel taxa={[taxon]} />);

    await userEvent.click(screen.getByRole("button", { name: "select-one" }));
    await userEvent.click(screen.getByRole("button", { name: /^ggenomes$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^ffeatures$/i }));

    expect(mockPush).toHaveBeenNthCalledWith(1, "/taxonomy/234?tab=genomes");
    expect(mockPush).toHaveBeenNthCalledWith(2, "/taxonomy/234?tab=features");
  });

  it("opens Services and reports that none are selectable", async () => {
    render(<TaxonomyTreePanel taxa={[taxon]} />);

    await userEvent.click(screen.getByRole("button", { name: "select-one" }));
    await userEvent.click(screen.getByRole("button", { name: /services/i }));

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "No selectable services",
    );
  });

  it("hides single-row actions when multiple rows are selected", async () => {
    render(<TaxonomyTreePanel taxa={[taxon]} />);

    await userEvent.click(screen.getByRole("button", { name: "select-two" }));

    expect(
      screen.queryByRole("button", { name: /taxon\s*overview/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^ffeatures$/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^ggenomes$/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /services/i })).toBeEnabled();
  });
});

/** A `matchMedia` whose `matches` can change and notify, like a real resize. */
function mockViewport(initiallyNarrow = false) {
  const listeners = new Set<() => void>();
  const state = { matches: initiallyNarrow };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      get matches() {
        return state.matches;
      },
      media: "(max-width: 47.999rem)",
      onchange: null,
      addEventListener: (_event: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_event: string, listener: () => void) => {
        listeners.delete(listener);
      },
      dispatchEvent: () => true,
    })),
  });
  return {
    crossBreakpoint(narrow: boolean) {
      act(() => {
        state.matches = narrow;
        for (const listener of [...listeners]) listener();
      });
    },
  };
}

/**
 * The Taxa Tree tab is the `ResourceWorkspace` consumer where a slot remount is most
 * visible: the tree owns its expanded nodes, its keyword filter and the user's focus,
 * and none of that is recoverable from above. This suite uses the real workspace and
 * the real `react-resizable-panels`, so it sees the actual DOM the two layouts produce.
 */
describe("TaxonomyTreePanel across the workspace breakpoint", () => {
  it.each([
    { name: "narrow first", start: true, then: false },
    { name: "wide first", start: false, then: true },
  ])(
    "keeps tree expansion, filter text and focus across a $name transition and back",
    async ({ start, then }) => {
      const viewport = mockViewport(start);
      const { container } = render(<TaxonomyTreePanel taxa={[taxon]} />);

      // A selection so the detail panel is mounted too.
      await userEvent.click(screen.getByRole("button", { name: "select-one" }));
      const expandNode = screen.getByRole("button", { name: "expand-node" });
      await userEvent.click(expandNode);
      await userEvent.click(expandNode);
      fireEvent.change(screen.getByLabelText("tree filter"), {
        target: { value: "brucel" },
      });
      expandNode.focus();

      for (const narrow of [then, start]) {
        viewport.crossBreakpoint(narrow);

        expect(container.querySelector("[data-layout]")).toHaveAttribute(
          "data-layout",
          narrow ? "stacked" : "resizable",
        );
        expect(screen.getByLabelText("expanded nodes")).toHaveTextContent(
          "node-1,node-2",
        );
        expect(screen.getByLabelText("tree filter")).toHaveValue("brucel");
        // Same DOM node, still focused: the tree was re-styled, not re-created.
        expect(screen.getByRole("button", { name: "expand-node" })).toBe(
          expandNode,
        );
        expect(document.activeElement).toBe(expandNode);
      }
    },
  );

  it("renders one action bar, one tree and one detail panel with no duplicate ids when narrow", async () => {
    mockViewport(true);
    const { container } = render(<TaxonomyTreePanel taxa={[taxon]} />);
    await userEvent.click(screen.getByRole("button", { name: "select-one" }));

    expect(container.querySelector("[data-layout]")).toHaveAttribute(
      "data-layout",
      "stacked",
    );
    // `hidden: true` deliberately: rendering both layouts and hiding one with CSS
    // would trade the remount for duplicate interactive controls, which a
    // visibility-filtered query cannot see.
    for (const name of [
      /^(Hide|Show)$/,
      /services/i,
      /^ggenomes$/i,
      "expand-node",
    ]) {
      expect(
        screen.getAllByRole("button", { hidden: true, name }),
      ).toHaveLength(1);
    }
    expect(screen.getAllByLabelText("tree filter")).toHaveLength(1);

    // One separator, taken out of the layout (and so out of the tab order) while
    // there is nothing to drag.
    const separators = container.querySelectorAll("[role='separator']");
    expect(separators).toHaveLength(1);
    expect(separators[0].className).toContain("max-md:hidden");

    const ids = [...container.querySelectorAll("[id]")].map(
      (element) => element.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});
