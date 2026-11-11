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
import { createResourceCollectionResult } from "./fixtures/resource-collection-result";

/**
 * Real workspace and action bar: only that pair shows that crossing `md`
 * re-styles slots instead of remounting them.
 */
const { useResourceCollection, slotLog } = vi.hoisted(() => ({
  useResourceCollection: vi.fn<typeof useResourceCollectionHook>(),
  slotLog: [] as string[],
}));

vi.mock("@/hooks/views/use-resource-collection", () => ({
  useResourceCollection,
}));
// Panel primitives only (jsdom has no ResizeObserver); `ResourceWorkspace`
// stays real.
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
vi.mock("@tanstack/react-query", async () =>
  (await import("./fixtures/resource-collection-mocks")).reactQueryMock(),
);
vi.mock("@/hooks/views/use-collection-download", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).collectionDownloadMock(),
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
  return createResourceCollectionResult({
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
  });
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

// Loose match: the spinner's "Loading" label joins the button's accessible
// name.
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
    expect(resolvingSpinner()).toBeInTheDocument();
    expect(servicesButton()).toBeDisabled();

    act(() => {
      viewport.crossBreakpoint(true);
    });
    expect(document.querySelector("[data-layout]")).toHaveAttribute(
      "data-layout",
      "stacked",
    );
    expect(resolvingSpinner()).toBeInTheDocument();
    expect(servicesButton()).toBeDisabled();
    expect(slotLog).toStrictEqual(["mount:table"]);

    await act(async () => {
      resolveExport?.({ rows: [{ taxon_id: "234" }, { taxon_id: "235" }] });
      await Promise.resolve();
    });

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
        expect(slotLog).toStrictEqual(["mount:table"]);
        expect(screen.getByLabelText("table local state")).toHaveValue(
          "scrolled-to-row-40",
        );
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

    useResourceCollection.mockReturnValue({
      ...allPagesTaxonomyCollection(),
      error: new Error("Data service is unavailable (503)"),
    });
    view.rerender(taxonomyCollection(repository));

    expect(screen.getByText("Data service is unavailable (503)")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /services/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("taxonomy-services")).toHaveTextContent("234");
  });
});

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
        expect(screen.getByTestId("copy-dialog")).toBeInTheDocument();
        expect(screen.getByTestId("selection-group")).toHaveTextContent(
          "83332.12,83332.13",
        );
      }
      expect(slotLog).toStrictEqual(["mount:table"]);
    },
  );
});
