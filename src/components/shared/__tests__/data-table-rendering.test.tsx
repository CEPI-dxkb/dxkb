import { useState } from "react";
import type { RowSelectionState } from "@tanstack/react-table";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { DataTable } from "../data-table";
import { formatCellValue } from "../data-table-utils";
import { server } from "@/test-helpers/msw-server";

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

// ─── Download Selected: POST regression ──────────────────────────────────────
// Regression: download-selected used a GET request with the RQL query in the URL.
// With 200 selected rows the URL exceeded browser/server limits → net::ERR_FAILED.
// Fix: POST with query in body (Content-type: application/rqlquery+x-www-form-urlencoded).

describe("DataTable download selected: POST regression", () => {
  const DATA_API = "https://data.test";

  const dlColumns = [
    { id: "source", label: "Source", visible: true },
    { id: "product", label: "Product", visible: true },
  ];

  const twoRows = [
    { id: "aaaa-0001", source: "PRINTS", product: "polyprotein" },
    { id: "aaaa-0002", source: "Pfam", product: "capsid" },
  ];

  beforeAll(() => {
    process.env.NEXT_PUBLIC_DATA_API = DATA_API;
    global.ResizeObserver = class ResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    };
    // jsdom doesn't implement URL.createObjectURL; downloadFile() calls it.
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    global.URL.revokeObjectURL = vi.fn();
  });

  afterAll(() => {
    delete process.env.NEXT_PUBLIC_DATA_API;
  });

  it("uses POST not GET when downloading selected rows", async () => {
    const user = userEvent.setup();
    let requestMethod = "";
    server.use(
      http.post(`${DATA_API}/protein_feature/`, ({ request }) => {
        requestMethod = request.method;
        return HttpResponse.json(twoRows);
      }),
    );

    render(
      <DataTable
        id="dl-method"
        data={twoRows}
        columns={dlColumns}
        totalItems={2}
        resource="protein_feature"
        selectedIds={["aaaa-0001", "aaaa-0002"]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Download Selected \(CSV\)/i }),
    );
    await waitFor(() => {
      expect(requestMethod).toBe("POST");
    });
  });

  it("sends RQL query in POST body, not in URL query string", async () => {
    const user = userEvent.setup();
    let capturedUrl = "";
    let capturedBody = "";
    server.use(
      http.post(`${DATA_API}/protein_feature/`, async ({ request }) => {
        capturedUrl = request.url;
        capturedBody = await request.text();
        return HttpResponse.json(twoRows);
      }),
    );

    render(
      <DataTable
        id="dl-body"
        data={twoRows}
        columns={dlColumns}
        totalItems={2}
        resource="protein_feature"
        selectedIds={["aaaa-0001", "aaaa-0002"]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Download Selected \(CSV\)/i }),
    );
    await waitFor(() => {
      expect(capturedBody).toBeTruthy();
    });

    expect(capturedBody).toBe("or(eq(id,aaaa-0001),eq(id,aaaa-0002))");
    expect(capturedUrl).not.toContain("or(eq(id,");
  });

  it("Range header matches selected count", async () => {
    const user = userEvent.setup();
    let rangeHeader = "";
    server.use(
      http.post(`${DATA_API}/protein_feature/`, ({ request }) => {
        rangeHeader = request.headers.get("Range") ?? "";
        return HttpResponse.json(twoRows);
      }),
    );

    render(
      <DataTable
        id="dl-range"
        data={twoRows}
        columns={dlColumns}
        totalItems={2}
        resource="protein_feature"
        selectedIds={["aaaa-0001", "aaaa-0002"]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Download Selected \(CSV\)/i }),
    );
    await waitFor(() => {
      expect(rangeHeader).toBeTruthy();
    });
    expect(rangeHeader).toBe("items=0-2");
  });

  it("uses correct id field per resource: genome_id for genome", async () => {
    const user = userEvent.setup();
    let capturedBody = "";
    server.use(
      http.post(`${DATA_API}/genome/`, async ({ request }) => {
        capturedBody = await request.text();
        return HttpResponse.json([]);
      }),
    );

    render(
      <DataTable
        id="dl-genome"
        data={[{ genome_id: "1234.1", source: "ref", product: "genome" }]}
        columns={[{ id: "source", label: "Source", visible: true }]}
        totalItems={1}
        resource="genome"
        selectedIds={["1234.1"]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Download Selected \(CSV\)/i }),
    );
    await waitFor(() => {
      expect(capturedBody).toBeTruthy();
    });
    expect(capturedBody).toBe("or(eq(genome_id,1234.1))");
  });

  it("regression: 200 selected IDs fit in POST body (GET URL would have caused ERR_FAILED)", async () => {
    const user = userEvent.setup();
    const ids = Array.from(
      { length: 200 },
      (_, i) => `id-${String(i).padStart(4, "0")}`,
    );
    const rows = ids.map((id) => ({ id, source: "Pfam", product: "poly" }));
    let capturedBody = "";

    server.use(
      http.post(`${DATA_API}/protein_feature/`, async ({ request }) => {
        capturedBody = await request.text();
        return HttpResponse.json(rows);
      }),
    );

    render(
      <DataTable
        id="dl-200"
        data={rows.slice(0, 5)}
        columns={dlColumns}
        totalItems={200}
        resource="protein_feature"
        selectedIds={ids}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Download Selected \(CSV\)/i }),
    );
    await waitFor(
      () => {
        expect(capturedBody).toBeTruthy();
      },
      { timeout: 5000 },
    );

    expect(capturedBody).toMatch(/^or\(/);
    // First and last IDs present — a GET URL would have hit length limits and lost some
    expect(capturedBody).toContain("id-0000");
    expect(capturedBody).toContain("id-0199");
  });

  it("Download Selected button absent when selectedIds is empty", () => {
    render(
      <DataTable
        id="dl-empty"
        data={twoRows}
        columns={dlColumns}
        totalItems={2}
        resource="protein_feature"
        selectedIds={[]}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Download Selected/i }),
    ).not.toBeInTheDocument();
  });

  it("triggers anchor click (file download) after successful POST", async () => {
    const user = userEvent.setup();
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {
        /* no-op */
      });

    server.use(
      http.post(`${DATA_API}/protein_feature/`, () =>
        HttpResponse.json([
          { id: "aaaa-0001", source: "PRINTS", product: "polyprotein" },
        ]),
      ),
    );

    render(
      <DataTable
        id="dl-file"
        data={twoRows}
        columns={dlColumns}
        totalItems={2}
        resource="protein_feature"
        selectedIds={["aaaa-0001"]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Download Selected \(CSV\)/i }),
    );
    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled();
    });
    clickSpy.mockRestore();
  });

  it("logs error and does not crash when POST returns 500", async () => {
    const user = userEvent.setup();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      /* no-op */
    });

    server.use(
      http.post(
        `${DATA_API}/protein_feature/`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    render(
      <DataTable
        id="dl-500"
        data={twoRows}
        columns={dlColumns}
        totalItems={2}
        resource="protein_feature"
        selectedIds={["aaaa-0001"]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Download Selected \(CSV\)/i }),
    );
    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        "Download selected failed:",
        expect.any(Error),
      );
    });
    errorSpy.mockRestore();
  });

  it("handles {items:[...]} response envelope and still downloads", async () => {
    const user = userEvent.setup();
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {
        /* no-op */
      });

    server.use(
      http.post(`${DATA_API}/protein_feature/`, () =>
        HttpResponse.json({
          items: [{ id: "aaaa-0001", source: "PRINTS", product: "poly" }],
        }),
      ),
    );

    render(
      <DataTable
        id="dl-envelope"
        data={twoRows}
        columns={dlColumns}
        totalItems={2}
        resource="protein_feature"
        selectedIds={["aaaa-0001"]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Download Selected \(CSV\)/i }),
    );
    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled();
    });
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
