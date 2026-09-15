import type { ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
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
 * `ResourceWorkspace` renders the action bar under structurally different parents
 * either side of the `md` breakpoint (`div[data-layout="stacked"] > aside` versus
 * `ResizablePanelGroup > ResizablePanel > aside`) and flips between them from a live
 * `matchMedia` listener, so the slot's whole subtree is remounted by a window resize
 * or a tablet rotation. The Taxonomy launch resolves IDs over the network first, so
 * anything it kept inside that slot would be thrown away mid-flight: no chooser, no
 * error, no spinner, just a click that vanished. The real workspace and the real
 * action bar are therefore both used here on purpose.
 */
const { useResourceCollection } = vi.hoisted(() => ({
  useResourceCollection: vi.fn<typeof useResourceCollectionHook>(),
}));

vi.mock("@/hooks/views/use-resource-collection", () => ({
  useResourceCollection,
}));
// Panel primitives only; the branching `ResourceWorkspace` itself stays real.
vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: { children: ReactNode }) => (
    <div data-testid="panel-group">{children}</div>
  ),
  ResizableHandle: () => <div data-testid="resize-handle" />,
  ResizablePanel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/components/shared/data-table", () => ({
  DataTable: () => <div data-testid="data-table" />,
}));
vi.mock("../resource-filter-bar", () => ({ ResourceFilterBar: () => null }));
vi.mock("@/components/detail-panel/info-panel", () => ({
  InfoPanel: () => null,
}));
vi.mock("../taxonomy-service-chooser", () => ({
  TaxonomyServiceChooser: ({
    open,
    taxonIds,
  }: {
    open: boolean;
    taxonIds: string[];
  }) =>
    open ? (
      <div data-testid="taxonomy-services">{taxonIds.join(",")}</div>
    ) : null,
}));

/** A `matchMedia` whose `matches` can change and notify, like a real resize. */
function mockViewport() {
  const listeners = new Set<() => void>();
  const state = { matches: false };
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

// Loose match: the bar swaps SERVICES' icon for a spinner while it resolves, and
// the spinner's own "Loading" label joins the button's accessible name.
const servicesButton = () => screen.getByRole("button", { name: /services/i });
const resolvingSpinner = () =>
  screen.queryByRole("status", { name: "Loading" });

beforeEach(() => {
  useResourceCollection.mockReturnValue(allPagesTaxonomyCollection());
});

describe("ResourceCollection action mounting across the workspace breakpoint", () => {
  it("completes a Taxonomy launch that is still resolving when the layout flips", async () => {
    const user = userEvent.setup();
    const viewport = mockViewport();
    let resolveExport:
      | ((value: { rows: { taxon_id: string }[] }) => void)
      | undefined;
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

    // The window crosses the md breakpoint mid-resolution, which swaps the
    // workspace's whole layout branch and remounts the action-bar slot.
    act(() => {
      viewport.crossBreakpoint(true);
    });
    expect(document.querySelector("[data-layout]")).toHaveAttribute(
      "data-layout",
      "stacked",
    );
    // The pending state is the shell's, so the remounted bar still reports it
    // rather than quietly going idle on a launch that is still running.
    expect(resolvingSpinner()).toBeInTheDocument();
    expect(servicesButton()).toBeDisabled();

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
