import {
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { ResourceWorkspace } from "../resource-workspace";

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({
    children,
    orientation,
    disabled,
  }: {
    children: ReactNode;
    orientation?: string;
    disabled?: boolean;
  }) => (
    <div
      data-testid="panel-group"
      data-orientation={orientation}
      data-disabled={disabled ? "true" : "false"}
    >
      {children}
    </div>
  ),
  ResizableHandle: ({ className }: { className?: string }) => (
    <div data-testid="resize-handle" className={className} />
  ),
  ResizablePanel: ({
    children,
    defaultSize,
    minSize,
    maxSize,
  }: {
    children: ReactNode;
    defaultSize?: number | string;
    minSize?: number | string;
    maxSize?: number | string;
  }) => (
    <div
      data-testid={defaultSize ? "details-panel" : "main-panel"}
      data-default-size={defaultSize}
      data-min-size={minSize}
      data-max-size={maxSize}
    >
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));

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
 * One mount probe per workspace slot. Each records its own mounts and cleanups, so a
 * layout change that re-parents a slot (rather than re-styling it) is visible as a
 * second mount — the defect this component exists to not have.
 */
function createSlotProbes() {
  const log: string[] = [];
  const probe = (name: string) =>
    function SlotProbe() {
      const [typed, setTyped] = useState("");
      useEffect(() => {
        log.push(`mount:${name}`);
        return () => {
          log.push(`cleanup:${name}`);
        };
      }, []);
      return (
        <div>
          <span>{name}</span>
          <input
            aria-label={`${name} local state`}
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
            }}
          />
        </div>
      );
    };
  return {
    log,
    counts: () => ({
      mounts: log.filter((entry) => entry.startsWith("mount:")).length,
      cleanups: log.filter((entry) => entry.startsWith("cleanup:")).length,
    }),
    Table: probe("Table"),
    Actions: probe("Actions"),
    Details: probe("Details"),
  };
}

function renderWorkspace(hasSidePanel = true) {
  return render(
    <ResourceWorkspace
      hasSidePanel={hasSidePanel}
      actionBar={<span>Actions</span>}
      sidePanel={<span>Details</span>}
    >
      <span>Table</span>
    </ResourceWorkspace>,
  );
}

/** Every `id` in the tree, so a tree rendered twice shows up as a collision. */
function duplicateIds(container: HTMLElement) {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const element of container.querySelectorAll("[id]")) {
    const id = element.id;
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
  }
  return duplicates;
}

