import { Suspense, startTransition, useState } from "react";
import type { RowSelectionState } from "@tanstack/react-table";
import * as reactVirtual from "@tanstack/react-virtual";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createPendingNavigation } from "@/test-helpers/pending-navigation";
import { DataTable, type DataTableProps } from "../data-table";
import { DataTableFooter } from "../data-table-footer";
import { DataTableHeader } from "../data-table-header";
import { formatCellValue } from "../data-table-utils";

// A virtualizer whose visible window the test moves: the range lives in a store
// read through useSyncExternalStore, so a change re-renders only the component
// that called useVirtualizer, as a real scroll tick does.
vi.mock("@tanstack/react-virtual", async () => {
  const { useSyncExternalStore } = await import("react");
  let range = { start: 0, end: 10 };
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  return {
    useVirtualizer: ({
      count,
      estimateSize,
    }: {
      count: number;
      estimateSize: () => number;
    }) => {
      const current = useSyncExternalStore(subscribe, () => range);
      const size = estimateSize();
      const end = Math.min(count, current.end);
      return {
        getVirtualItems: () =>
          Array.from(
            { length: Math.max(0, end - current.start) },
            (_, offset) => {
              const index = current.start + offset;
              return {
                index,
                start: index * size,
                size,
                end: (index + 1) * size,
                key: index,
                lane: 0,
              };
            },
          ),
        getTotalSize: () => count * size,
        measure: vi.fn(),
      };
    },
    setVisibleRange: (start: number, end: number) => {
      range = { start, end };
      for (const listener of listeners) listener();
    },
  };
});

vi.mock("../data-table-header", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data-table-header")>();
  return { ...actual, DataTableHeader: vi.fn(actual.DataTableHeader) };
});

vi.mock("../data-table-footer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data-table-footer")>();
  return { ...actual, DataTableFooter: vi.fn(actual.DataTableFooter) };
});

vi.mock("../data-table-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data-table-utils")>();
  return { ...actual, formatCellValue: vi.fn(actual.formatCellValue) };
});

const { setVisibleRange } = reactVirtual as unknown as {
  setVisibleRange: (start: number, end: number) => void;
};

function moveWindow(start: number, end: number) {
  act(() => {
    setVisibleRange(start, end);
  });
}

const columns = [
  { id: "strain_name", label: "Strain Name" },
  { id: "host", label: "Host" },
  { id: "country", label: "Country" },
];
const dataCellsPerRow = columns.length;
const visibleRowCount = 10;

const rows = Array.from({ length: 30 }, (_, index) => ({
  genome_id: `100.${String(index)}`,
  strain_name: `Strain ${String(index)}`,
  host: `Host ${String(index)}`,
  country: `Country ${String(index)}`,
}));

function ControlledTable(
  props: Partial<Omit<DataTableProps, "rowSelection" | "onRowSelectionChange">>,
) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  return (
    <DataTable
      id="render-scope"
      data={rows}
      columns={columns}
      totalItems={rows.length}
      resource="genome"
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
      {...props}
    />
  );
}

function rowOf(index: number) {
  const row = screen.getByText(`Strain ${String(index)}`).closest("tr");
  if (!row) throw new Error(`Row ${String(index)} must be a table row`);
  return row;
}

function checkboxOf(index: number) {
  return screen.getByRole("checkbox", {
    name: `Select row 100.${String(index)}`,
  });
}

function selectedIndexes() {
  return rows.flatMap((_, index) => {
    const checkbox = screen.queryByRole("checkbox", {
      name: `Select row 100.${String(index)}`,
    });
    return checkbox && (checkbox as HTMLInputElement).checked ? [index] : [];
  });
}

function formatCalls() {
  return vi.mocked(formatCellValue).mock.calls.length;
}

function cellTexts(index: number) {
  return within(rowOf(index))
    .getAllByRole("cell")
    .map((cell) => cell.textContent);
}

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  };
});

