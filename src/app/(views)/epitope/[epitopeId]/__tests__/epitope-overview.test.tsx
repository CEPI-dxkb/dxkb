import { render, screen } from "@testing-library/react";
import { metadataLinkClassName } from "@/components/detail-panel/metadata-link";
import type { EpitopeViewRecord } from "@/lib/epitope-view";
import {
  emptyOverviewSectionTitles,
  overviewFieldValue,
  overviewSectionHrefs,
  overviewSectionLabels,
  overviewSectionTitles,
} from "@/test-helpers/overview";
import { EpitopeOverview } from "../epitope-overview";

function epitopeRecord(
  overrides: Partial<EpitopeViewRecord> = {},
): EpitopeViewRecord {
  return { epitope_id: "EPI_1", ...overrides };
}

describe("EpitopeOverview", () => {
  it("renders its four sections in the declared order", () => {
    render(<EpitopeOverview epitope={epitopeRecord()} />);
    expect(overviewSectionTitles()).toEqual([
      "Identity and sequence",
      "Organism and protein",
      "Assay summary",
      "Provenance and comments",
    ]);
  });

  it("keeps the hand-written field order inside a section", () => {
    render(
      <EpitopeOverview
        epitope={epitopeRecord({
          organism: "Influenza A virus",
          taxon_id: 11320,
          protein_name: "Hemagglutinin",
          protein_id: "P03452",
          protein_accession: "AAA43209",
          host_name: "Homo sapiens",
        })}
      />,
    );
    expect(overviewSectionLabels("Organism and protein")).toEqual([
      "Organism",
      "Taxon ID",
      "Protein name",
      "Protein ID",
      "Protein accession",
      "Host",
    ]);
  });

  it("links the taxon to its exact internal destination through the shared boundary", () => {
    render(<EpitopeOverview epitope={epitopeRecord({ taxon_id: 11320 })} />);
    expect(overviewSectionHrefs("Organism and protein")).toEqual([
      "/taxonomy/11320",
    ]);
    const link = screen.getByRole("link", { name: "11320" });
    expect(link).not.toHaveAttribute("target");
    // Class identity with the boundary's own constant is the mechanism check.
    // A local `<Link className="text-primary underline">` — the code this task
    // replaced — also lacks `target` and also carries `text-primary`, so only
    // the exact shared treatment distinguishes a classified link from an
    // unclassified one.
    expect(link).toHaveClass(metadataLinkClassName, { exact: true });
  });

  it("omits the Taxon ID field entirely when the ID is not a usable taxon ID", () => {
    render(
      <EpitopeOverview
        epitope={epitopeRecord({ organism: "Influenza A virus", taxon_id: 0 })}
      />,
    );
    expect(overviewSectionLabels("Organism and protein")).toEqual(["Organism"]);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("omits the Taxon ID field when there is no taxon ID at all", () => {
    render(
      <EpitopeOverview
        epitope={epitopeRecord({ organism: "Influenza A virus" })}
      />,
    );
    expect(overviewSectionLabels("Organism and protein")).toEqual(["Organism"]);
  });

  it("keeps a zero assay count, which is a measurement rather than an absence", () => {
    render(
      <EpitopeOverview
        epitope={epitopeRecord({ total_assays: 0, bcell_assays: 3 })}
      />,
    );
    expect(overviewSectionLabels("Assay summary")).toEqual([
      "Total assays",
      "B-cell assays",
    ]);
    expect(overviewFieldValue("Assay summary", "Total assays")).toBe("0");
  });

  it("renders the date added exactly as the source supplied it, and joins comments", () => {
    render(
      <EpitopeOverview
        epitope={epitopeRecord({
          comments: ["curated", "verified"],
          date_inserted: "2018-03-01T00:00:00Z",
        })}
      />,
    );
    expect(overviewSectionLabels("Provenance and comments")).toEqual([
      "Comments",
      "Date added",
    ]);
    expect(overviewFieldValue("Provenance and comments", "Comments")).toBe(
      "curated, verified",
    );
    expect(overviewFieldValue("Provenance and comments", "Date added")).toBe(
      "2018-03-01T00:00:00Z",
    );
  });

  it("applies the empty-section policy to every section but the one holding the epitope ID", () => {
    render(<EpitopeOverview epitope={epitopeRecord()} />);
    expect(emptyOverviewSectionTitles()).toEqual([
      "Organism and protein",
      "Assay summary",
      "Provenance and comments",
    ]);
    expect(overviewSectionLabels("Identity and sequence")).toEqual([
      "Epitope ID",
    ]);
  });
});
