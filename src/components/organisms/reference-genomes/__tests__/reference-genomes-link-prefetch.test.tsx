import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

import { ReferenceGenomesClient } from "../reference-genomes-client";

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

describe("ReferenceGenomesClient genome links", () => {
  it("do not prefetch their target on viewport entry", () => {
    render(
      <ReferenceGenomesClient
        genomes={[
          {
            genome_id: "234.1",
            genome_name: "Charlie strain",
            reference_genome: "Reference",
          },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Charlie strain" })).toHaveAttribute(
      "data-prefetch",
      "false",
    );
  });
});