beforeEach(() => {
  moveWindow(0, visibleRowCount);
});

describe("DataTable scrolling", () => {
  it("renders the rows entering the window without re-rendering the header or footer", () => {
    render(<ControlledTable />);
    expect(screen.getByText("Strain 0")).toBeInTheDocument();
    const headerRenders = vi.mocked(DataTableHeader).mock.calls.length;
    const footerRenders = vi.mocked(DataTableFooter).mock.calls.length;
    expect(headerRenders).toBeGreaterThan(0);
    expect(footerRenders).toBeGreaterThan(0);

    moveWindow(15, 15 + visibleRowCount);

    expect(screen.getByText("Strain 15")).toBeInTheDocument();
    expect(screen.getByText("Strain 24")).toBeInTheDocument();
    expect(screen.queryByText("Strain 0")).not.toBeInTheDocument();
    expect(vi.mocked(DataTableHeader).mock.calls).toHaveLength(headerRenders);
    expect(vi.mocked(DataTableFooter).mock.calls).toHaveLength(footerRenders);
  });

  it("formats only the rows that enter the window", () => {
    render(<ControlledTable />);
    const before = formatCalls();

    // Five rows leave and five enter; the five that stay keep their cells.
    moveWindow(5, 5 + visibleRowCount);

    expect(formatCalls() - before).toBe(5 * dataCellsPerRow);
  });
});

describe("DataTable row selection render scope", () => {
  it("re-renders only the clicked row", () => {
    render(<ControlledTable />);
    const before = formatCalls();

    fireEvent.click(rowOf(2));

    expect(selectedIndexes()).toEqual([2]);
    expect(formatCalls() - before).toBeLessThanOrEqual(dataCellsPerRow);
  });

  it("re-renders only the clicked row and the one it deselects", () => {
    render(<ControlledTable />);
    fireEvent.click(rowOf(2));
    const before = formatCalls();

    // Row 2's `selected` turns false, so it renders again beside row 5.
    fireEvent.click(rowOf(5));

    expect(selectedIndexes()).toEqual([5]);
    expect(formatCalls() - before).toBeLessThanOrEqual(2 * dataCellsPerRow);
    expect(formatCalls() - before).toBeLessThan(
      visibleRowCount * dataCellsPerRow,
    );
  });
});

describe("DataTable row checkboxes", () => {
  it("keeps the earlier selection when a second checkbox is ticked", () => {
    render(<ControlledTable />);
    fireEvent.click(checkboxOf(2));
    fireEvent.click(checkboxOf(5));

    expect(selectedIndexes()).toEqual([2, 5]);
  });
});

