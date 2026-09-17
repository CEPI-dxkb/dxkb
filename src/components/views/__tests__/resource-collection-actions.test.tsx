import { useEffect, useState, type ReactNode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DataRepository } from "@/lib/data-api";
import { taxonomyCollectionProfile } from "@/lib/taxonomy-view/profile";
import type { useResourceCollection as useResourceCollectionHook } from "@/hooks/views/use-resource-collection";
import { ResourceCollection } from "../resource-collection";

/**
 * Where the action bar and its dialogs *mount*, rather than what they do —
 * `resource-collection.test.tsx` covers behaviour, but it replaces
 * `ResourceWorkspace` with a flat stand-in, so it cannot see this at all.
 *
 * Two separate guarantees are exercised, and the real workspace plus the real action
 * bar are used on purpose because only that pair can show either:
 *
 * 1. Crossing the `md` breakpoint re-styles the workspace's slots instead of
 *    re-parenting them. `ResourceWorkspace` renders one subtree at every width, so a
 *    window resize or a tablet rotation must not remount the table or the bar, and
 *    must not discard table-local state. It used to return two structurally different
 *    trees and did exactly that.
 * 2. A collection error still replaces the whole workspace — action bar included —
 *    with the retry alert. The Taxonomy launch resolves IDs over the network first, so
 *    anything it kept inside that slot would be thrown away mid-flight: no chooser, no
 *    error, no spinner, just a click that vanished. That is why the chooser is a
 *    sibling of the workspace rather than a descendant.
 */
const { useResourceCollection, slotLog } = vi.hoisted(() => ({
  useResourceCollection: vi.fn<typeof useResourceCollectionHook>(),
  /** Mount/cleanup entries recorded by the table stand-in below. */
  slotLog: [] as string[],
}));

vi.mock("@/hooks/views/use-resource-collection", () => ({
  useResourceCollection,
}));
// Panel primitives only (jsdom has no ResizeObserver); the responsive
// `ResourceWorkspace` itself stays real, because it is what is under test.
vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({
    children,
    orientation,
  }: {
    children: ReactNode;
    orientation?: string;
  }) => (
    <div data-testid="panel-group" data-orientation={orientation}>
      {children}
    </div>
  ),
  ResizableHandle: () => <div data-testid="resize-handle" />,
  ResizablePanel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/components/shared/data-table", () => ({
  // Carries state of its own, standing in for the real table's row selection,
  // scroll offset and column sizing — none of which the shell owns, so only the
  // table's own mount can preserve them.
  DataTable: () => {
    const [localState, setLocalState] = useState("");
    useEffect(() => {
      slotLog.push("mount:table");
      return () => {
        slotLog.push("cleanup:table");
      };
    }, []);
    return (
      <div data-testid="data-table">
        <input
          aria-label="table local state"
          value={localState}
          onChange={(event) => {
            setLocalState(event.target.value);
          }}
        />
      </div>
    );
  },
}));
vi.mock("../resource-filter-bar", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).resourceFilterBarMock(),
);
vi.mock("@/components/detail-panel/info-panel", () => ({
  InfoPanel: () => null,
}));
vi.mock("../taxonomy-service-chooser", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).taxonomyServiceChooserMock(),
);
// The dependencies `CollectionSelectionActions` brings with it, for the non-Taxonomy
// half of the suite. Its COPY / SERVICES / GROUP progress lives in its own instance
// inside the `actionBar` slot, which is exactly what a slot remount would destroy.
vi.mock("@tanstack/react-query", async () =>
  (await import("./fixtures/resource-collection-mocks")).reactQueryMock(),
);
vi.mock("@/lib/auth/provider", async () =>
  (await import("./fixtures/resource-collection-mocks")).authProviderMock({
    username: "alice",
    realm: "BVBRC",
  }),
);
vi.mock("@/contexts/workspace-repository-context", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).workspaceRepositoryContextMock(),
);
vi.mock("../collection-copy-dialog", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).collectionCopyDialogMock(),
);
vi.mock("../selection-service-chooser", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).selectionServiceChooserMock(),
);
vi.mock("@/components/workspace/selection-to-group-dialog", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).selectionToGroupDialogMock(),
);

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
    crossBreakpoint(matches: boolean) {
      state.matches = matches;
      for (const listener of [...listeners]) listener();
    },
  };
}

