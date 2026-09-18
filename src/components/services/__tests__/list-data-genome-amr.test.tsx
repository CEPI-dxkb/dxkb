/**
 * The AMR Phenotypes list — `/search?type=genome_amr`, the second of the two
 * routes item 29 retained, and the one whose Data API contract this work
 * invented (registry entry, record schema, `id` identity, `pmid` cardinality).
 *
 * It takes the same `ListData` → `DataRepository` → `/api/data/genome_amr`
 * path as `genome_sequence`; these cases pin that path for AMR specifically,
 * because nothing else in the suite reads it. Row shapes are the realistic
 * ones: a `pmid` list and a non-numeric `measurement_value`.
 * `src/lib/data-api/__tests__/repository.test.ts` pins the same shapes on the
 * server side of the gateway, where the record schema actually runs.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { maxSelectedRows } from "@/lib/data-api/validation";
import { ListData } from "../list-data";

const gateway = "/api/data/genome_amr";
const query = "keyword(ampicillin*)";

const amrRow = {
  id: "1a2b3c",
  genome_id: "1313.5678",
  genome_name: "Streptococcus pneumoniae",
  antibiotic: "ampicillin",
  resistant_phenotype: "Resistant",
  measurement_value: ">=32",
  measurement_sign: ">=",
  pmid: ["12345", "67890"],
  evidence: ["Laboratory Method"],
  laboratory_typing_method: "Broth dilution",
};

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  };
});

/**
 * Answer every AMR collection GET (rows + total + facets). The member read is
 * the detail panel's, not the list's, and is covered in
 * `src/components/genome/__tests__/genome-detail-panel-member.test.tsx`.
 */
function stubGateway({
  rows = [amrRow],
  total = 1,
}: { rows?: Record<string, unknown>[]; total?: number } = {}) {
  const requests: URL[] = [];
  server.use(
    http.get(gateway, ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      return HttpResponse.json({
        rows,
        total,
        facets: {
          antibiotic: [{ value: "ampicillin", count: total }],
          evidence: [{ value: "Laboratory Method", count: total }],
        },
        page: Number(url.searchParams.get("page") ?? 1),
        pageSize: 200,
      });
    }),
  );
  return requests;
}

function renderAmrList(
  props: Partial<React.ComponentProps<typeof ListData>> = {},
) {
  return render(<ListData resource="genome_amr" q={query} {...props} />, {
    wrapper: createQueryClientWrapper(),
  });
}

describe("ListData genome_amr collection", () => {
  it("reads the page through the same-origin gateway with the AMR projection", async () => {
    const requests = stubGateway();

    renderAmrList();

    await screen.findByText(/Showing 1-1 of 1 results/);
    const url = requests[0];
    expect(url.origin).toBe(window.location.origin);
    expect(url.pathname).toBe(gateway);
    expect(url.searchParams.get("operation")).toBe("collection");
    expect(url.searchParams.get("rql")).toBe(query);
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("pageSize")).toBe("200");

    const fields = url.searchParams.getAll("field");
    // `id` is the identity field the registry and the legacy table agree on.
    expect(fields).toContain("id");
    expect(fields).toContain("antibiotic");
    expect(fields).toContain("resistant_phenotype");
    expect(fields).toContain("measurement_value");
    expect(fields).toContain("pmid");
  });

  it("asks for no sort by default, and never offers one on the publication list", async () => {
    const requests = stubGateway();

    renderAmrList();

    await screen.findByText(/Showing 1-1 of 1 results/);
    expect(requests[0].searchParams.get("sort")).toBeNull();
    // This is the registry-backed `sortable` reaching the DOM: `pmid` is
    // declared multi-valued, so `enableSorting` is false and its header button
    // is disabled — the user cannot issue the sort the gateway would reject.
    // Before this work every column's header was enabled.
    expect(
      screen.getByRole("button", { name: "Sort by Pubmed" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Sort by Evidence" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Sort by Antibiotic" }),
    ).toBeEnabled();
  });

  it("prefetches the adjacent page once the first one lands", async () => {
    const requests = stubGateway({ total: 1000 });

    renderAmrList();

    await waitFor(
      () => {
        expect(
          requests
            .filter((url) => url.searchParams.get("operation") === "collection")
            .map((url) => url.searchParams.get("page")),
        ).toContain("2");
      },
      { timeout: 4000 },
    );
  });
});

