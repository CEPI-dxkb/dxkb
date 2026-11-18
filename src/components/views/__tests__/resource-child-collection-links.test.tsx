import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { resourceCollectionPageSize } from "@/hooks/views/collection-state";
import { interactionColumns } from "@/lib/views/child-resources";

import { ResourceChildCollection } from "../resource-child-collection";

// The real profile -> DataTable path, so the ppi field templates reach the rendered anchors. Only
// the virtualizer is replaced: jsdom has no geometry, so it would render no rows.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    estimateSize,
  }: {
    count: number;
    estimateSize: () => number;
  }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * estimateSize(),
        size: estimateSize(),
        end: (index + 1) * estimateSize(),
        key: index,
        lane: 0,
      })),
    getTotalSize: () => count * estimateSize(),
    measure: vi.fn(),
  }),
}));
vi.mock("next/navigation", async () =>
  (await import("@/test-helpers/history-navigation")).historyNavigationMock({
    pathname: "/taxonomy/234",
  }),
);
vi.mock("@/components/views/resource-workspace", () => ({
  ResourceWorkspace: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/views/collection-selection-actions", async (
  importOriginal,
) => ({
  ...(await importOriginal<
    typeof import("@/components/views/collection-selection-actions")
  >()),
  CollectionSelectionActions: () => null,
}));

class ResizeObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);
vi.stubGlobal("scrollTo", vi.fn());
Element.prototype.scrollIntoView = vi.fn();

const linkedRow = {
  id: "ppi-0",
  interactor_a: "fig|224914.16.peg.600",
  feature_id_a: "PATRIC.224914.16.feature-a-0",
  gene_a: "hisD",
  interactor_b: "fig|224914.16.peg.700",
  feature_id_b: "PATRIC.224914.16.feature-b-0",
};
const genelessRow = {
  id: "ppi-1",
  interactor_a: "fig|224914.16.peg.601",
  feature_id_a: "PATRIC.224914.16.feature-a-1",
  gene_a: "",
  interactor_b: "fig|224914.16.peg.701",
  feature_id_b: "PATRIC.224914.16.feature-b-1",
};

beforeEach(() => {
  window.history.replaceState(null, "", "/taxonomy/234?tab=interactions");
  // jsdom has no canvas; DataTable falls back to its default column widths.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  server.use(
    http.get("/api/data/ppi", () =>
      HttpResponse.json({
        rows: [linkedRow, genelessRow],
        total: 2,
        facets: {},
        page: 1,
        pageSize: resourceCollectionPageSize,
      }),
    ),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderInteractionsTable() {
  return render(
    <ResourceChildCollection
      urlKey="interactions"
      resource="ppi"
      label="Interactions"
      idField="id"
      rql="eq(evidence,experimental)"
      columns={interactionColumns}
      defaultSort="id:asc"
    />,
    { wrapper: createQueryClientWrapper() },
  );
}

async function rowFor(interactor: string) {
  const row = (await screen.findByText(interactor)).closest("tr");
  if (!row) throw new Error(`No table row shows ${interactor}`);
  return within(row);
}

describe("ResourceChildCollection Interactions links", () => {
  it("links an Interactor A cell to its feature page", async () => {
    renderInteractionsTable();

    const row = await rowFor(linkedRow.interactor_a);
    expect(
      row.getByRole("link", { name: linkedRow.interactor_a }),
    ).toHaveAttribute("href", `/feature/${linkedRow.feature_id_a}`);
    expect(row.getByRole("link", { name: "hisD" })).toHaveAttribute(
      "href",
      `/feature/${linkedRow.feature_id_a}`,
    );
  });

  it("renders an empty Gene A cell as plain text, with no empty anchor", async () => {
    renderInteractionsTable();

    const row = await rowFor(genelessRow.interactor_a);
    const featureLinks = row
      .getAllByRole("link")
      .filter(
        (link) =>
          link.getAttribute("href") === `/feature/${genelessRow.feature_id_a}`,
      );
    // Interactor A alone: the Gene A cell shares the template but has nothing to show.
    expect(featureLinks).toHaveLength(1);
    expect(featureLinks[0]).toHaveTextContent(genelessRow.interactor_a);
    for (const link of row.getAllByRole("link")) {
      expect(link.textContent.trim()).not.toBe("");
    }
  });
});
