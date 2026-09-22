import { fireEvent, render, screen } from "@testing-library/react";
import { ProteinStructureMember } from "../protein-structure-member";

vi.mock("next/dynamic", () => ({
  default: () =>
    function Viewer({ sources }: { sources: { url: string }[] }) {
      return (
        <div data-testid="viewer">
          {sources.map((source) => source.url).join("|")}
        </div>
      );
    },
}));

describe("ProteinStructureMember", () => {
  it("initializes one viewer and switches accessions", () => {
    render(
      <ProteinStructureMember
        lookups={[
          { accession: "1ABC", metadata: null },
          { accession: "AF-P12345-F1", metadata: null },
        ]}
      />,
    );
    expect(screen.getAllByTestId("viewer")).toHaveLength(1);
    expect(screen.getByTestId("viewer")).toHaveTextContent("1ABC.cif");
    fireEvent.click(screen.getByRole("button", { name: "AF-P12345-F1" }));
    expect(screen.getAllByTestId("viewer")).toHaveLength(1);
    expect(screen.getByTestId("viewer")).toHaveTextContent(
      "alphafold.ebi.ac.uk",
    );
  });

  it("selects the first accession when route lookups change", () => {
    const { rerender } = render(
      <ProteinStructureMember
        lookups={[{ accession: "1ABC", metadata: null }]}
      />,
    );

    rerender(
      <ProteinStructureMember
        lookups={[{ accession: "2DEF", metadata: null }]}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("2DEF");
    expect(screen.getByTestId("viewer")).toHaveTextContent("2DEF.cif");
  });

  it("selects the first accession when the selected lookup is removed", () => {
    const { rerender } = render(
      <ProteinStructureMember
        lookups={[
          { accession: "1ABC", metadata: null },
          { accession: "2DEF", metadata: null },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "2DEF" }));

    rerender(
      <ProteinStructureMember
        lookups={[
          { accession: "1ABC", metadata: null },
          { accession: "3GHI", metadata: null },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("1ABC");
    expect(screen.getByTestId("viewer")).toHaveTextContent("1ABC.cif");
  });

  it("presents metadata and internal and external record links", () => {
    render(
      <ProteinStructureMember
        lookups={[
          {
            accession: "1ABC",
            metadata: {
              pdb_id: "1ABC",
              title: "Example structure",
              organism_name: ["Escherichia coli"],
              taxon_id: [562],
              genome_id: "83333.1",
              patric_id: "fig|83333.1.peg.1",
              product: ["Example protein"],
              gene: ["abc"],
              method: ["X-RAY DIFFRACTION"],
              resolution: 2.1,
              uniprotkb_accession: ["P12345"],
              pmid: [123456],
              file_path: "structures/1abc.pdb",
              release_date: "2025-01-02",
              date_inserted: "2025-01-03",
            },
          },
        ]}
      />,
    );
    const metadata = screen.getByRole("region", {
      name: "Structure metadata",
    });
    expect(metadata).toHaveTextContent("Example protein");
    expect(metadata).toHaveTextContent("BV-BRC file: structures/1abc.pdb");
    expect(metadata).toHaveTextContent("Released 2025-01-02");
    expect(metadata).toHaveTextContent("Added 2025-01-03");
    expect(screen.getByRole("link", { name: "Taxon 562" })).toHaveAttribute(
      "href",
      "/taxonomy/562",
    );
    expect(
      screen.getByRole("link", { name: "Genome 83333.1" }),
    ).toHaveAttribute("href", "/genome/83333.1");
    expect(screen.getByRole("link", { name: /Feature fig/ })).toHaveAttribute(
      "href",
      "/feature/fig%7C83333.1.peg.1",
    );
    expect(screen.getByRole("link", { name: /RCSB PDB/ })).toHaveAttribute(
      "href",
      "https://www.rcsb.org/structure/1ABC",
    );
    expect(
      screen.getByRole("link", { name: /UniProt P12345/ }),
    ).toHaveAttribute("href", "https://www.uniprot.org/uniprotkb/P12345");
    expect(screen.getByRole("link", { name: /PubMed 123456/ })).toHaveAttribute(
      "href",
      "https://pubmed.ncbi.nlm.nih.gov/123456/",
    );
  });

  it("does not link AlphaFold accessions to RCSB PDB", () => {
    render(
      <ProteinStructureMember
        lookups={[
          {
            accession: "AF-P12345-F1",
            metadata: {
              pdb_id: "AF-P12345-F1",
              title: "Predicted structure",
            },
          },
        ]}
      />,
    );

    expect(
      screen.queryByRole("link", { name: /RCSB PDB/ }),
    ).not.toBeInTheDocument();
  });

  it("renders comma-separated UniProt accessions as individual links", () => {
    const { rerender } = render(
      <ProteinStructureMember
        lookups={[
          {
            accession: "1ABC",
            metadata: {
              pdb_id: "1ABC",
              uniprotkb_accession: "P12345, Q67890",
            },
          },
        ]}
      />,
    );

    for (const accession of ["P12345", "Q67890"]) {
      expect(
        screen.getByRole("link", { name: new RegExp(`UniProt ${accession}`) }),
      ).toHaveAttribute(
        "href",
        `https://www.uniprot.org/uniprotkb/${accession}`,
      );
    }

    rerender(
      <ProteinStructureMember
        lookups={[
          {
            accession: "2DEF",
            metadata: {
              pdb_id: "2DEF",
              uniprotkb_accession: ["A0A123, A0A456"],
            },
          },
        ]}
      />,
    );

    for (const accession of ["A0A123", "A0A456"]) {
      expect(
        screen.getByRole("link", { name: new RegExp(`UniProt ${accession}`) }),
      ).toHaveAttribute(
        "href",
        `https://www.uniprot.org/uniprotkb/${accession}`,
      );
    }
  });

  it("shows metadata errors without suppressing the viewer", () => {
    render(
      <ProteinStructureMember
        lookups={[
          { accession: "1ABC", metadata: null, error: "metadata timeout" },
        ]}
      />,
    );
    expect(screen.getByText("metadata timeout")).toBeInTheDocument();
    expect(screen.getByTestId("viewer")).toHaveTextContent("1ABC.cif");
  });
});
