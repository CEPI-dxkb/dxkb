import { act, renderHook } from "@testing-library/react";
import { CancelledError } from "@tanstack/react-query";
import { maxExportRows, type DataRepository } from "@/lib/data-api";
import { maxSelectedRows } from "@/lib/data-api/validation";
import {
  exceedsReadLimit,
  useResourceCollectionRowResolution,
} from "../use-resource-collection-row-resolution";

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
    isPlaceholderData: false,
    currentTotal: vi.fn(() => Promise.resolve(1)),
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
  const collection = vi.fn();
  return {
    data: { selected, exportAll, collection } as unknown as DataRepository,
    selected,
    exportAll,
    collection,
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

  it("guards action limits before fetching", async () => {
    const { data, selected, exportAll } = repository();
    const { result } = renderHook(() =>
      useResourceCollectionRowResolution(
        options(data, { selectedActionCount: 3 }),
      ),
    );
    await expect(
      result.current.resolveActionRows([], 2, "Copy"),
    ).rejects.toThrow("Copy supports at most 2 Genomes");
    expect(selected).not.toHaveBeenCalled();
    expect(exportAll).not.toHaveBeenCalled();
  });

  it("waits for the current query's total before reading every matching row", async () => {
    // A previous query's 50,000 rows are on screen; this query matches 2.
    const { data, exportAll } = repository();
    exportAll.mockResolvedValue({
      rows: [{ genome_id: "1" }, { genome_id: "2" }],
    });
    const total = Promise.withResolvers<number>();
    const { result } = renderHook(() =>
      useResourceCollectionRowResolution(
        options(data, {
          isAllPagesSelected: true,
          isPlaceholderData: true,
          selectedActionCount: 50_000,
          currentTotal: () => total.promise,
        }),
      ),
    );

    const resolved = result.current.resolveActionRows(["genome_id"], 10, "Copy");
    await Promise.resolve();
    expect(exportAll).not.toHaveBeenCalled();

    total.resolve(2);
    await expect(resolved).resolves.toEqual([
      { genome_id: "1" },
      { genome_id: "2" },
    ]);
    expect(exportAll).toHaveBeenCalledOnce();
  });

  it("applies the action limit to the current query's total, not a previous query's", async () => {
    // A previous query's 1 row is on screen; this query matches 50.
    const { data, exportAll } = repository();
    const { result } = renderHook(() =>
      useResourceCollectionRowResolution(
        options(data, {
          isAllPagesSelected: true,
          isPlaceholderData: true,
          selectedActionCount: 1,
          currentTotal: () => Promise.resolve(50),
        }),
      ),
    );

    await expect(
      result.current.resolveActionRows(["genome_id"], 10, "Copy"),
    ).rejects.toThrow("Copy supports at most 10 Genomes");
    expect(exportAll).not.toHaveBeenCalled();
  });

  it("rejects with CancelledError when the query it waits for is replaced", async () => {
    const { data, exportAll } = repository();
    const { result } = renderHook(() =>
      useResourceCollectionRowResolution(
        options(data, {
          isAllPagesSelected: true,
          isPlaceholderData: true,
          currentTotal: () => Promise.reject(new CancelledError()),
        }),
      ),
    );

    await expect(
      result.current.resolveActionRows(["genome_id"], 10, "Copy"),
    ).rejects.toBeInstanceOf(CancelledError);
    expect(exportAll).not.toHaveBeenCalled();
  });

  it("reads every matching row while the rows belong to a previous query", async () => {
    // The Taxonomy and Bioset workflows size this read themselves, against the
    // current query's total, before they call it.
    const { data, exportAll } = repository();
    exportAll.mockResolvedValue({ rows: [{ taxon_id: 561 }] });
    const { result } = renderHook(() =>
      useResourceCollectionRowResolution(
        options(data, { isAllPagesSelected: true, isPlaceholderData: true }),
      ),
    );

    await expect(
      result.current.resolveAllMatchingRows(["taxon_id"]),
    ).resolves.toEqual({ rows: [{ taxon_id: 561 }], total: 1 });
  });

  it("still resolves an explicit selection while the rows refresh", async () => {
    const { data, selected } = repository();
    selected.mockResolvedValue({ rows: [{ genome_id: "1" }] });
    const currentTotal = vi.fn(() => new Promise<number>(() => undefined));
    const { result } = renderHook(() =>
      useResourceCollectionRowResolution(
        options(data, { isPlaceholderData: true, currentTotal }),
      ),
    );

    // The user's own IDs do not depend on which query's rows are on screen.
    await expect(
      result.current.resolveActionRows(["genome_id"], 10, "Copy"),
    ).resolves.toEqual([{ genome_id: "1" }]);
    expect(currentTotal).not.toHaveBeenCalled();
  });

  it("refuses an all-matching read that returns more rows than the action allows", async () => {
    // The count passed the limit, but it is the total on screen, which the data
    // can outgrow during a same-query refresh or with none at all.
    const { data, exportAll } = repository();
    exportAll.mockResolvedValue({
      rows: [{ genome_id: "1" }, { genome_id: "2" }, { genome_id: "3" }],
    });
    const { result } = renderHook(() =>
      useResourceCollectionRowResolution(
        options(data, { isAllPagesSelected: true, selectedActionCount: 2 }),
      ),
    );

    await expect(
      result.current.resolveActionRows(["genome_id"], 2, "Copy"),
    ).rejects.toThrow("Copy supports at most 2 Genomes");
  });

  it("refuses an all-matching read that stops at the export cap when more rows match than it read", async () => {
    const { data, exportAll, collection } = repository();
    exportAll.mockResolvedValue({
      rows: Array.from({ length: maxExportRows }, (_, index) => ({
        genome_id: String(index),
      })),
    });
    collection.mockResolvedValue({ total: 10_412 });
    const { result } = renderHook(() =>
      useResourceCollectionRowResolution(
        options(data, { isAllPagesSelected: true, selectedActionCount: 9_000 }),
      ),
    );

    await expect(
      result.current.resolveActionRows(["genome_id"], maxExportRows, "Copy"),
    ).rejects.toThrow("Copy supports at most 10,000 Genomes");
    expect(collection).toHaveBeenCalledWith("genome", {
      rql: "eq(owner,public)",
      keyword: "coli",
      keywordMode: "exact",
      pageSize: 1,
      fields: ["genome_id"],
    });
  });

  it("resolves an all-matching read that stops at the export cap when it read every match", async () => {
    // The total on screen said fewer, but the cap alone does not mean rows were
    // left out: a fresh count of the query decides.
    const { data, exportAll, collection } = repository();
    const rows = Array.from({ length: maxExportRows }, (_, index) => ({
      genome_id: String(index),
    }));
    exportAll.mockResolvedValue({ rows });
    collection.mockResolvedValue({ total: maxExportRows });
    const { result } = renderHook(() =>
      useResourceCollectionRowResolution(
        options(data, { isAllPagesSelected: true, selectedActionCount: 9_000 }),
      ),
    );

    await expect(
      result.current.resolveActionRows(["genome_id"], maxExportRows, "Copy"),
    ).resolves.toEqual(rows);
  });

  it("resolves all matching rows with the shell query", async () => {
    const { data, exportAll, collection } = repository();
    exportAll.mockResolvedValue({ rows: [{ genome_id: "1" }] });
    const currentTotal = vi.fn(() => new Promise<number>(() => undefined));
    const { result } = renderHook(() =>
      useResourceCollectionRowResolution(
        options(data, { isAllPagesSelected: true, currentTotal }),
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
    expect(collection).not.toHaveBeenCalled();
    // The total on screen is this query's, so nothing waits for another.
    expect(currentTotal).not.toHaveBeenCalled();
  });
});

describe("exceedsReadLimit", () => {
  it.each([
    // [rows read, rows matching, limit, over]
    [3, 3, 2, true],
    [2, 2, 2, false],
    [3, 3, 10, false],
    [maxExportRows, 10_412, maxExportRows, true],
    [maxExportRows, maxExportRows, maxExportRows, false],
  ])(
    "reads %i of %i matching rows against a limit of %i: over is %s",
    (rowCount, total, maxRows, over) => {
      const rows = Array.from({ length: rowCount }, () => ({}));
      expect(exceedsReadLimit({ rows, total }, maxRows)).toBe(over);
    },
  );
});