describe("DataTable modifier keys", () => {
  it("selects the exclusive range on a shift-click after a plain click", () => {
    render(<ControlledTable />);
    fireEvent.click(rowOf(7));
    fireEvent.click(rowOf(1), { metaKey: true });
    expect(selectedIndexes()).toEqual([1, 7]);

    // The range from the anchor (row 1) replaces the selection, row 7 too.
    fireEvent.click(rowOf(4), { shiftKey: true });

    expect(selectedIndexes()).toEqual([1, 2, 3, 4]);
  });

  it.each([["metaKey"], ["ctrlKey"]])(
    "toggles a row on a %s click",
    (modifier) => {
      render(<ControlledTable />);
      fireEvent.click(rowOf(1));
      fireEvent.click(rowOf(3), { [modifier]: true });
      expect(selectedIndexes()).toEqual([1, 3]);

      fireEvent.click(rowOf(3), { [modifier]: true });
      expect(selectedIndexes()).toEqual([1]);
    },
  );

  it("adds the inclusive range on a shift-click of a checkbox", () => {
    render(<ControlledTable />);
    fireEvent.click(rowOf(8));
    fireEvent.click(checkboxOf(1));
    fireEvent.click(checkboxOf(4), { shiftKey: true });

    expect(selectedIndexes()).toEqual([1, 2, 3, 4, 8]);
  });

  it("prevents a text selection from starting on a modifier press", () => {
    render(<ControlledTable />);

    expect(fireEvent.mouseDown(rowOf(1), { shiftKey: true })).toBe(false);
    expect(fireEvent.mouseDown(rowOf(1), { metaKey: true })).toBe(false);
    expect(fireEvent.mouseDown(rowOf(1), { ctrlKey: true })).toBe(false);
    expect(fireEvent.mouseDown(rowOf(1))).toBe(true);
  });

  it.each([["shiftKey"], ["metaKey"], ["ctrlKey"]])(
    "still focuses the scroll region, without scrolling it, on a %s press",
    (modifier) => {
      const focus = vi.spyOn(HTMLElement.prototype, "focus");
      try {
        render(<ControlledTable />);
        const region = screen.getByRole("region");

        fireEvent.mouseDown(rowOf(1), { [modifier]: true });

        expect(document.activeElement).toBe(region);
        expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
      } finally {
        focus.mockRestore();
      }
    },
  );

  it("focuses the checkbox, without scrolling, on a shift-press of a checkbox", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    try {
      render(<ControlledTable />);

      fireEvent.mouseDown(checkboxOf(1), { shiftKey: true });

      expect(document.activeElement).toBe(checkboxOf(1));
      expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    } finally {
      focus.mockRestore();
    }
  });

  it("focuses the link, without scrolling, on a meta-press of a link in a cell", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    try {
      render(
        <ControlledTable
          columns={[
            {
              ...columns[0],
              href: (row) => `/genome/${String(row.genome_id)}`,
            },
            ...columns.slice(1),
          ]}
        />,
      );
      const link = screen.getByRole("link", { name: "Strain 1" });

      fireEvent.mouseDown(link, { metaKey: true });

      expect(document.activeElement).toBe(link);
      expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    } finally {
      focus.mockRestore();
    }
  });

  it("renders nothing when Shift is pressed and released", async () => {
    const user = userEvent.setup();
    render(<ControlledTable />);
    const before = formatCalls();
    const headerRenders = vi.mocked(DataTableHeader).mock.calls.length;
    const footerRenders = vi.mocked(DataTableFooter).mock.calls.length;

    await user.keyboard("{Shift}");
    await user.keyboard("{Control}");
    await user.keyboard("{Meta}");

    expect(formatCalls()).toBe(before);
    expect(vi.mocked(DataTableHeader).mock.calls).toHaveLength(headerRenders);
    expect(vi.mocked(DataTableFooter).mock.calls).toHaveLength(footerRenders);
  });
});

describe("DataTable data changes", () => {
  it("re-renders rows whose data objects change under the same ids", () => {
    const { rerender } = render(<ControlledTable />);
    const before = formatCalls();

    const refreshed = rows.map((row) => ({
      ...row,
      strain_name: `${row.strain_name} (new)`,
    }));
    rerender(<ControlledTable data={refreshed} />);

    expect(screen.getByText("Strain 0 (new)")).toBeInTheDocument();
    expect(screen.getByText("Strain 9 (new)")).toBeInTheDocument();
    expect(formatCalls() - before).toBe(visibleRowCount * dataCellsPerRow);
  });

  // A transition can render new data (useTable hands it to the table during
  // render) and then suspend, leaving the old rows on screen. A click on one
  // of them names a row the table no longer has.
  it("ignores a click on a row the table no longer has", () => {
    const pending = createPendingNavigation();
    const onGenomeSelect = vi.fn();
    function SwappingTable() {
      const [data, setData] = useState(rows);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              startTransition(() => {
                setData(
                  rows.map((row) => ({
                    ...row,
                    genome_id: `200.${row.genome_id}`,
                  })),
                );
                pending.arm();
              });
            }}
          >
            Swap data
          </button>
          <Suspense fallback={null}>
            <ControlledTable data={data} onGenomeSelect={onGenomeSelect} />
            <pending.Suspender />
          </Suspense>
        </>
      );
    }
    render(<SwappingTable />);
    const staleRow = rowOf(2);

    fireEvent.click(screen.getByRole("button", { name: "Swap data" }));
    expect(staleRow).toBeInTheDocument();

    fireEvent.click(staleRow);
    fireEvent.click(checkboxOf(3).closest("td") as HTMLElement);
    fireEvent.click(checkboxOf(4));

    expect(onGenomeSelect).not.toHaveBeenCalled();
    expect(selectedIndexes()).toEqual([]);
  });
});

