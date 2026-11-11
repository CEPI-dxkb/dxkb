import { useState } from "react";
import type { RowSelectionState } from "@tanstack/react-table";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { stretchedColumnWidths } from "../column-resize";
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

// jsdom has no pointer capture.
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();

/**
 * Presses a resize handle with the primary pointer (jsdom defaults `isPrimary`
 * to false, which `followPointer` ignores).
 */
function pressHandle(
  handle: HTMLElement,
  clientX: number,
  pointerType: "mouse" | "touch" = "mouse",
) {
  fireEvent.pointerDown(handle, {
    pointerId: 1,
    button: 0,
    isPrimary: true,
    pointerType,
    clientX,
  });
}

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
  crossPageSelection,
}: {
  onGenomeSelect?: (id: string | null) => void;
  onActiveRowChange?: (id: string | null) => void;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  crossPageSelection?: boolean;
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
      crossPageSelection={crossPageSelection}
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

describe("DataTable cross-page selection", () => {
  it("offers every result across pages once the page is selected", async () => {
    const user = userEvent.setup();
    render(<ControlledSelectionTable />);

    await user.click(
      screen.getByRole("checkbox", { name: "Select all rows on this page" }),
    );

    expect(
      screen.getByRole("button", {
        name: "Select all 4 results across all pages",
      }),
    ).toBeInTheDocument();
  });

  it("leaves the page selection alone when the owner turns it off", async () => {
    const user = userEvent.setup();
    const onRowSelectionChange = vi.fn();
    render(
      <ControlledSelectionTable
        crossPageSelection={false}
        onRowSelectionChange={onRowSelectionChange}
      />,
    );

    await user.click(
      screen.getByRole("checkbox", { name: "Select all rows on this page" }),
    );

    expect(onRowSelectionChange).toHaveBeenLastCalledWith({
      "100.1": true,
      "100.2": true,
      "100.3": true,
      "100.4": true,
    });
    expect(screen.queryByText(/across all pages/)).not.toBeInTheDocument();
    expect(screen.queryByText(/results on this page are selected/)).not.toBeInTheDocument();
  });
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

    const link = screen.getByRole("link", { name: "100/2" });
    expect(link).toHaveAttribute("href", "https://example.test/100%2F2");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("resolves named placeholders from the row and rejects unsafe templates", () => {
    render(
      <DataTable
        id="row-aware-and-unsafe-links"
        data={[
          { id: "row-1", genome_id: "100/2", contigs: 4, unsafe: "shown" },
        ]}
        columns={[
          {
            id: "contigs",
            label: "Contigs",
            valueHref: "/genome/{genome_id}?tab=sequences",
          },
          { id: "unsafe", label: "Unsafe", valueHref: "/\\evil.test/{value}" },
        ]}
        totalItems={1}
        resource="genome"
        idField="id"
      />,
    );

    expect(screen.getByRole("link", { name: "4" })).toHaveAttribute(
      "href",
      "/genome/100%2F2?tab=sequences",
    );
    expect(screen.getByText("shown")).not.toHaveRole("link");
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

  it("centers the selection skeleton the way the checkboxes it stands in for are centered", () => {
    const { container } = render(
      <DataTable
        id="loading-selection-skeleton"
        data={[]}
        columns={columns}
        totalItems={200}
        resource="strain"
        isLoading={true}
      />,
    );

    const headerSelectCell = container.querySelector(
      'thead input[type="checkbox"]',
    )?.parentElement;
    const skeletonSelectCell = container.querySelector("tbody tr td");
    expect(headerSelectCell).toHaveClass("justify-center");
    expect(skeletonSelectCell).toHaveClass("justify-center");
  });

  it("says the first read is loading, not 'Showing 0-0 of 0 results', and marks the table busy", () => {
    render(
      <DataTable
        id="first-read"
        data={[]}
        columns={columns}
        totalItems={0}
        resource="strain"
        isLoading={true}
        scrollRegionLabel="Strains results table"
      />,
    );

    expect(screen.getByText("Loading results…")).toBeInTheDocument();
    expect(screen.queryByText(/Showing 0-0/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Strains results table" }),
    ).toHaveAttribute("aria-busy", "true");
  });

  it("is not busy, and counts, once the rows are in", () => {
    render(
      <DataTable
        id="loaded"
        data={[{ strain_name: "A" }]}
        columns={columns}
        totalItems={1}
        resource="strain"
        scrollRegionLabel="Strains results table"
      />,
    );

    expect(screen.getByText("Showing 1-1 of 1 results")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Strains results table" }),
    ).not.toHaveAttribute("aria-busy");
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
    expect(screen.queryByText("Previous Strain 0")).not.toBeInTheDocument();
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
    expect(
      screen.getByText(/Showing 201-210 of 210 results/),
    ).toBeInTheDocument();
  });
});

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

describe("DataTable download all: local fallback when onDownloadAll is not supplied", () => {
  it("triggers anchor click (file download) when no onDownloadAll is provided", async () => {
    const user = userEvent.setup();
    const createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

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

  function captureLocalDownload() {
    let blob: Blob | undefined;
    let filename: string | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((value) => {
      blob = value as Blob;
      return "blob:mock";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        filename = this.download;
      },
    );
    return { text: () => blob?.text(), filename: () => filename };
  }

  function renderLocalFallbackTable(value: string) {
    render(
      <DataTable
        id="dl-all-local-delimiter"
        data={[{ id: "aaaa-0001", value, other: "B" }]}
        columns={[
          { id: "value", label: "Value" },
          { id: "other", label: "Other" },
        ]}
        totalItems={1}
        resource="protein_feature"
        idField="id"
      />,
    );
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delimits a TXT download with tabs and leaves values unquoted", async () => {
    const user = userEvent.setup();
    const download = captureLocalDownload();
    renderLocalFallbackTable("A");

    await user.click(
      screen.getByRole("button", { name: /^Download \(TXT\)$/i }),
    );

    await waitFor(() => {
      expect(download.filename()).toBe("protein_feature.txt");
    });
    await expect(download.text()).resolves.toBe("Value\tOther\nA\tB");
  });

  it("replaces a tab inside a TXT cell so it cannot forge a column break", async () => {
    const user = userEvent.setup();
    const download = captureLocalDownload();
    renderLocalFallbackTable("A\tforged");

    await user.click(
      screen.getByRole("button", { name: /^Download \(TXT\)$/i }),
    );

    await waitFor(() => {
      expect(download.filename()).toBe("protein_feature.txt");
    });
    await expect(download.text()).resolves.toBe(
      "Value\tOther\nA forged\tB",
    );
  });

  it("keeps CSV comma-delimited and quoted", async () => {
    const user = userEvent.setup();
    const download = captureLocalDownload();
    renderLocalFallbackTable("A, comma");

    await user.click(
      screen.getByRole("button", { name: /^Download \(CSV\)$/i }),
    );

    await waitFor(() => {
      expect(download.filename()).toBe("protein_feature.csv");
    });
    await expect(download.text()).resolves.toBe(
      'Value,Other\n"A, comma","B"',
    );
  });
});

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
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
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

describe("DataTable column drag affordance", () => {
  const reorderColumns = [
    { id: "strain_name", label: "Strain Name", visible: true },
    { id: "public_id", label: "Public ID", visible: true },
  ];
  const reorderRows = [{ genome_id: "100.1", strain_name: "A", public_id: "B" }];

  function dragWrapperFor(headerName: RegExp) {
    const header = screen.getByRole("columnheader", { name: headerName });
    const wrapper = header.querySelector<HTMLElement>("div[draggable]");
    if (!wrapper) throw new Error("Header has no draggable wrapper element");
    return wrapper;
  }

  it("makes headers draggable with a move cursor when onColumnOrderChange is supplied", () => {
    render(
      <DataTable
        id="reorderable"
        data={reorderRows}
        columns={reorderColumns}
        totalItems={1}
        resource="genome"
        onColumnOrderChange={vi.fn()}
      />,
    );

    const wrapper = dragWrapperFor(/Strain Name/);
    expect(wrapper).toHaveAttribute("draggable", "true");
    expect(wrapper).toHaveClass("cursor-move");
  });

  it("does not make headers draggable when onColumnOrderChange is absent", () => {
    render(
      <DataTable
        id="not-reorderable"
        data={reorderRows}
        columns={reorderColumns}
        totalItems={1}
        resource="genome"
      />,
    );

    const wrapper = dragWrapperFor(/Strain Name/);
    expect(wrapper).toHaveAttribute("draggable", "false");
    expect(wrapper).not.toHaveClass("cursor-move");
  });

  describe("a drag that starts near a header's edge", () => {
    function renderReorderable() {
      render(
        <DataTable
          id="reorder-guard"
          data={reorderRows}
          columns={reorderColumns}
          totalItems={1}
          resource="genome"
          onColumnOrderChange={vi.fn()}
        />,
      );
      const wrapper = dragWrapperFor(/Strain Name/);
      vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue(
        DOMRect.fromRect({ x: 100, y: 0, width: 200, height: 30 }),
      );
      return wrapper;
    }

    function dragFrom(wrapper: HTMLElement, clientX: number) {
      fireEvent.mouseDown(wrapper, { clientX });
      return fireEvent.dragStart(wrapper, {
        clientX,
        dataTransfer: { effectAllowed: "" },
      });
    }

    it("does not start a reorder from beside the right edge", () => {
      expect(dragFrom(renderReorderable(), 292)).toBe(false);
    });

    it("does not start a reorder from beside the left edge", () => {
      expect(dragFrom(renderReorderable(), 105)).toBe(false);
    });

    it("starts a reorder from the middle of the header", () => {
      expect(dragFrom(renderReorderable(), 200)).toBe(true);
    });

    function renderWithWidth(width: number) {
      const wrapper = renderReorderable();
      vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue(
        DOMRect.fromRect({ x: 0, y: 0, width, height: 30 }),
      );
      return wrapper;
    }

    it("starts a reorder from the middle of a narrow column", () => {
      const wrapper = renderWithWidth(24);
      expect(dragFrom(wrapper, 10)).toBe(true);
      expect(wrapper).toHaveClass("opacity-50");
    });

    it("still blocks a press at the very edge of a narrow column", () => {
      expect(dragFrom(renderWithWidth(24), 2)).toBe(false);
    });

    it("blocks a press 2px from the edge of a wide column", () => {
      expect(dragFrom(renderWithWidth(200), 2)).toBe(false);
    });

    it("never fires dragStart on the wrapper from a pointerDown on the resize handle", () => {
      const wrapper = renderReorderable();
      const handle = screen.getByRole("separator", {
        name: "Resize strain_name column",
      });
      expect(wrapper.contains(handle)).toBe(false);
      const onDragStart = vi.fn();
      wrapper.addEventListener("dragstart", onDragStart);
      pressHandle(handle, 105);
      expect(onDragStart).not.toHaveBeenCalled();
      expect(wrapper).not.toHaveClass("opacity-50");
    });
  });

  it("ignores a drop on a non-reorderable table instead of reordering", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        id="not-reorderable-drop"
        data={reorderRows}
        columns={reorderColumns}
        totalItems={1}
        resource="genome"
      />,
    );

    const source = dragWrapperFor(/Strain Name/);
    const target = dragWrapperFor(/Public ID/);
    await user.pointer([
      { target: source, keys: "[MouseLeft>]" },
      { target },
      { keys: "[/MouseLeft]" },
    ]);

    const headerNames = screen
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent);
    expect(headerNames).toEqual(
      expect.arrayContaining(["Strain Name", "Public ID"]),
    );
  });
});

/**
 * A header cell's rendered width in a `boxWidth`-wide scroll box, laid out as
 * the browser lays out the flex row (jsdom lays out nothing).
 */
function laidOutWidth(cell: HTMLElement, boxWidth: number): number {
  const row = [...(cell.closest("tr")?.children ?? [])].filter(
    (sibling): sibling is HTMLElement => sibling instanceof HTMLElement,
  );
  const read = (name: string) =>
    row.map((sibling) =>
      Number.parseFloat(sibling.style.getPropertyValue(name)),
    );
  const sizes = read("--col-size");
  const grows = read("--col-grow");
  const total = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const room = boxWidth - 8 - total(sizes);
  const index = row.indexOf(cell);
  return room > 0 && total(grows) > 0
    ? sizes[index] + (room * grows[index]) / total(grows)
    : sizes[index];
}

describe("DataTable resize handle pointer wiring", () => {
  const resizeColumns = [
    { id: "strain_name", label: "Strain Name", visible: true },
  ];
  const resizeRows = [{ genome_id: "100.1", strain_name: "A" }];

  function renderResizable({
    onSortingChange,
    onColumnWidthsCommit,
  }: {
    onSortingChange?: (sorting: unknown) => void;
    onColumnWidthsCommit?: (widths: Record<string, number>) => void;
  } = {}) {
    const view = render(
      <DataTable
        id="resizable"
        data={resizeRows}
        columns={resizeColumns}
        totalItems={1}
        resource="genome"
        savedColumnWidths={{ strain_name: 333 }}
        onSortingChange={onSortingChange}
        onColumnWidthsCommit={onColumnWidthsCommit}
      />,
    );
    const handle = screen.getByRole("separator", {
      name: "Resize strain_name column",
    });
    return { ...view, handle };
  }

  it.each(["mouse", "touch"] as const)(
    "resizes from a %s pointer and commits on release",
    async (pointerType) => {
      const onColumnWidthsCommit = vi.fn();
      const { handle } = renderResizable({ onColumnWidthsCommit });
      await waitFor(() => {
        expect(handle).toHaveAttribute("aria-valuenow", "333");
      });

      pressHandle(handle, 100, pointerType);
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 150 });
      expect(handle).toHaveAttribute("aria-valuenow", "383");
      fireEvent.pointerUp(handle, { pointerId: 1, clientX: 150 });

      expect(onColumnWidthsCommit).toHaveBeenCalledWith({ strain_name: 383 });
      expect(onColumnWidthsCommit).toHaveBeenCalledTimes(1);
    },
  );

  it("does not start a resize from a secondary mouse button", async () => {
    const onColumnWidthsCommit = vi.fn();
    const { handle } = renderResizable({ onColumnWidthsCommit });
    await waitFor(() => {
      expect(handle).toHaveAttribute("aria-valuenow", "333");
    });

    fireEvent.pointerDown(handle, {
      pointerId: 1,
      button: 2,
      isPrimary: true,
      pointerType: "mouse",
      clientX: 100,
    });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 150 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 150 });

    expect(handle).toHaveAttribute("aria-valuenow", "333");
    expect(onColumnWidthsCommit).not.toHaveBeenCalled();
  });

  it("ignores a second finger: its release does not end the drag", async () => {
    const onColumnWidthsCommit = vi.fn();
    const { handle } = renderResizable({ onColumnWidthsCommit });
    await waitFor(() => {
      expect(handle).toHaveAttribute("aria-valuenow", "333");
    });

    pressHandle(handle, 100, "touch");
    fireEvent.pointerDown(handle, {
      pointerId: 2,
      isPrimary: false,
      pointerType: "touch",
      clientX: 300,
    });
    fireEvent.pointerUp(handle, { pointerId: 2, clientX: 300 });
    expect(onColumnWidthsCommit).not.toHaveBeenCalled();

    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 150 });
    expect(handle).toHaveAttribute("aria-valuenow", "383");
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 150 });

    expect(onColumnWidthsCommit).toHaveBeenCalledWith({ strain_name: 383 });
    expect(onColumnWidthsCommit).toHaveBeenCalledTimes(1);
  });

  it("ends a cancelled drag without committing it", async () => {
    const onColumnWidthsCommit = vi.fn();
    const { handle } = renderResizable({ onColumnWidthsCommit });
    await waitFor(() => {
      expect(handle).toHaveAttribute("aria-valuenow", "333");
    });
    const header = screen.getByRole("columnheader", { name: /Strain Name/ });

    pressHandle(handle, 100, "touch");
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 150 });
    expect(handle).toHaveAttribute("aria-valuenow", "383");
    expect(header.style.getPropertyValue("--col-size")).toBe("383px");
    expect(header.style.getPropertyValue("--col-grow")).toBe("0");

    fireEvent.pointerCancel(handle, { pointerId: 1, isPrimary: true });

    expect(onColumnWidthsCommit).not.toHaveBeenCalled();
    expect(handle).toHaveAttribute("aria-valuenow", "333");
    expect(header.style.getPropertyValue("--col-size")).toBe("333px");
    expect(header.style.getPropertyValue("--col-grow")).toBe("333");
  });

  it("commits nothing when the table unmounts mid-drag", async () => {
    const onColumnWidthsCommit = vi.fn();
    const { handle, unmount } = renderResizable({ onColumnWidthsCommit });
    await waitFor(() => {
      expect(handle).toHaveAttribute("aria-valuenow", "333");
    });

    pressHandle(handle, 100);
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 150 });
    expect(handle).toHaveAttribute("aria-valuenow", "383");
    unmount();
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 150 });
    fireEvent.mouseUp(document);
    fireEvent.touchEnd(document);

    expect(onColumnWidthsCommit).not.toHaveBeenCalled();
  });

  it("suppresses the sort toggle after a resize drag ends", async () => {
    vi.useFakeTimers();
    try {
      const onSortingChange = vi.fn();
      const { handle } = renderResizable({ onSortingChange });
      const sortButton = screen.getByRole("button", {
        name: "Sort by Strain Name",
      });

      pressHandle(handle, 100, "touch");
      fireEvent.pointerUp(handle, { pointerId: 1, clientX: 100 });

      fireEvent.click(sortButton);
      expect(onSortingChange).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(150);
      fireEvent.click(sortButton);
      expect(onSortingChange).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("moves and commits nothing for a drag smaller than a setting step", async () => {
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(2000);
    try {
      const onColumnWidthsCommit = vi.fn();
      render(
        <DataTable
          id="resizable-wide"
          data={[{ genome_id: "100.1", strain_name: "A", public_id: "B" }]}
          columns={[
            { id: "strain_name", label: "Strain Name", visible: true },
            { id: "public_id", label: "Public ID", visible: true },
          ]}
          totalItems={1}
          resource="genome"
          savedColumnWidths={{ strain_name: 200, public_id: 200 }}
          onColumnWidthsCommit={onColumnWidthsCommit}
        />,
      );
      const handle = screen.getByRole("separator", {
        name: "Resize strain_name column",
      });
      await waitFor(() => {
        expect(handle).toHaveAttribute("aria-valuenow", "200");
      });
      const header = screen.getByRole("columnheader", { name: /Strain Name/ });
      const restingWidth = laidOutWidth(header, 2000);
      expect(restingWidth).toBeGreaterThan(900);

      pressHandle(handle, 500);
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 501 });
      expect(handle.firstElementChild).toHaveClass("bg-info");
      expect(laidOutWidth(header, 2000)).toBeCloseTo(restingWidth, 6);
      expect(handle).toHaveAttribute("aria-valuenow", "200");

      fireEvent.pointerUp(handle, { pointerId: 1, clientX: 501 });
      expect(onColumnWidthsCommit).not.toHaveBeenCalled();
      expect(laidOutWidth(header, 2000)).toBeCloseTo(restingWidth, 6);
    } finally {
      clientWidth.mockRestore();
    }
  });

  it("stretches resting columns in proportion to their settings", async () => {
    render(
      <DataTable
        id="flex-stretch"
        data={[{ genome_id: "100.1", strain_name: "A", public_id: "B" }]}
        columns={[
          { id: "strain_name", label: "Strain Name", visible: true },
          { id: "public_id", label: "Public ID", visible: true },
        ]}
        totalItems={1}
        resource="genome"
        savedColumnWidths={{ strain_name: 300, public_id: 100 }}
      />,
    );
    const headers = screen.getAllByRole("columnheader");
    await waitFor(() => {
      expect(
        headers.map((header) => header.style.getPropertyValue("--col-size")),
      ).toEqual(["40px", "300px", "100px"]);
    });
    expect(
      headers.map((header) => header.style.getPropertyValue("--col-grow")),
    ).toEqual(["0", "300", "100"]);

    for (const boxWidth of [2000, 1200]) {
      const expected = stretchedColumnWidths(
        [40, 300, 100],
        boxWidth - 8,
        [true, false, false],
      );
      headers.forEach((header, i) => {
        expect(laidOutWidth(header, boxWidth)).toBeCloseTo(expected[i], 6);
      });
    }
    expect(headers.map((header) => laidOutWidth(header, 300))).toEqual([
      40, 300, 100,
    ]);
  });
});

