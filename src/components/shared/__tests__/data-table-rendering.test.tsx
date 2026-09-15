import { useState } from "react";
import type { RowSelectionState } from "@tanstack/react-table";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable } from "../data-table";
import { formatCellValue } from "../data-table-utils";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    estimateSize,
  }: {
    count: number;
    estimateSize: () => number;
  }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * estimateSize(),
        size: estimateSize(),
        end: (index + 1) * estimateSize(),
        key: index,
        lane: 0,
      })),
    getTotalSize: () => count * estimateSize(),
    measure: vi.fn(),
  }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const columns = [{ id: "strain_name", label: "Strain Name", visible: true }];
const selectionRows = [
  { genome_id: "100.1", strain_name: "First" },
  { genome_id: "100.2", strain_name: "Second" },
  { genome_id: "100.3", strain_name: "Third" },
  { genome_id: "100.4", strain_name: "Fourth" },
];

function selectionCell(checkbox: HTMLElement) {
  const cell = checkbox.closest("td");
  if (!cell) throw new Error("Selection checkbox must be inside a table cell");
  return cell;
}

function ControlledSelectionTable({
  onGenomeSelect,
  onActiveRowChange,
  onRowSelectionChange,
}: {
  onGenomeSelect?: (id: string | null) => void;
  onActiveRowChange?: (id: string | null) => void;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
}) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const handleRowSelectionChange = (selection: RowSelectionState) => {
    setRowSelection(selection);
    onRowSelectionChange?.(selection);
  };
  return (
    <DataTable
      id="controlled-selection"
      data={selectionRows}
      columns={columns}
      totalItems={selectionRows.length}
      resource="genome"
      rowSelection={rowSelection}
      onRowSelectionChange={handleRowSelectionChange}
      onGenomeSelect={onGenomeSelect}
      onActiveRowChange={onActiveRowChange}
    />
  );
}

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  };
});

