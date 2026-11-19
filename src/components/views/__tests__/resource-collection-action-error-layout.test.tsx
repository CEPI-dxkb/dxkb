import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DataRepository } from "@/lib/data-api";
import { taxonomyCollectionProfile } from "@/lib/taxonomy-view/profile";
import type { useResourceCollection as useResourceCollectionHook } from "@/hooks/views/use-resource-collection";
import {
  CollectionToolbarLayoutProvider,
  type CollectionToolbarLayout,
} from "../collection-filters/toolbar-layout";
import { ResourceCollection } from "../resource-collection";
import { createResourceCollectionResult } from "./fixtures/resource-collection-result";

const { useResourceCollection } = vi.hoisted(() => ({
  useResourceCollection: vi.fn<typeof useResourceCollectionHook>(),
}));

vi.mock("next/navigation", async () =>
  (await import("./fixtures/resource-collection-mocks")).nextNavigationMock(),
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
  (await import("./fixtures/resource-collection-mocks")).resourceFilterBarMock(),
);
vi.mock("@/components/search/search-action-bar", async () =>
  (await import("./fixtures/resource-collection-mocks")).searchActionBarMock(
    () => undefined,
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
vi.mock("@/components/shared/data-table", () => ({
  DataTable: () => <div data-testid="data-table" />,
}));

const taxonomyRow = { taxon_id: "234", taxon_name: "Brucella" };

/** Fails the taxonomy "services" action, which sets the collection's action error. */
async function renderWithActionError(layout?: CollectionToolbarLayout) {
  useResourceCollection.mockReturnValue(
    createResourceCollectionResult({
      activeId: "234",
      detail: taxonomyRow,
      rows: [taxonomyRow],
      isAllPagesSelected: true,
      total: 3,
    }),
  );
  const collection = (
    <ResourceCollection
      profile={taxonomyCollectionProfile}
      repository={
        {
          selected: vi.fn(() => Promise.resolve({ rows: [] })),
          exportAll: vi.fn(() => Promise.reject(new Error("Export refused"))),
        } as unknown as DataRepository
      }
      state={{ filters: {}, page: 1, sort: "unsorted" }}
      onStateChange={vi.fn()}
    />
  );
  render(
    layout ? (
      <CollectionToolbarLayoutProvider value={layout}>
        {collection}
      </CollectionToolbarLayoutProvider>
    ) : (
      collection
    ),
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "services" }));
  return {
    alert: await screen.findByRole("alert"),
    toolbar: screen.getByTestId("filter-bar"),
  };
}

/** `a` comes before `b` in document order. */
function precedes(a: Element, b: Element) {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe("ResourceCollection action error placement", () => {
  it("shows the alert above the toolbar by default", async () => {
    const { alert, toolbar } = await renderWithActionError();

    expect(alert).toHaveTextContent("Could not complete action");
    expect(alert).toHaveTextContent("Export refused");
    expect(precedes(alert, toolbar)).toBe(true);
  });

  it("keeps the alert above the toolbar in the default layout provided explicitly", async () => {
    const { alert, toolbar } = await renderWithActionError("default");

    expect(precedes(alert, toolbar)).toBe(true);
  });

  it("shows the alert below the toolbar when a view switch is pinned beside it", async () => {
    const { alert, toolbar } = await renderWithActionError("besideViewSwitch");

    expect(alert).toHaveTextContent("Could not complete action");
    expect(alert).toHaveTextContent("Export refused");
    expect(precedes(toolbar, alert)).toBe(true);
    expect(precedes(alert, screen.getByTestId("data-table"))).toBe(true);
  });
});