describe("DataTable remembered widths", () => {
  it("starts a column at the width the user left it", async () => {
    render(
      <DataTable
        id="widths"
        data={selectionRows}
        columns={columns}
        totalItems={selectionRows.length}
        resource="genome"
        savedColumnWidths={{ strain_name: 333 }}
      />,
    );
    await waitFor(() => {
      expect(
        screen.getByRole("separator", { name: "Resize strain_name column" }),
      ).toHaveAttribute("aria-valuenow", "333");
    });
  });

  it("commits a keyboard resize once, with the final width", async () => {
    const onColumnWidthsCommit = vi.fn();
    render(
      <DataTable
        id="widths"
        data={selectionRows}
        columns={columns}
        totalItems={selectionRows.length}
        resource="genome"
        savedColumnWidths={{ strain_name: 333 }}
        onColumnWidthsCommit={onColumnWidthsCommit}
      />,
    );
    const handle = await screen.findByRole("separator", {
      name: "Resize strain_name column",
    });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    await waitFor(() => {
      expect(onColumnWidthsCommit).toHaveBeenCalledWith({ strain_name: 343 });
    });
    expect(onColumnWidthsCommit).toHaveBeenCalledTimes(1);
  });

  it("commits a pointer drag once, on release", async () => {
    const onColumnWidthsCommit = vi.fn();
    render(
      <DataTable
        id="widths"
        data={selectionRows}
        columns={columns}
        totalItems={selectionRows.length}
        resource="genome"
        savedColumnWidths={{ strain_name: 333 }}
        onColumnWidthsCommit={onColumnWidthsCommit}
      />,
    );
    const handle = await screen.findByRole("separator", {
      name: "Resize strain_name column",
    });
    pressHandle(handle, 100);
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 120 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 150 });
    await waitFor(() => {
      expect(handle).toHaveAttribute("aria-valuenow", "383");
    });
    expect(onColumnWidthsCommit).not.toHaveBeenCalled();

    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 150 });
    await waitFor(() => {
      expect(onColumnWidthsCommit).toHaveBeenCalledWith({ strain_name: 383 });
    });
    expect(onColumnWidthsCommit).toHaveBeenCalledTimes(1);
  });

  // TanStack stores the raw drag width and only getSize() clamps it; a
  // committed width outside the saved-layout schema (20-4000) would make the
  // stored layout unreadable.
  describe("a drag past the column's limits", () => {
    async function dragBy(savedWidth: number, deltaX: number) {
      const onColumnWidthsCommit = vi.fn();
      render(
        <DataTable
          id="widths"
          data={selectionRows}
          columns={columns}
          totalItems={selectionRows.length}
          resource="genome"
          savedColumnWidths={{ strain_name: savedWidth }}
          onColumnWidthsCommit={onColumnWidthsCommit}
        />,
      );
      const handle = await screen.findByRole("separator", {
        name: "Resize strain_name column",
      });
      pressHandle(handle, 1000);
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 1000 + deltaX });
      fireEvent.pointerUp(handle, { pointerId: 1, clientX: 1000 + deltaX });
      return { handle, onColumnWidthsCommit };
    }

    it("commits the minimum width, not the raw one", async () => {
      const { handle, onColumnWidthsCommit } = await dragBy(333, -400);
      await waitFor(() => {
        expect(onColumnWidthsCommit).toHaveBeenCalledWith({ strain_name: 40 });
      });
      expect(handle).toHaveAttribute("aria-valuenow", "40");
      expect(onColumnWidthsCommit).toHaveBeenCalledTimes(1);
    });

    it("commits the maximum width, not the raw one", async () => {
      const { handle, onColumnWidthsCommit } = await dragBy(900, 3200);
      await waitFor(() => {
        expect(onColumnWidthsCommit).toHaveBeenCalledWith({
          strain_name: 1000,
        });
      });
      expect(handle).toHaveAttribute("aria-valuenow", "1000");
      expect(onColumnWidthsCommit).toHaveBeenCalledTimes(1);
    });
  });

  it("shows saved widths before any data is measured, and a resize keeps the others", async () => {
    const onColumnWidthsCommit = vi.fn();
    render(
      <DataTable
        id="widths"
        data={[]}
        columns={[
          { id: "strain_name", label: "Strain Name", visible: true },
          { id: "public_id", label: "Public ID", visible: true },
        ]}
        totalItems={0}
        resource="genome"
        savedColumnWidths={{ strain_name: 333, public_id: 222 }}
        onColumnWidthsCommit={onColumnWidthsCommit}
      />,
    );
    const strainHandle = screen.getByRole("separator", {
      name: "Resize strain_name column",
    });
    const publicIdHandle = screen.getByRole("separator", {
      name: "Resize public_id column",
    });
    expect(strainHandle).toHaveAttribute("aria-valuenow", "333");
    expect(publicIdHandle).toHaveAttribute("aria-valuenow", "222");

    fireEvent.keyDown(strainHandle, { key: "ArrowRight" });

    await waitFor(() => {
      expect(onColumnWidthsCommit).toHaveBeenCalledWith({ strain_name: 343 });
    });
    expect(onColumnWidthsCommit).toHaveBeenCalledTimes(1);
    expect(strainHandle).toHaveAttribute("aria-valuenow", "343");
    expect(publicIdHandle).toHaveAttribute("aria-valuenow", "222");
  });
});

