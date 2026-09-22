import { act, renderHook } from "@testing-library/react";
import type { DataRepository } from "@/lib/data-api";
import { maxSelectedRows } from "@/lib/data-api/validation";
import { useResourceCollectionRowResolution } from "../use-resource-collection-row-resolution";

function options(
  repository: DataRepository,
  overrides: Partial<
    Parameters<typeof useResourceCollectionRowResolution>[0]
  > = {},
) {
  return {
    repository,
    resource: "genome" as const,
    idField: "genome_id",
    label: "Genomes",
    displayedRows: [{ genome_id: "1", genome_name: "First" }],
    displayedSelectedIds: ["1"],
    selectedActionCount: 1,
    isAllPagesSelected: false,
    hasLoadedKeyword: false,
    isRefreshing: false,
    rql: "eq(owner,public)",
    keyword: "coli",
    keywordMode: "exact" as const,
    sort: { field: "genome_name", direction: "asc" as const },
    ...overrides,
  };
}

function repository() {
  const selected = vi.fn();
  const exportAll = vi.fn();
  return {
    data: { selected, exportAll } as unknown as DataRepository,
    selected,
    exportAll,
  };
}

describe("useResourceCollectionRowResolution", () => {
  it("remembers selected rows after paging away and drops deselected rows", () => {
    const { data } = repository();
    const { result, rerender } = renderHook(
      ({ displayedRows }) =>
        useResourceCollectionRowResolution(
          options(data, { displayedRows, displayedSelectedIds: ["1"] }),
        ),
      {
        initialProps: { displayedRows: [{ genome_id: "1", exp_id: "exp-1" }] },
      },
    );

    act(() => {
      result.current.rememberSelectedRows({ "1": true });
    });
    rerender({ displayedRows: [{ genome_id: "2", exp_id: "exp-2" }] });
    expect(result.current.rowById("1")).toEqual({
      genome_id: "1",
      exp_id: "exp-1",
    });

    act(() => {
      result.current.rememberSelectedRows({});
    });
    expect(result.current.rowById("1")).toBeUndefined();
  });

  it("batches selected rows, includes the identity field, and restores selection order", async () => {
    const ids = Array.from({ length: maxSelectedRows + 1 }, (_, index) =>
      String(index),
    );
    const selected = vi.fn(
      (_resource: string, request: { ids: string[]; fields: string[] }) =>
        Promise.resolve({
          rows: [...request.ids].reverse().map((genome_id) => ({ genome_id })),
        }),
    );
    const data = {
      selected,
      exportAll: vi.fn(),
    } as unknown as DataRepository;
    const { result } = renderHook(() =>
      useResourceCollectionRowResolution(
        options(data, {
          displayedRows: [],
          displayedSelectedIds: ids,
          selectedActionCount: ids.length,
        }),
      ),
    );

    const rows = await result.current.resolveActionRows(
      ["genome_name"],
      ids.length,
      "Copy",
    );

    expect(selected).toHaveBeenCalledTimes(2);
    expect(selected.mock.calls.map((call) => call[1].fields)).toEqual([
      ["genome_name", "genome_id"],
      ["genome_name", "genome_id"],
    ]);
    expect(selected.mock.calls[0]?.[1]).toMatchObject({
      fields: ["genome_name", "genome_id"],
    });
    expect(rows.map((row) => row.genome_id)).toEqual(ids);
  });

  it("guards action limits before fetching and blocks stale all-pages results", async () => {
    const { data, selected, exportAll } = repository();
    const limited = renderHook(() =>
      useResourceCollectionRowResolution(
        options(data, { selectedActionCount: 3 }),
      ),
    );
    await expect(
      limited.result.current.resolveActionRows([], 2, "Copy"),
    ).rejects.toThrow("Copy supports at most 2 Genomes");

    const refreshing = renderHook(() =>
      useResourceCollectionRowResolution(
        options(data, { isAllPagesSelected: true, isRefreshing: true }),
      ),
    );
    await expect(
      refreshing.result.current.resolveActionRows(["genome_id"], 10, "Copy"),
    ).rejects.toThrow("finish loading");
    expect(selected).not.toHaveBeenCalled();
    expect(exportAll).not.toHaveBeenCalled();
  });

  it("resolves all matching rows with the shell query", async () => {
    const { data, exportAll } = repository();
    exportAll.mockResolvedValue({ rows: [{ genome_id: "1" }] });
    const { result } = renderHook(() =>
      useResourceCollectionRowResolution(
        options(data, { isAllPagesSelected: true }),
      ),
    );

    await expect(
      result.current.resolveActionRows(["genome_id"], 10, "Copy"),
    ).resolves.toEqual([{ genome_id: "1" }]);
    expect(exportAll).toHaveBeenCalledWith("genome", {
      rql: "eq(owner,public)",
      keyword: "coli",
      keywordMode: "exact",
      fields: ["genome_id"],
      sort: { field: "genome_name", direction: "asc" },
    });
  });
});