describe("DataTable shared view seams", () => {
  it("renders multivalue fields as individual links", () => {
    render(
      <DataTable
        id="multivalue-links"
        data={[{ id: "strain-1", genome_ids: ["100.1", "100/2"] }]}
        columns={[
          {
            id: "genome_ids",
            label: "Genome IDs",
            valueHref: "/genome/{value}",
          },
        ]}
        totalItems={1}
        resource="strain"
        idField="id"
      />,
    );

    expect(screen.getByRole("link", { name: "100.1" })).toHaveAttribute(
      "href",
      "/genome/100.1",
    );
    expect(screen.getByRole("link", { name: "100/2" })).toHaveAttribute(
      "href",
      "/genome/100%2F2",
    );
    const linkStrip = screen.getByRole("link", { name: "100.1" }).parentElement;
    expect(linkStrip).toHaveClass(
      "flex",
      "min-w-0",
      "overflow-x-auto",
      "whitespace-nowrap",
      "scrollbar-none",
    );
    expect(linkStrip).not.toHaveClass("flex-wrap");
    const firstLink = screen.getByRole("link", { name: "100.1" });
    expect(firstLink).toHaveClass("shrink-0");
    expect(firstLink.closest("td")).toHaveClass("p-0.5");
  });

  it("uses compact padding without making scalar cells nested scroll regions", () => {
    render(
      <DataTable
        id="compact-scalar-cell"
        data={[{ id: "strain-1", accession: "100/2" }]}
        columns={[
          {
            id: "accession",
            label: "Accession",
            valueHref: "https://example.test/{value}",
          },
        ]}
        totalItems={1}
        resource="strain"
        idField="id"
      />,
    );

    const cell = screen.getByRole("link", { name: "100/2" }).closest("td");
    expect(cell).toHaveClass("p-0.5");
    expect(cell).not.toHaveClass("overflow-x-auto", "scrollbar-none");
  });

  it("keeps selection cells padding-free", () => {
    render(
      <DataTable
        id="compact-selection-cell"
        data={[{ id: "strain-1", accession: "100/2" }]}
        columns={[{ id: "accession", label: "Accession" }]}
        totalItems={1}
        resource="strain"
        idField="id"
      />,
    );

    const checkbox = screen.getByRole("checkbox", {
      name: "Select row strain-1",
    });
    expect(checkbox.closest("td")).toHaveClass("p-0");
    expect(checkbox.closest("td")).not.toHaveClass("p-0.5");
  });

  it("renders a scalar value using its value link template", () => {
    render(
      <DataTable
        id="scalar-value-link"
        data={[{ id: "strain-1", accession: "100/2" }]}
        columns={[
          {
            id: "accession",
            label: "Accession",
            valueHref: "https://example.test/{value}",
          },
        ]}
        totalItems={1}
        resource="strain"
        idField="id"
      />,
    );

    expect(screen.getByRole("link", { name: "100/2" })).toHaveAttribute(
      "href",
      "https://example.test/100%2F2",
    );
  });

  it("renders repeated multivalue links without duplicate React keys", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(
      <DataTable
        id="repeated-multivalue-links"
        data={[{ id: "strain-1", accessions: ["PX806884", "PX806884"] }]}
        columns={[
          {
            id: "accessions",
            label: "Accessions",
            valueHref: "https://example.test/{value}",
          },
        ]}
        totalItems={1}
        resource="strain"
        idField="id"
      />,
    );

    expect(screen.getAllByRole("link", { name: "PX806884" })).toHaveLength(1);
    expect(
      consoleError.mock.calls.some((call) =>
        call.some(
          (argument) =>
            typeof argument === "string" && argument.includes("same key"),
        ),
      ),
    ).toBe(false);
    consoleError.mockRestore();
  });

  it("uses an explicit row identity, named focusable region, links, and pagination semantics", () => {
    render(
      <DataTable
        id="shared-seams"
        data={[{ stable_id: "row-1", public_id: "ABC" }]}
        columns={[
          {
            id: "public_id",
            label: "Public ID",
            href: (row) => `/feature/${String(row.public_id)}`,
          },
        ]}
        totalItems={201}
        resource="unregistered-resource"
        idField="stable_id"
        pageIndex={0}
        pageSize={200}
      />,
    );

    expect(
      screen.getByRole("region", { name: "unregistered-resource results" }),
    ).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("link", { name: "ABC" })).toHaveAttribute(
      "href",
      "/feature/ABC",
    );
    expect(
      screen.getByRole("columnheader", { name: /Public ID/ }),
    ).toHaveAttribute("aria-sort", "none");
    expect(screen.getByRole("button", { name: "1" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("navigation", {
        name: "unregistered-resource results pagination",
      }),
    ).toBeInTheDocument();
  });

  it("renders a linked fallback value when the link column is missing", () => {
    render(
      <DataTable
        id="fallback-link"
        data={[{ stable_id: "row-1", feature_id: "fig|83332.12.peg.1" }]}
        columns={[
          {
            id: "patric_id",
            label: "BRC ID",
            valueHref: "/feature/{value}",
            fallbackValue: (row) => row.feature_id,
          },
        ]}
        totalItems={1}
        resource="unregistered-resource"
        idField="stable_id"
        pageIndex={0}
        pageSize={200}
      />,
    );

    expect(
      screen.getByRole("link", { name: "fig|83332.12.peg.1" }),
    ).toHaveAttribute("href", "/feature/fig%7C83332.12.peg.1");
  });

  it("delegates selected exports without fetching", async () => {
    const user = userEvent.setup();
    const onDownloadSelected = vi.fn();
    render(
      <DataTable
        id="selected-export"
        data={[{ stable_id: "row-1", value: "A" }]}
        columns={[{ id: "value", label: "Value" }]}
        totalItems={1}
        resource="unregistered-resource"
        idField="stable_id"
        selectedIds={["row-1"]}
        onDownloadSelected={onDownloadSelected}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Download Selected \(CSV\)/i }),
    );
    expect(onDownloadSelected).toHaveBeenCalledWith("csv", ["row-1"], null);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Download Selected \(CSV\)/i }),
      ).toBeEnabled();
    });
    expect(screen.queryByText("Downloading...")).not.toBeInTheDocument();
  });
});

