import { render, screen } from "@testing-library/react";

import type { TaxonMatch } from "@/lib/search/all-types-search";
import { SearchResultsHeader } from "../search-results-header";

const coronaviridae: TaxonMatch = {
  name: "Coronaviridae",
  taxonId: "11118",
  href: "/taxonomy/11118",
  genomes: 9_471_991,
  rank: "Family",
  parents: ["Viruses", "Riboviria"],
};

function renderHeader(bestMatch: TaxonMatch) {
  render(
    <SearchResultsHeader
      keyword="Coronaviridae"
      summary="12 results"
      bestMatch={bestMatch}
    />,
  );
}

describe("SearchResultsHeader best match", () => {
  it("shows the taxon's genome count, rank and ID", () => {
    renderHeader(coronaviridae);

    expect(
      screen.getByText("9,471,991 genomes · Family · Taxon ID 11118"),
    ).toBeInTheDocument();
  });

  it("shows a count of zero rather than leaving it out", () => {
    renderHeader({ ...coronaviridae, genomes: 0 });

    expect(
      screen.getByText("0 genomes · Family · Taxon ID 11118"),
    ).toBeInTheDocument();
  });

  it("leaves the genome figure out when the count is unavailable", () => {
    renderHeader({ ...coronaviridae, genomes: null });

    expect(screen.getByText("Family · Taxon ID 11118")).toBeInTheDocument();
    expect(screen.queryByText(/genomes/)).not.toBeInTheDocument();
  });
});
