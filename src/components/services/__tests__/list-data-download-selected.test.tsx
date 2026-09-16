/**
 * Tests for ListData's selected-row export (plan item 20A).
 *
 * DataTable no longer has a built-in "download selected" fallback (it used to
 * raw-fetch NEXT_PUBLIC_DATA_API, hand-build RQL by string concatenation,
 * accept an unvalidated response envelope, and comma-join output even for
 * .txt — see git history). ListData now supplies onDownloadSelected itself,
 * routed through the Data API repository (`/api/data/<resource>`) and the
 * shared export serializer (`serializeResourceRows`/`downloadResourceExport`).
 *
 * These tests intercept the repository's HTTP call with MSW (never vi.mock or
 * a direct global.fetch assignment) so they exercise the real request/response
 * and serialization code paths.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import type { DataResource } from "@/lib/data-api";
import { ListData } from "../list-data";

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ListData issues its own page read on mount. None of these tests exercise that
// path or need rows loaded to reach the "Download Selected" buttons (their
// visibility depends only on the selectedIds prop), so stub it to an empty,
// non-prefetching result. It shares the gateway path with the POST export
// below, which is why the GET handler is registered separately.
function stubListFetch(resource: DataResource) {
  server.use(
    http.get(`/api/data/${resource}`, () =>
      HttpResponse.json({
        rows: [],
        total: 0,
        facets: {},
        page: 1,
        pageSize: 200,
      }),
    ),
  );
}

function renderListData(
  resource: DataResource,
  selectedIds: string[],
  extraProps: Partial<React.ComponentProps<typeof ListData>> = {},
) {
  stubListFetch(resource);
  return render(
    <ListData
      resource={resource}
      q=""
      selectedIds={selectedIds}
      {...extraProps}
    />,
    { wrapper: createQueryClientWrapper() },
  );
}

function spyOnDownload() {
  let exportedBlob: Blob | undefined;
  let downloadedFilename: string | undefined;
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    exportedBlob = blob as Blob;
    return "blob:mock";
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
    function (this: HTMLAnchorElement) {
      // `download` is set on the anchor before `.click()` in both export
      // helpers, so it's already in place by the time this mock runs.
      downloadedFilename = this.download;
    },
  );
  return {
    text: async () => {
      await waitFor(() => {
        expect(exportedBlob).toBeDefined();
      });
      return exportedBlob?.text();
    },
    filename: async () => {
      await waitFor(() => {
        expect(downloadedFilename).toBeDefined();
      });
      return downloadedFilename;
    },
  };
}

describe("ListData selected export: repository boundary", () => {
  it("sends selected ids verbatim to the Data API repository instead of building RQL itself", async () => {
    const user = userEvent.setup();
    const captured: { body?: unknown; url?: string } = {};
    // A selected id carrying RQL metacharacters. The old fallback built
    // `or(eq(id,<id>),...)` by string concatenation, which this id would have
    // corrupted (or worse, injected extra predicates into) the request.
    const maliciousId = "1.1),or(eq(genome_id,injected";

    server.use(
      http.post("/api/data/genome", async ({ request }) => {
        captured.url = request.url;
        captured.body = await request.json();
        return HttpResponse.json({
          rows: [{ genome_id: "1.1", genome_name: "A" }],
        });
      }),
    );
    spyOnDownload();

    renderListData("genome", ["1.1", maliciousId]);

    await user.click(
      await screen.findByRole("button", { name: /Download Selected \(CSV\)/i }),
    );

    await waitFor(() => {
      expect(captured.body).toBeDefined();
    });
    expect(captured.body).toMatchObject({
      operation: "selected",
      ids: ["1.1", maliciousId],
    });
    // The malicious id travels intact, as one array element in a JSON body —
    // never spliced into a hand-built `rql`/query string field (which is what
    // the removed fallback did via string concatenation).
    expect(captured.body).not.toHaveProperty("rql");
    expect(captured.body).not.toHaveProperty("query");
    // Never a direct call to the backend/NEXT_PUBLIC_DATA_API for this export.
    expect(captured.url).toBe(`${window.location.origin}/api/data/genome`);
  });

  it("names the downloaded file with a -selected marker, not the all-rows name", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/api/data/genome", () =>
        HttpResponse.json({ rows: [{ genome_id: "1.1", genome_name: "A" }] }),
      ),
    );
    const download = spyOnDownload();

    renderListData("genome", ["1.1"]);

    await user.click(
      await screen.findByRole("button", { name: /Download Selected \(CSV\)/i }),
    );

    expect(await download.filename()).toBe("genome-selected.csv");
  });

  it("re-sorts the exported rows to match selection order, not response order", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/api/data/genome", () =>
        // Server returns them in the opposite order to the selection.
        HttpResponse.json({
          rows: [
            { genome_id: "2.2", genome_name: "Second" },
            { genome_id: "1.1", genome_name: "First" },
          ],
        }),
      ),
    );
    const download = spyOnDownload();

    renderListData("genome", ["1.1", "2.2"]);

    await user.click(
      await screen.findByRole("button", { name: /Download Selected \(CSV\)/i }),
    );

    const content = await download.text();
    const lines = (content ?? "").trim().split("\n");
    const firstRowIndex = lines.findIndex((line) => line.includes("First"));
    const secondRowIndex = lines.findIndex((line) => line.includes("Second"));
    expect(firstRowIndex).toBeGreaterThan(-1);
    expect(secondRowIndex).toBeGreaterThan(-1);
    expect(firstRowIndex).toBeLessThan(secondRowIndex);
  });

  it("exports CSV with comma delimiters and formula-injection protection", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/api/data/genome", () =>
        HttpResponse.json({
          rows: [{ genome_id: "1.1", genome_name: "=cmd|' /C calc'!A0" }],
        }),
      ),
    );
    const download = spyOnDownload();

    renderListData("genome", ["1.1"]);

    await user.click(
      await screen.findByRole("button", { name: /Download Selected \(CSV\)/i }),
    );

    const content = await download.text();
    expect(content).toContain(",");
    // A value that looks like a spreadsheet formula is quoted and prefixed
    // with a `'` so it opens as text, not an executed formula.
    expect(content).toContain(`"'=cmd|' /C calc'!A0"`);
  });

  it("exports TXT with tab delimiters", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/api/data/genome", () =>
        HttpResponse.json({
          rows: [{ genome_id: "1.1", genome_name: "Plain Name" }],
        }),
      ),
    );
    const download = spyOnDownload();

    renderListData("genome", ["1.1"]);

    await user.click(
      await screen.findByRole("button", { name: /Download Selected \(TXT\)/i }),
    );

    const content = await download.text();
    expect(content).toContain("\t");
    expect(content).not.toMatch(/Plain Name[^\t\n]*,/);
  });
});

describe("ListData selected export: failure visibility", () => {
  it("surfaces the real error message for a malformed upstream response", async () => {
    const user = userEvent.setup();
    const alertSpy = vi
      .spyOn(window, "alert")
      .mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    server.use(
      http.post("/api/data/genome", () =>
        HttpResponse.json(
          {
            error: "Malformed data service response.",
            code: "malformed_response",
          },
          { status: 502 },
        ),
      ),
    );

    renderListData("genome", ["1.1"]);

    await user.click(
      await screen.findByRole("button", { name: /Download Selected \(CSV\)/i }),
    );

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });
    // The real upstream message reaches the user, not a generic replacement.
    expect(alertSpy).toHaveBeenCalledWith("Malformed data service response.");
    expect(errorSpy).toHaveBeenCalledWith(
      "Download selected failed:",
      expect.any(Error),
    );
  });

  it("surfaces the real error message when the request fails", async () => {
    const user = userEvent.setup();
    const alertSpy = vi
      .spyOn(window, "alert")
      .mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    server.use(
      http.post("/api/data/genome", () =>
        HttpResponse.json(
          { error: "Upstream timed out.", code: "upstream_error" },
          { status: 502 },
        ),
      ),
    );

    renderListData("genome", ["1.1"]);

    await user.click(
      await screen.findByRole("button", { name: /Download Selected \(CSV\)/i }),
    );

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Upstream timed out.");
    });
  });
});

describe("ListData selected export: AMR phenotypes", () => {
  // genome_amr used to be the one list resource outside the Data API registry,
  // so its selected export fell back to serializing whatever rows happened to
  // be loaded — a narrower promise than every other resource made. It is a
  // registered resource now, so it takes the same repository path, and a
  // selected id that is not on the current page is still exported.
  it("exports selected AMR rows through the repository, including ids not on the loaded page", async () => {
    const user = userEvent.setup();
    let body: unknown;
    server.use(
      http.post("/api/data/genome_amr", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          rows: [
            { id: "amr-2", antibiotic: "ampicillin" },
            { id: "amr-1", antibiotic: "gentamicin" },
          ],
        });
      }),
    );
    const download = spyOnDownload();

    renderListData("genome_amr", ["amr-1", "amr-2"]);

    await user.click(
      await screen.findByRole("button", { name: /Download Selected \(CSV\)/i }),
    );

    const content = await download.text();
    expect(body).toMatchObject({
      operation: "selected",
      ids: ["amr-1", "amr-2"],
    });
    const lines = (content ?? "").trim().split("\n");
    // Re-sorted into selection order, not response order.
    expect(
      lines.findIndex((line) => line.includes("gentamicin")),
    ).toBeLessThan(lines.findIndex((line) => line.includes("ampicillin")));
    expect(await download.filename()).toBe("genome_amr-selected.csv");
  });
});