describe("DataTable row selection checkboxes", () => {
  it("keeps each checkbox checked when multiple rows are selected", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        id="selection"
        data={[
          { genome_id: "100.1", strain_name: "First" },
          { genome_id: "100.2", strain_name: "Second" },
        ]}
        columns={columns}
        totalItems={2}
        resource="genome"
      />,
    );

    const first = screen.getByRole("checkbox", { name: "Select row 100.1" });
    const second = screen.getByRole("checkbox", { name: "Select row 100.2" });
    await user.click(first);
    await user.click(second);

    expect(first).toBeChecked();
    expect(second).toBeChecked();
  });

  it("uses checkbox toggle semantics when clicking anywhere in the selection cell", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        id="selection-cell"
        data={[
          { genome_id: "100.1", strain_name: "First" },
          { genome_id: "100.2", strain_name: "Second" },
        ]}
        columns={columns}
        totalItems={2}
        resource="genome"
      />,
    );

    const first = screen.getByRole("checkbox", { name: "Select row 100.1" });
    const second = screen.getByRole("checkbox", { name: "Select row 100.2" });
    const firstCell = selectionCell(first);
    const secondCell = selectionCell(second);

    await user.click(firstCell);
    await user.click(secondCell);
    expect(first).toBeChecked();
    expect(second).toBeChecked();

    await user.click(firstCell);
    expect(first).not.toBeChecked();
    expect(second).toBeChecked();
  });

  it("does not double-toggle and removes deselected row keys", async () => {
    const user = userEvent.setup();
    const onRowSelectionChange = vi.fn();
    render(
      <ControlledSelectionTable onRowSelectionChange={onRowSelectionChange} />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Select row 100.1" });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(onRowSelectionChange).toHaveBeenLastCalledWith({ "100.1": true });

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(onRowSelectionChange).toHaveBeenLastCalledWith({});
  });

  it("updates controlled selection when checkbox cells are clicked", async () => {
    const user = userEvent.setup();
    render(<ControlledSelectionTable />);

    const first = screen.getByRole("checkbox", { name: "Select row 100.1" });
    const second = screen.getByRole("checkbox", { name: "Select row 100.2" });
    await user.click(selectionCell(first));
    await user.click(selectionCell(second));

    expect(first).toBeChecked();
    expect(second).toBeChecked();
  });

  it("marks partial page selection indeterminate but not full page selection", async () => {
    const user = userEvent.setup();
    render(<ControlledSelectionTable />);

    await user.click(
      screen.getByRole("checkbox", { name: "Select row 100.1" }),
    );
    const partialSelection = screen.getByRole("checkbox", {
      name: "Select all rows on this page",
    });
    expect(partialSelection).toBePartiallyChecked();

    await user.click(partialSelection);
    const fullSelection = screen.getByRole("checkbox", {
      name: "Deselect all rows on this page",
    });
    expect(fullSelection).toBeChecked();
    expect(fullSelection).not.toBePartiallyChecked();
  });

  it.each([
    ["checkbox", (checkbox: HTMLElement) => checkbox],
    ["selection cell", selectionCell],
  ])(
    "shift-clicking the %s adds the inclusive range",
    async (_label, targetFor) => {
      const user = userEvent.setup();
      render(<ControlledSelectionTable />);

      const first = screen.getByRole("checkbox", { name: "Select row 100.1" });
      const fourth = screen.getByRole("checkbox", { name: "Select row 100.4" });
      await user.click(targetFor(first));
      await user.keyboard("{Shift>}");
      await user.click(targetFor(fourth));
      await user.keyboard("{/Shift}");

      for (const row of selectionRows) {
        expect(
          screen.getByRole("checkbox", { name: `Select row ${row.genome_id}` }),
        ).toBeChecked();
      }
    },
  );

  it.each([
    ["checkbox", (checkbox: HTMLElement) => checkbox],
    ["selection cell", selectionCell],
  ])(
    "notifies active-row callbacks once when the %s selects and deselects",
    async (_label, targetFor) => {
      const user = userEvent.setup();
      const onGenomeSelect = vi.fn();
      const onActiveRowChange = vi.fn();
      render(
        <ControlledSelectionTable
          onGenomeSelect={onGenomeSelect}
          onActiveRowChange={onActiveRowChange}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: "Select row 100.1",
      });
      await user.click(targetFor(checkbox));
      expect(onGenomeSelect).toHaveBeenLastCalledWith("100.1");
      expect(onActiveRowChange).toHaveBeenLastCalledWith("100.1");

      await user.click(targetFor(checkbox));
      expect(onGenomeSelect).toHaveBeenLastCalledWith(null);
      expect(onActiveRowChange).toHaveBeenLastCalledWith(null);
      expect(onGenomeSelect).toHaveBeenCalledTimes(2);
      expect(onActiveRowChange).toHaveBeenCalledTimes(2);
    },
  );
});