describe("ListData genome_amr facets", () => {
  it("requests AMR facet counts over the same predicate and renders them", async () => {
    const user = userEvent.setup();
    const requests = stubGateway();

    renderAmrList();
    await screen.findByText(/Showing 1-1 of 1 results/);

    await user.click(screen.getByRole("button", { name: "Show Filters" }));

    // `antibiotic` and `evidence` are the AMR facets that start expanded
    // (`facet_hidden: false` in datafields/genome_amr.ts).
    expect(
      await screen.findByRole("button", { name: "ampicillin (1)" }),
    ).toBeInTheDocument();
    const facetRequest = requests.find(
      (url) => url.searchParams.getAll("facet").length > 0,
    );
    expect(facetRequest).toBeDefined();
    expect(facetRequest?.searchParams.getAll("facet")).toContain("antibiotic");
    expect(facetRequest?.searchParams.get("rql")).toBe(query);
    expect(facetRequest?.searchParams.get("pageSize")).toBe("1");
  });
});

describe("ListData genome_amr selected export", () => {
  it("batches a selection above the per-request ceiling and restores its order", async () => {
    const user = userEvent.setup();
    stubGateway();
    const selectedIds = Array.from(
      { length: maxSelectedRows + 1 },
      (_, index) => `amr-${String(index)}`,
    );
    const bodies: { ids: string[] }[] = [];
    server.use(
      http.post(gateway, async ({ request }) => {
        const body = (await request.json()) as { ids: string[] };
        bodies.push(body);
        return HttpResponse.json({
          rows: [...body.ids]
            .reverse()
            .map((id) => ({ ...amrRow, id, antibiotic: id })),
        });
      }),
    );
    let exported: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      exported = blob as Blob;
      return "blob:download";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );

    renderAmrList({ selectedIds });

    await user.click(
      await screen.findByRole("button", { name: /Download Selected \(CSV\)/i }),
    );

    await waitFor(() => {
      expect(exported).toBeDefined();
    });
    expect(bodies.map((body) => body.ids.length)).toEqual([maxSelectedRows, 1]);
    expect(bodies.flatMap((body) => body.ids)).toEqual(selectedIds);
    const lines = (await exported?.text())?.trim().split("\n") ?? [];
    expect(lines.findIndex((line) => line.includes("amr-0"))).toBeLessThan(
      lines.findIndex((line) => line.includes(`amr-${String(maxSelectedRows)}`)),
    );
  });

  it("exports a selection within the ceiling", async () => {
    const user = userEvent.setup();
    stubGateway();
    server.use(
      http.post(gateway, () => HttpResponse.json({ rows: [amrRow] })),
    );
    let exported: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      exported = blob as Blob;
      return "blob:download";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );

    renderAmrList({ selectedIds: [amrRow.id] });

    await user.click(
      await screen.findByRole("button", { name: /Download Selected \(CSV\)/i }),
    );

    await waitFor(() => {
      expect(exported).toBeDefined();
    });
    await expect(exported?.text()).resolves.toContain("ampicillin");
  });
});

describe("ListData genome_amr all-rows export", () => {
  it("exports every matching AMR row through the aggregate read", async () => {
    stubGateway();
    let body: unknown;
    server.use(
      http.post(gateway, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ rows: [amrRow] });
      }),
    );
    let exported: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      exported = blob as Blob;
      return "blob:download";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );

    renderAmrList();
    await screen.findByText(/Showing 1-1 of 1 results/);
    fireEvent.click(screen.getByRole("button", { name: "Download (CSV)" }));

    await waitFor(() => {
      expect(exported).toBeDefined();
    });
    expect(body).toMatchObject({ operation: "export", rql: query });
    expect((body as { fields: string[] }).fields).toEqual(
      expect.arrayContaining(["antibiotic", "evidence", "pmid"]),
    );
    // The `pmid` list is serialized, not dropped.
    await expect(exported?.text()).resolves.toContain("12345");
  });
});