describe("ResourceWorkspace layout", () => {
  it("opens the details panel at 15% side by side and allows shrinking it to 10%", () => {
    mockViewport(false);
    renderWorkspace();

    expect(screen.getByText("Table").closest("[data-layout]")).toHaveAttribute(
      "data-layout",
      "resizable",
    );
    expect(screen.getByTestId("panel-group")).toHaveAttribute(
      "data-orientation",
      "horizontal",
    );
    expect(screen.getByTestId("panel-group")).toHaveAttribute(
      "data-disabled",
      "false",
    );
    const detailsPanel = screen.getByTestId("details-panel");
    expect(detailsPanel).toHaveAttribute("data-default-size", "15%");
    expect(detailsPanel).toHaveAttribute("data-min-size", "10%");
    expect(detailsPanel).toHaveAttribute("data-max-size", "60%");
  });

  it("stacks details below the content on narrow screens without offering a drag", () => {
    mockViewport(true);
    renderWorkspace();

    const workspace = screen.getByText("Table").closest("[data-layout]");
    expect(workspace).toHaveAttribute("data-layout", "stacked");
    expect(workspace).toHaveTextContent("Details");
    // Same panel group, turned through 90 degrees and frozen — not a second tree.
    const panelGroup = screen.getByTestId("panel-group");
    expect(panelGroup).toHaveAttribute("data-orientation", "vertical");
    expect(panelGroup).toHaveAttribute("data-disabled", "true");
    expect(screen.getByTestId("resize-handle").className).toContain(
      "max-md:hidden",
    );
    const detailsPanel = screen.getByTestId("details-panel");
    expect(detailsPanel).toHaveAttribute("data-default-size", "45%");
    expect(detailsPanel).toHaveAttribute("data-min-size", "25%");
    expect(detailsPanel).toHaveAttribute("data-max-size", "60%");

    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.queryByText("Details")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByText("Details")).toBeInTheDocument();
  });

  it("removes the details region when the side panel is no longer available", () => {
    mockViewport(false);
    const { rerender } = renderWorkspace();

    rerender(
      <ResourceWorkspace
        hasSidePanel={false}
        actionBar={<span>Actions</span>}
        sidePanel={<span>Details</span>}
      >
        <span>Table</span>
      </ResourceWorkspace>,
    );

    expect(screen.queryByTestId("details-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("resize-handle")).not.toBeInTheDocument();
  });
});

describe("ResourceWorkspace slot mounting", () => {
  it("mounts each slot once on an initially narrow viewport", () => {
    mockViewport(true);
    const probes = createSlotProbes();

    render(
      <ResourceWorkspace
        actionBar={<probes.Actions />}
        sidePanel={<probes.Details />}
      >
        <probes.Table />
      </ResourceWorkspace>,
    );

    // Narrow is only knowable after the effect reads matchMedia, so a layout chosen
    // by branching would have mounted the wide tree first and thrown it away here.
    expect(screen.getByText("Table").closest("[data-layout]")).toHaveAttribute(
      "data-layout",
      "stacked",
    );
    expect(probes.counts()).toStrictEqual({ mounts: 3, cleanups: 0 });
  });

  it.each([
    { name: "narrow first", start: true, then: false },
    { name: "wide first", start: false, then: true },
  ])(
    "keeps one instance of every slot across a $name transition and back",
    ({ start, then }) => {
      const viewport = mockViewport(start);
      const probes = createSlotProbes();

      const { container } = render(
        <ResourceWorkspace
          actionBar={<probes.Actions />}
          sidePanel={<probes.Details />}
        >
          <probes.Table />
        </ResourceWorkspace>,
      );

      const typeInto = (label: string, value: string) => {
        const input = screen.getByLabelText(label);
        fireEvent.change(input, { target: { value } });
      };
      typeInto("Table local state", "row-7");
      typeInto("Actions local state", "pending-copy");
      typeInto("Details local state", "accordion-open");

      for (const narrow of [then, start]) {
        viewport.crossBreakpoint(narrow);

        expect(
          screen.getByText("Table").closest("[data-layout]"),
        ).toHaveAttribute("data-layout", narrow ? "stacked" : "resizable");
        // No remount, and no cleanup: the slots were re-styled, not re-parented.
        expect(probes.counts()).toStrictEqual({ mounts: 3, cleanups: 0 });
        // Which is what lets slot-local state survive the transition.
        expect(screen.getByLabelText("Table local state")).toHaveValue("row-7");
        expect(screen.getByLabelText("Actions local state")).toHaveValue(
          "pending-copy",
        );
        expect(screen.getByLabelText("Details local state")).toHaveValue(
          "accordion-open",
        );
      }

      expect(probes.log).toStrictEqual([
        "mount:Table",
        "mount:Actions",
        "mount:Details",
      ]);
      expect(duplicateIds(container)).toStrictEqual([]);
    },
  );

  it.each([
    { name: "narrow", narrow: true },
    { name: "wide", narrow: false },
  ])(
    "renders no hidden duplicate of any slot or control when $name",
    ({ narrow }) => {
      mockViewport(narrow);
      const { container } = renderWorkspace();

      // `hidden: true` deliberately: the wrong fix for the breakpoint remount is to
      // render both layouts and hide one, which a visibility-filtered query misses.
      expect(
        screen.getAllByRole("button", { hidden: true, name: /^(Hide|Show)$/ }),
      ).toHaveLength(1);
      for (const slot of ["Table", "Actions", "Details"]) {
        expect(screen.getAllByText(slot)).toHaveLength(1);
      }
      expect(container.querySelectorAll("[data-layout]")).toHaveLength(1);
      expect(
        container.querySelectorAll("[data-testid='panel-group']"),
      ).toHaveLength(1);
      expect(duplicateIds(container)).toStrictEqual([]);
    },
  );
});