// Regression: "Showing 1-0 of N" appeared during page-data loading because end was
// computed from data.length (= 0) even when isLoading=true. The fix uses the expected
// page range (pageIndex * pageSize + pageSize) while loading, so the display is
// meaningful from the moment totalItems resolves.
describe("DataTable Showing display during loading", () => {
  it("renders the empty state inside the table body", () => {
    render(
      <DataTable
        id="test"
        data={[]}
        columns={columns}
        totalItems={0}
        resource="strain"
      />,
    );

    const emptyState = screen.getByText("No results");
    expect(emptyState).toBeInTheDocument();
    expect(emptyState.closest("td")).toHaveClass("p-0.5");
  });

  it("uses compact padding for loading cells while preserving the selection cell", () => {
    const { container } = render(
      <DataTable
        id="loading-cell-padding"
        data={[]}
        columns={columns}
        totalItems={200}
        resource="strain"
        isLoading={true}
      />,
    );

    const firstSkeletonRow = container.querySelector("tbody tr");
    const cells = firstSkeletonRow?.querySelectorAll("td");
    expect(cells).toHaveLength(2);
    expect(cells?.[0]).toHaveClass("p-0");
    expect(cells?.[1]).toHaveClass("p-0.5");
  });

  it("shows expected page range when isLoading=true and data is empty", () => {
    render(
      <DataTable
        id="test"
        data={[]}
        columns={columns}
        totalItems={5000}
        resource="strain"
        isLoading={true}
        pageIndex={0}
        pageSize={200}
      />,
    );
    expect(
      screen.getByText(/Showing 1-200 of 5000 results/),
    ).toBeInTheDocument();
  });

  it("shows expected range for page 2 while loading (not '201-200')", () => {
    render(
      <DataTable
        id="test"
        data={[]}
        columns={columns}
        totalItems={5000}
        resource="strain"
        isLoading={true}
        pageIndex={1}
        pageSize={200}
      />,
    );
    expect(
      screen.getByText(/Showing 201-400 of 5000 results/),
    ).toBeInTheDocument();
  });

  it("uses target page range while loading even when placeholder rows exist", () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      strain_name: `Previous Strain ${String(i)}`,
    }));

    render(
      <DataTable
        id="test"
        data={rows}
        columns={columns}
        totalItems={5000}
        resource="strain"
        isLoading={true}
        pageIndex={1}
        pageSize={200}
      />,
    );

    expect(
      screen.getByText(/Showing 201-400 of 5000 results/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Showing 201-203 of 5000 results/),
    ).not.toBeInTheDocument();
  });

  it("shows 1-0 when data is genuinely empty and not loading", () => {
    render(
      <DataTable
        id="test"
        data={[]}
        columns={columns}
        totalItems={5000}
        resource="strain"
        isLoading={false}
        pageIndex={0}
        pageSize={200}
      />,
    );
    expect(screen.getByText(/Showing 1-0 of 5000 results/)).toBeInTheDocument();
  });

  it("shows actual row count range when data is loaded", () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      strain_name: `Strain ${String(i)}`,
    }));
    render(
      <DataTable
        id="test"
        data={rows}
        columns={columns}
        totalItems={5000}
        resource="strain"
        isLoading={false}
        pageIndex={0}
        pageSize={200}
      />,
    );
    expect(screen.getByText(/Showing 1-3 of 5000 results/)).toBeInTheDocument();
  });

  it("caps end at totalItems when last page is partial", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      strain_name: `Strain ${String(i)}`,
    }));
    render(
      <DataTable
        id="test"
        data={rows}
        columns={columns}
        totalItems={210}
        resource="strain"
        isLoading={true}
        pageIndex={1}
        pageSize={200}
      />,
    );
    // expected end: min(201 + 200 - 1, 210) = 210, not 400
    expect(
      screen.getByText(/Showing 201-210 of 210 results/),
    ).toBeInTheDocument();
  });
});

