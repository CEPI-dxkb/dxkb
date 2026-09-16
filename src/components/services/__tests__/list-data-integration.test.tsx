/**
 * Integration tests for ListData's network behaviour.
 *
 * Every read goes through the same-origin Data API gateway
 * (`/api/data/<resource>`) via `DataRepository`. MSW intercepts that call, so
 * these tests exercise the real request-building, response-parsing and prefetch
 * code paths without a backend — and a regression that reintroduced a direct
 * `NEXT_PUBLIC_DATA_API` fetch would fail here, because MSW runs in strict mode
 * and no handler exists for an upstream URL.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { maxExportRows } from "@/lib/data-api";
import { ListData } from "../list-data";

const gateway = "/api/data/genome_sequence";
const query = "eq(genome_id,*)";

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  };
});

interface CollectionStub {
  rows?: Record<string, unknown>[];
  total: number;
  page?: number;
}

function collectionBody({ rows = [], total, page = 1 }: CollectionStub) {
  return { rows, total, facets: {}, page, pageSize: 200 };
}

/** Record every gateway collection request and answer with a fixed page. */
function stubCollection(stub: CollectionStub) {
  const requests: URL[] = [];
  server.use(
    http.get(gateway, ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      return HttpResponse.json(collectionBody(stub));
    }),
  );
  return requests;
}

function renderList(props: Partial<React.ComponentProps<typeof ListData>> = {}) {
  return render(<ListData resource="genome_sequence" q={query} {...props} />, {
    wrapper: createQueryClientWrapper(),
  });
}

