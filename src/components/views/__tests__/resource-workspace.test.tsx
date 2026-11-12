import { useEffect, useState, type ComponentProps } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

import {
  panelShares,
  pressOnSeparator,
  stubResizableGeometry,
} from "@/test-helpers/resizable";
import { createUiPreferencesWrapper } from "@/test-helpers/react";
import { ResourceWorkspace } from "../resource-workspace";

/**
 * Real `react-resizable-panels`: it restores a layout cached per panel-id key
 * over `defaultSize`, which a stub echoing props would hide.
 */
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));

stubResizableGeometry();

// vitest.config.mts sets clearMocks but not restoreMocks; restore so a failing
// assertion cannot leave document.cookie spied.
afterEach(() => {
  vi.restoreAllMocks();
});

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

function panelGroup() {
  return document.querySelector("[data-group]") as HTMLElement;
}

function separator() {
  return document.querySelector(
    "[data-slot='resizable-handle']",
  ) as HTMLElement;
}

function resizeWindow() {
  const handle = separator();
  return [
    handle.getAttribute("aria-valuemin"),
    handle.getAttribute("aria-valuenow"),
    handle.getAttribute("aria-valuemax"),
  ];
}

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
    Toolbar: probe("Toolbar"),
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

function renderProbedWorkspace(probes: ReturnType<typeof createSlotProbes>) {
  return render(
    <ResourceWorkspace
      actionBar={<probes.Actions />}
      sidePanel={<probes.Details />}
    >
      <probes.Table />
    </ResourceWorkspace>,
  );
}

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
  it("renders an 85/15 side-by-side split the user can actually resize", () => {
    mockViewport(false);
    renderWorkspace();

    expect(screen.getByText("Table").closest("[data-layout]")).toHaveAttribute(
      "data-layout",
      "resizable",
    );
    expect(panelShares()).toStrictEqual(["85", "15"]);
    expect(panelGroup().style.flexDirection).toBe("row");
    expect(separator()).toHaveAttribute("aria-orientation", "vertical");
    expect(resizeWindow()).toStrictEqual(["40", "85", "90"]);

    pressOnSeparator("ArrowLeft");
    expect(panelShares()).toStrictEqual(["80", "20"]);
    pressOnSeparator("ArrowRight");
    expect(panelShares()).toStrictEqual(["85", "15"]);
  });

  it("renders a 55/45 stacked split that refuses to resize when narrow", () => {
    mockViewport(true);
    renderWorkspace();

    const workspace = screen.getByText("Table").closest("[data-layout]");
    expect(workspace).toHaveAttribute("data-layout", "stacked");
    expect(workspace).toHaveTextContent("Details");
    expect(panelShares()).toStrictEqual(["55", "45"]);
    expect(panelGroup().style.flexDirection).toBe("column");
    expect(separator()).toHaveAttribute("aria-orientation", "horizontal");
    const actionStrip = screen.getByText("Actions").closest("aside");
    expect(actionStrip?.className).toContain("max-md:max-h-20");
    expect(actionStrip?.querySelector(".scrollbar-themed")?.className).toContain(
      "max-md:overflow-x-auto",
    );
    expect(resizeWindow()).toStrictEqual(["40", "55", "75"]);

    expect(separator().className).toContain("max-md:hidden");
    for (const key of ["ArrowUp", "ArrowDown", "Home", "End"]) {
      pressOnSeparator(key);
      expect(panelShares()).toStrictEqual(["55", "45"]);
    }

    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.queryByText("Details")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByText("Details")).toBeInTheDocument();
  });

  it("opens side by side at the remembered width", () => {
    mockViewport(false);
    render(
      <ResourceWorkspace
        actionBar={<span>Actions</span>}
        sidePanel={<span>Details</span>}
      >
        <span>Table</span>
      </ResourceWorkspace>,
      { wrapper: createUiPreferencesWrapper({ resourceDetailPanelSize: 30 }) },
    );
    expect(panelShares()).toStrictEqual(["70", "30"]);
  });

  it("remembers a side-by-side resize but never the stacked split", () => {
    const viewport = mockViewport(false);
    const cookieSpy = vi.spyOn(document, "cookie", "set");
    render(
      <ResourceWorkspace
        actionBar={<span>Actions</span>}
        sidePanel={<span>Details</span>}
      >
        <span>Table</span>
      </ResourceWorkspace>,
      { wrapper: createUiPreferencesWrapper() },
    );
    pressOnSeparator("ArrowLeft");
    expect(cookieSpy).toHaveBeenCalledWith(
      expect.stringContaining("dxkb-resource-detail-panel-size=20;"),
    );
    cookieSpy.mockClear();
    viewport.crossBreakpoint(true);
    expect(
      cookieSpy.mock.calls.some(([value]) =>
        value.startsWith("dxkb-resource-detail-panel-size="),
      ),
    ).toBe(false);
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

    expect(panelShares()).toHaveLength(1);
    expect(
      document.querySelector("[data-slot='resizable-handle']"),
    ).not.toBeInTheDocument();
  });
});

