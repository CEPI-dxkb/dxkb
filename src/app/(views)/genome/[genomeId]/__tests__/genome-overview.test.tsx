import { render, screen } from "@testing-library/react";
import { metadataLinkClassName } from "@/components/detail-panel/metadata-link";
import type { GenomeViewRecord } from "@/lib/genome-view";
import {
  emptyOverviewSectionTitles,
  overviewFieldValue,
  overviewSectionHrefs,
  overviewSectionLabels,
  overviewSectionTitles,
} from "@/test-helpers/overview";
import { GenomeOverview } from "../genome-overview";

function genomeRecord(
  overrides: Partial<GenomeViewRecord> = {},
): GenomeViewRecord {
  return { genome_id: "83332.12", ...overrides };
}

describe("GenomeOverview", () => {
  it("renders its four sections in the declared order", () => {
    render(<GenomeOverview genome={genomeRecord()} />);
    expect(overviewSectionTitles()).toEqual([
      "Assembly summary",
      "Quality and status",
      "Annotation summary",
      "Isolation and host",
    ]);
  });

  it("keeps the hand-written field order inside a section", () => {
    render(
      <GenomeOverview
        genome={genomeRecord({
          genome_length: 4411532,
          contigs: 1,
          chromosomes: 1,
          plasmids: 0,
          gc_content: 65.6,
          assembly_accession: "GCA_000195955.2",
          genbank_accessions: ["AL123456"],
        })}
      />,
    );
    // Declared order, which is neither alphabetical nor the schema's order.
    expect(overviewSectionLabels("Assembly summary")).toEqual([
      "Genome length",
      "Contigs",
      "Chromosomes",
      "Plasmids",
      "GC content",
      "Assembly accession",
      "GenBank accessions",
    ]);
  });

  it("links each annotation count to the Feature list filtered to that feature type", () => {
    render(
      <GenomeOverview
        genome={genomeRecord({
          cds: 4004,
          trna: 45,
          rrna: 3,
          mat_peptide: 7,
        })}
      />,
    );
    expect(overviewSectionLabels("Annotation summary")).toEqual([
      "CDS",
      "tRNA",
      "rRNA",
      "Mature peptides",
    ]);
    expect(overviewSectionHrefs("Annotation summary")).toEqual([
      "/feature?rql=and(eq(genome_id%2C83332.12)%2Ceq(feature_type%2CCDS))",
      "/feature?rql=and(eq(genome_id%2C83332.12)%2Ceq(feature_type%2CtRNA))",
      "/feature?rql=and(eq(genome_id%2C83332.12)%2Ceq(feature_type%2CrRNA))",
      "/feature?rql=and(eq(genome_id%2C83332.12)%2Ceq(feature_type%2Cmat_peptide))",
    ]);
    expect(screen.getByRole("link", { name: "4004" })).toBeInTheDocument();
  });

  it("routes those counts through the shared link boundary, so they stay same-origin Links", () => {
    render(<GenomeOverview genome={genomeRecord({ cds: 4004 })} />);
    const link = screen.getByRole("link", { name: "4004" });
    expect(link).not.toHaveAttribute("target");
    // Class identity with the boundary's own constant is the mechanism check.
    // A local `<Link className="text-primary underline">` — the code this task
    // replaced — also lacks `target` and also carries `text-primary`, so only
    // the exact shared treatment distinguishes a classified link from an
    // unclassified one.
    expect(link).toHaveClass(metadataLinkClassName, { exact: true });
  });

  it("omits an annotation count with no value rather than linking the words Not available", () => {
    render(<GenomeOverview genome={genomeRecord({ cds: 4004 })} />);
    expect(overviewSectionLabels("Annotation summary")).toEqual(["CDS"]);
    expect(screen.queryAllByRole("link")).toHaveLength(1);
  });

  it("falls back from cds to patric_cds for the CDS count", () => {
    render(<GenomeOverview genome={genomeRecord({ patric_cds: 3999 })} />);
    expect(overviewFieldValue("Annotation summary", "CDS")).toBe("3999");
  });

  it("prefers the host common name over the scientific host name", () => {
    render(
      <GenomeOverview
        genome={genomeRecord({
          host_common_name: "Human",
          host_name: "Homo sapiens",
        })}
      />,
    );
    expect(overviewFieldValue("Isolation and host", "Host")).toBe("Human");
  });

  it("renders the collection date exactly as the source supplied it", () => {
    render(
      <GenomeOverview
        genome={genomeRecord({
          collection_date: "2011-06-15",
          collection_year: 2011,
        })}
      />,
    );
    expect(overviewFieldValue("Isolation and host", "Collection date")).toBe(
      "2011-06-15",
    );
    expect(overviewFieldValue("Isolation and host", "Collection year")).toBe(
      "2011",
    );
  });

  it("joins multi-valued quality flags rather than showing a bare array", () => {
    render(
      <GenomeOverview
        genome={genomeRecord({
          genome_quality_flags: ["Misidentified", "Low completeness"],
        })}
      />,
    );
    expect(overviewFieldValue("Quality and status", "Quality flags")).toBe(
      "Misidentified, Low completeness",
    );
  });

  it("applies the empty-section policy to every section, given only a genome ID", () => {
    const { container } = render(<GenomeOverview genome={genomeRecord()} />);
    expect(emptyOverviewSectionTitles()).toEqual([
      "Assembly summary",
      "Quality and status",
      "Annotation summary",
      "Isolation and host",
    ]);
    expect(container.querySelectorAll("dl")).toHaveLength(0);
  });
});
