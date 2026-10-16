import { act, renderHook } from "@testing-library/react";
import { CancelledError } from "@tanstack/react-query";
import { maxExportRows, type DataRepository } from "@/lib/data-api";
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
  const collection = vi.fn();
  return {
    data: { selected, exportAll, collection } as unknown as DataRepository,
    selected,
    exportAll,
    collection,
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
    isPlaceholderData: false,
    currentTotal: () => Promise.resolve(2),
    hasLoadedKeyword: false,
    loadedKeyword: "",
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

  it("exports loaded-keyword matches from every page", async () => {
    const { data, exportAll } = repository();
    exportAll.mockResolvedValue({
      rows: [
        { genome_id: "1", genome_name: "DNA gyrase A" },
        { genome_id: "2", genome_name: "Unrelated protein" },
        { genome_id: "201", genome_name: "DNA gyrase B" },
      ],
    });
    const { result } = renderHook(() =>
      useResourceCollectionExport(
        options(data, {
          hasLoadedKeyword: true,
          loadedKeyword: "gyrase",
        }),
      ),
    );

    await act(() => result.current.exportRows("txt", undefined, ["genome_id"]));

    expect(exportAll).toHaveBeenCalledWith("genome", {
      rql: "eq(owner,public)",
      keyword: undefined,
      keywordMode: undefined,
      fields: ["genome_id", "genome_name"],
      sort: { field: "genome_name", direction: "asc" },
    });
    expect(downloadResourceExport).toHaveBeenCalledWith(
      "genome",
      [
        { genome_id: "1", genome_name: "DNA gyrase A" },
        { genome_id: "201", genome_name: "DNA gyrase B" },
      ],
      columns,
      ["genome_id"],
      "txt",
      "all",
      "genome",
    );
  });

  it("refuses a loaded-keyword export when the source exceeds the export limit", async () => {
    const { data, exportAll } = repository();
    const { result } = renderHook(() =>
      useResourceCollectionExport(
        options(data, {
          hasLoadedKeyword: true,
          loadedKeyword: "gyrase",
          total: 40_000,
        }),
      ),
    );

    await act(() => result.current.exportRows("csv"));

    expect(result.current.exportError).toContain("40,000");
    expect(exportAll).not.toHaveBeenCalled();
    expect(downloadResourceExport).not.toHaveBeenCalled();
  });

  it("refuses an export over the limit without requesting rows", async () => {
    const { data, exportAll } = repository();
    const { result } = renderHook(() =>
      useResourceCollectionExport(options(data, { total: 10_001 })),
    );

    await act(() => result.current.exportRows("csv"));

    expect(result.current.exportError).toContain("10,001");
    expect(exportAll).not.toHaveBeenCalled();
  });

  it("waits for the current query's total before reading the rows", async () => {
    // While the rows on screen are a previous query's placeholder, the total
    // comes from this query's own read, so the export starts once it lands.
    const { data, exportAll } = repository();
    exportAll.mockResolvedValue({ rows: [{ genome_id: "1" }] });
    const total = Promise.withResolvers<number>();
    const { result } = renderHook(() =>
      useResourceCollectionExport(
        options(data, {
          total: 1,
          isPlaceholderData: true,
          currentTotal: () => total.promise,
        }),
      ),
    );

    let exported: Promise<void> | undefined;
    act(() => {
      exported = result.current.exportRows("csv");
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(exportAll).not.toHaveBeenCalled();
    expect(result.current.exportError).toBeNull();

    await act(async () => {
      total.resolve(1);
      await exported;
    });

    expect(exportAll).toHaveBeenCalledTimes(1);
    expect(downloadResourceExport).toHaveBeenCalledWith(
      "genome",
      [{ genome_id: "1" }],
      columns,
      ["genome_id", "genome_name"],
      "csv",
      "all",
      "genome",
    );
  });

  it("refuses after waiting when the current query matches more than the limit", async () => {
    // The previous query's 2 rows are on screen; this query matches 10,001.
    const { data, exportAll } = repository();
    const { result } = renderHook(() =>
      useResourceCollectionExport(
        options(data, {
          total: 2,
          isPlaceholderData: true,
          currentTotal: () => Promise.resolve(10_001),
        }),
      ),
    );

    await act(() => result.current.exportRows("csv"));

    expect(result.current.exportError).toContain("10,001");
    expect(exportAll).not.toHaveBeenCalled();
  });

  it("drops the export quietly when the query it waits for is replaced", async () => {
    const { data, exportAll } = repository();
    const { result } = renderHook(() =>
      useResourceCollectionExport(
        options(data, {
          isPlaceholderData: true,
          currentTotal: () => Promise.reject(new CancelledError()),
        }),
      ),
    );

    await act(() => result.current.exportRows("csv"));

    expect(result.current.exportError).toBeNull();
    expect(exportAll).not.toHaveBeenCalled();
    expect(downloadResourceExport).not.toHaveBeenCalled();
  });

  it("reports the current query's failed read as the export error", async () => {
    const { data, exportAll } = repository();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = renderHook(() =>
      useResourceCollectionExport(
        options(data, {
          isPlaceholderData: true,
          currentTotal: () =>
            Promise.reject(
              new Error("Too many data requests. Please try again shortly."),
            ),
        }),
      ),
    );

    await act(() => result.current.exportRows("csv"));

    expect(result.current.exportError).toBe(
      "Too many data requests. Please try again shortly.",
    );
    expect(exportAll).not.toHaveBeenCalled();
  });

  it("exports selected rows without waiting for the current total", async () => {
    const { data, selected } = repository();
    selected.mockResolvedValue({ rows: [{ genome_id: "7" }] });
    const currentTotal = vi.fn(() => new Promise<number>(() => undefined));
    const { result } = renderHook(() =>
      useResourceCollectionExport(
        options(data, { isPlaceholderData: true, currentTotal }),
      ),
    );

    await act(() => result.current.exportRows("csv", ["7"]));

    expect(currentTotal).not.toHaveBeenCalled();
    expect(downloadResourceExport).toHaveBeenCalledWith(
      "genome",
      [{ genome_id: "7" }],
      columns,
      ["genome_id", "genome_name"],
      "csv",
      "all",
      "genome",
    );
  });

  it("refuses a read that stops at the export cap when more rows match than it read", async () => {
    // A same-query refresh keeps the total it had, and the data can outgrow it, so
    // a read that stops at the cap is counted again: 10,000 rows may be the first
    // 10,000 of more.
    const { data, exportAll, collection } = repository();
    exportAll.mockResolvedValue({
      rows: Array.from({ length: maxExportRows }, (_, index) => ({
        genome_id: String(index),
      })),
    });
    collection.mockResolvedValue({ total: 10_412 });
    const { result } = renderHook(() =>
      useResourceCollectionExport(options(data, { total: 9_000 })),
    );

    await act(() => result.current.exportRows("csv"));

    expect(collection).toHaveBeenCalledWith("genome", {
      rql: "eq(owner,public)",
      keyword: "coli",
      keywordMode: undefined,
      pageSize: 1,
      fields: ["genome_id"],
    });
    expect(result.current.exportError).toBe(
      "This export matches 10,412 rows. Narrow the results to 10,000 rows or fewer and try again.",
    );
    expect(downloadResourceExport).not.toHaveBeenCalled();
  });

  it("downloads a read that stops at the export cap when it read every match", async () => {
    const { data, exportAll, collection } = repository();
    const rows = Array.from({ length: maxExportRows }, (_, index) => ({
      genome_id: String(index),
    }));
    exportAll.mockResolvedValue({ rows });
    collection.mockResolvedValue({ total: maxExportRows });
    const { result } = renderHook(() =>
      useResourceCollectionExport(options(data, { total: 9_000 })),
    );

    await act(() => result.current.exportRows("csv"));

    expect(result.current.exportError).toBeNull();
    expect(downloadResourceExport).toHaveBeenCalledWith(
      "genome",
      rows,
      columns,
      ["genome_id", "genome_name"],
      "csv",
      "all",
      "genome",
    );
  });

  it("downloads a read that outgrew the count but stayed under the export cap", async () => {
    const { data, exportAll, collection } = repository();
    const rows = [{ genome_id: "1" }, { genome_id: "2" }, { genome_id: "3" }];
    exportAll.mockResolvedValue({ rows });
    const { result } = renderHook(() =>
      useResourceCollectionExport(options(data, { total: 2 })),
    );

    await act(() => result.current.exportRows("csv"));

    expect(collection).not.toHaveBeenCalled();
    expect(result.current.exportError).toBeNull();
    expect(downloadResourceExport).toHaveBeenCalledWith(
      "genome",
      rows,
      columns,
      ["genome_id", "genome_name"],
      "csv",
      "all",
      "genome",
    );
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
