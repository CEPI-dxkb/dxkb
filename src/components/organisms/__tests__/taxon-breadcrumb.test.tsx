import { render, screen } from "@testing-library/react";

import { TaxonBreadcrumb } from "../taxon-breadcrumb";

describe("TaxonBreadcrumb", () => {
  it("falls back to the display name when taxon is null", () => {
    render(<TaxonBreadcrumb taxon={null} displayName="Brucella" />);
    expect(screen.getByRole("heading", { level: 1, name: "Brucella" })).toBeInTheDocument();
  });

  it("renders ancestor links and promotes the current taxon to <h1>", () => {
    render(
      <TaxonBreadcrumb
        displayName="Brucella"
        taxon={{
          taxonId: 234,
          taxonName: "Brucella",
          taxonRank: "genus",
          genomes: 1909,
          lineageNames: ["Bacteria", "Pseudomonadota", "Brucella"],
          lineageIds: [2, 1224, 234],
        }}
      />,
    );

    // Ancestors are links with /taxonomy/<id> hrefs
    const bacteriaLink = screen.getByRole("link", { name: "Bacteria" });
    expect(bacteriaLink).toHaveAttribute("href", "/taxonomy/2");
    expect(screen.getByRole("link", { name: "Pseudomonadota" })).toHaveAttribute(
      "href",
      "/taxonomy/1224",
    );

    // Current taxon is a visible h1
    expect(screen.getByRole("heading", { level: 1, name: "Brucella" })).toBeInTheDocument();
  });

  it("drops 'cellular organisms' from the lineage", () => {
    render(
      <TaxonBreadcrumb
        displayName="Bacteria"
        taxon={{
          taxonId: 2,
          taxonName: "Bacteria",
          taxonRank: "superkingdom",
          genomes: 1337420,
          lineageNames: ["cellular organisms", "Bacteria"],
          lineageIds: [131567, 2],
        }}
      />,
    );

    expect(screen.queryByRole("link", { name: /cellular organisms/i })).not.toBeInTheDocument();
  });

  it("renders ancestor entries without an id as plain text (no /taxonomy/0 fallback)", () => {
    render(
      <TaxonBreadcrumb
        displayName="Brucella"
        taxon={{
          taxonId: 234,
          taxonName: "Brucella",
          taxonRank: "genus",
          genomes: 99,
          // lineageIds was empty (e.g. SOLR did not return lineage_ids) — names
          // still render but should NOT link to /taxonomy/0.
          lineageNames: ["Bacteria", "Brucella"],
          lineageIds: [],
        }}
      />,
    );

    expect(screen.queryByRole("link", { name: "Bacteria" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /\/taxonomy\/0/ })).not.toBeInTheDocument();
    expect(screen.getByText("Bacteria")).toBeInTheDocument();
  });

  it("shows the genome count it is given after the heading", () => {
    render(
      <TaxonBreadcrumb
        displayName="Brucella"
        taxon={{
          taxonId: 234,
          taxonName: "Brucella",
          taxonRank: "genus",
          genomes: 1909,
          lineageNames: ["Brucella"],
          lineageIds: [234],
        }}
        genomeCount={<span>(1,500 Genomes)</span>}
      />,
    );
    expect(screen.getByText("(1,500 Genomes)")).toBeInTheDocument();
  });

  it("never shows the taxonomy record's genome count, which includes Deprecated genomes", () => {
    render(
      <TaxonBreadcrumb
        displayName="Brucella"
        taxon={{
          taxonId: 234,
          taxonName: "Brucella",
          taxonRank: "genus",
          genomes: 1909,
          lineageNames: ["Brucella"],
          lineageIds: [234],
        }}
      />,
    );
    expect(screen.queryByText(/Genomes/)).not.toBeInTheDocument();
  });
});
