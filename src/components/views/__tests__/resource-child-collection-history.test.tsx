import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { resourceCollectionPageSize } from "@/hooks/views/collection-state";
import { interactionColumns } from "@/lib/views/child-resources";

import { ResourceChildCollection } from "../resource-child-collection";

// The real path from a header click to the address bar: DataTable, TanStack
// Table, ResourceCollection, useResourceCollection, the child's URL state and the
// History API. A sort click reports a page reset and then the sort from one event,
// which the unit suites cannot see because they stub DataTable. Only the chrome
// around the table (action bars, dialogs) is stubbed.
vi.mock("next/navigation", async () =>
  (await import("@/test-helpers/history-navigation")).historyNavigationMock({
    pathname: "/genome/1.1",
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

const rows = Array.from({ length: resourceCollectionPageSize + 50 }, (_, index) => ({
  id: `ppi-${String(index).padStart(4, "0")}`,
  interactor_a: `peg.${String(600 + index)}`,
  interactor_b: `peg.${String(5000 + index)}`,
}));

const requested: { page: number; sort: string | null }[] = [];

beforeEach(() => {
  requested.length = 0;
  // jsdom has no canvas; DataTable falls back to its default column widths.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  server.use(
    http.get("/api/data/ppi", ({ request }) => {
      const params = new URL(request.url).searchParams;
      const page = Number(params.get("page") ?? "1");
      requested.push({ page, sort: params.get("sort") });
      const size = Number(params.get("pageSize") ?? resourceCollectionPageSize);
      return HttpResponse.json({
        rows: rows.slice((page - 1) * size, page * size),
        total: rows.length,
        facets: {},
        page,
        pageSize: size,
      });
    }),
  );
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ResourceChildCollection sort clicks in the address bar", () => {
  it("adds one history entry holding the sort on page 1", async () => {
    window.history.replaceState(null, "", "/genome/1.1?interactions.page=2");
    const pushState = vi.spyOn(window.history, "pushState");
    const lengthBefore = window.history.length;
    const user = userEvent.setup();
    renderInteractionsTable();
    await waitFor(() => {
      expect(requested).toContainEqual({ page: 2, sort: "id:asc" });
    });

    await user.click(
      screen.getByRole("button", { name: /^Sort by interactor a$/i }),
    );

    // Two reports came out of the one click (page reset, then sort); the visitor
    // gets one Back step, landing on page 2 of the old sort, not a phantom
    // "page 1, old sort" entry between them.
    expect(pushState).toHaveBeenCalledOnce();
    expect(window.history.length).toBe(lengthBefore + 1);
    expect(window.location.search).toBe("?interactions.sort=interactor_a:asc");
    // The next page is prefetched after it, so check for the request, not the order.
    await waitFor(() => {
      expect(requested).toContainEqual({ page: 1, sort: "interactor_a:asc" });
    });
  });
});