function allPagesTaxonomyCollection() {
  const taxonomyRow = { taxon_id: "234", taxon_name: "Brucella" };
  return {
    activeId: "234",
    detail: taxonomyRow,
    detailError: null,
    facets: {},
    isAllPagesSelected: true,
    isDetailLoading: false,
    isInitialLoading: false,
    isRefreshing: false,
    error: null,
    refetch: vi.fn(),
    rows: [taxonomyRow],
    selection: {},
    selectedIds: [],
    sorting: [],
    total: 2,
    setIsAllPagesSelected: vi.fn(),
    setSelection: vi.fn(),
    setPageIndex: vi.fn(),
    setSorting: vi.fn(),
  };
}

function taxonomyCollection(repository: DataRepository) {
  return (
    <ResourceCollection
      profile={taxonomyCollectionProfile}
      repository={repository}
      state={{ filters: {}, page: 1, sort: "unsorted" }}
      onStateChange={vi.fn()}
    />
  );
}

function renderTaxonomyCollection(repository: DataRepository) {
  return render(taxonomyCollection(repository));
}

/** Two explicitly selected Genome rows, so COPY, SERVICES and GROUP are all live. */
function selectedGenomeCollection() {
  const rows = [{ genome_id: "83332.12" }, { genome_id: "83332.13" }];
  return {
    ...allPagesTaxonomyCollection(),
    activeId: "83332.12",
    detail: rows[0],
    isAllPagesSelected: false,
    rows,
    selection: { "83332.12": true as const, "83332.13": true as const },
    selectedIds: ["83332.12", "83332.13"],
  };
}

function renderGenomeCollection(repository: DataRepository) {
  return render(
    <ResourceCollection
      profile={{
        resource: "genome",
        label: "Genomes",
        idField: "genome_id",
        columns: [{ id: "genome_id", label: "Genome ID" }],
      }}
      repository={repository}
      state={{ filters: {}, page: 1, sort: "genome_id:asc" }}
      onStateChange={vi.fn()}
    />,
  );
}

// Loose match: the bar swaps SERVICES' icon for a spinner while it resolves, and
// the spinner's own "Loading" label joins the button's accessible name.
const servicesButton = () => screen.getByRole("button", { name: /services/i });
const resolvingSpinner = () =>
  screen.queryByRole("status", { name: "Loading" });

beforeEach(() => {
  slotLog.length = 0;
  useResourceCollection.mockReturnValue(allPagesTaxonomyCollection());
});

