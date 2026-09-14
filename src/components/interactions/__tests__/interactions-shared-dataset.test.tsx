import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { resourceCollectionPageSize } from "@/hooks/views/collection-state";

import { InteractionsSubviewShell } from "../interactions-subview-shell";

// The Table and the Graph are two representations of one dataset, so these tests
// keep the whole data path real — ResourceChildCollection, ResourceCollection,
// useResourceCollection, DataRepository, the filter bar, useInteractions — and
// compare the requests the two views actually issue over MSW.
//
// Only presentation is stubbed: Sigma's WebGL canvas and TanStack Virtual's
// DataTable have no working geometry in jsdom, and the surrounding chrome
// (action bars, dialogs) needs app-wide providers this test has no stake in.
vi.mock("../sigma/sigma-canvas", () => ({
  SigmaCanvas: () => <div data-testid="sigma-canvas" />,
}));
vi.mock("@/components/shared/data-table", () => ({
  DataTable: ({
    data,
    columns,
  }: {
    data: Record<string, unknown>[];
    columns: { id: string }[];
  }) => (
    <table>
      <tbody>
        {data.map((row, index) => (
          <tr key={index}>
            {columns.map((column) => {
              const value = row[column.id];
              return (
                <td key={column.id}>
                  {typeof value === "string" ? value : ""}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));
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

const scopeRql = "eq(evidence,experimental)";
/** One row past the Table's first page, so only a server-side search can find it. */
const beyondFirstPageIndex = resourceCollectionPageSize + 49;

const allRows = Array.from(
  { length: resourceCollectionPageSize + 50 },
  (_, index) => ({
    id: `ppi-${String(index).padStart(4, "0")}`,
    interactor_a: `peg.${String(600 + index)}`,
    interactor_b: `peg.${String(5000 + index)}`,
    evidence: "experimental",
  }),
);
const beyondFirstPageInteractor = allRows[beyondFirstPageIndex].interactor_a;

interface Predicate {
  rql?: string;
  keyword?: string;
}

const tablePredicates: Predicate[] = [];
const graphPredicates: Predicate[] = [];

/** Server-side keyword search, the way the gateway applies it: prefix per term. */
function matching(keyword: string | undefined) {
  const terms = (keyword ?? "").trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return allRows;
  return allRows.filter((row) =>
    terms.every((term) => JSON.stringify(row).includes(term)),
  );
}

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  );
}

beforeEach(() => {
  tablePredicates.length = 0;
  graphPredicates.length = 0;
  server.use(
    http.get("/api/data/ppi", ({ request }) => {
      const params = new URL(request.url).searchParams;
      const keyword = params.get("keyword") ?? undefined;
      tablePredicates.push({ rql: params.get("rql") ?? undefined, keyword });
      const rows = matching(keyword);
      const page = Number(params.get("page") ?? "1");
      const size = Number(params.get("pageSize") ?? resourceCollectionPageSize);
      return HttpResponse.json({
        rows: rows.slice((page - 1) * size, page * size),
        total: rows.length,
        facets: {},
        page,
        pageSize: size,
      });
    }),
    http.post("/api/data/ppi", async ({ request }) => {
      const body = (await request.json()) as {
        rql?: string;
        keyword?: string;
        limit: number;
      };
      graphPredicates.push({ rql: body.rql, keyword: body.keyword });
      return HttpResponse.json({
        rows: matching(body.keyword).slice(0, body.limit),
      });
    }),
  );
});

function tablePanel() {
  return within(screen.getByRole("tabpanel", { name: "Table" }));
}

function graphPanel() {
  return within(screen.getByRole("tabpanel", { name: "Graph" }));
}

async function searchInTable(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(
    tablePanel().getByPlaceholderText("Search interaction results..."),
    text,
  );
  // The filter bar debounces before committing the keyword to the request.
  await waitFor(() => {
    expect(tablePredicates.at(-1)?.keyword).toBe(text);
  });
}

describe("Interactions Table and Graph share one dataset", () => {
  it("issues equivalent predicates from both views for the same keyword", async () => {
    const user = userEvent.setup();
    render(<InteractionsSubviewShell rql={scopeRql} />, { wrapper });

    await waitFor(() => { expect(tablePredicates).toHaveLength(1); });
    await searchInTable(user, "peg.601");

    await user.click(screen.getByRole("tab", { name: "Graph" }));
    await waitFor(() => { expect(graphPredicates).toHaveLength(1); });

    // Identical predicates, not merely similar ones: the Graph used to encode
    // the keyword into its own RQL clause while the Table kept it off the
    // request entirely.
    expect(graphPredicates.at(-1)).toEqual({
      rql: scopeRql,
      keyword: "peg.601",
    });
    expect(tablePredicates.at(-1)).toEqual(graphPredicates.at(-1));
  });

  it("shows a match that exists only beyond the Table's first page in both views", async () => {
    const user = userEvent.setup();
    render(<InteractionsSubviewShell rql={scopeRql} />, { wrapper });

    // The match is on page two of the unfiltered scope, so it is absent until
    // the keyword reaches the backend.
    await waitFor(() => {
      expect(tablePanel().getByText("peg.600")).toBeInTheDocument();
    });
    expect(
      tablePanel().queryByText(beyondFirstPageInteractor),
    ).not.toBeInTheDocument();

    await searchInTable(user, beyondFirstPageInteractor);

    await waitFor(() => {
      expect(
        tablePanel().getByText(beyondFirstPageInteractor),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: "Graph" }));

    await waitFor(() => {
      expect(
        graphPanel().getByText(beyondFirstPageInteractor),
      ).toBeInTheDocument();
    });
    expect(graphPredicates.at(-1)?.keyword).toBe(beyondFirstPageInteractor);
  });
});