// Regression: array-valued fields (e.g. treatment_duration: [3,6,12,18]) rendered
// as raw React children with no separator, reading as "361218" instead of "3, 6, 12, 18".
describe("formatCellValue array handling", () => {
  it("joins array of numbers with comma-space", () => {
    expect(formatCellValue([3, 6, 12, 18])).toBe("3, 6, 12, 18");
  });

  it("joins array of strings with comma-space", () => {
    expect(formatCellValue(["A/Vietnam/1203", "A/California/04"])).toBe(
      "A/Vietnam/1203, A/California/04",
    );
  });

  it("renders single-element array without trailing separator", () => {
    expect(formatCellValue([5])).toBe("5");
  });

  it("renders empty array as empty string", () => {
    expect(formatCellValue([])).toBe("");
  });

  it("still formats ISO date strings, unaffected by array handling", () => {
    expect(formatCellValue("2021-12-20T12:00:00Z")).toBe("20-12-2021");
  });

  it("returns plain scalar values unchanged", () => {
    expect(formatCellValue("H5N1")).toBe("H5N1");
    expect(formatCellValue(42)).toBe(42);
  });

  it("returns null/undefined unchanged", () => {
    expect(formatCellValue(null)).toBe(null);
    expect(formatCellValue(undefined)).toBe(undefined);
  });
});

