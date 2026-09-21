import { act, renderHook } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { deriveTableFields } from "../list-data-utils";
import {
  getExportProjection,
  orderSelectedRows,
  useListDataExport,
} from "../use-list-data-export";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getExportProjection", () => {
  const fields = deriveTableFields("genome");

  it("removes the selection column from visible exports", () => {
    expect(getExportProjection(fields, ["__select__", "genome_name"])).toEqual([
      "genome_name",
    ]);
  });

  it("falls back to table fields when no data column is visible", () => {
    expect(getExportProjection(fields, ["__select__"])).toEqual(
      fields.map((field) => field.id),
    );
  });
});

describe("orderSelectedRows", () => {
  it("matches selection order and leaves unknown rows last", () => {
    expect(
      orderSelectedRows(
        [{ genome_id: "unknown" }, { genome_id: "2.2" }, { genome_id: "1.1" }],
        ["1.1", "2.2"],
        "genome_id",
      ),
    ).toEqual([
      { genome_id: "1.1" },
      { genome_id: "2.2" },
      { genome_id: "unknown" },
    ]);
  });
});

describe("useListDataExport", () => {
  it("executes selected export with the identity field and selection ordering", async () => {
    let requestBody: { fields: string[]; ids: string[] } | undefined;
    server.use(
      http.post("/api/data/genome", async ({ request }) => {
        requestBody = (await request.json()) as {
          fields: string[];
          ids: string[];
        };
        return HttpResponse.json({
          rows: [
            { genome_id: "2.2", genome_name: "Second" },
            { genome_id: "1.1", genome_name: "First" },
          ],
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
    const fields = deriveTableFields("genome");
    const { result } = renderHook(() =>
      useListDataExport({
        resource: "genome",
        fields,
        idField: "genome_id",
        combinedQuery: "eq(owner,public)",
        sort: undefined,
        totalItems: 2,
        displayedRows: [],
        hasLoadedKeyword: false,
      }),
    );

    await act(() =>
      result.current.handleDownloadSelected(
        "csv",
        ["1.1", "2.2"],
        ["genome_name"],
      ),
    );

    expect(requestBody).toEqual({
      operation: "selected",
      ids: ["1.1", "2.2"],
      fields: ["genome_name", "genome_id"],
    });
    const content = await exportedBlob?.text();
    expect(content?.indexOf("First")).toBeLessThan(
      content?.indexOf("Second") ?? 0,
    );
  });

  it("exports loaded keyword rows without a repository request", async () => {
    const request = vi.fn();
    server.use(
      http.post("/api/data/genome", () => {
        request();
        return HttpResponse.json({ rows: [] });
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
    const { result } = renderHook(() =>
      useListDataExport({
        resource: "genome",
        fields: deriveTableFields("genome"),
        idField: "genome_id",
        combinedQuery: "",
        sort: undefined,
        totalItems: 20,
        displayedRows: [{ genome_id: "1.1", genome_name: "Filtered" }],
        hasLoadedKeyword: true,
      }),
    );

    await act(() => result.current.handleDownloadAll("csv", ["genome_name"]));

    expect(request).not.toHaveBeenCalled();
    await expect(exportedBlob?.text()).resolves.toContain("Filtered");
  });
});
