import { fireEvent, render, screen } from "@testing-library/react";

import { GenomeTable, ReferenceGenomesClient } from "../reference-genomes-client";

// useVirtualizer needs ResizeObserver/getBoundingClientRect, which jsdom lacks;
// the mock returns every item synchronously.
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

const genomes = [
  { genome_id: "234.1", genome_name: "Charlie strain", reference_genome: "Reference" },
  { genome_id: "234.2", genome_name: "Alpha strain", reference_genome: "Reference" },
  { genome_id: "234.3", genome_name: "Bravo strain", reference_genome: "Representative" },
  { genome_id: "234.4", genome_name: "Delta strain", reference_genome: "Representative" },
];

const empty = { rows: [], counts: {}, total: 0, hrefs: { byType: {} } };

const complete = {
  rows: genomes,
  counts: { Reference: 2, Representative: 2 },
  total: 4,
  hrefs: { byType: {} },
};

const truncated = {
  rows: genomes,
  counts: { Reference: 2, Representative: 21329 },
  total: 21331,
  hrefs: {
    all: "/genome?reference_genome=Reference,Representative",
    byType: {
      Reference: "/genome?reference_genome=Reference",
      Representative: "/genome?reference_genome=Representative",
    },
  },
};

describe("ReferenceGenomesClient", () => {
  it("keeps the empty card stretchable to the geographic map height", () => {
    render(<ReferenceGenomesClient {...empty} />);

    expect(
      screen
        .getByText("Reference & Representative Genomes")
        .closest('[data-slot="card"]'),
    ).toHaveClass("xl:flex-1");
  });

  it("renders a draggable divider and supports keyboard column resizing", () => {
    render(<ReferenceGenomesClient {...empty} />);

    const separator = screen.getByRole("separator", {
      name: "Resize Type column",
    });
    const typeColumn = document.querySelector("col");

    expect(separator).toHaveAttribute("aria-valuenow", "144");
    expect(typeColumn).toHaveClass("w-(--type-col-width)");
    expect(typeColumn).toHaveStyle("--type-col-width: 144px");
    expect(separator.parentElement).toHaveClass(
      "border-r",
      "border-foreground/20",
    );

    fireEvent.keyDown(separator, { key: "ArrowRight" });

    expect(separator).toHaveAttribute("aria-valuenow", "154");
    expect(typeColumn).toHaveStyle("--type-col-width: 154px");
  });

  it("caps the Type column width at its configured maximum", () => {
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(1_000);
    render(<ReferenceGenomesClient {...empty} />);

    const separator = screen.getByRole("separator", {
      name: "Resize Type column",
    });
    const typeColumn = document.querySelector("col");

    expect(separator).toHaveAttribute("aria-valuemax", "480");
    for (let index = 0; index < 40; index += 1) {
      fireEvent.keyDown(separator, { key: "ArrowRight" });
    }
    expect(separator).toHaveAttribute("aria-valuenow", "480");
    expect(typeColumn).toHaveStyle("--type-col-width: 480px");
    clientWidth.mockRestore();
  });

  it("renders one tab per reference type plus an All tab", () => {
    render(<ReferenceGenomesClient {...complete} />);

    expect(screen.getByRole("tab", { name: /All \(4\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Reference \(2\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Representative \(2\)/ })).toBeInTheDocument();
  });

  it("renders genome rows as same-tab links to the internal genome view", () => {
    render(<ReferenceGenomesClient {...complete} />);

    const link = screen.getByRole("link", { name: "Charlie strain" });
    expect(link).toHaveAttribute("href", "/genome/234.1");
    expect(link).not.toHaveAttribute("target");
  });

  it("sort button is accessible via aria-sort (none → ascending → descending → none)", () => {
    render(<ReferenceGenomesClient {...complete} />);

    const sortButton = screen.getAllByRole("button", { name: /Sort by genome name/ })[0];
    const sortHeader = sortButton.closest("th");
    expect(sortHeader).not.toBeNull();
    expect(sortHeader).toHaveAttribute("aria-sort", "none");

    fireEvent.click(sortButton);
    expect(sortHeader).toHaveAttribute("aria-sort", "ascending");

    fireEvent.click(sortButton);
    expect(sortHeader).toHaveAttribute("aria-sort", "descending");

    fireEvent.click(sortButton);
    expect(sortHeader).toHaveAttribute("aria-sort", "none");
  });

  it("ascending sort reorders rows alphabetically by genome name", () => {
    render(<ReferenceGenomesClient {...complete} />);

    const sortButton = screen.getAllByRole("button", { name: /Sort by genome name/ })[0];
    fireEvent.click(sortButton);

    const links = screen.getAllByRole("link");
    const orderedNames = links.slice(0, 4).map((el) => el.textContent);
    expect(orderedNames).toEqual([
      "Alpha strain",
      "Bravo strain",
      "Charlie strain",
      "Delta strain",
    ]);
  });

  it("descending sort reorders rows reverse-alphabetically", () => {
    render(<ReferenceGenomesClient {...complete} />);
    const sortButton = screen.getAllByRole("button", { name: /Sort by genome name/ })[0];
    fireEvent.click(sortButton);
    fireEvent.click(sortButton);

    const links = screen.getAllByRole("link");
    const orderedNames = links.slice(0, 4).map((el) => el.textContent);
    expect(orderedNames).toEqual([
      "Delta strain",
      "Charlie strain",
      "Bravo strain",
      "Alpha strain",
    ]);
  });

  it("renders only the types in counts", () => {
    render(
      <ReferenceGenomesClient
        rows={[genomes[0]]}
        counts={{ Reference: 1 }}
        total={1}
        hrefs={{ byType: {} }}
      />,
    );
    expect(screen.queryByRole("tab", { name: /Representative/ })).not.toBeInTheDocument();
  });

  it("shows no 'View all' link or note when every genome is inline", () => {
    render(<ReferenceGenomesClient {...complete} />);

    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    expect(screen.queryByText(/View all/)).not.toBeInTheDocument();
  });

  describe("with more genomes than were inlined", () => {
    it("formats the counts in the tabs", () => {
      render(<ReferenceGenomesClient {...truncated} />);

      expect(screen.getByRole("tab", { name: "All (21,331)" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Representative (21,329)" })).toBeInTheDocument();
    });

    it("notes the shortfall and links the All and Representative tabs", () => {
      render(<ReferenceGenomesClient {...truncated} />);

      expect(screen.getByText("Showing 4 of 21,331.")).toBeInTheDocument();
      const all = screen.getByRole("link", { name: "View all 21,331 in the Genomes tab" });
      expect(all).toHaveAttribute("href", truncated.hrefs.all);

      fireEvent.click(screen.getByRole("tab", { name: /Representative/ }));
      expect(screen.getByText("Showing 2 of 21,329.")).toBeInTheDocument();
      const representative = screen.getByRole("link", {
        name: "View all 21,329 in the Genomes tab",
      });
      expect(representative).toHaveAttribute(
        "href",
        truncated.hrefs.byType.Representative,
      );
    });

    it("leaves the complete Reference tab without a note", () => {
      render(<ReferenceGenomesClient {...truncated} />);

      fireEvent.click(screen.getByRole("tab", { name: /Reference \(2\)/ }));
      expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /View all/ })).not.toBeInTheDocument();
    });

    it("renders the note without a link when no href exists", () => {
      render(
        <ReferenceGenomesClient
          {...truncated}
          hrefs={{ byType: { Reference: undefined } }}
        />,
      );

      expect(screen.getByText("Showing 4 of 21,331.")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /View all/ })).not.toBeInTheDocument();
    });

    it("shows the Genome Name header as plain text in incomplete tabs only", () => {
      render(<ReferenceGenomesClient {...truncated} />);

      expect(screen.getByText("Genome Name").closest("th")).not.toHaveAttribute("aria-sort");
      expect(screen.queryByRole("button", { name: /Sort by genome name/ })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("tab", { name: /Reference \(2\)/ }));
      expect(screen.getByRole("button", { name: /Sort by genome name/ })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("tab", { name: /Representative/ }));
      expect(screen.queryByRole("button", { name: /Sort by genome name/ })).not.toBeInTheDocument();
    });
  });

  it("does not re-sort when re-rendered with the same genomes and direction", () => {
    const compare = vi.spyOn(String.prototype, "localeCompare");
    try {
      const { rerender } = render(<GenomeTable genomes={genomes} />);
      fireEvent.click(screen.getByRole("button", { name: /Sort by genome name/ }));
      const sorts = compare.mock.calls.length;
      expect(sorts).toBeGreaterThan(0);

      rerender(<GenomeTable genomes={genomes} />);
      expect(compare.mock.calls.length).toBe(sorts);
    } finally {
      compare.mockRestore();
    }
  });

  it("keeps a list that turns partial in server order, though it was sorted", () => {
    const { rerender } = render(<GenomeTable genomes={genomes} />);
    fireEvent.click(screen.getByRole("button", { name: /Sort by genome name/ }));

    rerender(<GenomeTable genomes={genomes} count={1000} sortable={false} />);

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Charlie strain",
      "Alpha strain",
      "Bravo strain",
      "Delta strain",
    ]);
  });

  it("renders the empty-state message when nothing is listed at all", () => {
    render(<ReferenceGenomesClient {...empty} />);
    expect(screen.getByText("No genomes in this category.")).toBeInTheDocument();
  });

  it("never says a tab with genomes is empty when none of them are inline", () => {
    render(
      <ReferenceGenomesClient
        rows={[]}
        counts={{ Reference: 5 }}
        total={5}
        hrefs={{ all: "/genome?x=1", byType: { Reference: "/genome?x=1" } }}
      />,
    );

    expect(screen.queryByText("No genomes in this category.")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 0 of 5.")).toBeInTheDocument();
  });

  it("lists every small type in full beside a huge one (Viruses shape)", () => {
    const references = Array.from({ length: 3 }, (_, i) => ({
      genome_id: `1.${String(i)}`,
      genome_name: `Ref ${String(i)}`,
      reference_genome: "Reference",
    }));
    const representatives = Array.from({ length: 2 }, (_, i) => ({
      genome_id: `2.${String(i)}`,
      genome_name: `Rep ${String(i)}`,
      reference_genome: "Representative",
    }));
    render(
      <ReferenceGenomesClient
        rows={[...references, ...representatives]}
        counts={{ Reference: 24890, Representative: 2 }}
        total={24892}
        hrefs={{
          all: "/genome?all",
          byType: { Reference: "/genome?ref", Representative: "/genome?rep" },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Representative/ }));
    expect(screen.getByRole("link", { name: "Rep 0" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rep 1" })).toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    expect(screen.queryByText(/View all/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Reference \(24,890\)/ }));
    expect(screen.getByText("Showing 3 of 24,890.")).toBeInTheDocument();
  });
});