describe("DataTable empty state", () => {
  it("shows 'No results' when data is empty and no errorMessage", () => {
    render(
      <DataTable
        id="test"
        data={[]}
        columns={columns}
        totalItems={0}
        resource="strain"
      />,
    );
    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("shows errorMessage in table body instead of the empty-state message", () => {
    render(
      <DataTable
        id="test"
        data={[]}
        columns={columns}
        totalItems={0}
        resource="strain"
        errorMessage="Error: Failed to fetch metadata (500 Internal Server Error)"
      />,
    );
    const error = screen.getByText(/Failed to fetch metadata/);
    expect(error).toBeInTheDocument();
    expect(error.closest("td")).toHaveClass("p-0.5");
    expect(screen.queryByText("No results")).not.toBeInTheDocument();
  });

  it("keeps Download and Columns buttons visible when errorMessage is set", () => {
    render(
      <DataTable
        id="test"
        data={[]}
        columns={columns}
        totalItems={0}
        resource="strain"
        errorMessage="Error: Failed to fetch metadata (500 Internal Server Error)"
      />,
    );
    expect(
      screen.getByRole("button", { name: /Download \(CSV\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Columns/i }),
    ).toBeInTheDocument();
  });
});

// ─── Download Selected: capability gate ───────────────────────────────────────
// Regression: DataTable used to fall back to an unsafe raw fetch to
// NEXT_PUBLIC_DATA_API (with hand-built RQL, an unvalidated response envelope,
// and comma-joined output even for .txt) whenever a caller wired selectedIds
// without an onDownloadSelected handler. That fallback has been removed:
// DataTable now requires a caller-supplied export path for selected rows and
// hides the "Download Selected" buttons entirely when nothing can fulfil them,
// rather than rendering a button whose click would silently no-op.
describe("DataTable download selected: capability gate", () => {
  const dlColumns = [{ id: "value", label: "Value" }];
  const oneRow = [{ id: "aaaa-0001", value: "A" }];

  it("Download Selected button absent when selectedIds is empty", () => {
    render(
      <DataTable
        id="dl-empty"
        data={oneRow}
        columns={dlColumns}
        totalItems={1}
        resource="protein_feature"
        idField="id"
        selectedIds={[]}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Download Selected/i }),
    ).not.toBeInTheDocument();
  });

  it("hides Download Selected buttons when rows are selected but no onDownloadSelected is supplied", () => {
    render(
      <DataTable
        id="dl-no-handler"
        data={oneRow}
        columns={dlColumns}
        totalItems={1}
        resource="protein_feature"
        idField="id"
        selectedIds={["aaaa-0001"]}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Download Selected/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Download Selected buttons once onDownloadSelected is supplied", () => {
    render(
      <DataTable
        id="dl-handler"
        data={oneRow}
        columns={dlColumns}
        totalItems={1}
        resource="protein_feature"
        idField="id"
        selectedIds={["aaaa-0001"]}
        onDownloadSelected={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Download Selected \(CSV\)/i }),
    ).toBeInTheDocument();
  });

  it("shows Download Selected buttons when every page is selected and onDownloadAll can fulfil it, even without onDownloadSelected", () => {
    render(
      <DataTable
        id="dl-allpages"
        data={oneRow}
        columns={dlColumns}
        totalItems={50}
        resource="protein_feature"
        idField="id"
        isAllPagesSelected={true}
        onDownloadAll={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Download Selected \(CSV\)/i }),
    ).toBeInTheDocument();
  });
});

// ─── Download all: local fallback when onDownloadAll is not supplied ─────────
// Unlike the selected-rows fallback removed above, DataTable's "download every
// currently-loaded row" fallback is still a live, legitimate path: it never
// touches the network (no fetch, safe or otherwise) — it just serializes the
// table's own pre-paginated row model client-side via csvExportValue and
// downloadFile(). similar-genome-finder's results-section.tsx renders
// <DataTable> with no onDownloadAll, so its "Download (CSV)"/"(TXT)" buttons
// go through exactly this branch. This is the one place in the suite that
// still needs to prove the blob/anchor-click download mechanism actually
// fires, now that the selected-rows POST-regression block (which used to
// cover the same mechanism for a since-deleted path) is gone.
describe("DataTable download all: local fallback when onDownloadAll is not supplied", () => {
  it("triggers anchor click (file download) when no onDownloadAll is provided", async () => {
    const user = userEvent.setup();
    const createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {
        /* no-op */
      });

    render(
      <DataTable
        id="dl-all-local-fallback"
        data={[{ id: "aaaa-0001", value: "A" }]}
        columns={[{ id: "value", label: "Value" }]}
        totalItems={1}
        resource="protein_feature"
        idField="id"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /^Download \(CSV\)$/i }),
    );

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled();
    });
    expect(createObjectURLSpy).toHaveBeenCalled();
    createObjectURLSpy.mockRestore();
    clickSpy.mockRestore();
  });
});

