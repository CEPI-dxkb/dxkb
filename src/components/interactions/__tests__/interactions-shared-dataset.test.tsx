import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { stubMenuLayout } from "@/test-helpers/menu-layout";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { resourceCollectionPageSize } from "@/hooks/views/collection-state";
import { requestGraphLayout } from "@/lib/interactions/layout-client";
import { interactionsGraphFields } from "@/lib/interactions/use-interactions";

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
    onRowSelectionChange,
  }: {
    data: Record<string, unknown>[];
    columns: { id: string }[];
    pageIndex: number;
    onPageChange: (next: number) => void;
    onRowSelectionChange: (selection: Record<string, boolean>) => void;
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
      {/* One button rather than a checkbox a row: the full dataset is a page of 200 rows. */}
      <button
        type="button"
        onClick={() => {
          onRowSelectionChange(
            Object.fromEntries(
              data.slice(0, 2).map((row) => [String(row.id), true]),
            ),
          );
        }}
      >
        Select the first two rows
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
    actionBar,
    children,
  }: {
    toolbar?: React.ReactNode;
    actionBar?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <>
      {toolbar}
      {actionBar}
      {children}
    </>
  ),
}));
// The selection actions' own dialogs need auth and the workspace, so the bar is the real
// `SearchActionBar` (its visibility policy included) and hands back only the actions the shell
// supplies (Show in Graph).
vi.mock("@/components/views/collection-selection-actions", async (
  importOriginal,
) => {
  const actual = await importOriginal<
    typeof import("@/components/views/collection-selection-actions")
  >();
  const { SearchActionBar } = await import(
    "@/components/search/search-action-bar"
  );
  return {
    ...actual,
    CollectionSelectionActions: ({
      searchType,
      selectedCount,
      actionIds,
      extraEnabledActionIds = [],
      disabledActions,
      onOtherAction,
    }: Parameters<typeof actual.CollectionSelectionActions>[0]) => (
      <SearchActionBar
        searchType={searchType}
        selectedCount={selectedCount}
        enabledActions={[...actionIds, ...extraEnabledActionIds]}
        disabledActions={disabledActions}
        onAction={(actionId) => {
          if (!actionIds.includes(actionId)) onOtherAction?.(actionId);
        }}
      />
    ),
  };
});

stubMenuLayout();
vi.stubGlobal("scrollTo", vi.fn());

// The first Graph render loads graphology on demand; paid here outside any test, with a wider
// per-test budget.
vi.setConfig({ testTimeout: 15_000, hookTimeout: 15_000 });
beforeAll(() => import("@/lib/interactions/layout-positions"));

// A stand-in for the taxon scope, which pins no evidence: the evidence default is the shell's.
const scopeRql = "eq(genome_id_a,*)";
const experimentalClause = "eq(evidence,experimental)";
/** What both views send for the scope while only the evidence default applies. */
const defaultRql = `and(${scopeRql},${experimentalClause})`;
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

// A handful of rows with real-shaped ids (a pipe, a dot): role queries over the full node list are
// slow in jsdom, and the focus tests need an id that must be escaped on the way to the RQL.
const focusRows = [
  {
    id: "ppi-f1",
    interactor_a: "fig|1.1.peg.1",
    interactor_b: "fig|1.1.peg.2",
    gene_a: "geneA",
    gene_b: "geneB",
    evidence: "experimental",
  },
  {
    id: "ppi-f2",
    interactor_a: "fig|1.1.peg.1",
    interactor_b: "fig|1.1.peg.3",
    gene_a: "geneA",
    gene_b: "geneC",
    evidence: "experimental",
  },
];
const facetBuckets: Record<string, { value: string; count: number }[]> = {
  interaction_type: [
    { value: "association", count: 100 },
    { value: "physical association", count: 50 },
  ],
  evidence: [
    { value: "experimental", count: 120 },
    { value: "computational", count: 30 },
  ],
};
/** What the handlers below serve; a test swaps in `focusRows`, `beforeEach` restores it. */
let datasetRows: Record<string, string>[] = allRows;

