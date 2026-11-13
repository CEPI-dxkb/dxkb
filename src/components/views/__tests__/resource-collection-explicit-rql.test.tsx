import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DataRepository } from "@/lib/data-api";
import { genomeCollectionProfile } from "@/lib/genome-view/profile";
import type { CollectionState } from "@/lib/views/collection-state";
import type { useResourceCollection as useResourceCollectionHook } from "@/hooks/views/use-resource-collection";
import { ResourceCollection } from "../resource-collection";
import { stubMenuLayout } from "@/test-helpers/menu-layout";
import { jsdomLocalStorage } from "@/test-helpers/storage";
import { createResourceCollectionResult } from "./fixtures/resource-collection-result";

/**
 * Real `ResourceFilterBar` and toolbar: `resource-collection.test.tsx` mocks
 * the bar file-wide, so only a separate file can show the advanced-query chip
 * and follow its removal up to `onStateChange`.
 */
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
vi.mock("@/hooks/views/use-resource-collection", () => ({
  useResourceCollection,
}));
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
vi.mock("@/components/shared/data-table", async () =>
  (await import("./fixtures/resource-collection-mocks")).dataTableMock(),
);

stubMenuLayout();

const linkedState: CollectionState = {
  keyword: "coli",
  filters: { genome_status: ["WGS"] },
  page: 3,
  sort: "genome_length:desc",
  rql: "eq(host_name,Human)",
};

beforeEach(() => {
  vi.stubGlobal("localStorage", jsdomLocalStorage());
  localStorage.clear();
  useResourceCollection.mockReturnValue(createResourceCollectionResult());
});

describe("ResourceCollection advanced-query chip", () => {
  it("shows the chip for a state carrying an rql, and removing it drops only the rql", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={{} as DataRepository}
        state={linkedState}
        onStateChange={onStateChange}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Advanced query. Show details" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Remove advanced query" }),
    );

    // One argument: a `clearAll` second argument would not match.
    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith({
      ...linkedState,
      rql: undefined,
      page: 1,
    });
  });
});
