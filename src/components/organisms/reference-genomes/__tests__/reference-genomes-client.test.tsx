import { fireEvent, render, screen, within } from "@testing-library/react";

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
  { genome_id: "234.1", genome_name: "Charlie strain", reference_genome: "Reference", genbank_accessions: "AC0001" },
  { genome_id: "234.2", genome_name: "Alpha strain", reference_genome: "Reference", genbank_accessions: "AC0002" },
  { genome_id: "234.3", genome_name: "Bravo strain", reference_genome: "Representative", genbank_accessions: "AC0003" },
  { genome_id: "234.4", genome_name: "Delta strain", reference_genome: "Representative", genbank_accessions: "AC0004" },
];

// What the service returns for a scope with no reference genomes: both known
// types, zero-filled.
const empty = {
  rows: [],
  counts: { Reference: 0, Representative: 0 },
  total: 0,
  hrefs: { byType: {} },
};

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

  it("shows each genome's type as plain text on the All tab", () => {
    render(<ReferenceGenomesClient {...complete} />);

    const all = within(screen.getByRole("tabpanel"));
    expect(all.getByRole("columnheader", { name: "Type" })).toHaveClass(
      "border-r",
      "border-foreground/20",
    );

    const types = all.getAllByText(/^(Reference|Representative)$/);
    expect(types.map((type) => type.textContent)).toEqual([
      "Reference",
      "Reference",
      "Representative",
      "Representative",
    ]);
    for (const type of types) {
      // A solid pill reads as a button; this label must not.
      expect(type.closest('[data-slot="badge"]')).toBeNull();
      expect(type.closest("a, button")).toBeNull();
    }
  });

  it("drops the Type column on a type tab, whose trigger already names the type", () => {
    render(<ReferenceGenomesClient {...complete} />);

    fireEvent.click(screen.getByRole("tab", { name: /Reference \(2\)/ }));

    const reference = within(screen.getByRole("tabpanel"));
    expect(
      reference.queryByRole("columnheader", { name: "Type" }),
    ).not.toBeInTheDocument();
    expect(
      reference.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["Genome Name", "GenBank Accession"]);
    // Genome rows and the filler rows below them alike: a third cell would
    // overflow the table's two columns.
    const [, ...bodyRows] = reference.getAllByRole("row");
    expect(bodyRows.length).toBeGreaterThan(2);
    for (const row of bodyRows) {
      expect(within(row).getAllByRole("cell")).toHaveLength(2);
    }
    expect(reference.queryByText("Reference")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Representative \(2\)/ }));

    const representative = within(screen.getByRole("tabpanel"));
    expect(
      representative.queryByRole("columnheader", { name: "Type" }),
    ).not.toBeInTheDocument();
    expect(representative.queryByText("Representative")).not.toBeInTheDocument();
  });

  it("drops the Type column on All when only one type has genomes (Adenoviridae shape)", () => {
    render(
      <ReferenceGenomesClient
        rows={genomes.slice(0, 2)}
        counts={{ Reference: 355, Representative: 0 }}
        total={355}
        hrefs={{ byType: {} }}
      />,
    );

    const all = within(screen.getByRole("tabpanel"));
    expect(
      all.queryByRole("columnheader", { name: "Type" }),
    ).not.toBeInTheDocument();
    expect(
      all.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["Genome Name", "GenBank Accession"]);
    // Every row would repeat "Reference"; the zero-count tab already says it.
    expect(all.queryByText("Reference")).not.toBeInTheDocument();
    expect(document.querySelectorAll("col")).toHaveLength(2);
  });

  it("drops the Type column on All when only Representative has genomes", () => {
    render(
      <ReferenceGenomesClient
        rows={genomes.slice(2)}
        counts={{ Reference: 0, Representative: 2 }}
        total={2}
        hrefs={{ byType: {} }}
      />,
    );

    const all = within(screen.getByRole("tabpanel"));
    expect(
      all.queryByRole("columnheader", { name: "Type" }),
    ).not.toBeInTheDocument();
    expect(
      all.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["Genome Name", "GenBank Accession"]);
    expect(all.queryByText("Representative")).not.toBeInTheDocument();
    expect(document.querySelectorAll("col")).toHaveLength(2);
  });

  it("still shows the Type column on All when both types have genomes even if one list is partial", () => {
    render(<ReferenceGenomesClient {...truncated} />);

    const all = within(screen.getByRole("tabpanel"));
    expect(all.getByRole("columnheader", { name: "Type" })).toBeInTheDocument();
    expect(document.querySelectorAll("col")).toHaveLength(3);
  });

  it("has no Type column resize handle", () => {
    render(<ReferenceGenomesClient {...complete} />);

    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("renders one tab per reference type plus an All tab", () => {
    render(<ReferenceGenomesClient {...complete} />);

    expect(screen.getByRole("tab", { name: /All \(4\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Reference \(2\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Representative \(2\)/ })).toBeInTheDocument();
  });

  it("explains identical All and Reference counts with an empty Representative tab", () => {
    // Adenoviridae: 355 Reference genomes, no Representative one.
    render(
      <ReferenceGenomesClient
        rows={genomes.slice(0, 2)}
        counts={{ Reference: 355, Representative: 0 }}
        total={355}
        hrefs={{ byType: {} }}
      />,
    );

    expect(screen.getByRole("tab", { name: /All \(355\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Reference \(355\)/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Representative \(0\)/ }));

    expect(
      within(screen.getByRole("tabpanel")).getByText("No genomes in this category."),
    ).toBeInTheDocument();
  });

  it("lists each genome once in All, and Reference lists only Reference genomes", () => {
    render(<ReferenceGenomesClient {...complete} />);

    const all = within(screen.getByRole("tabpanel"));
    expect(all.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/genome/234.1",
      "/genome/234.2",
      "/genome/234.3",
      "/genome/234.4",
    ]);

    fireEvent.click(screen.getByRole("tab", { name: /Reference \(2\)/ }));

    const reference = within(screen.getByRole("tabpanel"));
    expect(reference.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/genome/234.1",
      "/genome/234.2",
    ]);
    expect(reference.queryByText("Representative")).not.toBeInTheDocument();
  });

  it("orders ids that differ only in digit count as strings, like the server's sort(+genome_name,+genome_id)", () => {
    const twins = [
      { genome_id: "1541205.9", genome_name: "Zhejiang2013", reference_genome: "Reference", genbank_accessions: "KF636752" },
      { genome_id: "1541205.10", genome_name: "Zhejiang2013", reference_genome: "Reference", genbank_accessions: "NC_025217" },
    ];
    render(
      <ReferenceGenomesClient
        rows={twins}
        counts={{ Reference: 2 }}
        total={2}
        hrefs={{ byType: {} }}
      />,
    );

    const all = within(screen.getByRole("tabpanel"));
    fireEvent.click(all.getByRole("button", { name: /Sort by genome name/ }));

    // "…10" before "…9", as a lexical id sort puts them; a numeric one would
    // swap them against the order the server returned.
    expect(all.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/genome/1541205.10",
      "/genome/1541205.9",
    ]);
  });

  it("orders genomes that share a name by genome id when sorting", () => {
    const twins = [
      { genome_id: "1541205.21", genome_name: "Zhejiang2013", reference_genome: "Reference", genbank_accessions: "KF636752" },
      { genome_id: "1541205.20", genome_name: "Zhejiang2013", reference_genome: "Reference", genbank_accessions: "NC_025217" },
    ];
    render(
      <ReferenceGenomesClient
        rows={twins}
        counts={{ Reference: 2 }}
        total={2}
        hrefs={{ byType: {} }}
      />,
    );

    const all = within(screen.getByRole("tabpanel"));
    fireEvent.click(all.getByRole("button", { name: /Sort by genome name/ }));

    expect(all.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/genome/1541205.20",
      "/genome/1541205.21",
    ]);
  });

  it("lists same-named genomes as separate rows keyed by genome id, each with its GenBank accession", () => {
    const twins = [
      { genome_id: "1541205.20", genome_name: "Bat Hp-betacoronavirus/Zhejiang2013", reference_genome: "Reference", genbank_accessions: "NC_025217" },
      { genome_id: "1541205.21", genome_name: "Bat Hp-betacoronavirus/Zhejiang2013", reference_genome: "Reference", genbank_accessions: "KF636752" },
    ];
    // A pass-through spy: rows keyed by name would log React's duplicate-key
    // warning ("two children with the same key"), which this asserts is absent.
    const consoleError = vi.spyOn(console, "error");
    try {
      render(
        <ReferenceGenomesClient
          rows={twins}
          counts={{ Reference: 2 }}
          total={2}
          hrefs={{ byType: {} }}
        />,
      );

      const all = within(screen.getByRole("tabpanel"));
      expect(screen.getByRole("columnheader", { name: "GenBank Accession" })).toBeInTheDocument();
      expect(all.getAllByRole("link", { name: "Bat Hp-betacoronavirus/Zhejiang2013" })).toHaveLength(2);
      expect(all.getByText("NC_025217")).toBeInTheDocument();
      expect(all.getByText("KF636752")).toBeInTheDocument();
      expect(consoleError.mock.calls.flat().join(" ")).not.toContain("same key");
    } finally {
      consoleError.mockRestore();
    }
  });

  it("tells same-named genomes apart by the GenBank accession in each name link's tooltip", () => {
    const rows = [
      { genome_id: "1541205.20", genome_name: "Zhejiang2013", reference_genome: "Reference", genbank_accessions: "NC_025217" },
      { genome_id: "1541205.21", genome_name: "Zhejiang2013", reference_genome: "Reference", genbank_accessions: "KF636752" },
      { genome_id: "234.1", genome_name: "No accession strain", reference_genome: "Reference", genbank_accessions: "" },
    ];
    render(
      <ReferenceGenomesClient
        rows={rows}
        counts={{ Reference: 3 }}
        total={3}
        hrefs={{ byType: {} }}
      />,
    );

    const [refSeq, genBank, bare] = within(screen.getByRole("tabpanel")).getAllByRole("link");
    expect(refSeq).toHaveAttribute("title", "Zhejiang2013 (NC_025217)");
    expect(genBank).toHaveAttribute("title", "Zhejiang2013 (KF636752)");
    expect(refSeq.getAttribute("title")).not.toBe(genBank.getAttribute("title"));
    expect(bare).toHaveAttribute("title", "No accession strain");
  });

  it("gives a table with the Type column three columns and spans the empty-state row across them", () => {
    render(<GenomeTable genomes={[]} count={0} />);

    expect(document.querySelectorAll("col")).toHaveLength(3);
    expect(
      screen.getByText("No genomes in this category.").closest("td"),
    ).toHaveAttribute("colspan", "3");
  });

  it("gives the All table two columns when no type has genomes, and spans the empty-state row across them", () => {
    render(<ReferenceGenomesClient {...empty} />);

    expect(document.querySelectorAll("col")).toHaveLength(2);
    expect(
      screen.getByText("No genomes in this category.").closest("td"),
    ).toHaveAttribute("colspan", "2");
  });

  it("gives a type tab's table two columns and spans its empty-state row across them", () => {
    render(<ReferenceGenomesClient {...empty} />);

    fireEvent.click(screen.getByRole("tab", { name: /Reference \(0\)/ }));

    expect(document.querySelectorAll("col")).toHaveLength(2);
    expect(
      screen.getByText("No genomes in this category.").closest("td"),
    ).toHaveAttribute("colspan", "2");
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

  it("keeps a tab for each type, each counting zero, when nothing is listed at all", () => {
    render(<ReferenceGenomesClient {...empty} />);

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "All (0)",
      "Reference (0)",
      "Representative (0)",
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
      genbank_accessions: "",
    }));
    const representatives = Array.from({ length: 2 }, (_, i) => ({
      genome_id: `2.${String(i)}`,
      genome_name: `Rep ${String(i)}`,
      reference_genome: "Representative",
      genbank_accessions: "",
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
