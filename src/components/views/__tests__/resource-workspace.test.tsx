import { useEffect, useState, type ComponentProps } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { ResourceWorkspace } from "../resource-workspace";

/**
 * The **real** `react-resizable-panels`, deliberately. This suite used to replace
 * `@/components/ui/resizable` with stand-ins that echoed `defaultSize` back as a data
 * attribute, and asserted that attribute — which is green whatever the group actually
 * renders. It hid a live defect: the group caches its computed layout under a key made
 * from its panels' joined ids and restores that cache in preference to `defaultSize`,
 * so switching only `defaultSize` on a breakpoint crossing left the detail panel
 * clamped to the stacked `minSize` (25%) and then stranded the desktop panel at that
 * same 25%. Every size assertion below therefore reads the inline `flex-grow` the
 * library writes, never a prop this file passed in.
 *
 * jsdom has no layout engine, so `ResizeObserver` is stubbed and the group is given a
 * non-zero size. That is enough for the library's real layout arithmetic to run.
 */
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));

const unstubbedOffsets = {
  width: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth"),
  height: Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetHeight",
  ),
};

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = () => undefined;
    unobserve = () => undefined;
    disconnect = () => undefined;
  };
  for (const property of ["offsetWidth", "offsetHeight"] as const) {
    Object.defineProperty(HTMLElement.prototype, property, {
      configurable: true,
      value: 500,
    });
  }
});

afterAll(() => {
  if (unstubbedOffsets.width) {
    Object.defineProperty(
      HTMLElement.prototype,
      "offsetWidth",
      unstubbedOffsets.width,
    );
  }
  if (unstubbedOffsets.height) {
    Object.defineProperty(
      HTMLElement.prototype,
      "offsetHeight",
      unstubbedOffsets.height,
    );
  }
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

/** The split the group actually rendered: `flex-grow` per panel, content first. */
function panelShares() {
  return [...document.querySelectorAll("[data-panel]")].map(
    (panel) => (panel as HTMLElement).style.flexGrow,
  );
}

function panelGroup() {
  return document.querySelector("[data-group]") as HTMLElement;
}

function separator() {
  return document.querySelector(
    "[data-slot='resizable-handle']",
  ) as HTMLElement;
}

/**
 * The separator's reported range, which is the *content* panel's constraint window and
 * therefore pins the detail panel's `minSize`/`maxSize` as rendered: side by side the
 * detail panel may take 10–60%, so the content panel may take 40–90%.
 */
function resizeWindow() {
  const handle = separator();
  return [
    handle.getAttribute("aria-valuemin"),
    handle.getAttribute("aria-valuenow"),
    handle.getAttribute("aria-valuemax"),
  ];
}

/** Drive a real resize through the library's own keyboard handler. */
function pressOnSeparator(key: string) {
  act(() => {
    fireEvent.keyDown(separator(), { key });
  });
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

/**
 * Every `id` in the tree. Meaningful here because the real library writes each panel's,
 * the group's and the separator's id into the DOM — including the detail panel's
 * layout-dependent id, which is the one that could collide.
 */
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
    // Detail panel 10–60% ⇒ content panel 40–90%, currently 85%.
    expect(resizeWindow()).toStrictEqual(["40", "85", "90"]);

    // A real resize through the library, not a prop assertion: jsdom cannot drag, but
    // the separator's own keyboard handler goes through the same layout code.
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
    // Same panel group, turned through 90 degrees — not a second tree.
    expect(panelShares()).toStrictEqual(["55", "45"]);
    expect(panelGroup().style.flexDirection).toBe("column");
    expect(separator()).toHaveAttribute("aria-orientation", "horizontal");
    // Detail panel 25–60% ⇒ content panel 40–75%, currently 55%.
    expect(resizeWindow()).toStrictEqual(["40", "55", "75"]);

    // Taken out of the layout by CSS, and out of the group's hit regions and keyboard
    // handling by `disabled` — so neither a drag nor an arrow key can move it.
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

describe("ResourceWorkspace slot mounting", () => {
  it("mounts each slot once, already stacked, on an initially narrow viewport", () => {
    mockViewport(true);
    const probes = createSlotProbes();

    renderProbedWorkspace(probes);

    // Narrow is only knowable after the effect reads matchMedia, so a layout chosen
    // by branching would have mounted the wide tree first and thrown it away here.
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
        // The rendered split, not the prop: the group has to re-read its sizes on a
        // crossing rather than restore the layout it cached for the other axis.
        expect(panelShares()).toStrictEqual(
          narrow ? ["55", "45"] : ["85", "15"],
        );
        expect(panelGroup().style.flexDirection).toBe(
          narrow ? "column" : "row",
        );
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

  it("restores a resize the user made when the layout returns, without remounting", () => {
    const viewport = mockViewport(false);
    const probes = createSlotProbes();

    renderProbedWorkspace(probes);
    pressOnSeparator("ArrowLeft");
    expect(panelShares()).toStrictEqual(["80", "20"]);

    // The group caches one layout per panel-id key, so the stacked layout does not
    // inherit the side-by-side split (a share of a horizontal axis means nothing on a
    // vertical one) and the side-by-side layout gets the user's own width back.
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

      // `hidden: true` deliberately: the wrong fix for the breakpoint remount is to
      // render both layouts and hide one, which a visibility-filtered query misses.
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

    // The library writes a panel's `id` prop straight into the DOM, so the
    // layout-dependent id has to be namespaced per instance.
    expect(duplicateIds(container)).toStrictEqual([]);
    expect(
      [...container.querySelectorAll("[data-panel]")].map((panel) => panel.id),
    ).toHaveLength(4);
  });
});