describe("ResourceCollection action mounting across the workspace breakpoint", () => {
  it("completes a Taxonomy launch that is still resolving when the layout flips", async () => {
    const user = userEvent.setup();
    const viewport = mockViewport();
    let resolveExport:
      ((value: { rows: { taxon_id: string }[] }) => void) | undefined;
    const exportAll = vi.fn(
      () =>
        new Promise<{ rows: { taxon_id: string }[] }>((resolve) => {
          resolveExport = resolve;
        }),
    );

    renderTaxonomyCollection({
      exportAll,
      selected: vi.fn(() => Promise.resolve({ rows: [] })),
    } as unknown as DataRepository);

    expect(document.querySelector("[data-layout]")).toHaveAttribute(
      "data-layout",
      "resizable",
    );

    await user.click(servicesButton());
    expect(exportAll).toHaveBeenCalledTimes(1);
    // The bar shows a spinner and disables the entry while the IDs resolve.
    expect(resolvingSpinner()).toBeInTheDocument();
    expect(servicesButton()).toBeDisabled();

    // The window crosses the md breakpoint mid-resolution, which turns the
    // workspace's panel group through 90 degrees without re-parenting its slots.
    act(() => {
      viewport.crossBreakpoint(true);
    });
    expect(document.querySelector("[data-layout]")).toHaveAttribute(
      "data-layout",
      "stacked",
    );
    // The bar still reports the pending launch rather than quietly going idle on
    // one that is still running.
    expect(resolvingSpinner()).toBeInTheDocument();
    expect(servicesButton()).toBeDisabled();
    expect(slotLog).toStrictEqual(["mount:table"]);

    await act(async () => {
      resolveExport?.({ rows: [{ taxon_id: "234" }, { taxon_id: "235" }] });
      await Promise.resolve();
    });

    // The launch lands: chooser open, on the IDs the request returned.
    expect(await screen.findByTestId("taxonomy-services")).toHaveTextContent(
      "234,235",
    );
    expect(
      screen.queryByText("Could not complete action"),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(resolvingSpinner()).not.toBeInTheDocument();
    });
    expect(servicesButton()).toBeEnabled();
  });

  it("keeps an open Taxonomy chooser and its IDs when the layout flips", async () => {
    const user = userEvent.setup();
    const viewport = mockViewport();

    renderTaxonomyCollection({
      exportAll: vi.fn(() =>
        Promise.resolve({ rows: [{ taxon_id: "234" }, { taxon_id: "235" }] }),
      ),
      selected: vi.fn(() => Promise.resolve({ rows: [] })),
    } as unknown as DataRepository);

    await user.click(servicesButton());
    expect(await screen.findByTestId("taxonomy-services")).toHaveTextContent(
      "234,235",
    );

    act(() => {
      viewport.crossBreakpoint(true);
    });

    // The chooser is rendered at section level, outside the workspace, so the
    // layout switch cannot close it or drop what it is working with.
    expect(document.querySelector("[data-layout]")).toHaveAttribute(
      "data-layout",
      "stacked",
    );
    expect(screen.getByTestId("taxonomy-services")).toHaveTextContent(
      "234,235",
    );
  });

  it("mounts the collection once on an initially narrow viewport", () => {
    mockViewport(true);

    renderTaxonomyCollection({
      exportAll: vi.fn(() => Promise.resolve({ rows: [] })),
      selected: vi.fn(() => Promise.resolve({ rows: [] })),
    } as unknown as DataRepository);

    // `isNarrow` can only become true once the effect has read `matchMedia`, so a
    // layout picked by branching mounted the whole collection wide and then threw
    // it away on the very first paint of every phone-sized page load.
    expect(document.querySelector("[data-layout]")).toHaveAttribute(
      "data-layout",
      "stacked",
    );
    expect(slotLog).toStrictEqual(["mount:table"]);
    expect(screen.getAllByTestId("data-table")).toHaveLength(1);
    expect(
      screen.getAllByRole("button", { hidden: true, name: /^(Hide|Show)$/ }),
    ).toHaveLength(1);
  });

  it.each([
    { name: "narrow first", start: true, then: false },
    { name: "wide first", start: false, then: true },
  ])(
    "keeps the table and the action bar mounted with their own state across a $name transition and back",
    ({ start, then }) => {
      const viewport = mockViewport(start);

      renderTaxonomyCollection({
        exportAll: vi.fn(() => Promise.resolve({ rows: [] })),
        selected: vi.fn(() => Promise.resolve({ rows: [] })),
      } as unknown as DataRepository);

      fireEvent.change(screen.getByLabelText("table local state"), {
        target: { value: "scrolled-to-row-40" },
      });

      for (const narrow of [then, start]) {
        act(() => {
          viewport.crossBreakpoint(narrow);
        });

        expect(document.querySelector("[data-layout]")).toHaveAttribute(
          "data-layout",
          narrow ? "stacked" : "resizable",
        );
        expect(screen.getByTestId("panel-group")).toHaveAttribute(
          "data-orientation",
          narrow ? "vertical" : "horizontal",
        );
        // One mount, no cleanup, in either direction — so the table keeps the
        // state only its own instance holds.
        expect(slotLog).toStrictEqual(["mount:table"]);
        expect(screen.getByLabelText("table local state")).toHaveValue(
          "scrolled-to-row-40",
        );
        // And the bar is re-styled, not duplicated into a hidden second copy.
        expect(
          screen.getAllByRole("button", { name: /services/i }),
        ).toHaveLength(1);
        expect(screen.getAllByTestId("data-table")).toHaveLength(1);
      }
    },
  );

  it("keeps an open Taxonomy chooser when the collection query fails", async () => {
    const user = userEvent.setup();
    mockViewport();
    const repository = {
      exportAll: vi.fn(() => Promise.resolve({ rows: [{ taxon_id: "234" }] })),
      selected: vi.fn(() => Promise.resolve({ rows: [] })),
    } as unknown as DataRepository;

    const view = renderTaxonomyCollection(repository);

    await user.click(servicesButton());
    expect(await screen.findByTestId("taxonomy-services")).toHaveTextContent(
      "234",
    );

    // A background refetch failing replaces the whole workspace with an error
    // alert, taking the action bar with it.
    useResourceCollection.mockReturnValue({
      ...allPagesTaxonomyCollection(),
      error: new Error("Data service is unavailable (503)"),
    });
    view.rerender(taxonomyCollection(repository));

    expect(screen.getByText("Data service is unavailable (503)")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /services/i }),
    ).not.toBeInTheDocument();
    // The chooser is not in the workspace, so it stays open on its own IDs.
    expect(screen.getByTestId("taxonomy-services")).toHaveTextContent("234");
  });
});

