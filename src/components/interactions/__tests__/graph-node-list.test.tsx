import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GraphNodeList } from "../graph-node-list";
import { colors } from "@/lib/interactions/graph-theme";
import type { GNode } from "@/lib/interactions/types";

// cmdk needs two browser APIs jsdom omits: scrollIntoView (scrolls the active
// item into view on selection) and ResizeObserver (its internal sizing). Stub
// both so the keyboard flow runs. scrollIntoView is re-stubbed per-test where a
// test asserts on it, so grab a stable default here.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    },
  );
});

// Undo the global stubs so they don't leak to sibling files (clearMocks resets
// neither stubGlobal nor prototype mutations).
afterAll(() => {
  delete (Element.prototype as Partial<Element>).scrollIntoView;
  vi.unstubAllGlobals();
});

const nodes: GNode[] = [
  { id: "fig|1.1", gene: "dnaA", kind: "microbial" },
  { id: "fig|2.2", gene: "recA", kind: "host" },
];

// The dot paints `bg-(--dot-color)`, so its rendered color is whatever the row
// puts in that custom property.
function dotColorOf(row: HTMLElement): string {
  const dot = row.querySelector("span[aria-hidden]");
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
        selectedIds={new Set()}
        onSelectNode={onSelectNode}
      />,
    );

    const input = screen.getByPlaceholderText("Search proteins…");
    await user.click(input);
    await user.keyboard("recA");
    await user.keyboard("{Enter}");

    expect(onSelectNode).toHaveBeenCalledWith(nodes[1]);
  });

  it("selects a node via pointer click even with cmdk pointer-selection disabled", async () => {
    const user = userEvent.setup();
    const onSelectNode = vi.fn();

    render(
      <GraphNodeList
        nodes={nodes}
        selectedIds={new Set()}
        onSelectNode={onSelectNode}
      />,
    );

    await user.click(screen.getByText("dnaA"));

    expect(onSelectNode).toHaveBeenCalledWith(nodes[0]);
  });

  it("marks the app-selected row without overriding cmdk's listbox semantics", () => {
    render(
      <GraphNodeList
        nodes={nodes}
        selectedIds={new Set(["fig|2.2"])}
        onSelectNode={vi.fn()}
      />,
    );

    const selected = screen.getByText("recA").closest("[cmdk-item]");
    const other = screen.getByText("dnaA").closest("[cmdk-item]");

    expect(selected).toHaveAttribute("data-app-selected", "true");
    expect(other).toHaveAttribute("data-app-selected", "false");
    expect(selected).not.toHaveAttribute("aria-current");
    expect(other).not.toHaveAttribute("aria-current");
  });

  it("recolors the selected row's dot amber and leaves unselected dots on their kind color", () => {
    render(
      <GraphNodeList
        nodes={nodes}
        selectedIds={new Set(["fig|1.1"])}
        onSelectNode={vi.fn()}
      />,
    );

    const selectedRow = screen
      .getByText("dnaA")
      .closest("[cmdk-item]") as HTMLElement;
    const hostRow = screen
      .getByText("recA")
      .closest("[cmdk-item]") as HTMLElement;

    // dnaA is selected -> amber, regardless of its microbial kind.
    expect(dotColorOf(selectedRow)).toBe(colors.selected);
    // recA is unselected -> its host kind color.
    expect(dotColorOf(hostRow)).toBe(colors.host);
  });

  it("highlights every protein in a bulk selection", () => {
    render(
      <GraphNodeList
        nodes={nodes}
        selectedIds={new Set(nodes.map((node) => node.id))}
        onSelectNode={vi.fn()}
      />,
    );

    for (const label of ["dnaA", "recA"]) {
      const row = screen.getByText(label).closest("[cmdk-item]") as HTMLElement;
      expect(row).toHaveAttribute("data-app-selected", "true");
      expect(row).not.toHaveAttribute("aria-current");
      expect(dotColorOf(row)).toBe(colors.selected);
    }
  });

  it("uses each node's kind color for the dot when nothing is selected", () => {
    render(
      <GraphNodeList
        nodes={nodes}
        selectedIds={new Set()}
        onSelectNode={vi.fn()}
      />,
    );

    const microbialRow = screen
      .getByText("dnaA")
      .closest("[cmdk-item]") as HTMLElement;
    const hostRow = screen
      .getByText("recA")
      .closest("[cmdk-item]") as HTMLElement;

    expect(dotColorOf(microbialRow)).toBe(colors.microbial);
    expect(dotColorOf(hostRow)).toBe(colors.host);
  });

  it("gives every row a hover highlight distinct from the selected row's", () => {
    render(
      <GraphNodeList
        nodes={nodes}
        selectedIds={new Set(["fig|1.1"])}
        onSelectNode={vi.fn()}
      />,
    );

    const selectedRow = screen
      .getByText("dnaA")
      .closest("[cmdk-item]") as HTMLElement;
    const otherRow = screen
      .getByText("recA")
      .closest("[cmdk-item]") as HTMLElement;

    // Hover tint lives on every row (cmdk's pointer-selection is disabled, so the
    // built-in data-[selected] hover never fires — this explicit class is the
    // only hover feedback).
    expect(otherRow).toHaveClass("hover:bg-secondary/15");
    // Selected row keeps its stronger, forced highlight so hover can't override it.
    expect(selectedRow).toHaveClass(
      "data-[app-selected=true]:bg-secondary/25!",
    );
  });

  it("scrolls the newly selected row into view (graph→list sync)", () => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;

    const { rerender } = render(
      <GraphNodeList
        nodes={nodes}
        selectedIds={new Set()}
        onSelectNode={vi.fn()}
      />,
    );

    // cmdk scrolls its own internal cursor into view on mount; clear that so the
    // assertion isolates our selection-change effect, not cmdk's mount behavior.
    scrollSpy.mockClear();

    // A canvas click flows in as a new selectedId → scroll that row into view.
    rerender(
      <GraphNodeList
        nodes={nodes}
        selectedIds={new Set(["fig|2.2"])}
        onSelectNode={vi.fn()}
      />,
    );

    expect(scrollSpy).toHaveBeenCalledWith({ block: "nearest" });
  });
});
