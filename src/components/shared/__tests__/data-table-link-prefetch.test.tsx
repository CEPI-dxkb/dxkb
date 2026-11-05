import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { DataTable } from "../data-table";

vi.mock("next/link", () => ({
  default: ({
    prefetch,
    children,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props}>
      {children}
    </a>
  ),
}));

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

describe("DataTable internal links", () => {
  it("do not prefetch their target on viewport entry", () => {
    render(
      <DataTable
        id="prefetch-links"
        data={[{ id: "a", genome_id: "100.1" }]}
        columns={[
          { id: "genome_id", label: "Genome", valueHref: "/genome/{value}" },
        ]}
        totalItems={1}
        resource="genome"
        idField="id"
      />,
    );

    expect(screen.getByRole("link", { name: "100.1" })).toHaveAttribute(
      "data-prefetch",
      "false",
    );
  });
});