/**
 * `CollectionSelectionActions` is the other half of the action bar, and unlike the
 * Taxonomy workflow it deliberately keeps its own state — `isCopyOpen`,
 * `isServiceOpen`, `isGroupOpen`, `selectionIds`, `loadingActionIds` and the overlap
 * ref — inside the `actionBar` slot. Hoisting all of that into every consumer is not
 * the fix (see the item's stop condition); the workspace not re-parenting the slot is.
 */
describe("CollectionSelectionActions progress across the workspace breakpoint", () => {
  const copyButton = () => screen.getByRole("button", { name: /^copy$/i });
  const groupButton = () => screen.getByRole("button", { name: /^group$/i });

  beforeEach(() => {
    useResourceCollection.mockReturnValue(selectedGenomeCollection());
  });

  it.each([
    { name: "narrow first", start: true, then: false },
    { name: "wide first", start: false, then: true },
  ])(
    "completes a SERVICES resolution still in flight across a $name transition and back",
    async ({ start, then }) => {
      const user = userEvent.setup();
      const viewport = mockViewport(start);
      let resolveSelected:
        ((value: { rows: { genome_id: string }[] }) => void) | undefined;
      const selected = vi.fn(
        () =>
          new Promise<{ rows: { genome_id: string }[] }>((resolve) => {
            resolveSelected = resolve;
          }),
      );

      renderGenomeCollection({ selected } as unknown as DataRepository);

      await user.click(servicesButton());
      expect(selected).toHaveBeenCalledTimes(1);
      expect(resolvingSpinner()).toBeInTheDocument();

      for (const narrow of [then, start]) {
        act(() => {
          viewport.crossBreakpoint(narrow);
        });
        // The spinner is `loadingActionIds`, owned by the bar itself, so seeing it
        // here means the bar's own instance survived the layout change.
        expect(resolvingSpinner()).toBeInTheDocument();
        expect(servicesButton()).toBeDisabled();
      }

      await act(async () => {
        resolveSelected?.({ rows: [{ genome_id: "83332.12" }] });
        await Promise.resolve();
      });

      expect(await screen.findByTestId("selection-services")).toHaveTextContent(
        "83332.12",
      );
      expect(
        screen.queryByText("Could not complete action"),
      ).not.toBeInTheDocument();
      expect(slotLog).toStrictEqual(["mount:table"]);
    },
  );

  it.each([
    { name: "narrow first", start: true, then: false },
    { name: "wide first", start: false, then: true },
  ])(
    "keeps open COPY and GROUP dialogs and their resolved IDs across a $name transition and back",
    async ({ start, then }) => {
      const user = userEvent.setup();
      const viewport = mockViewport(start);
      const selected = vi.fn(() =>
        Promise.resolve({
          rows: [{ genome_id: "83332.12" }, { genome_id: "83332.13" }],
        }),
      );

      renderGenomeCollection({ selected } as unknown as DataRepository);

      await user.click(copyButton());
      expect(screen.getByTestId("copy-dialog")).toBeInTheDocument();
      await user.click(groupButton());
      expect(await screen.findByTestId("selection-group")).toHaveTextContent(
        "83332.12,83332.13",
      );

      for (const narrow of [then, start]) {
        act(() => {
          viewport.crossBreakpoint(narrow);
        });
        expect(document.querySelector("[data-layout]")).toHaveAttribute(
          "data-layout",
          narrow ? "stacked" : "resizable",
        );
        // Both dialogs render inside the bar, under `isCopyOpen`/`isGroupOpen`.
        expect(screen.getByTestId("copy-dialog")).toBeInTheDocument();
        expect(screen.getByTestId("selection-group")).toHaveTextContent(
          "83332.12,83332.13",
        );
      }
      expect(slotLog).toStrictEqual(["mount:table"]);
    },
  );
});
