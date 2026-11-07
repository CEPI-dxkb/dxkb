import { render, screen } from "@testing-library/react";
import { DataTable } from "../data-table";

// The real useVirtualizer (no module mock). virtual-core 3.19 sizes its window
// from the scroll element's clientHeight (3.17 read offsetHeight), which jsdom
// reports as 0, so every element gets 240px here: ten 24px rows, plus the
// overscan.
const clientHeight = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "clientHeight",
);

beforeAll(() => {
  Object.defineProperty(Element.prototype, "clientHeight", {
    configurable: true,
    get: () => 240,
  });
  global.ResizeObserver = class ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  };
});

afterAll(() => {
  if (clientHeight) {
    Object.defineProperty(Element.prototype, "clientHeight", clientHeight);
  }
});

const columns = [{ id: "strain_name", label: "Strain Name" }];
const rows = Array.from({ length: 100 }, (_, index) => ({
  genome_id: `100.${String(index)}`,
  strain_name: `Strain ${String(index)}`,
}));

function renderTable(data: typeof rows, isLoading = false) {
  return (
    <DataTable
      id="real-virtualizer"
      data={data}
      columns={columns}
      totalItems={rows.length}
      resource="genome"
      isLoading={isLoading}
    />
  );
}

describe("DataTable with the real virtualizer", () => {
  it("renders the first window of rows when the data is there at mount", () => {
    render(renderTable(rows));

    expect(screen.getByText("Strain 0")).toBeInTheDocument();
    expect(screen.getByText("Strain 9")).toBeInTheDocument();
    // Windowed: the rows far below are not rendered.
    expect(screen.queryByText("Strain 99")).not.toBeInTheDocument();
  });

  it("renders the first window of rows when the data arrives late", () => {
    const { rerender } = render(renderTable([], true));
    expect(screen.queryByText("Strain 0")).not.toBeInTheDocument();

    rerender(renderTable(rows));

    expect(screen.getByText("Strain 0")).toBeInTheDocument();
    expect(screen.getByText("Strain 9")).toBeInTheDocument();
    expect(screen.queryByText("Strain 99")).not.toBeInTheDocument();
  });
});
