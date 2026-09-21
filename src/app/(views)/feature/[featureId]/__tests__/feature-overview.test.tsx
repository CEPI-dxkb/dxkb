import { render, screen } from "@testing-library/react";
import { metadataLinkClassName } from "@/components/detail-panel/metadata-link";
import type { FeatureViewRecord } from "@/lib/feature-view";
import {
  emptyOverviewSectionTitles,
  overviewFieldValue,
  overviewSectionHrefs,
  overviewSectionLabels,
  overviewSectionTitles,
} from "@/test-helpers/overview";
import { FeatureOverview } from "../feature-overview";

function featureRecord(
  overrides: Partial<FeatureViewRecord> = {},
): FeatureViewRecord {
  return {
    feature_id: "PATRIC.83332.12.NC_000962.CDS.1.1524.fwd",
    ...overrides,
  };
}

describe("FeatureOverview", () => {
  it("renders its four sections in the declared order", () => {
    render(<FeatureOverview feature={featureRecord()} />);
    expect(overviewSectionTitles()).toEqual([
      "Genome and source",
      "Identifiers",
      "Location and sequence",
      "Annotation and families",
    ]);
  });

  it("keeps the hand-written field order inside a section", () => {
    render(
      <FeatureOverview
        feature={featureRecord({
          sequence_id: "NC_000962",
          accession: "NC_000962",
          start: 1,
          end: 1524,
          strand: "+",
          location: "1..1524",
          codon_start: 1,
          na_length: 1524,
          aa_length: 507,
          na_sequence_md5: "abc",
          aa_sequence_md5: "def",
        })}
      />,
    );
    expect(overviewSectionLabels("Location and sequence")).toEqual([
      "Sequence ID",
      "Accession",
      "Start",
      "End",
      "Strand",
      "Location",
      "Codon start",
      "Nucleotide length",
      "Amino acid length",
      "Nucleotide MD5",
      "Amino acid MD5",
    ]);
  });

  it("links the genome and the taxon to their exact internal destinations", () => {
    render(
      <FeatureOverview
        feature={featureRecord({
          genome_id: "83332.12",
          genome_name: "Mycobacterium tuberculosis H37Rv",
          taxon_id: 1773,
        })}
      />,
    );
    expect(overviewSectionHrefs("Genome and source")).toEqual([
      "/genome/83332.12",
      "/taxonomy/1773",
    ]);
    expect(
      screen.getByRole("link", { name: "Mycobacterium tuberculosis H37Rv" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "1773" })).toBeInTheDocument();
  });

  it("routes those destinations through the shared link boundary", () => {
    render(
      <FeatureOverview
        feature={featureRecord({ genome_id: "83332.12", taxon_id: 1773 })}
      />,
    );
    // Class identity with the boundary's own constant is the mechanism check.
    // A local `<Link className="text-primary underline">` — the code this task
    // replaced — also lacks `target` and also carries `text-primary`, so only
    // the exact shared treatment distinguishes a classified link from an
    // unclassified one.
    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("target");
      expect(link).toHaveClass(metadataLinkClassName, { exact: true });
    }
  });

  it("falls back to the genome ID as the link text when no genome name is present", () => {
    render(
      <FeatureOverview feature={featureRecord({ genome_id: "83332.12" })} />,
    );
    const link = screen.getByRole("link", { name: "83332.12" });
    expect(link).toHaveAttribute("href", "/genome/83332.12");
  });

  it("shows the taxon ID as plain text, not a link, when it is not a usable taxon ID", () => {
    render(<FeatureOverview feature={featureRecord({ taxon_id: "0" })} />);
    expect(overviewFieldValue("Genome and source", "Taxon ID")).toBe("0");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("leaves the amino acid MD5 inert — no destination is invented for it", () => {
    render(
      <FeatureOverview
        feature={featureRecord({
          na_sequence_md5: "aaaa",
          aa_sequence_md5: "bbbb",
        })}
      />,
    );
    expect(overviewFieldValue("Location and sequence", "Amino acid MD5")).toBe(
      "bbbb",
    );
    expect(overviewSectionHrefs("Location and sequence")).toEqual([]);
  });

  it("renders the date added exactly as the source supplied it", () => {
    render(
      <FeatureOverview
        feature={featureRecord({ date_inserted: "2014-11-06T00:00:00Z" })}
      />,
    );
    expect(overviewFieldValue("Annotation and families", "Date added")).toBe(
      "2014-11-06T00:00:00Z",
    );
  });

  it("joins multi-valued annotation fields rather than showing a bare array", () => {
    render(
      <FeatureOverview
        feature={featureRecord({ go: ["GO:0003677", "GO:0006355"] })}
      />,
    );
    expect(overviewFieldValue("Annotation and families", "GO terms")).toBe(
      "GO:0003677, GO:0006355",
    );
  });

  it("applies the empty-section policy to every section but the one holding the feature ID", () => {
    render(<FeatureOverview feature={featureRecord()} />);
    expect(emptyOverviewSectionTitles()).toEqual([
      "Genome and source",
      "Location and sequence",
      "Annotation and families",
    ]);
    expect(overviewSectionLabels("Identifiers")).toEqual(["Feature ID"]);
  });
});
