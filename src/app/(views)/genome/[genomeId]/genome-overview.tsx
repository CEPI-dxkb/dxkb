import { MetadataLink } from "@/components/detail-panel/metadata-link";
import {
  OverviewSection,
  formatOverviewValue,
  type OverviewSectionField,
} from "@/components/views";
import type { GenomeViewRecord } from "@/lib/genome-view";
import { genomeFeatureRql } from "@/lib/views/child-resources";
import { featureListHref } from "@/lib/views/hrefs";

/**
 * An annotation count linking to the Feature collection pre-filtered to that
 * feature type. The count is the link text, so an unavailable count omits the
 * field rather than linking the words "Not available".
 */
function featureCountField(
  genomeId: string,
  label: string,
  type: string | undefined,
  value: unknown,
): OverviewSectionField {
  return {
    label,
    value,
    className: "mt-0.5",
    children: (
      <MetadataLink
        href={featureListHref({ rql: genomeFeatureRql(genomeId, type) })}
      >
        {formatOverviewValue(value)}
      </MetadataLink>
    ),
  };
}

export function GenomeOverview({ genome }: { genome: GenomeViewRecord }) {
  const cds = genome.cds ?? genome.patric_cds;
  return (
    <div className="grid gap-4 pb-6 xl:grid-cols-2">
      <OverviewSection
        title="Assembly summary"
        fields={[
          { label: "Genome length", value: genome.genome_length },
          { label: "Contigs", value: genome.contigs },
          { label: "Chromosomes", value: genome.chromosomes },
          { label: "Plasmids", value: genome.plasmids },
          { label: "GC content", value: genome.gc_content },
          { label: "Assembly accession", value: genome.assembly_accession },
          { label: "GenBank accessions", value: genome.genbank_accessions },
        ]}
      />
      <OverviewSection
        title="Quality and status"
        fields={[
          { label: "Genome status", value: genome.genome_status },
          { label: "Genome quality", value: genome.genome_quality },
          { label: "Quality flags", value: genome.genome_quality_flags },
          { label: "CheckM completeness", value: genome.checkm_completeness },
          { label: "CheckM contamination", value: genome.checkm_contamination },
        ]}
      />
      <OverviewSection
        title="Annotation summary"
        fields={[
          featureCountField(genome.genome_id, "CDS", "CDS", cds),
          featureCountField(genome.genome_id, "tRNA", "tRNA", genome.trna),
          featureCountField(genome.genome_id, "rRNA", "rRNA", genome.rrna),
          featureCountField(
            genome.genome_id,
            "Mature peptides",
            "mat_peptide",
            genome.mat_peptide,
          ),
        ]}
      />
      <OverviewSection
        title="Isolation and host"
        fields={[
          { label: "Strain", value: genome.strain },
          { label: "Collection date", value: genome.collection_date },
          { label: "Collection year", value: genome.collection_year },
          { label: "Country", value: genome.isolation_country },
          {
            label: "Host",
            value: genome.host_common_name ?? genome.host_name,
          },
        ]}
      />
    </div>
  );
}
