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
