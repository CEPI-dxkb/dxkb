import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DataRepository } from "@/lib/data-api";
import { taxonomyCollectionProfile } from "@/lib/taxonomy-view/profile";
import type { useResourceCollection as useResourceCollectionHook } from "@/hooks/views/use-resource-collection";
import { ResourceCollection } from "../resource-collection";
import { createResourceCollectionResult } from "./fixtures/resource-collection-result";

// Taxonomy is the one resource whose action bar is dispatched directly by
// `useResourceCollectionActions` rather than through `CollectionSelectionActions` (see
// `enabledActionsByResource` in resource-collection-actions.tsx), so its workflow —
// reserving a tab before an all-pages ID resolution, rejecting an overlapping second
// action, and the taxonomy chooser's own overlap guard — is exercised on its own here
// rather than folded into the shared selection-action tests.

const { useResourceCollection } = vi.hoisted(() => ({
  useResourceCollection: vi.fn<typeof useResourceCollectionHook>(),
}));
let actionBarProps: Record<string, unknown>;

vi.mock("next/navigation", async () =>
  (await import("./fixtures/resource-collection-mocks")).nextNavigationMock(),
);
vi.mock("@tanstack/react-query", async () =>
  (await import("./fixtures/resource-collection-mocks")).reactQueryMock(),
);
vi.mock("@/lib/auth/provider", async () =>
  (await import("./fixtures/resource-collection-mocks")).authProviderMock(),
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
vi.mock("../resource-export", async () =>
  (await import("./fixtures/resource-collection-mocks")).resourceExportMock(),
);
vi.mock("@/hooks/views/use-resource-collection", () => ({
  useResourceCollection,
}));
vi.mock("../resource-filter-bar", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).resourceFilterBarMock(),
);
// The `SearchActionBar` fake shared with every resource-collection*.test.tsx suite.
// It calls the same `visibleSearchActions` / `isSearchActionDisabled` policy
// production does (search-action-policy.ts), so a control this suite can query or
// click is one the real bar would have rendered, in the same enabled state.
vi.mock("@/components/search/search-action-bar", async () =>
  (await import("./fixtures/resource-collection-mocks")).searchActionBarMock(
    (props) => {
      actionBarProps = props;
    },
  ),
);
vi.mock("@/components/detail-panel/info-panel", async () =>
  (await import("./fixtures/resource-collection-mocks")).infoPanelMock(),
);
vi.mock("../taxonomy-service-chooser", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).taxonomyServiceChooserMock(),
);
vi.mock("../resource-workspace", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).flatResourceWorkspaceMock(),
);
vi.mock("@/components/shared/data-table", async () =>
  (await import("./fixtures/resource-collection-mocks")).dataTableMock(),
);

function collectionResult(
  overrides: Partial<ReturnType<typeof useResourceCollectionHook>> = {},
) {
  return createResourceCollectionResult(overrides);
}

function repository(
  exportResult: Promise<unknown> = Promise.resolve({ rows: [] }),
) {
  return {
    exportAll: vi.fn(() => exportResult),
    selected: vi.fn(() => exportResult),
  } as unknown as DataRepository;
}

beforeEach(() => {
  useResourceCollection.mockReturnValue(collectionResult());
});

afterEach(() => vi.unstubAllGlobals());

