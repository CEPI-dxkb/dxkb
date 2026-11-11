import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { resourceCollectionPageSize } from "@/hooks/views/collection-state";
import { requestGraphLayout } from "@/lib/interactions/layout-client";

import { InteractionsSubviewShell } from "../interactions-subview-shell";

// The Table and the Graph show one dataset, so these tests keep the data path real and compare the
// requests both issue over MSW. Only Sigma's canvas and TanStack Virtual's DataTable are stubbed,
// since jsdom has no geometry for them.
vi.mock("next/navigation", async () =>
  (await import("@/test-helpers/history-navigation")).historyNavigationMock({
    pathname: "/genome/1.1",
  }),
);
vi.mock("../sigma/sigma-canvas", () => ({
  SigmaCanvas: ({ positions }: { positions: Float64Array | null }) => (
    <div
      data-testid="sigma-canvas"
      data-positions={positions ? String(positions.length) : "none"}
    />
  ),
}));
vi.mock("@/lib/interactions/layout-client", () => ({
  requestGraphLayout: vi.fn(),
}));
vi.mock("@/components/shared/data-table", () => ({
  // The real pager sits in TanStack Virtual's DataTable (no geometry in jsdom), so the mock keeps a
  // minimal pager.
  DataTable: ({
    data,
    columns,
    pageIndex,
    onPageChange,
  }: {
    data: Record<string, unknown>[];
    columns: { id: string }[];
    pageIndex: number;
    onPageChange: (next: number) => void;
  }) => (
    <div>
      <p>{`Showing page ${String(pageIndex + 1)}`}</p>
      <button
        type="button"
        onClick={() => {
          onPageChange(pageIndex + 1);
        }}
      >
        Next page
      </button>
      <table>
        <tbody>
          {data.map((row) => (
            <tr key={String(row.id)}>
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
    </div>
  ),
}));
vi.mock("@/components/views/resource-workspace", () => ({
  ResourceWorkspace: ({
    toolbar,
    children,
  }: {
    toolbar?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <>
      {toolbar}
      {children}
    </>
  ),
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

// The first Graph render loads graphology on demand; paid here outside any test, with a wider
// per-test budget.
vi.setConfig({ testTimeout: 15_000, hookTimeout: 15_000 });
beforeAll(() => import("@/lib/interactions/layout-positions"));

const scopeRql = "eq(evidence,experimental)";
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
  /** `undefined` for `ppi` today; captured so a profile that sets one cannot make the views diverge unnoticed. */
  keywordMode?: string;
}

const tablePredicates: Predicate[] = [];
const graphPredicates: Predicate[] = [];
/** Kept out of `Predicate` because the Graph fetches its whole dataset and has no page. */
const tablePages: number[] = [];

function matching(keyword: string | undefined) {
  const terms = (keyword ?? "").trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return allRows;
  return allRows.filter((row) =>
    terms.every((term) => JSON.stringify(row).includes(term)),
  );
}

beforeEach(() => {
  vi.mocked(requestGraphLayout).mockImplementation((request) =>
    Promise.resolve(new Float64Array(2 * request.nodeCount)),
  );
  window.history.replaceState(null, "", "/genome/1.1");
  tablePredicates.length = 0;
  graphPredicates.length = 0;
  tablePages.length = 0;
  server.use(
    http.get("/api/data/ppi", ({ request }) => {
      const params = new URL(request.url).searchParams;
      const keyword = params.get("keyword") ?? undefined;
      tablePredicates.push({
        rql: params.get("rql") ?? undefined,
        keyword,
        keywordMode: params.get("keywordMode") ?? undefined,
      });
      const rows = matching(keyword);
      const page = Number(params.get("page") ?? "1");
      tablePages.push(page);
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
        keywordMode?: string;
        limit: number;
      };
      graphPredicates.push({
        rql: body.rql,
        keyword: body.keyword,
        keywordMode: body.keywordMode,
      });
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
  await waitFor(() => {
    expect(tablePredicates.at(-1)?.keyword).toBe(text);
  });
}

describe("Interactions Table and Graph share one dataset", () => {
  it("issues equivalent predicates from both views for the same keyword", async () => {
    const user = userEvent.setup();
    render(<InteractionsSubviewShell rql={scopeRql} />, { wrapper: createQueryClientWrapper() });

    await waitFor(() => { expect(tablePredicates).toHaveLength(1); });
    await searchInTable(user, "peg.601");

    await user.click(screen.getByRole("tab", { name: "Graph" }));
    await waitFor(() => { expect(graphPredicates).toHaveLength(1); });

    expect(graphPredicates.at(-1)).toEqual({
      rql: scopeRql,
      keyword: "peg.601",
      keywordMode: undefined,
    });
    expect(tablePredicates.at(-1)).toEqual(graphPredicates.at(-1));
  });

  it("issues one request per view for a whole typing burst in the Graph's box", async () => {
    // delay: null dispatches keystrokes without waiting, so the burst lands inside the debounce
    // window.
    const user = userEvent.setup({ delay: null });
    render(<InteractionsSubviewShell rql={scopeRql} />, {
      wrapper: createQueryClientWrapper(),
    });

    await waitFor(() => { expect(tablePredicates).toHaveLength(1); });
    await user.click(screen.getByRole("tab", { name: "Graph" }));
    await waitFor(() => { expect(graphPredicates).toHaveLength(1); });

    const tableRequestsBefore = tablePredicates.length;
    const graphRequestsBefore = graphPredicates.length;

    await user.type(
      graphPanel().getByPlaceholderText("Search interaction results..."),
      "peg.601",
    );

    await waitFor(() => {
      expect(graphPredicates.at(-1)?.keyword).toBe("peg.601");
    });
    await waitFor(() => {
      expect(tablePredicates.at(-1)?.keyword).toBe("peg.601");
    });

    expect(graphPredicates.length - graphRequestsBefore).toBe(1);
    expect(tablePredicates.length - tableRequestsBefore).toBe(1);
  });

  it("shows a match that exists only beyond the Table's first page in both views", async () => {
    const user = userEvent.setup();
    render(<InteractionsSubviewShell rql={scopeRql} />, { wrapper: createQueryClientWrapper() });

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

describe("Interactions Table paging follows the shared keyword", () => {
  it("restarts the Table at page 1 when the keyword arrives from the Graph's box", async () => {
    const user = userEvent.setup();
    render(<InteractionsSubviewShell rql={scopeRql} />, {
      wrapper: createQueryClientWrapper(),
    });

    await waitFor(() => {
      expect(tablePredicates).toHaveLength(1);
    });

    await user.click(tablePanel().getByRole("button", { name: "Next page" }));
    await waitFor(() => {
      expect(tablePages.at(-1)).toBe(2);
    });
    expect(window.location.search).toBe("?interactions.page=2");

    await user.click(screen.getByRole("tab", { name: "Graph" }));
    await waitFor(() => {
      expect(graphPredicates).toHaveLength(1);
    });

    await user.type(
      graphPanel().getByPlaceholderText("Search interaction results..."),
      "peg.601",
    );

    await waitFor(() => {
      expect(tablePredicates.at(-1)?.keyword).toBe("peg.601");
    });
    // A new keyword is a new result set (one row, so page 2 is past its end); the stale page must
    // not be refetched.
    expect(tablePages.at(-1)).toBe(1);
    expect(window.location.search).not.toContain("interactions.page");
  });

  it("adds no history entry when the keyword is typed in the Table's own box", async () => {
    const user = userEvent.setup();
    render(<InteractionsSubviewShell rql={scopeRql} />, {
      wrapper: createQueryClientWrapper(),
    });
    await waitFor(() => {
      expect(tablePredicates).toHaveLength(1);
    });
    await user.click(tablePanel().getByRole("button", { name: "Next page" }));
    await waitFor(() => {
      expect(tablePages.at(-1)).toBe(2);
    });

    const pushState = vi.spyOn(window.history, "pushState");
    try {
      await searchInTable(user, "peg.601");
      await waitFor(() => {
        expect(tablePages.at(-1)).toBe(1);
      });

      // The commit drops the stale page (a replace) then writes the table's state; a keyword pause
      // is not a Back step.
      expect(pushState).not.toHaveBeenCalled();
      expect(window.location.search).not.toContain("interactions.page");
    } finally {
      pushState.mockRestore();
    }
  });
});

describe("Interactions Graph layout across tab switches", () => {
  it("shows the layout's progress and keeps the chosen layout and its positions through a Table round trip", async () => {
    const user = userEvent.setup();
    // A handful of rows: role queries over the full node list are slow in jsdom.
    const fewRows = allRows.slice(0, 3);
    server.use(
      http.get("/api/data/ppi", () =>
        HttpResponse.json({
          rows: fewRows,
          total: fewRows.length,
          facets: {},
          page: 1,
          pageSize: resourceCollectionPageSize,
        }),
      ),
      http.post("/api/data/ppi", () => HttpResponse.json({ rows: fewRows })),
    );
    let resolveLayout: (positions: Float64Array) => void = () => undefined;
    vi.mocked(requestGraphLayout).mockReturnValueOnce(
      new Promise<Float64Array>((resolve) => {
        resolveLayout = resolve;
      }),
    );
    render(<InteractionsSubviewShell rql={scopeRql} />, {
      wrapper: createQueryClientWrapper(),
    });

    await user.click(screen.getByRole("tab", { name: "Graph" }));

    expect(await graphPanel().findByRole("status")).toHaveTextContent(
      "Laying out…",
    );
    expect(graphPanel().getByRole("button", { name: "Export" })).toBeDisabled();
    const nodeCount = vi.mocked(requestGraphLayout).mock.calls[0][0].nodeCount;
    expect(nodeCount).toBe(6);
    resolveLayout(new Float64Array(2 * nodeCount));
    await waitFor(() => {
      expect(graphPanel().queryByRole("status")).not.toBeInTheDocument();
    });
    expect(graphPanel().getByTestId("sigma-canvas")).toHaveAttribute(
      "data-positions",
      String(2 * nodeCount),
    );

    await user.click(graphPanel().getByRole("combobox", { name: "Layout" }));
    await user.click(await screen.findByRole("option", { name: "Circular" }));
    await waitFor(() => {
      expect(graphPanel().queryByRole("status")).not.toBeInTheDocument();
    });
    expect(requestGraphLayout).toHaveBeenCalledTimes(2);
    expect(vi.mocked(requestGraphLayout).mock.calls[1][0].layout).toBe(
      "circular",
    );

    await user.click(screen.getByRole("tab", { name: "Table" }));
    expect(
      screen.queryByRole("tabpanel", { name: "Graph" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Graph" }));

    expect(
      graphPanel().getByRole("combobox", { name: "Layout" }),
    ).toHaveTextContent("Circular");
    expect(graphPanel().getByTestId("sigma-canvas")).toHaveAttribute(
      "data-positions",
      String(2 * nodeCount),
    );
    expect(graphPanel().queryByRole("status")).not.toBeInTheDocument();
    expect(requestGraphLayout).toHaveBeenCalledTimes(2);
  });
});