describe("ResourceWorkspace panel toggle", () => {
  it("disables Show with a selection hint while there is no side panel", () => {
    mockViewport(false);
    renderWorkspace(false);

    const toggle = screen.getByRole("button", { name: /show panel/i });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAccessibleName(
      "Show panel. Select a row to show its details",
    );

    fireEvent.click(toggle);
    expect(screen.getByText("Show")).toBeInTheDocument();
    expect(screen.queryByText("Details")).not.toBeInTheDocument();
  });

  it("uses the caller's hint for what to select", () => {
    mockViewport(false);
    render(
      <ResourceWorkspace
        hasSidePanel={false}
        emptySelectionHint="Select a leaf in the tree to show its details"
        sidePanel={<span>Details</span>}
      >
        <span>Table</span>
      </ResourceWorkspace>,
    );

    expect(
      screen.getByRole("button", { name: /show panel/i }),
    ).toHaveAccessibleName(
      "Show panel. Select a leaf in the tree to show its details",
    );
  });

  it("hides and shows the panel once a selection exists", () => {
    mockViewport(false);
    renderWorkspace(true);

    const hide = screen.getByRole("button", { name: "Hide" });
    expect(hide).toBeEnabled();
    expect(screen.getByText("Details")).toBeInTheDocument();

    fireEvent.click(hide);
    expect(screen.queryByText("Details")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByText("Details")).toBeInTheDocument();
  });

  it("enables the toggle and opens the panel when a selection arrives", () => {
    mockViewport(false);
    const { rerender } = renderWorkspace(false);
    expect(screen.getByRole("button", { name: /show panel/i })).toBeDisabled();

    rerender(
      <ResourceWorkspace
        hasSidePanel
        actionBar={<span>Actions</span>}
        sidePanel={<span>Details</span>}
      >
        <span>Table</span>
      </ResourceWorkspace>,
    );

    expect(screen.getByRole("button", { name: "Hide" })).toBeEnabled();
    expect(screen.getByText("Details")).toBeInTheDocument();
  });
});

