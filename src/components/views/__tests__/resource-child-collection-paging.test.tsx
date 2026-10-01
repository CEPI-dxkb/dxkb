import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { resourceCollectionPageSize } from "@/hooks/views/collection-state";
import { interactionColumns } from "@/lib/views/child-resources";

import { ResourceChildCollection } from "../resource-child-collection";

// The real path from a pager click to the table body: DataTable, ResourceCollection,
// useResourceCollection and TanStack Query's cache. Whether the next page was
// prefetched decides what the body shows while it loads, which the unit suites
// cannot see because they stub DataTable or the hook. Only the chrome around the
// table (action bars, dialogs) is stubbed.
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

// Four pages, so page 3 is one the prefetch (page 2, from page 1) never reaches.
const total = resourceCollectionPageSize * 3 + 50;
const requestedPages: number[] = [];
let pageThree = Promise.withResolvers<undefined>();

beforeEach(() => {
  requestedPages.length = 0;
  pageThree = Promise.withResolvers<undefined>();
  window.history.replaceState(null, "", "/genome/1.1");
  // jsdom has no canvas; DataTable falls back to its default column widths.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  server.use(
    http.get("/api/data/ppi", async ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get("page") ?? "1");
      requestedPages.push(page);
      if (page === 3) await pageThree.promise;
      return HttpResponse.json({
        rows: [
          {
            id: `ppi-${String(page)}`,
            interactor_a: `peg.${String(page)}`,
            interactor_b: "peg.0",
          },
        ],
        total,
        facets: {},
        page,
        pageSize: resourceCollectionPageSize,
      });
    }),
  );
});

afterEach(() => {
  pageThree.resolve(undefined);
  vi.restoreAllMocks();
});

function renderInteractionsTable() {
  // Its own client, so a test can wait for the background prefetch to settle.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <ResourceChildCollection
      urlKey="interactions"
      resource="ppi"
      label="Interactions"
      idField="id"
      rql="eq(evidence,experimental)"
      columns={interactionColumns}
      defaultSort="id:asc"
    />,
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  return { ...view, client };
}

const pager = () =>
  screen.getByRole("navigation", { name: "ppi results pagination" });
const skeletons = (container: HTMLElement) =>
  container.querySelectorAll('tbody [data-slot="skeleton"]');

describe("ResourceChildCollection paging to a page that is not loaded yet", () => {
  it("shows the loading skeleton instead of the page being left, with the pager in place", async () => {
    const user = userEvent.setup();
    const { container } = renderInteractionsTable();
    await screen.findByText(/Showing 1-1 of 650 results/);
    await waitFor(() => {
      expect(requestedPages).toContain(2);
    });
    expect(skeletons(container)).toHaveLength(0);

    await user.click(within(pager()).getByRole("button", { name: "3" }));

    // Page 3 was never prefetched: the body shows the skeleton while it loads,
    // and the previous total keeps the pager and the range readable.
    await waitFor(() => {
      expect(skeletons(container).length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/Showing 401-600 of 650 results/)).toBeVisible();
    expect(pager()).toBeVisible();

    pageThree.resolve(undefined);
    await waitFor(() => {
      expect(skeletons(container)).toHaveLength(0);
    });
    expect(screen.getByText(/Showing 401-401 of 650 results/)).toBeVisible();
  });

  it("shows a prefetched page straight away, with no skeleton", async () => {
    const user = userEvent.setup();
    const { container, client } = renderInteractionsTable();
    await screen.findByText(/Showing 1-1 of 650 results/);
    await waitFor(() => {
      expect(requestedPages).toContain(2);
    });
    // Let the prefetch land before paging to it.
    await waitFor(() => {
      expect(client.isFetching()).toBe(0);
    });

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByText(/Showing 201-201 of 650 results/)).toBeVisible();
    expect(skeletons(container)).toHaveLength(0);
  });
});
