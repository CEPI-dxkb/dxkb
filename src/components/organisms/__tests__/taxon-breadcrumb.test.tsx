import { render, screen } from "@testing-library/react";

import type { OrganismTaxonomy } from "@/lib/services/organisms/types";

import { TaxonBreadcrumb } from "../taxon-breadcrumb";

// Live BV-BRC lineage for E. coli K-12 (83333), 2026-10-28.
const ecoliK12: OrganismTaxonomy = {
  taxonId: 83333,
  taxonName: "Escherichia coli K-12",
  taxonRank: "strain",
  genomes: 100,
  lineageIds: [131567, 2, 3379134, 1224, 1236, 91347, 543, 561, 562, 83333],
  lineageNames: [
    "cellular organisms",
    "Bacteria",
    "Pseudomonadati",
    "Pseudomonadota",
    "Gammaproteobacteria",
    "Enterobacterales",
    "Enterobacteriaceae",
    "Escherichia",
    "Escherichia coli",
    "Escherichia coli K-12",
  ],
  lineageRanks: [
    "cellular root",
    "domain",
    "kingdom",
    "phylum",
    "class",
    "order",
    "family",
    "genus",
    "species",
    "strain",
  ],
};

function trailLinks() {
  return screen
    .getAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")]);
}

describe("TaxonBreadcrumb", () => {
  it("falls back to the display name when taxon is null", () => {
    render(<TaxonBreadcrumb taxon={null} displayName="Brucella" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Brucella" }),
    ).toBeInTheDocument();
  });

  it("shows BV-BRC's ranked ancestors and the strain as the heading", () => {
    render(<TaxonBreadcrumb taxon={ecoliK12} displayName="E. coli K-12" />);

    expect(trailLinks()).toEqual([
      ["Pseudomonadota", "/taxonomy/1224"],
      ["Gammaproteobacteria", "/taxonomy/1236"],
      ["Enterobacterales", "/taxonomy/91347"],
      ["Enterobacteriaceae", "/taxonomy/543"],
      ["Escherichia", "/taxonomy/561"],
      ["Escherichia coli", "/taxonomy/562"],
    ]);
    expect(
      screen.getByRole("heading", { level: 1, name: "Escherichia coli K-12" }),
    ).toBeInTheDocument();
  });

  it("never names the root, domain or kingdom", () => {
    render(<TaxonBreadcrumb taxon={ecoliK12} displayName="E. coli K-12" />);
    for (const name of ["cellular organisms", "Bacteria", "Pseudomonadati"]) {
      expect(screen.queryByText(name)).not.toBeInTheDocument();
    }
  });

  it("makes a whitelisted taxon its own heading without repeating it", () => {
    render(
      <TaxonBreadcrumb
        displayName="Escherichia coli"
        taxon={{
          ...ecoliK12,
          taxonId: 562,
          taxonName: "Escherichia coli",
          taxonRank: "species",
          lineageIds: ecoliK12.lineageIds.slice(0, 9),
          lineageNames: ecoliK12.lineageNames.slice(0, 9),
          lineageRanks: ecoliK12.lineageRanks?.slice(0, 9),
        }}
      />,
    );
    expect(trailLinks().at(-1)).toEqual(["Escherichia", "/taxonomy/561"]);
    expect(
      screen.getByRole("heading", { level: 1, name: "Escherichia coli" }),
    ).toBeInTheDocument();
  });

  it("shows an empty trail for a domain, as BV-BRC does, but keeps an h1", () => {
    render(
      <TaxonBreadcrumb
        // Differs from taxonName: the h1 names the taxon, not the display name.
        displayName="Bacteria landing"
        taxon={{
          taxonId: 2,
          taxonName: "Bacteria",
          taxonRank: "domain",
          genomes: 1,
          lineageIds: [131567, 2],
          lineageNames: ["cellular organisms", "Bacteria"],
          lineageRanks: ["cellular root", "domain"],
        }}
      />,
    );
    expect(screen.queryAllByRole("link")).toEqual([]);
    const heading = screen.getByRole("heading", { level: 1, name: "Bacteria" });
    expect(heading).toHaveClass("sr-only");
  });

  it("renders a rank BV-BRC repeats without a duplicate-key warning", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    render(
      <TaxonBreadcrumb
        displayName="Leaf"
        taxon={{
          taxonId: 4,
          taxonName: "Leaf",
          taxonRank: "no rank",
          genomes: 1,
          lineageIds: [1, 2, 3, 4],
          lineageNames: ["Phylum A", "Class A", "Class B", "Leaf"],
          lineageRanks: ["phylum", "class", "class", "no rank"],
        }}
      />,
    );
    expect(trailLinks()).toEqual([
      ["Phylum A", "/taxonomy/1"],
      ["Class A", "/taxonomy/2"],
      ["Class A", "/taxonomy/2"],
    ]);
    // React's dev warning: "Encountered two children with the same key…".
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("same key");
    consoleError.mockRestore();
  });

  it("shows the genome count it is given after the heading", () => {
    render(
      <TaxonBreadcrumb
        displayName="E. coli K-12"
        taxon={ecoliK12}
        genomeCount={<span>(1,500 Genomes)</span>}
      />,
    );
    expect(screen.getByText("(1,500 Genomes)")).toBeInTheDocument();
  });

  it("never shows the taxonomy record's genome count, which includes Deprecated genomes", () => {
    render(<TaxonBreadcrumb displayName="E. coli K-12" taxon={ecoliK12} />);
    expect(screen.queryByText(/Genomes/)).not.toBeInTheDocument();
  });
});