describe("ResourceWorkspace slot mounting", () => {
  it("mounts each slot once, already stacked, on an initially narrow viewport", () => {
    mockViewport(true);
    const probes = createSlotProbes();

    renderProbedWorkspace(probes);

    expect(screen.getByText("Table").closest("[data-layout]")).toHaveAttribute(
      "data-layout",
      "stacked",
    );
    expect(panelShares()).toStrictEqual(["55", "45"]);
    expect(probes.counts()).toStrictEqual({ mounts: 3, cleanups: 0 });
  });

  it.each([
    { name: "narrow first", start: true, then: false },
    { name: "wide first", start: false, then: true },
  ])(
    "keeps one instance of every slot, and the right split, across a $name transition and back",
    ({ start, then }) => {
      const viewport = mockViewport(start);
      const probes = createSlotProbes();

      const { container } = renderProbedWorkspace(probes);

      const typeInto = (label: string, value: string) => {
        fireEvent.change(screen.getByLabelText(label), { target: { value } });
      };
      typeInto("Table local state", "row-7");
      typeInto("Actions local state", "pending-copy");
      typeInto("Details local state", "accordion-open");

      for (const narrow of [then, start]) {
        viewport.crossBreakpoint(narrow);

        expect(
          screen.getByText("Table").closest("[data-layout]"),
        ).toHaveAttribute("data-layout", narrow ? "stacked" : "resizable");
        expect(panelShares()).toStrictEqual(
          narrow ? ["55", "45"] : ["85", "15"],
        );
        expect(panelGroup().style.flexDirection).toBe(
          narrow ? "column" : "row",
        );
        expect(probes.counts()).toStrictEqual({ mounts: 3, cleanups: 0 });
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

  it("restores a resize the user made when the layout returns, without remounting", () => {
    const viewport = mockViewport(false);
    const probes = createSlotProbes();

    renderProbedWorkspace(probes);
    pressOnSeparator("ArrowLeft");
    expect(panelShares()).toStrictEqual(["80", "20"]);

    viewport.crossBreakpoint(true);
    expect(panelShares()).toStrictEqual(["55", "45"]);
    viewport.crossBreakpoint(false);
    expect(panelShares()).toStrictEqual(["80", "20"]);
    viewport.crossBreakpoint(true);
    expect(panelShares()).toStrictEqual(["55", "45"]);
    expect(probes.counts()).toStrictEqual({ mounts: 3, cleanups: 0 });
  });

  it.each([
    { name: "narrow", narrow: true },
    { name: "wide", narrow: false },
  ])(
    "renders no hidden duplicate of any slot or control when $name",
    ({ narrow }) => {
      mockViewport(narrow);
      const { container } = renderWorkspace();

      // `hidden: true`: rendering both layouts and hiding one is the wrong fix,
      // and a visibility-filtered query would miss it.
      expect(
        screen.getAllByRole("button", { hidden: true, name: /^(Hide|Show)$/ }),
      ).toHaveLength(1);
      for (const slot of ["Table", "Actions", "Details"]) {
        expect(screen.getAllByText(slot)).toHaveLength(1);
      }
      expect(container.querySelectorAll("[data-layout]")).toHaveLength(1);
      expect(container.querySelectorAll("[data-group]")).toHaveLength(1);
      expect(
        container.querySelectorAll("[data-slot='resizable-handle']"),
      ).toHaveLength(1);
      expect(duplicateIds(container)).toStrictEqual([]);
    },
  );

  it("drops the action rail without remounting the toolbar", () => {
    mockViewport(false);
    const probes = createSlotProbes();
    const workspace = (hasActionRail: boolean) => (
      <ResourceWorkspace
        toolbar={<probes.Toolbar />}
        hasActionRail={hasActionRail}
        hasSidePanel={hasActionRail}
        actionBar={<span>Rail actions</span>}
        sidePanel={<probes.Details />}
      >
        <probes.Table />
      </ResourceWorkspace>
    );
    const { rerender } = render(workspace(true));
    fireEvent.change(screen.getByLabelText("Toolbar local state"), {
      target: { value: "keyword draft" },
    });

    rerender(workspace(false));
    expect(document.querySelector("aside")).not.toBeInTheDocument();
    expect(screen.queryByText("Rail actions")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^(Hide|Show)$/ }),
    ).not.toBeInTheDocument();
    expect(panelShares()).toHaveLength(1);

    rerender(workspace(true));
    expect(screen.getByText("Rail actions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide" })).toBeInTheDocument();
    expect(screen.getByLabelText("Toolbar local state")).toHaveValue(
      "keyword draft",
    );
    expect(
      probes.log.filter((entry) => !entry.endsWith(":Details")),
    ).toStrictEqual(["mount:Toolbar", "mount:Table"]);
  });

  it("keeps the detail panel's id unique when two workspaces are mounted at once", () => {
    mockViewport(false);
    const { container } = render(
      <>
        <ResourceWorkspace
          actionBar={<span>A1</span>}
          sidePanel={<span>D1</span>}
        >
          <span>T1</span>
        </ResourceWorkspace>
        <ResourceWorkspace
          actionBar={<span>A2</span>}
          sidePanel={<span>D2</span>}
        >
          <span>T2</span>
        </ResourceWorkspace>
      </>,
    );

    expect(duplicateIds(container)).toStrictEqual([]);
    expect(
      [...container.querySelectorAll("[data-panel]")].map((panel) => panel.id),
    ).toHaveLength(4);
  });
});