describe("ResourceCollection Taxonomy actions", () => {
  it("opens canonical member, Genome, Feature, and service destinations", async () => {
    const user = userEvent.setup();
    const taxonomyRow = { taxon_id: "234", taxon_name: "Brucella" };
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: "234",
      detail: taxonomyRow,
      rows: [taxonomyRow],
      selection: { "234": true },
      selectedIds: ["234"],
      sorting: [],
    });
    // The tab is reserved synchronously on click and navigated once IDs resolve, so
    // an all-pages selection's export cannot get the popup blocked.
    const close = vi.fn();
    const links: {
      href: string;
      target: string;
      rel: string;
      click: ReturnType<typeof vi.fn>;
    }[] = [];
    const createElement = vi.fn(() => {
      const link = { href: "", target: "", rel: "", click: vi.fn() };
      links.push(link);
      return link;
    });
    const open = vi.fn(() => ({
      opener: window,
      document: { createElement },
      close,
    }));
    vi.stubGlobal("open", open);

    render(
      <ResourceCollection
        profile={taxonomyCollectionProfile}
        repository={repository()}
        state={{ filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
      />,
    );

    expect(actionBarProps.enabledActions).toEqual([
      "services",
      "taxonOverview",
      "genomes",
      "features",
    ]);
    await user.click(screen.getByRole("button", { name: "taxonOverview" }));
    await waitFor(() => {
      expect(links).toHaveLength(1);
    });
    await user.click(screen.getByRole("button", { name: "Genomes action" }));
    await waitFor(() => {
      expect(links).toHaveLength(2);
    });
    await user.click(screen.getByRole("button", { name: "features" }));
    await waitFor(() => {
      expect(links).toHaveLength(3);
    });
    expect(open).toHaveBeenCalledTimes(3);
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    expect(links.map(({ href }) => href)).toEqual([
      "/taxonomy/234",
      "/genome?rql=and(in(taxon_lineage_ids%2C(234))%2Cne(genome_status%2CDeprecated))",
      "/feature?rql=and(eq(genome_id%2C*)%2Cgenome(and(in(taxon_lineage_ids%2C(234))%2Cne(genome_status%2CDeprecated)))%2Ceq(annotation%2CPATRIC))",
    ]);
    expect(links.map(({ target, rel }) => ({ target, rel }))).toEqual([
      { target: "_self", rel: "noreferrer" },
      { target: "_self", rel: "noreferrer" },
      { target: "_self", rel: "noreferrer" },
    ]);
    expect(links.every((link) => link.click.mock.calls.length === 1)).toBe(
      true,
    );
    expect(close).not.toHaveBeenCalled();

    // SERVICES opens an in-page dialog, so it must not reserve a tab.
    await user.click(screen.getByRole("button", { name: "services" }));
    expect(screen.getByTestId("taxonomy-services")).toHaveTextContent("234");
    expect(open).toHaveBeenCalledTimes(3);
  });

  it("reports a blocked pop-up instead of silently doing nothing", async () => {
    const user = userEvent.setup();
    const taxonomyRow = { taxon_id: "234", taxon_name: "Brucella" };
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: "234",
      detail: taxonomyRow,
      rows: [taxonomyRow],
      selection: { "234": true },
      selectedIds: ["234"],
      sorting: [],
    });
    vi.stubGlobal(
      "open",
      vi.fn(() => null),
    );

    render(
      <ResourceCollection
        profile={taxonomyCollectionProfile}
        repository={repository()}
        state={{ filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Genomes action" }));
    expect(
      await screen.findByText("Allow pop-ups to open the selected Taxa."),
    ).toBeInTheDocument();
  });

  it("rejects a second Taxonomy action while the first is still resolving", async () => {
    const user = userEvent.setup();
    const taxonomyRow = { taxon_id: "234", taxon_name: "Brucella" };
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: "234",
      detail: taxonomyRow,
      rows: [taxonomyRow],
      selection: {},
      selectedIds: [],
      isAllPagesSelected: true,
      total: 3,
      sorting: [],
    });
    let resolveExport:
      ((value: { rows: { taxon_id: string }[] }) => void) | undefined;
    const exportAll = vi.fn(
      () =>
        new Promise<{ rows: { taxon_id: string }[] }>((resolve) => {
          resolveExport = resolve;
        }),
    );
    const click = vi.fn();
    const createElement = vi.fn(() => ({
      href: "",
      target: "",
      rel: "",
      click,
    }));
    const open = vi.fn(() => ({
      opener: window,
      document: { createElement },
      close: vi.fn(),
    }));
    vi.stubGlobal("open", open);

    render(
      <ResourceCollection
        profile={taxonomyCollectionProfile}
        repository={
          {
            selected: vi.fn(() => Promise.resolve({ rows: [] })),
            exportAll,
          } as unknown as DataRepository
        }
        state={{ filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Genomes action" }));
    // SERVICES would otherwise overwrite the IDs the first action is resolving.
    await user.click(screen.getByRole("button", { name: "services" }));
    expect(exportAll).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("taxonomy-services")).not.toBeInTheDocument();

    await act(async () => {
      resolveExport?.({ rows: [{ taxon_id: "234" }] });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(click).toHaveBeenCalledTimes(1);
    });

    // The guard releases once the first action settles.
    await user.click(screen.getByRole("button", { name: "services" }));
    expect(exportAll).toHaveBeenCalledTimes(2);
  });

  it("closes a reserved tab with no valid destination and releases the action", async () => {
    const user = userEvent.setup();
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: "234",
      detail: { taxon_id: "234", taxon_name: "Brucella" },
      rows: [{ taxon_id: "234", taxon_name: "Brucella" }],
      selection: {},
      selectedIds: [],
      isAllPagesSelected: true,
      total: 2,
      sorting: [],
    });
    const close = vi.fn();
    vi.stubGlobal(
      "open",
      vi.fn(() => ({ opener: window, close })),
    );
    const exportAll = vi.fn(() =>
      Promise.resolve({ rows: [{ taxon_id: "234" }, { taxon_id: "235" }] }),
    );

    render(
      <ResourceCollection
        profile={taxonomyCollectionProfile}
        repository={
          {
            selected: vi.fn(() => Promise.resolve({ rows: [] })),
            exportAll,
          } as unknown as DataRepository
        }
        state={{ filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
      />,
    );

    act(() => {
      (actionBarProps.onAction as (actionId: string) => void)("features");
    });
    await waitFor(() => {
      expect(close).toHaveBeenCalledOnce();
    });

    await user.click(screen.getByRole("button", { name: "services" }));
    expect(exportAll).toHaveBeenCalledTimes(2);
    expect(await screen.findByTestId("taxonomy-services")).toHaveTextContent(
      "234,235",
    );
  });

  it("closes the reserved tab and keeps the original error when ID resolution fails", async () => {
    const user = userEvent.setup();
    const taxonomyRow = { taxon_id: "234", taxon_name: "Brucella" };
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: "234",
      detail: taxonomyRow,
      rows: [taxonomyRow],
      selection: {},
      selectedIds: [],
      isAllPagesSelected: true,
      total: 3,
      sorting: [],
    });
    const replace = vi.fn();
    const close = vi.fn();
    vi.stubGlobal(
      "open",
      vi.fn(() => ({ opener: window, location: { replace }, close })),
    );

    render(
      <ResourceCollection
        profile={taxonomyCollectionProfile}
        repository={
          {
            selected: vi.fn(() => Promise.resolve({ rows: [] })),
            exportAll: vi.fn(() =>
              Promise.reject(new Error("Taxonomy export failed upstream")),
            ),
          } as unknown as DataRepository
        }
        state={{ filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Genomes action" }));
    expect(
      await screen.findByText("Taxonomy export failed upstream"),
    ).toBeInTheDocument();
    expect(close).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it("opens the Taxonomy chooser on the IDs it resolved, not a later selection", async () => {
    const user = userEvent.setup();
    let resolveExport:
      ((value: { rows: { taxon_id: string }[] }) => void) | undefined;
    const exportAll = vi.fn(
      () =>
        new Promise<{ rows: { taxon_id: string }[] }>((resolve) => {
          resolveExport = resolve;
        }),
    );
    const allPages = {
      ...collectionResult(),
      activeId: "234",
      detail: { taxon_id: "234", taxon_name: "Brucella" },
      rows: [{ taxon_id: "234", taxon_name: "Brucella" }],
      selection: {},
      selectedIds: [],
      isAllPagesSelected: true,
      total: 2,
      sorting: [],
    };
    useResourceCollection.mockReturnValue(allPages);

    const view = render(
      <ResourceCollection
        profile={taxonomyCollectionProfile}
        repository={
          {
            exportAll,
            selected: vi.fn(() => Promise.resolve({ rows: [] })),
          } as unknown as DataRepository
        }
        state={{ filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "services" }));
    expect(exportAll).toHaveBeenCalledTimes(1);

    useResourceCollection.mockReturnValue({
      ...allPages,
      isAllPagesSelected: false,
      selection: { "999": true },
      selectedIds: ["999"],
    });
    view.rerender(
      <ResourceCollection
        profile={taxonomyCollectionProfile}
        repository={
          {
            exportAll,
            selected: vi.fn(() => Promise.resolve({ rows: [] })),
          } as unknown as DataRepository
        }
        state={{ filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
      />,
    );

    // The overlap guard is a ref inside the actions boundary, so a re-render
    // driven by the selection change does not release it. Without the guard the
    // narrowed selection needs no request and would open the chooser on "999"
    // straight away, replacing the IDs the first run is still resolving.
    await user.click(screen.getByRole("button", { name: "services" }));
    expect(exportAll).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("taxonomy-services")).not.toBeInTheDocument();

    await act(async () => {
      resolveExport?.({ rows: [{ taxon_id: "234" }, { taxon_id: "235" }] });
      await Promise.resolve();
    });

    expect(await screen.findByTestId("taxonomy-services")).toHaveTextContent(
      "234,235",
    );
  });
});
