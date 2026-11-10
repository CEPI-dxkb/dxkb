import { fireEvent, render, screen } from "@testing-library/react";
import { DataTable } from "../data-table";

// The real useVirtualizer: jsdom reports clientHeight 0, so virtual-core sizes
// its window at 240px (ten 24px rows plus overscan).
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
    expect(screen.queryByText("Strain 99")).not.toBeInTheDocument();
  });

  it("renders the rows a scroll of the results region brings into view", () => {
    render(renderTable(rows));
    const region = screen.getByRole("region", { name: "genome results" });

    region.scrollTop = 90 * 24;
    fireEvent.scroll(region);

    expect(screen.getByText("Strain 99")).toBeInTheDocument();
    expect(screen.queryByText("Strain 0")).not.toBeInTheDocument();
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