interface Predicate {
  rql?: string;
  keyword?: string;
  /** `undefined` for `ppi` today; captured so a profile that sets one cannot make the views diverge unnoticed. */
  keywordMode?: string;
}

const tablePredicates: Predicate[] = [];
const graphPredicates: Predicate[] = [];
/** Facet-count reads (a GET with `facet` params), kept apart from the Table's row reads. */
const facetPredicates: (Predicate & { facets: string[] })[] = [];
/** Kept out of `Predicate` because the Graph fetches its whole dataset and has no page. */
const tablePages: number[] = [];
/** The Graph's reads by id (Show in Graph), kept apart from its predicate reads. */
const selectedReads: Record<string, unknown>[] = [];

function matching(keyword: string | undefined) {
  const terms = (keyword ?? "").trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return datasetRows;
  return datasetRows.filter((row) =>
    terms.every((term) => JSON.stringify(row).includes(term)),
  );
}

beforeEach(() => {
  vi.mocked(requestGraphLayout).mockImplementation((request) =>
    Promise.resolve(new Float64Array(2 * request.nodeCount)),
  );
  window.history.replaceState(null, "", "/genome/1.1");
  datasetRows = allRows;
  tablePredicates.length = 0;
  graphPredicates.length = 0;
  facetPredicates.length = 0;
  tablePages.length = 0;
  selectedReads.length = 0;
  server.use(
    http.get("/api/data/ppi", ({ request }) => {
      const params = new URL(request.url).searchParams;
      const keyword = params.get("keyword") ?? undefined;
      const facets = params.getAll("facet");
      if (facets.length > 0) {
        facetPredicates.push({
          rql: params.get("rql") ?? undefined,
          keyword,
          keywordMode: params.get("keywordMode") ?? undefined,
          facets,
        });
        return HttpResponse.json({
          rows: [],
          total: allRows.length,
          facets: Object.fromEntries(
            facets.map((field) => [field, facetBuckets[field] ?? []]),
          ),
          page: 1,
          pageSize: 1,
        });
      }
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
        operation: string;
        ids?: string[];
        fields?: string[];
        rql?: string;
        keyword?: string;
        keywordMode?: string;
        limit: number;
      };
      if (body.operation === "selected") {
        selectedReads.push(body);
        const ids = new Set(body.ids);
        return HttpResponse.json({
          rows: datasetRows.filter((row) => ids.has(row.id)),
        });
      }
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
      rql: defaultRql,
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

async function pickAssociation(
  user: ReturnType<typeof userEvent.setup>,
  panel: ReturnType<typeof tablePanel>,
) {
  await user.click(panel.getByRole("button", { name: /^Filters/ }));
  await user.click(
    within(await screen.findByRole("listbox", { name: "Filters" })).getByRole(
      "option",
      { name: /^Interaction Type/ },
    ),
  );
  await user.click(
    await within(
      screen.getByRole("listbox", { name: "Interaction Type values" }),
    ).findByRole("option", { name: /^association/ }),
  );
  await user.keyboard("{Escape}");
}

// The evidence default stays beside a pick; the filters sort in the facets' own order.
const associationRql = `and(${scopeRql},and(eq(interaction_type,association),${experimentalClause}))`;

describe("Interactions Table and Graph share one set of filters", () => {
  it("narrows both views alike from a pick in the Graph's Filters menu", async () => {
    const user = userEvent.setup();
    render(<InteractionsSubviewShell rql={scopeRql} />, {
      wrapper: createQueryClientWrapper(),
    });
    await waitFor(() => {
      expect(tablePredicates).toHaveLength(1);
    });
    await user.click(screen.getByRole("tab", { name: "Graph" }));
    await waitFor(() => {
      expect(graphPredicates).toHaveLength(1);
    });

    await pickAssociation(user, graphPanel());

    await waitFor(() => {
      expect(graphPredicates.at(-1)?.rql).toBe(associationRql);
    });
    await waitFor(() => {
      expect(tablePredicates.at(-1)?.rql).toBe(associationRql);
    });
    expect(tablePredicates.at(-1)).toEqual(graphPredicates.at(-1));
    expect(window.location.search).toBe(
      "?interactions.interaction_type=association",
    );
    // The other facets count within the pick; Interaction Type is counted without its own filter
    // (the scope's cached counts), so a second value stays pickable.
    await waitFor(() => {
      expect(facetPredicates).toContainEqual(
        expect.objectContaining({ rql: associationRql }),
      );
    });
    expect(
      facetPredicates.filter(
        (request) =>
          request.rql === associationRql &&
          request.facets.includes("interaction_type"),
      ),
    ).toEqual([]);
  });

  it("narrows the Graph from a pick in the Table's Filters menu", async () => {
    const user = userEvent.setup();
    render(<InteractionsSubviewShell rql={scopeRql} />, {
      wrapper: createQueryClientWrapper(),
    });
    await waitFor(() => {
      expect(tablePredicates).toHaveLength(1);
    });

    await pickAssociation(user, tablePanel());
    await waitFor(() => {
      expect(tablePredicates.at(-1)?.rql).toBe(associationRql);
    });

    await user.click(screen.getByRole("tab", { name: "Graph" }));
    await waitFor(() => {
      expect(graphPredicates).toHaveLength(1);
    });
    expect(graphPredicates.at(-1)).toEqual(tablePredicates.at(-1));
  });

  it("drops the Table's page when the Graph picks a filter", async () => {
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

    await user.click(screen.getByRole("tab", { name: "Graph" }));
    await pickAssociation(user, graphPanel());

    await waitFor(() => {
      expect(tablePredicates.at(-1)?.rql).toBe(associationRql);
    });
    // The narrowed read starts at page 1; a later page-2 read of it is the next-page prefetch.
    expect(
      tablePages[
        tablePredicates.findIndex((request) => request.rql === associationRql)
      ],
    ).toBe(1);
    expect(window.location.search).not.toContain("interactions.page");
  });
});

/** Opens the panel's Filters menu on Evidence and returns its value list. */
async function openEvidenceValues(
  user: ReturnType<typeof userEvent.setup>,
  panel: ReturnType<typeof tablePanel>,
) {
  await user.click(panel.getByRole("button", { name: /^Filters/ }));
  await user.click(
    within(await screen.findByRole("listbox", { name: "Filters" })).getByRole(
      "option",
      { name: /^Evidence/ },
    ),
  );
  return within(screen.getByRole("listbox", { name: "Evidence values" }));
}

describe("Interactions Table and Graph share the evidence default", () => {
  it("sends experimental evidence from both views while the URL carries no evidence param", async () => {
    const user = userEvent.setup();
    render(<InteractionsSubviewShell rql={scopeRql} />, {
      wrapper: createQueryClientWrapper(),
    });
    await waitFor(() => {
      expect(tablePredicates).toHaveLength(1);
    });
    await user.click(screen.getByRole("tab", { name: "Graph" }));
    await waitFor(() => {
      expect(graphPredicates).toHaveLength(1);
    });

    expect(tablePredicates.at(-1)?.rql).toBe(defaultRql);
    expect(graphPredicates.at(-1)).toEqual(tablePredicates.at(-1));
    expect(window.location.search).toBe("");
    // The default shows as a pill, in both views, that the user can remove.
    expect(
      graphPanel().getByRole("button", {
        name: "Evidence: experimental. Edit filter",
      }),
    ).toBeInTheDocument();
  });

  it("sends no evidence term from either view once the URL removed the default", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/genome/1.1?interactions.evidence=*");
    render(<InteractionsSubviewShell rql={scopeRql} />, {
      wrapper: createQueryClientWrapper(),
    });
    await waitFor(() => {
      expect(tablePredicates).toHaveLength(1);
    });
    await user.click(screen.getByRole("tab", { name: "Graph" }));
    await waitFor(() => {
      expect(graphPredicates).toHaveLength(1);
    });

    expect(tablePredicates.at(-1)?.rql).toBe(scopeRql);
    expect(graphPredicates.at(-1)).toEqual(tablePredicates.at(-1));
    expect(
      graphPanel().queryByRole("button", { name: /^Evidence:/ }),
    ).not.toBeInTheDocument();
  });

  it("widens both views when the Graph's Evidence pill is removed", async () => {
    const user = userEvent.setup();
    render(<InteractionsSubviewShell rql={scopeRql} />, {
      wrapper: createQueryClientWrapper(),
    });
    await waitFor(() => {
      expect(tablePredicates).toHaveLength(1);
    });
    await user.click(screen.getByRole("tab", { name: "Graph" }));
    await waitFor(() => {
      expect(graphPredicates).toHaveLength(1);
    });

    await user.click(
      graphPanel().getByRole("button", { name: "Clear Evidence filter" }),
    );

    await waitFor(() => {
      expect(graphPredicates.at(-1)?.rql).toBe(scopeRql);
    });
    await waitFor(() => {
      expect(tablePredicates.at(-1)?.rql).toBe(scopeRql);
    });
    expect(tablePredicates.at(-1)).toEqual(graphPredicates.at(-1));
    // The removal is written, so it survives a reload.
    expect(window.location.search).toBe("?interactions.evidence=*");
  });

  it("narrows both views to computational picked from the Graph's Filters menu", async () => {
    const user = userEvent.setup();
    render(<InteractionsSubviewShell rql={scopeRql} />, {
      wrapper: createQueryClientWrapper(),
    });
    await waitFor(() => {
      expect(tablePredicates).toHaveLength(1);
    });
    await user.click(screen.getByRole("tab", { name: "Graph" }));
    await waitFor(() => {
      expect(graphPredicates).toHaveLength(1);
    });

    const values = await openEvidenceValues(user, graphPanel());
    // The menu lists both values, the default one selected.
    expect(
      await values.findByRole("option", { name: /^experimental/ }),
    ).toHaveAttribute("aria-selected", "true");
    await user.click(await values.findByRole("option", { name: /^computational/ }));
    await user.click(values.getByRole("option", { name: /^experimental/ }));
    await user.keyboard("{Escape}");

    const computationalRql = `and(${scopeRql},eq(evidence,computational))`;
    await waitFor(() => {
      expect(graphPredicates.at(-1)?.rql).toBe(computationalRql);
    });
    await waitFor(() => {
      expect(tablePredicates.at(-1)?.rql).toBe(computationalRql);
    });
    expect(tablePredicates.at(-1)).toEqual(graphPredicates.at(-1));
    expect(window.location.search).toBe("?interactions.evidence=computational");

    await user.click(screen.getByRole("tab", { name: "Table" }));
    expect(
      tablePanel().getByRole("button", {
        name: "Evidence: computational. Edit filter",
      }),
    ).toBeInTheDocument();
  });

  it("lists both evidence values in either menu, counted over the whole scope", async () => {
    const user = userEvent.setup();
    render(<InteractionsSubviewShell rql={scopeRql} />, {
      wrapper: createQueryClientWrapper(),
    });
    await waitFor(() => {
      expect(tablePredicates).toHaveLength(1);
    });

    const tableValues = await openEvidenceValues(user, tablePanel());
    expect(
      await tableValues.findByRole("option", { name: /^computational/ }),
    ).toBeInTheDocument();
    expect(
      tableValues.getByRole("option", { name: /^experimental/ }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("tab", { name: "Graph" }));
    await waitFor(() => {
      expect(graphPredicates).toHaveLength(1);
    });
    const graphValues = await openEvidenceValues(user, graphPanel());
    expect(
      await graphValues.findByRole("option", { name: /^computational/ }),
    ).toBeInTheDocument();
    expect(
      graphValues.getByRole("option", { name: /^experimental/ }),
    ).toBeInTheDocument();

    // Evidence is counted without its own filter, by both views, so the default's hidden value shows.
    const evidenceCounts = facetPredicates.filter((request) =>
      request.facets.includes("evidence"),
    );
    expect(evidenceCounts.length).toBeGreaterThan(0);
    expect(evidenceCounts.map((request) => request.rql)).toEqual(
      evidenceCounts.map(() => scopeRql),
    );
  });
});

const countedFacetFields = [
  "category",
  "detection_method",
  "evidence",
  "interaction_type",
];

/**
 * Renders the shell on a fresh cache (so one view's counts cannot serve the other's), opens
 * `view`'s Filters menu, and returns the rql each facet's counts were requested over. A shared
 * cache would hide a difference: equal requests are fetched once, so a Graph that agrees with the
 * Table sends nothing at all.
 */
async function facetCountRqls(
  user: ReturnType<typeof userEvent.setup>,
  view: "Table" | "Graph",
) {
  tablePredicates.length = 0;
  graphPredicates.length = 0;
  facetPredicates.length = 0;
  const { unmount } = render(<InteractionsSubviewShell rql={scopeRql} />, {
    wrapper: createQueryClientWrapper(),
  });
  await waitFor(() => {
    expect(tablePredicates).toHaveLength(1);
  });
  if (view === "Graph") {
    await user.click(screen.getByRole("tab", { name: "Graph" }));
    await waitFor(() => {
      expect(graphPredicates).toHaveLength(1);
    });
  }
  const panel = view === "Table" ? tablePanel() : graphPanel();
  await user.click(panel.getByRole("button", { name: /^Filters/ }));
  await waitFor(() => {
    expect(
      [...new Set(facetPredicates.flatMap((request) => request.facets))].sort(),
    ).toEqual(countedFacetFields);
  });
  const rqls = Object.fromEntries(
    facetPredicates.flatMap((request) =>
      request.facets.map((field) => [field, request.rql]),
    ),
  );
  unmount();
  return rqls;
}

describe("Interactions Table and Graph count every facet over the same scope", () => {
  const picked = `and(${scopeRql},eq(evidence,computational))`;
  it.each([
    {
      state: "only the default applies",
      search: "",
      expected: {
        category: scopeRql,
        detection_method: scopeRql,
        evidence: scopeRql,
        interaction_type: scopeRql,
      },
    },
    {
      state: "the default is removed",
      search: "?interactions.evidence=*",
      expected: {
        category: scopeRql,
        detection_method: scopeRql,
        evidence: scopeRql,
        interaction_type: scopeRql,
      },
    },
    {
      state: "computational is picked",
      search: "?interactions.evidence=computational",
      expected: {
        category: picked,
        detection_method: picked,
        evidence: scopeRql,
        interaction_type: picked,
      },
    },
  ])("when $state", async ({ search, expected }) => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", `/genome/1.1${search}`);

    const tableRqls = await facetCountRqls(user, "Table");
    const graphRqls = await facetCountRqls(user, "Graph");

    expect(tableRqls).toEqual(expected);
    expect(graphRqls).toEqual(tableRqls);
  });
});

const focusedProteinId = "fig|1.1.peg.1";
const focusClause =
  "or(eq(interactor_a,fig%7C1.1.peg.1),eq(interactor_b,fig%7C1.1.peg.1))";
const focusedRql = `and(${scopeRql},and(${focusClause},${experimentalClause}))`;
const focusUrlParam = "interactions.interactor=fig%7C1.1.peg.1";

/** Picks the node in the Graph's list, then its detail panel's focus button. */
async function focusFromGraph(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await graphPanel().findByText("geneA"));
  await user.click(
    graphPanel().getByRole("button", { name: "Focus on this protein" }),
  );
}

describe("Interactions Table and Graph share a protein focus", () => {
  beforeEach(() => {
    datasetRows = focusRows;
  });

  it("narrows both views to the protein from the Graph's detail panel", async () => {
    const user = userEvent.setup();
    render(<InteractionsSubviewShell rql={scopeRql} />, {
      wrapper: createQueryClientWrapper(),
    });
    await waitFor(() => {
      expect(tablePredicates).toHaveLength(1);
    });
    await user.click(screen.getByRole("tab", { name: "Graph" }));
    await waitFor(() => {
      expect(graphPredicates).toHaveLength(1);
    });

    await focusFromGraph(user);

    await waitFor(() => {
      expect(graphPredicates.at(-1)?.rql).toBe(focusedRql);
    });
    await waitFor(() => {
      expect(tablePredicates.at(-1)?.rql).toBe(focusedRql);
    });
    expect(tablePredicates.at(-1)).toEqual(graphPredicates.at(-1));
    expect(window.location.search).toBe(`?${focusUrlParam}`);
    // The focus is a filter like the rest: the bar names it, and the counts stay inside it.
    expect(
      graphPanel().getByRole("button", {
        name: `Protein: ${focusedProteinId}. Edit filter`,
      }),
    ).toBeInTheDocument();
    // The rows come back with the protein in them, so the Graph selects it again.
    await waitFor(() => {
      expect(
        graphPanel().getByRole("button", { name: "Focus on this protein" }),
      ).toBeInTheDocument();
    });
    expect(
      within(graphPanel().getByLabelText("Selection details")).getByText(
        focusedProteinId,
      ),
    ).toBeInTheDocument();
  });

  it("keeps the focus when the Table picks a facet afterwards", async () => {
    const user = userEvent.setup();
    render(<InteractionsSubviewShell rql={scopeRql} />, {
      wrapper: createQueryClientWrapper(),
    });
    await waitFor(() => {
      expect(tablePredicates).toHaveLength(1);
    });
    await user.click(screen.getByRole("tab", { name: "Graph" }));
    await waitFor(() => {
      expect(graphPredicates).toHaveLength(1);
    });
    await focusFromGraph(user);
    await waitFor(() => {
      expect(tablePredicates.at(-1)?.rql).toBe(focusedRql);
    });

    await user.click(screen.getByRole("tab", { name: "Table" }));
    // The Table's own bar names the focus too: its profile carries the label.
    expect(
      tablePanel().getByRole("button", {
        name: `Protein: ${focusedProteinId}. Edit filter`,
      }),
    ).toBeInTheDocument();
    await pickAssociation(user, tablePanel());

    const bothRql = `and(${scopeRql},and(${focusClause},and(eq(interaction_type,association),${experimentalClause})))`;
    await waitFor(() => {
      expect(tablePredicates.at(-1)?.rql).toBe(bothRql);
    });
    expect(window.location.search).toContain(focusUrlParam);
    expect(window.location.search).toContain(
      "interactions.interaction_type=association",
    );

    await user.click(screen.getByRole("tab", { name: "Graph" }));
    await waitFor(() => {
      expect(graphPredicates.at(-1)?.rql).toBe(bothRql);
    });
    expect(tablePredicates.at(-1)).toEqual(graphPredicates.at(-1));
  });

  it("keeps a facet the Table picked when the Graph focuses afterwards", async () => {
    const user = userEvent.setup();
    render(<InteractionsSubviewShell rql={scopeRql} />, {
      wrapper: createQueryClientWrapper(),
    });
    await waitFor(() => {
      expect(tablePredicates).toHaveLength(1);
    });
    await pickAssociation(user, tablePanel());
    await waitFor(() => {
      expect(tablePredicates.at(-1)?.rql).toBe(associationRql);
    });

    await user.click(screen.getByRole("tab", { name: "Graph" }));
    await waitFor(() => {
      expect(graphPredicates.at(-1)?.rql).toBe(associationRql);
    });
    await focusFromGraph(user);

    const bothRql = `and(${scopeRql},and(${focusClause},and(eq(interaction_type,association),${experimentalClause})))`;
    await waitFor(() => {
      expect(graphPredicates.at(-1)?.rql).toBe(bothRql);
    });
    await waitFor(() => {
      expect(tablePredicates.at(-1)?.rql).toBe(bothRql);
    });
    expect(tablePredicates.at(-1)).toEqual(graphPredicates.at(-1));
    expect(window.location.search).toContain(focusUrlParam);
    expect(window.location.search).toContain(
      "interactions.interaction_type=association",
    );
  });

  it("drops the Table's page when the Graph focuses", async () => {
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
    await user.click(screen.getByRole("tab", { name: "Graph" }));
    await waitFor(() => {
      expect(graphPredicates).toHaveLength(1);
    });

    await focusFromGraph(user);

    await waitFor(() => {
      expect(tablePredicates.at(-1)?.rql).toBe(focusedRql);
    });
    expect(
      tablePages[
        tablePredicates.findIndex((request) => request.rql === focusedRql)
      ],
    ).toBe(1);
    expect(window.location.search).not.toContain("interactions.page");
  });

  it("widens both views again when the Protein pill is removed", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", `/genome/1.1?${focusUrlParam}`);
    render(<InteractionsSubviewShell rql={scopeRql} />, {
      wrapper: createQueryClientWrapper(),
    });
    await waitFor(() => {
      expect(tablePredicates.at(-1)?.rql).toBe(focusedRql);
    });
    await user.click(screen.getByRole("tab", { name: "Graph" }));
    await waitFor(() => {
      expect(graphPredicates.at(-1)?.rql).toBe(focusedRql);
    });

    await user.click(
      graphPanel().getByRole("button", { name: "Clear Protein filter" }),
    );

    await waitFor(() => {
      expect(graphPredicates.at(-1)?.rql).toBe(defaultRql);
    });
    await waitFor(() => {
      expect(tablePredicates.at(-1)?.rql).toBe(defaultRql);
    });
    expect(window.location.search).toBe("");
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

describe("Interactions Show in Graph from the Table's selection", () => {
  const selectionRows = [
    ...focusRows,
    {
      id: "ppi-f3",
      interactor_a: "fig|1.1.peg.4",
      interactor_b: "fig|1.1.peg.5",
      gene_a: "geneD",
      gene_b: "geneE",
      evidence: "experimental",
    },
  ];

  beforeEach(() => {
    datasetRows = selectionRows;
  });

  it("draws exactly the selected rows, read by id, and leaves the Table's request alone", async () => {
    const user = userEvent.setup();
    render(<InteractionsSubviewShell rql={scopeRql} />, {
      wrapper: createQueryClientWrapper(),
    });
    await waitFor(() => {
      expect(tablePanel().getByText("geneD")).toBeInTheDocument();
    });
    const tableRequests = [...tablePredicates];

    await user.click(
      tablePanel().getByRole("button", { name: "Select the first two rows" }),
    );
    await user.click(
      await tablePanel().findByRole("button", { name: /^show in\s*graph$/i }),
    );

    expect(screen.getByRole("tab", { name: "Graph" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await waitFor(() => {
      expect(graphPanel().getByText("geneA")).toBeInTheDocument();
    });
    expect(selectedReads).toStrictEqual([
      {
        operation: "selected",
        ids: ["ppi-f1", "ppi-f2"],
        fields: [...interactionsGraphFields],
      },
    ]);
    expect(graphPredicates).toStrictEqual([]);
    expect(graphPanel().getByText("geneB")).toBeInTheDocument();
    expect(graphPanel().getByText("geneC")).toBeInTheDocument();
    expect(graphPanel().queryByText("geneD")).not.toBeInTheDocument();
    expect(
      graphPanel().getByText("Showing 2 selected interactions"),
    ).toBeInTheDocument();
    expect(tablePredicates).toStrictEqual(tableRequests);

    // Show all goes back to the Graph's own predicate read.
    await user.click(graphPanel().getByRole("button", { name: "Show all" }));
    await waitFor(() => {
      expect(graphPanel().getByText("geneD")).toBeInTheDocument();
    });
    expect(graphPredicates).toStrictEqual([
      { rql: defaultRql, keyword: undefined, keywordMode: undefined },
    ]);
  });
});