describe("DataTable column changes reach the memoized rows", () => {
  it("drops a hidden column's cells", () => {
    const { rerender } = render(<ControlledTable />);
    expect(cellTexts(0)).toEqual(["", "Strain 0", "Host 0", "Country 0"]);

    rerender(<ControlledTable columnVisibility={{ host: false }} />);

    expect(cellTexts(0)).toEqual(["", "Strain 0", "Country 0"]);
  });

  it("renders cells in the new column order", () => {
    const { rerender } = render(
      <ControlledTable
        columnOrder={["__select__", "strain_name", "host", "country"]}
        onColumnOrderChange={vi.fn()}
      />,
    );
    expect(cellTexts(0)).toEqual(["", "Strain 0", "Host 0", "Country 0"]);

    rerender(
      <ControlledTable
        columnOrder={["__select__", "country", "strain_name", "host"]}
        onColumnOrderChange={vi.fn()}
      />,
    );

    expect(cellTexts(0)).toEqual(["", "Country 0", "Strain 0", "Host 0"]);
  });

  // Object keys that look like array indices iterate in numeric order, not
  // insertion order, so the row signature must follow the headers.
  it("renders cells in the new order of integer-like column ids", () => {
    const numericColumns = [
      { id: "1", label: "One" },
      { id: "2", label: "Two" },
    ];
    const numericRows = rows.map((row, index) => ({
      genome_id: row.genome_id,
      "1": `One ${String(index)}`,
      "2": `Two ${String(index)}`,
    }));
    const firstRowTexts = () =>
      within(screen.getByText("One 0").closest("tr") as HTMLElement)
        .getAllByRole("cell")
        .map((cell) => cell.textContent);
    const { rerender } = render(
      <ControlledTable
        data={numericRows}
        columns={numericColumns}
        columnOrder={["__select__", "1", "2"]}
        onColumnOrderChange={vi.fn()}
      />,
    );
    expect(firstRowTexts()).toEqual(["", "One 0", "Two 0"]);

    rerender(
      <ControlledTable
        data={numericRows}
        columns={numericColumns}
        columnOrder={["__select__", "2", "1"]}
        onColumnOrderChange={vi.fn()}
      />,
    );

    expect(firstRowTexts()).toEqual(["", "Two 0", "One 0"]);
  });

  it("sizes the cells from a committed resize", async () => {
    const onColumnWidthsCommit = vi.fn();
    render(
      <ControlledTable
        savedColumnWidths={{ strain_name: 333 }}
        onColumnWidthsCommit={onColumnWidthsCommit}
      />,
    );
    const cell = screen.getByText("Strain 0").closest("td");
    await vi.waitFor(() => {
      expect(cell?.style.getPropertyValue("--col-size")).toBe("333px");
    });

    fireEvent.keyDown(
      screen.getByRole("separator", { name: "Resize strain_name column" }),
      { key: "ArrowRight" },
    );

    await vi.waitFor(() => {
      expect(onColumnWidthsCommit).toHaveBeenCalledWith({ strain_name: 343 });
    });
    expect(
      screen
        .getByText("Strain 0")
        .closest("td")
        ?.style.getPropertyValue("--col-size"),
    ).toBe("343px");
  });
});