describe("DataTable refreshing state", () => {
  const previousRows = [{ strain_name: "Previous Strain" }];

  it("marks the rows on screen as stale while the new results load", () => {
    const { container } = render(
      <DataTable
        id="refreshing"
        data={previousRows}
        columns={columns}
        totalItems={1}
        resource="strain"
        isRefreshing={true}
      />,
    );

    expect(screen.getByText("Loading results...")).toBeVisible();
    expect(screen.getByText("Previous Strain")).toBeInTheDocument();
    expect(container.querySelector("tbody")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("shows nothing extra once the results are current", () => {
    const { container } = render(
      <DataTable
        id="current"
        data={previousRows}
        columns={columns}
        totalItems={1}
        resource="strain"
      />,
    );

    expect(screen.queryByText("Loading results...")).not.toBeInTheDocument();
    expect(container.querySelector("tbody")).not.toHaveAttribute("aria-busy");
  });

  it("leaves a loading page to its skeleton", () => {
    const { container } = render(
      <DataTable
        id="page-loading"
        data={previousRows}
        columns={columns}
        totalItems={1}
        resource="strain"
        isLoading={true}
        isRefreshing={true}
      />,
    );

    expect(screen.queryByText("Loading results...")).not.toBeInTheDocument();
    expect(container.querySelector("tbody")).not.toHaveAttribute("aria-busy");
  });
});

describe("DataTable sorted column", () => {
  const sortColumns = [
    { id: "strain_name", label: "Strain Name", visible: true },
    { id: "genome_id", label: "Genome ID", visible: true },
  ];

  it.each([
    [false, "ascending"],
    [true, "descending"],
  ])("marks only the sorted column's header (desc: %s)", (desc, ariaSort) => {
    render(
      <DataTable
        id="sorted"
        data={[{ genome_id: "1", strain_name: "First" }]}
        columns={sortColumns}
        totalItems={1}
        resource="genome"
        sorting={[{ id: "genome_id", desc }]}
      />,
    );

    expect(
      screen.getByRole("columnheader", { name: /Genome ID/ }),
    ).toHaveAttribute("aria-sort", ariaSort);
    expect(
      screen.getByRole("columnheader", { name: /Strain Name/ }),
    ).toHaveAttribute("aria-sort", "none");
  });
});