describe("ListData gateway boundary", () => {
  it("reads rows from the same-origin gateway with the registry projection", async () => {
    const requests = stubCollection({ total: 500 });

    renderList();

    await waitFor(() => {
      expect(requests.length).toBeGreaterThan(0);
    });
    const url = requests[0];
    expect(url.origin).toBe(window.location.origin);
    expect(url.pathname).toBe(gateway);
    expect(url.searchParams.get("operation")).toBe("collection");
    expect(url.searchParams.get("rql")).toBe(query);
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("pageSize")).toBe("200");

    const fields = url.searchParams.getAll("field");
    // Raw DNA field excluded — prevents 18MB responses.
    expect(fields).not.toContain("sequence");
    expect(fields).toContain("sequence_id");
    expect(fields).toContain("genome_id");
    expect(fields).toContain("accession");
    expect(fields).toContain("gc_content");
    expect(fields).toContain("length");
  });

  it("asks for no sort until the user sorts", async () => {
    const requests = stubCollection({ total: 5 });

    renderList();

    await waitFor(() => {
      expect(requests.length).toBeGreaterThan(0);
    });
    expect(requests[0].searchParams.get("sort")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Pagination loading regression
// ---------------------------------------------------------------------------
// Placeholder rows keep the query in a success state while the next page fetches.
// The table should still show skeletons instead of rendering stale rows as current data.
describe("ListData pagination loading", () => {
  it("shows skeletons instead of stale rows while placeholder page data is fetching", async () => {
    let resolveThirdPage: (() => void) | undefined;

    server.use(
      http.get(gateway, async ({ request }) => {
        const page = new URL(request.url).searchParams.get("page");
        if (page === "3") {
          await new Promise<void>((resolve) => {
            resolveThirdPage = resolve;
          });
          return HttpResponse.json(
            collectionBody({
              rows: [{ sequence_id: "page-3-sequence" }],
              total: 1000,
              page: 3,
            }),
          );
        }
        return HttpResponse.json(
          collectionBody({
            rows: [{ sequence_id: `page-${String(page)}-sequence` }],
            total: 1000,
            page: Number(page),
          }),
        );
      }),
    );

    renderList();

    expect(
      await screen.findByText(/Showing 1-1 of 1000 results/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "3" }));

    await waitFor(() => {
      expect(
        document.querySelectorAll('[data-slot="skeleton"]').length,
      ).toBeGreaterThan(0);
    });
    expect(
      screen.queryByText(/Showing 401-401 of 1000 results/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Showing 401-600 of 1000 results/),
    ).toBeInTheDocument();

    resolveThirdPage?.();

    expect(
      await screen.findByText(/Showing 401-401 of 1000 results/),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Prefetch regression
// ---------------------------------------------------------------------------
// After page 1 lands, the prefetch effect fires page 2 (and page 0, which is
// out of range) in the background. Subsequent Next/Prev clicks then hit the
// TanStack Query cache instantly.
describe("ListData prefetch", () => {
  it("prefetches the next page after the initial page loads", async () => {
    const requests = stubCollection({ total: 1000 });

    renderList();

    await waitFor(
      () => {
        expect(
          requests.map((url) => url.searchParams.get("page")),
        ).toContain("2");
      },
      { timeout: 4000 },
    );
    expect(requests.map((url) => url.searchParams.get("page"))).toContain("1");
  });

  it("does not prefetch when the query matches nothing", async () => {
    const requests = stubCollection({ total: 0 });

    renderList();

    await screen.findByText(/No results/i);
    // Give the prefetch effect time to fire if it incorrectly did so.
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Exactly the one page read; the count no longer has a request of its own.
    expect(requests).toHaveLength(1);
    expect(requests[0].searchParams.get("page")).toBe("1");
  });
});

// ---------------------------------------------------------------------------
// Controlled filter
// ---------------------------------------------------------------------------
// ListData supports a controlled `filter`/`onFilterChange` pair (mirroring the
// controlled rowSelection/pageIndex pattern) as well as owning `filter` itself.
describe("ListData controlled filter", () => {
  it("conjoins the controlled filter with the base query", async () => {
    const requests = stubCollection({ total: 5 });

    renderList({ filter: "eq(mol_type,DNA)", onFilterChange: vi.fn() });

    await waitFor(() => {
      expect(requests.length).toBeGreaterThan(0);
    });
    // `and(...)`, not the legacy `&` join: the gateway parses `rql` as one RQL
    // expression.
    expect(requests[0].searchParams.get("rql")).toBe(
      `and(${query},eq(mol_type,DNA))`,
    );
  });

  it("filters and exports loaded rows without issuing another request", async () => {
    const rows = [
      { sequence_id: "row-1", description: "DNA-3-methyladenine glycosylase" },
      { sequence_id: "row-2", description: "Flagellar protein" },
    ];
    const requests = stubCollection({ rows, total: rows.length });

    renderList({ keywordMode: "loaded" });

    await screen.findByText(/Showing 1-2 of 2 results/);
    const initialRequestCount = requests.length;
    fireEvent.change(screen.getByPlaceholderText("Search keywords..."), {
      target: { value: "DNA-3-methyl" },
    });

    await screen.findByText(/Showing 1-1 of 1 results/);

    let exportedBlob: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      exportedBlob = blob as Blob;
      return "blob:download";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );
    fireEvent.click(screen.getByRole("button", { name: "Download (CSV)" }));

    await waitFor(() => {
      expect(exportedBlob).toBeDefined();
    });
    const exportedText = await exportedBlob?.text();
    expect(exportedText).toContain("DNA-3-methyladenine glycosylase");
    expect(exportedText).not.toContain("Flagellar protein");
    expect(requests).toHaveLength(initialRequestCount);
  });

  it("calls onFilterChange instead of applying the new filter itself when controlled", async () => {
    const requests = stubCollection({ total: 5 });
    const onFilterChange = vi.fn();

    renderList({ filter: "", onFilterChange });

    fireEvent.change(screen.getByPlaceholderText("Search keywords..."), {
      target: { value: "abc" },
    });

    await waitFor(() => {
      expect(onFilterChange).toHaveBeenCalledWith("keyword(abc*)");
    });
    await waitFor(() => {
      expect(requests.length).toBeGreaterThan(0);
    });

    // Controlled: the prop is still "" (the parent chose not to feed it back),
    // so ListData must not have silently applied the typed keyword itself.
    expect(
      requests.every((url) => !(url.searchParams.get("rql") ?? "").includes("abc")),
    ).toBe(true);
  });

  // A third mode beyond controlled/uncontrolled: `onFilterChange` provided but
  // `filter` left undefined — internal state still drives ListData's own query,
  // and the parent is notified too.
  it("updates its own query AND notifies onFilterChange when filter is left uncontrolled", async () => {
    const requests = stubCollection({ total: 5 });
    const onFilterChange = vi.fn();

    renderList({ onFilterChange });

    fireEvent.change(screen.getByPlaceholderText("Search keywords..."), {
      target: { value: "abc" },
    });

    await waitFor(() => {
      expect(onFilterChange).toHaveBeenCalledWith("keyword(abc*)");
    });
    await waitFor(() => {
      expect(
        requests.some((url) =>
          (url.searchParams.get("rql") ?? "").includes("keyword(abc*)"),
        ),
      ).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// All-rows export
// ---------------------------------------------------------------------------
describe("ListData download all", () => {
  it("exports every matching row through the gateway's aggregate read", async () => {
    stubCollection({ rows: [{ sequence_id: "row-1" }], total: 1 });
    let exportBody: unknown;
    server.use(
      http.post(gateway, async ({ request }) => {
        exportBody = await request.json();
        return HttpResponse.json({
          rows: [{ sequence_id: "row-1", accession: "CP000123" }],
        });
      }),
    );
    let exportedBlob: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      exportedBlob = blob as Blob;
      return "blob:download";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );

    renderList();
    await screen.findByText(/Showing 1-1 of 1 results/);
    fireEvent.click(screen.getByRole("button", { name: "Download (CSV)" }));

    await waitFor(() => {
      expect(exportedBlob).toBeDefined();
    });
    expect(exportBody).toMatchObject({
      operation: "export",
      rql: query,
      limit: maxExportRows,
    });
    await expect(exportedBlob?.text()).resolves.toContain("CP000123");
  });

  it("refuses an export larger than the gateway's row ceiling instead of truncating it", async () => {
    stubCollection({ rows: [{ sequence_id: "row-1" }], total: maxExportRows + 1 });
    const alertSpy = vi
      .spyOn(window, "alert")
      .mockImplementation(() => undefined);
    const objectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:download");

    renderList();
    await screen.findByText(/Showing 1-1 of/);
    fireEvent.click(screen.getByRole("button", { name: "Download (CSV)" }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });
    expect(alertSpy.mock.calls[0][0]).toContain(
      maxExportRows.toLocaleString(),
    );
    expect(objectUrl).not.toHaveBeenCalled();
  });

  it("surfaces the real error message when the aggregate read fails", async () => {
    stubCollection({ rows: [{ sequence_id: "row-1" }], total: 1 });
    server.use(
      http.post(gateway, () =>
        HttpResponse.json(
          { error: "Upstream timed out.", code: "upstream_error" },
          { status: 502 },
        ),
      ),
    );
    const alertSpy = vi
      .spyOn(window, "alert")
      .mockImplementation(() => undefined);

    renderList();
    await screen.findByText(/Showing 1-1 of 1 results/);
    fireEvent.click(screen.getByRole("button", { name: "Download (CSV)" }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Upstream timed out.");
    });
  });
});
