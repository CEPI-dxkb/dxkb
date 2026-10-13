import { render, screen } from "@testing-library/react";
import type { StrainViewRecord } from "@/lib/strain-view";
import {
  emptyOverviewSectionTitles,
  overviewFieldValue,
  overviewSectionHrefs,
  overviewSectionLabels,
  overviewSectionTitles,
} from "@/test-helpers/overview";
import { StrainOverview } from "../strain-overview";

function strainRecord(
  overrides: Partial<StrainViewRecord> = {},
): StrainViewRecord {
  return { id: "strain-1", ...overrides };
}

describe("StrainOverview", () => {
  it("renders its four sections in the declared order", () => {
    render(<StrainOverview strain={strainRecord()} />);
    expect(overviewSectionTitles()).toEqual([
      "Strain",
      "Taxonomy",
      "Host and isolation",
      "Segments and genomes",
    ]);
    expect(emptyOverviewSectionTitles()).toEqual([
      "Strain",
      "Taxonomy",
      "Host and isolation",
      "Segments and genomes",
    ]);
  });

  it("keeps the hand-written field order inside a section", () => {
    render(
      <StrainOverview
        strain={strainRecord({
          strain: "A/California/04/2009",
          subtype: "H1N1",
          h_type: 1,
          n_type: 1,
          segment_count: 8,
          status: "Complete",
          season: "2008-2009",
          date_inserted: "2024-01-01",
        })}
      />,
    );
    expect(overviewSectionLabels("Strain")).toEqual([
      "Strain",
      "Subtype",
      "H type",
      "N type",
      "Segment count",
      "Status",
      "Season",
      "Date added",
    ]);
  });

  it("links a recognized taxon and omits an unrecognized one", () => {
    const { unmount } = render(
      <StrainOverview
        strain={strainRecord({ species: "Influenza A virus", taxon_id: 11320 })}
      />,
    );
    expect(screen.getByRole("link", { name: "11320" })).toHaveAttribute(
      "href",
      "/taxonomy/11320",
    );
    unmount();

    render(<StrainOverview strain={strainRecord({ taxon_id: "0" })} />);
    expect(overviewSectionLabels("Taxonomy")).toEqual([]);
  });

  it("links genomes internally and every segment accession to NCBI", () => {
    render(
      <StrainOverview
        strain={strainRecord({
          genome_ids: ["641501.3", "641501.4"],
          genbank_accessions: ["FJ969513", "FJ969516"],
          "1_pb2": ["FJ969513"],
          "4_ha": ["FJ969516"],
          s: [],
        })}
      />,
    );
    expect(overviewSectionLabels("Segments and genomes")).toEqual([
      "Genomes",
      "GenBank accessions",
      "1_PB2",
      "4_HA",
    ]);
    expect(overviewSectionHrefs("Segments and genomes")).toEqual([
      "/genome/641501.3",
      "/genome/641501.4",
      "https://www.ncbi.nlm.nih.gov/nuccore/FJ969513",
      "https://www.ncbi.nlm.nih.gov/nuccore/FJ969516",
      "https://www.ncbi.nlm.nih.gov/nuccore/FJ969513",
      "https://www.ncbi.nlm.nih.gov/nuccore/FJ969516",
    ]);
    expect(overviewFieldValue("Segments and genomes", "4_HA")).toBe(
      "FJ969516",
    );
    expect(screen.getAllByRole("link", { name: "FJ969516" })[0]).toHaveAttribute(
      "target",
      "_blank",
    );
  });
});