// ─── "Downloading..." indicator: onDownloadAll regression ────────────────────
// Regression: handleDownload called the parent-supplied onDownloadAll without
// awaiting it, then immediately cleared downloadingButton — so "Downloading..."
// never had a chance to render on the plain Download (CSV/TXT) buttons (every
// caller wires onDownloadAll, so this path is always taken for those two
// buttons). Fix: onDownloadAll's return value is awaited before the button
// state clears. These tests use a manually-resolved promise to freeze the
// in-flight window and assert the label swap happens (and reverts after).
describe("DataTable 'Downloading...' indicator via onDownloadAll", () => {
  it("shows 'Downloading...' on Download (CSV) while onDownloadAll's promise is pending", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<undefined>();
    const onDownloadAll = vi.fn(() => promise);

    render(
      <DataTable
        id="dl-all-csv"
        data={[]}
        columns={columns}
        totalItems={10}
        resource="strain"
        onDownloadAll={onDownloadAll}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /^Download \(CSV\)$/i }),
    );

    expect(onDownloadAll).toHaveBeenCalledWith("csv", null);
    expect(await screen.findByText("Downloading...")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Download \(CSV\)$/i }),
    ).not.toBeInTheDocument();

    resolve(undefined);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^Download \(CSV\)$/i }),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Downloading...")).not.toBeInTheDocument();
  });

  it("shows 'Downloading...' on Download (TXT) while onDownloadAll's promise is pending", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<undefined>();
    const onDownloadAll = vi.fn(() => promise);

    render(
      <DataTable
        id="dl-all-txt"
        data={[]}
        columns={columns}
        totalItems={10}
        resource="strain"
        onDownloadAll={onDownloadAll}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /^Download \(TXT\)$/i }),
    );

    expect(onDownloadAll).toHaveBeenCalledWith("txt", null);
    expect(await screen.findByText("Downloading...")).toBeInTheDocument();

    resolve(undefined);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^Download \(TXT\)$/i }),
      ).toBeInTheDocument();
    });
  });

  it("disables the other download buttons while one is in flight", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<undefined>();
    const onDownloadAll = vi.fn(() => promise);

    render(
      <DataTable
        id="dl-all-disable"
        data={[]}
        columns={columns}
        totalItems={10}
        resource="strain"
        onDownloadAll={onDownloadAll}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /^Download \(CSV\)$/i }),
    );
    await screen.findByText("Downloading...");

    expect(
      screen.getByRole("button", { name: /^Download \(TXT\)$/i }),
    ).toBeDisabled();

    resolve(undefined);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^Download \(TXT\)$/i }),
      ).not.toBeDisabled();
    });
  });

  it("shows 'Downloading...' on Download Selected (all-pages-selected path routes through onDownloadAll)", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<undefined>();
    const onDownloadAll = vi.fn(() => promise);

    render(
      <DataTable
        id="dl-selected-allpages"
        data={[]}
        columns={columns}
        totalItems={10}
        resource="strain"
        selectedIds={["a", "b"]}
        isAllPagesSelected={true}
        onDownloadAll={onDownloadAll}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Download Selected \(CSV\)/i }),
    );

    expect(onDownloadAll).toHaveBeenCalledWith("csv", null);
    expect(await screen.findByText("Downloading...")).toBeInTheDocument();

    resolve(undefined);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Download Selected \(CSV\)/i }),
      ).toBeInTheDocument();
    });
  });

  it("clears 'Downloading...' even when onDownloadAll's promise rejects", async () => {
    const user = userEvent.setup();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      /* no-op */
    });
    const onDownloadAll = vi.fn(() =>
      Promise.reject(new Error("network down")),
    );

    render(
      <DataTable
        id="dl-all-error"
        data={[]}
        columns={columns}
        totalItems={10}
        resource="strain"
        onDownloadAll={onDownloadAll}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /^Download \(CSV\)$/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^Download \(CSV\)$/i }),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Downloading...")).not.toBeInTheDocument();
    errorSpy.mockRestore();
  });
});
