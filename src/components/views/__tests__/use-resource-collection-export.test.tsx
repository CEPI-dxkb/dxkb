import { act, renderHook } from "@testing-library/react";
import type { DataRepository } from "@/lib/data-api";
import { useResourceCollectionExport } from "../use-resource-collection-export";

const { downloadResourceExport } = vi.hoisted(() => ({
  downloadResourceExport: vi.fn(),
}));

vi.mock("../resource-export", () => ({ downloadResourceExport }));

const columns = [
  { id: "genome_id", label: "Genome ID" },
  { id: "genome_name", label: "Genome name" },
];

function repository() {
  const selected = vi.fn();
  const exportAll = vi.fn();
  return {
    data: { selected, exportAll } as unknown as DataRepository,
    selected,
    exportAll,
  };
}

function options(
  data: DataRepository,
  overrides: Partial<Parameters<typeof useResourceCollectionExport>[0]> = {},
) {
  return {
    repository: data,
    resource: "genome" as const,
    idField: "genome_id",
    columns,
    total: 2,
    isRefreshing: false,
    hasLoadedKeyword: false,
    displayedRows: [],
    rql: "eq(owner,public)",
    keyword: "coli",
    sort: { field: "genome_name", direction: "asc" as const },
    ...overrides,
  };
}

beforeEach(() => {
  downloadResourceExport.mockReset();
});

describe("useResourceCollectionExport", () => {
  it("fetches and downloads all rows with the active query", async () => {
    const { data, exportAll } = repository();
    exportAll.mockResolvedValue({
      rows: [{ genome_id: "1", genome_name: "First" }],
    });
    const { result } = renderHook(() =>
      useResourceCollectionExport(options(data, { exportFileName: "related" })),
    );

    await act(() =>
      result.current.exportRows("csv", undefined, ["genome_name"]),
    );

    expect(exportAll).toHaveBeenCalledWith("genome", {
      rql: "eq(owner,public)",
      keyword: "coli",
      keywordMode: undefined,
      fields: ["genome_name"],
      sort: { field: "genome_name", direction: "asc" },
    });
    expect(downloadResourceExport).toHaveBeenCalledWith(
      "genome",
      [{ genome_id: "1", genome_name: "First" }],
      columns,
      ["genome_name"],
      "csv",
      "all",
      "related",
    );
  });

  // Loaded mode exports the rows already on screen. It must not refetch:
  // `exportAll` is capped at maxExportRows, so a refetch-then-filter would draw
  // matches only from the first page of a large collection.
  it("exports the displayed rows for a loaded keyword without refetching", async () => {
    const { data, exportAll } = repository();
    const displayedRows = [{ genome_id: "2", genome_name: "DNA gyrase" }];
    const { result } = renderHook(() =>
      useResourceCollectionExport(
        options(data, { hasLoadedKeyword: true, displayedRows }),
      ),
    );

    await act(() => result.current.exportRows("txt", undefined, ["genome_id"]));

    expect(exportAll).not.toHaveBeenCalled();
    expect(downloadResourceExport).toHaveBeenCalledWith(
      "genome",
      displayedRows,
      columns,
      ["genome_id"],
      "txt",
      "all",
      "genome",
    );
  });

  // Regression: the size guard read `total`, which is the UNFILTERED
  // collection total (the collection strips the keyword from the server
  // request). A view filtered down to a few visible matches inside a large
  // collection was refused, quoting a row count the user never sees.
  it("exports a small keyword-filtered view inside an oversized collection", async () => {
    const { data, exportAll } = repository();
    const displayedRows = [
      { genome_id: "1", genome_name: "DNA gyrase A" },
      { genome_id: "2", genome_name: "DNA gyrase B" },
    ];
    const { result } = renderHook(() =>
      useResourceCollectionExport(
        options(data, {
          hasLoadedKeyword: true,
          displayedRows,
          total: 40_000,
        }),
      ),
    );

    await act(() => result.current.exportRows("csv"));

    expect(result.current.exportError).toBeNull();
    expect(exportAll).not.toHaveBeenCalled();
    expect(downloadResourceExport).toHaveBeenCalledWith(
      "genome",
      displayedRows,
      columns,
      ["genome_id", "genome_name"],
      "csv",
      "all",
      "genome",
    );
  });

  it("reports refresh and size guards without requesting rows", async () => {
    const { data, exportAll } = repository();
    const refreshing = renderHook(() =>
      useResourceCollectionExport(options(data, { isRefreshing: true })),
    );
    await act(() => refreshing.result.current.exportRows("csv"));
    expect(refreshing.result.current.exportError).toMatch(/finish loading/);

    const oversized = renderHook(() =>
      useResourceCollectionExport(options(data, { total: 10_001 })),
    );
    await act(() => oversized.result.current.exportRows("csv"));
    expect(oversized.result.current.exportError).toContain("10,001");
    expect(exportAll).not.toHaveBeenCalled();
  });

  it("preserves repository failures in export state", async () => {
    const { data, exportAll } = repository();
    exportAll.mockRejectedValue(new Error("Export unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = renderHook(() =>
      useResourceCollectionExport(options(data)),
    );

    await act(() => result.current.exportRows("csv"));

    expect(result.current.exportError).toBe("Export unavailable");
  });
});
